// Admin-triggered: publish exactly ONE scheduled post immediately, bypassing
// the automatic-publish switches (both are explicit-admin-action bypasses -
// this exists specifically so an admin can test Facebook/Instagram
// publishing before flipping automatic publishing on). Uses the caller's
// own bearer token for every query, same as social-campaign-activate - RLS
// (admin only) is the actual authorization boundary here, not the service
// role key.
//
// Safety properties:
//  - Scoped to exactly one scheduled_post_id per request - there is no
//    "publish all due posts" code path here at all.
//  - Claims the post with the SAME atomic conditional UPDATE
//    (status='scheduled' -> 'publishing') the worker uses, so two
//    concurrent "Publish now" clicks - or a click racing the cron worker -
//    can never both publish the same post. The loser's UPDATE affects 0
//    rows and gets a 409, never a duplicate Meta post.
//  - Delegates the actual Meta call and outcome/DB bookkeeping to
//    _shared/socialPublishExecution.ts, the exact same code the worker
//    uses - no separate Meta-calling logic.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claimScheduledPost, executePublish, PUBLISHABLE_POST_COLUMNS } from "../_shared/socialPublishExecution.ts";

const MAIN_URL = "https://frormnagythfpiuzgfkz.supabase.co";
const MAIN_PUBLISHABLE_KEY = "sb_publishable_MxFecwRlAUn7Z1Pa7-it6A_QDYO9rW8";
const JSON_HEADERS = { "Content-Type": "application/json" };

function corsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), ...JSON_HEADERS, "Cache-Control": "no-store" } });
}

function bearerToken(req: Request) {
  return (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || "";
}

function mainHeaders(token: string) {
  return { apikey: MAIN_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
}

async function authenticateAdmin(token: string) {
  if (!token) return null;
  const headers = mainHeaders(token);
  const userResponse = await fetch(`${MAIN_URL}/auth/v1/user`, { headers });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  const roleResponse = await fetch(`${MAIN_URL}/rest/v1/rpc/get_my_role`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" });
  if (!roleResponse.ok || (await roleResponse.json()) !== "admin") return null;
  return { id: user.id as string };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const token = bearerToken(req);
  const actor = await authenticateAdmin(token);
  if (!actor) return json(req, { error: "Forbidden" }, 403);

  let body: { scheduled_post_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }

  const scheduledPostId = body.scheduled_post_id;
  if (typeof scheduledPostId !== "string" || !scheduledPostId) {
    return json(req, { error: "scheduled_post_id is required" }, 400);
  }

  const sb = createClient(MAIN_URL, MAIN_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: existing, error: fetchError } = await sb.from("social_scheduled_posts").select(PUBLISHABLE_POST_COLUMNS).eq("id", scheduledPostId).maybeSingle();
  if (fetchError) return json(req, { error: "Unable to load the scheduled post" }, 500);
  if (!existing) return json(req, { error: "Scheduled post not found" }, 404);
  if (existing.status !== "scheduled") {
    return json(req, {
      error: existing.status === "published"
        ? "This post has already been published and cannot be published again."
        : `This post is not in a publishable state (current status: ${existing.status}).`,
    }, 409);
  }

  const nowIso = new Date().toISOString();
  const claimId = `manual:${actor.id}:${crypto.randomUUID()}`;
  // The atomic claim: only succeeds if the post is STILL 'scheduled' at
  // UPDATE time. A concurrent second click (or the cron worker, if
  // automatic publishing were on) racing this exact moment gets null back
  // here and a 409 below - never a second Meta publish.
  const claimed = await claimScheduledPost(sb, scheduledPostId, claimId, nowIso);
  if (!claimed) {
    return json(req, { error: "This post was just claimed by another request (a concurrent click, or the scheduler). It was not published twice." }, 409);
  }

  const result = await executePublish(sb, claimed, { triggeredBy: "manual_admin", actorProfileId: actor.id });

  const { data: finalRow } = await sb
    .from("social_scheduled_posts")
    .select("id, status, provider_post_id, provider_permalink, published_at, failure_code, failure_message, next_retry_at")
    .eq("id", scheduledPostId)
    .maybeSingle();

  return json(req, {
    ok: result.outcome.kind === "success",
    outcome: result.outcome.kind,
    status: result.status,
    post: finalRow,
  });
});
