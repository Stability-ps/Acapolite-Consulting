// The single place that actually calls a Meta provider and records the
// result. Both social-publish-worker (cron, service-role client) and
// social-publish-now (admin-triggered "Publish now", caller's own token)
// call executePublish for exactly one post - neither duplicates Meta
// API-calling logic, and both get identical idempotency/outcome handling.
import { decideNextState, type PublishOutcome } from "./socialPublishDecision.ts";
import { PermanentPublishError, TemporaryPublishError } from "./social-providers/types.ts";
import { publishToFacebookPage } from "./social-providers/meta-facebook.ts";
import { publishToInstagramAccount } from "./social-providers/meta-instagram.ts";
import { publishToLinkedInCompanyPage } from "./social-providers/linkedin.ts";

// deno-lint-ignore no-explicit-any
export type AnySupabaseClient = any;

export const SOCIAL_ASSET_BUCKET = "social-media-assets";
const SIGNED_URL_SECONDS = 300;

export type PublishablePost = {
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

export async function dispatchToProvider(platform: string, request: { imageUrl: string; caption: string; providerAccountId: string }) {
  if (platform === "facebook") return publishToFacebookPage(request);
  if (platform === "instagram") return publishToInstagramAccount(request);
  if (platform === "linkedin") return publishToLinkedInCompanyPage(request);
  throw new PermanentPublishError("unknown_platform", `Unknown target platform: ${platform}`);
}

export const PUBLISHABLE_POST_COLUMNS = "id, campaign_id, media_asset_id, platform_variant_id, target_platform, social_account_id, caption, hashtags, attempt_count, status";

// The one atomic claim primitive both the cron worker and "Publish now"
// use: a conditional UPDATE that only succeeds if the post is STILL
// 'scheduled' at the moment it runs. Postgres's per-statement snapshot
// guarantees at most one concurrent caller's UPDATE actually matches, so
// two simultaneous callers (two admin clicks, or a click racing the
// worker) can never both come away with a claimed row - the loser gets
// null and must not publish anything.
export async function claimScheduledPost(sb: AnySupabaseClient, postId: string, claimedBy: string, nowIso: string): Promise<PublishablePost | null> {
  const { data } = await sb
    .from("social_scheduled_posts")
    .update({ status: "publishing", claimed_at: nowIso, claimed_by: claimedBy, updated_at: nowIso })
    .eq("id", postId)
    .eq("status", "scheduled")
    .select(PUBLISHABLE_POST_COLUMNS)
    .maybeSingle();
  return (data as PublishablePost) || null;
}

export type ExecutePublishOptions = {
  triggeredBy: "system_cron" | "manual_admin";
  actorProfileId?: string | null;
};

export type ExecutePublishResult = {
  outcome: PublishOutcome;
  status: "published" | "scheduled" | "failed";
};

// Runs the full publish attempt for exactly one already-claimed post:
// resolve the right image (variant if the target platform needed one),
// call the provider, decide the next state via the same retry/backoff
// rules the worker uses, then write scheduled_posts + publish_attempts +
// system_activity_log. The caller is responsible for claiming the post
// first (atomic UPDATE ... WHERE status = 'scheduled') so this function
// never has to re-derive idempotency itself.
export async function executePublish(sb: AnySupabaseClient, post: PublishablePost, options: ExecutePublishOptions): Promise<ExecutePublishResult> {
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

    const { data: signed, error: signError } = await sb.storage.from(SOCIAL_ASSET_BUCKET).createSignedUrl(asset.storage_path, SIGNED_URL_SECONDS);
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
    actor_profile_id: options.actorProfileId ?? null,
    actor_role: "admin",
    action: outcome.kind === "success" ? "social_post_published" : next.status === "failed" ? "social_post_publish_failed" : "social_post_publish_retry_scheduled",
    target_type: "social_scheduled_post",
    target_id: post.id,
    metadata: { platform: post.target_platform, campaign_id: post.campaign_id, triggered_by: options.triggeredBy, outcome: outcome.kind, code: outcome.kind === "success" ? null : outcome.code },
  });

  return { outcome, status: next.status };
}
