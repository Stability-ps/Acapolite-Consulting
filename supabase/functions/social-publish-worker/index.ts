// Cron-triggered publish worker. Invoked every 5 minutes by pg_cron via
// pg_net (see the cron wiring migration) - never invoked with a user
// session, so authorization is a shared secret header, not a JWT.
//
// Safety properties this function guarantees:
//  - SOCIAL_AUTO_PUBLISH_ENABLED must be exactly "true" or nothing publishes.
//  - Only scheduled_posts belonging to an 'active' campaign are considered.
//  - Each row is claimed with an atomic conditional UPDATE (status='scheduled'
//    -> 'publishing'), so two concurrent invocations can never both publish
//    the same post - the loser's UPDATE affects 0 rows.
//  - Stale claims (a worker that crashed mid-publish) are reclaimable after
//    CLAIM_STALE_MINUTES so a post can never get stuck forever.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decideNextState, type PublishOutcome } from "../_shared/socialPublishDecision.ts";
import { PermanentPublishError, TemporaryPublishError } from "../_shared/social-providers/types.ts";
import { publishToFacebookPage } from "../_shared/social-providers/meta-facebook.ts";
import { publishToInstagramAccount } from "../_shared/social-providers/meta-instagram.ts";
import { publishToLinkedInCompanyPage } from "../_shared/social-providers/linkedin.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };
const BATCH_LIMIT = 20;
const CLAIM_STALE_MINUTES = 10;
const SIGNED_URL_SECONDS = 300;

const env = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, "Cache-Control": "no-store" } });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

type SupabaseClient = ReturnType<typeof createClient>;

type DueScheduledPost = {
  id: string;
  campaign_id: string;
  media_asset_id: string;
  platform_variant_id: string | null;
  target_platform: string;
  social_account_id: string;
  caption: string;
  hashtags: string[] | null;
  attempt_count: number;
  status: string;
};

async function dispatchToProvider(platform: string, request: { imageUrl: string; caption: string; providerAccountId: string }) {
  if (platform === "facebook") return publishToFacebookPage(request);
  if (platform === "instagram") return publishToInstagramAccount(request);
  if (platform === "linkedin") return publishToLinkedInCompanyPage(request);
  throw new PermanentPublishError("unknown_platform", `Unknown target platform: ${platform}`);
}

async function claimDuePosts(sb: SupabaseClient, nowIso: string, staleCutoffIso: string, workerId: string): Promise<DueScheduledPost[]> {
  const { data: candidates, error } = await sb
    .from("social_scheduled_posts")
    .select("id, campaign_id, media_asset_id, platform_variant_id, target_platform, social_account_id, caption, hashtags, attempt_count, status, campaign:social_campaigns!inner(status)")
    .eq("status", "scheduled")
    .eq("campaign.status", "active")
    .lte("scheduled_at", nowIso)
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .limit(BATCH_LIMIT);
  if (error) throw new Error(`Unable to load due scheduled posts: ${error.message}`);

  const claimed: DueScheduledPost[] = [];
  for (const candidate of (candidates || []) as unknown as DueScheduledPost[]) {
    const { data: claimResult } = await sb
      .from("social_scheduled_posts")
      .update({ status: "publishing", claimed_at: nowIso, claimed_by: workerId, updated_at: nowIso })
      .eq("id", candidate.id)
      .eq("status", "scheduled") // atomic guard: only succeeds if still unclaimed at UPDATE time
      .select("id")
      .maybeSingle();
    if (claimResult) claimed.push(candidate);
  }

  // Recover posts stuck in "publishing" from a worker that crashed before
  // recording a result, once the stale window has passed.
  const { data: staleCandidates } = await sb
    .from("social_scheduled_posts")
    .select("id, campaign_id, media_asset_id, platform_variant_id, target_platform, social_account_id, caption, hashtags, attempt_count, status, campaign:social_campaigns!inner(status)")
    .eq("status", "publishing")
    .eq("campaign.status", "active")
    .lt("claimed_at", staleCutoffIso)
    .limit(BATCH_LIMIT);
  for (const candidate of (staleCandidates || []) as unknown as DueScheduledPost[]) {
    const { data: reclaimResult } = await sb
      .from("social_scheduled_posts")
      .update({ claimed_at: nowIso, claimed_by: workerId, updated_at: nowIso })
      .eq("id", candidate.id)
      .eq("status", "publishing")
      .lt("claimed_at", staleCutoffIso)
      .select("id")
      .maybeSingle();
    if (reclaimResult) claimed.push(candidate);
  }

  return claimed;
}

Deno.serve(async (req: Request) => {
  try {
    const providedSecret = req.headers.get("x-cron-secret") || "";
    if (!timingSafeEqual(providedSecret, env("SOCIAL_CRON_SECRET"))) {
      return json({ error: "Forbidden" }, 403);
    }

    const autoPublishEnabled = (Deno.env.get("SOCIAL_AUTO_PUBLISH_ENABLED") || "false").trim().toLowerCase() === "true";
    if (!autoPublishEnabled) {
      return json({ ok: true, skipped: true, reason: "auto_publish_disabled" });
    }

    const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

    const now = new Date();
    const nowIso = now.toISOString();
    const staleCutoffIso = new Date(now.getTime() - CLAIM_STALE_MINUTES * 60 * 1000).toISOString();
    const workerId = crypto.randomUUID();

    const claimed = await claimDuePosts(sb, nowIso, staleCutoffIso, workerId);
    if (!claimed.length) return json({ ok: true, processed: 0 });

    let published = 0;
    let retried = 0;
    let failed = 0;

    for (const post of claimed) {
      const startedAt = new Date();
      let outcome: PublishOutcome;
      try {
        const [{ data: asset }, { data: account }] = await Promise.all([
          post.platform_variant_id
            ? sb.from("social_platform_variants").select("storage_path").eq("id", post.platform_variant_id).single()
            : sb.from("social_media_assets").select("storage_path").eq("id", post.media_asset_id).single(),
          sb.from("social_accounts").select("provider_account_id").eq("id", post.social_account_id).single(),
        ]);
        if (!asset || !account) throw new PermanentPublishError("missing_reference", "Media asset, platform variant, or social account no longer exists");

        const { data: signed, error: signError } = await sb.storage.from("social-media-assets").createSignedUrl(asset.storage_path, SIGNED_URL_SECONDS);
        if (signError || !signed?.signedUrl) throw new TemporaryPublishError("signed_url_failed", "Unable to create a signed URL for the asset");

        const hashtagText = ((post.hashtags as string[]) || []).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
        const caption = [post.caption, hashtagText].filter(Boolean).join("\n\n");

        const result = await dispatchToProvider(post.target_platform, {
          imageUrl: signed.signedUrl,
          caption,
          providerAccountId: account.provider_account_id,
        });
        outcome = { kind: "success", providerPostId: result.providerPostId, permalink: result.permalink };
      } catch (error) {
        if (error instanceof TemporaryPublishError) outcome = { kind: "temporary_failure", code: error.code, message: error.message };
        else if (error instanceof PermanentPublishError) outcome = { kind: "permanent_failure", code: error.code, message: error.message };
        else outcome = { kind: "temporary_failure", code: "unexpected_error", message: error instanceof Error ? error.message : "Unknown error" };
      }

      const finishedAt = new Date();
      const next = decideNextState({ attemptCount: post.attempt_count, status: post.status }, outcome, finishedAt);

      if (next.status === "published") {
        published++;
        await sb.from("social_scheduled_posts").update({
          status: "published",
          published_at: next.publishedAt.toISOString(),
          provider_post_id: next.providerPostId,
          provider_permalink: next.providerPermalink,
          attempt_count: next.attemptCount,
          last_attempt_at: finishedAt.toISOString(),
          next_retry_at: null,
          failure_code: null,
          failure_message: null,
          claimed_at: null,
          claimed_by: null,
          updated_at: finishedAt.toISOString(),
        }).eq("id", post.id);
      } else if (next.status === "scheduled") {
        retried++;
        await sb.from("social_scheduled_posts").update({
          status: "scheduled",
          attempt_count: next.attemptCount,
          last_attempt_at: finishedAt.toISOString(),
          next_retry_at: next.nextRetryAt.toISOString(),
          failure_code: next.failureCode,
          failure_message: next.failureMessage,
          claimed_at: null,
          claimed_by: null,
          updated_at: finishedAt.toISOString(),
        }).eq("id", post.id);
      } else {
        failed++;
        await sb.from("social_scheduled_posts").update({
          status: "failed",
          attempt_count: next.attemptCount,
          last_attempt_at: finishedAt.toISOString(),
          next_retry_at: null,
          failure_code: next.failureCode,
          failure_message: next.failureMessage,
          claimed_at: null,
          claimed_by: null,
          updated_at: finishedAt.toISOString(),
        }).eq("id", post.id);
      }

      await sb.from("social_publish_attempts").insert({
        scheduled_post_id: post.id,
        attempt_number: next.attemptCount,
        status: outcome.kind,
        error_code: outcome.kind === "success" ? null : outcome.code,
        error_message: outcome.kind === "success" ? null : outcome.message,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
      });

      await sb.from("system_activity_log").insert({
        actor_role: "admin",
        action: outcome.kind === "success" ? "social_post_published" : next.status === "failed" ? "social_post_publish_failed" : "social_post_publish_retry_scheduled",
        target_type: "social_scheduled_post",
        target_id: post.id,
        metadata: { platform: post.target_platform, campaign_id: post.campaign_id, triggered_by: "system_cron", outcome: outcome.kind, code: outcome.kind === "success" ? null : outcome.code },
      });
    }

    return json({ ok: true, processed: claimed.length, published, retried, failed });
  } catch (error) {
    console.error("social-publish-worker error", error instanceof Error ? error.message : error);
    return json({ ok: false }, 500);
  }
});
