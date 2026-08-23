// Cron-triggered publish worker. Invoked every 5 minutes by pg_cron via
// pg_net (see the cron wiring migration) - never invoked with a user
// session, so authorization is a shared secret header, not a JWT.
//
// Safety properties this function guarantees:
//  - Publishing requires BOTH the SOCIAL_AUTO_PUBLISH_ENABLED env kill
//    switch AND social_scheduler_settings.auto_publish_enabled to be true
//    (see _shared/socialSchedulerSettings.ts) - either one alone blocks it.
//  - Only scheduled_posts belonging to an 'active' campaign are considered.
//  - Each row is claimed with an atomic conditional UPDATE (status='scheduled'
//    -> 'publishing'), so two concurrent invocations can never both publish
//    the same post - the loser's UPDATE affects 0 rows.
//  - Stale claims (a worker that crashed mid-publish) are reclaimable after
//    CLAIM_STALE_MINUTES so a post can never get stuck forever.
//  - The actual per-post publish logic lives in
//    _shared/socialPublishExecution.ts, shared with social-publish-now
//    (manual "Publish now") so there is exactly one place that calls Meta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claimScheduledPost, executePublish, PUBLISHABLE_POST_COLUMNS, type PublishablePost } from "../_shared/socialPublishExecution.ts";
import { computeEffectiveAutoPublish, envKillSwitchAllowsPublishing } from "../_shared/socialSchedulerSettings.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };
const BATCH_LIMIT = 20;
const CLAIM_STALE_MINUTES = 10;

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

const CANDIDATE_COLUMNS = `${PUBLISHABLE_POST_COLUMNS}, campaign:social_campaigns!inner(status)`;

async function claimDuePosts(sb: SupabaseClient, nowIso: string, staleCutoffIso: string, workerId: string): Promise<PublishablePost[]> {
  const { data: candidates, error } = await sb
    .from("social_scheduled_posts")
    .select(CANDIDATE_COLUMNS)
    .eq("status", "scheduled")
    .eq("campaign.status", "active")
    .lte("scheduled_at", nowIso)
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .limit(BATCH_LIMIT);
  if (error) throw new Error(`Unable to load due scheduled posts: ${error.message}`);

  const claimed: PublishablePost[] = [];
  for (const candidate of (candidates || []) as unknown as PublishablePost[]) {
    // Same atomic claim primitive social-publish-now uses: only succeeds if
    // the post is still 'scheduled' at UPDATE time, so this worker run and
    // a concurrent "Publish now" click can never both publish it.
    const claimResult = await claimScheduledPost(sb, candidate.id, workerId, nowIso);
    if (claimResult) claimed.push(claimResult);
  }

  // Recover posts stuck in "publishing" from a worker that crashed before
  // recording a result, once the stale window has passed.
  const { data: staleCandidates } = await sb
    .from("social_scheduled_posts")
    .select(CANDIDATE_COLUMNS)
    .eq("status", "publishing")
    .eq("campaign.status", "active")
    .lt("claimed_at", staleCutoffIso)
    .limit(BATCH_LIMIT);
  for (const candidate of (staleCandidates || []) as unknown as PublishablePost[]) {
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

    const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

    const envAllows = envKillSwitchAllowsPublishing();
    const { data: settingsRow } = await sb.from("social_scheduler_settings").select("auto_publish_enabled").limit(1).maybeSingle();
    const dbEnabled = settingsRow?.auto_publish_enabled === true;

    if (!computeEffectiveAutoPublish(envAllows, dbEnabled)) {
      return json({ ok: true, skipped: true, reason: "auto_publish_disabled" });
    }

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
      const result = await executePublish(sb, post, { triggeredBy: "system_cron" });
      if (result.status === "published") published++;
      else if (result.status === "scheduled") retried++;
      else failed++;
    }

    return json({ ok: true, processed: claimed.length, published, retried, failed });
  } catch (error) {
    console.error("social-publish-worker error", error instanceof Error ? error.message : error);
    return json({ ok: false }, 500);
  }
});
