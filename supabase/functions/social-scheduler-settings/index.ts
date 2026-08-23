// Admin-only read/write for the "Automatic Publishing" database switch
// (social_scheduler_settings.auto_publish_enabled). The table has no
// insert/update/delete RLS policy for authenticated users at all (see the
// migration) - this function is the ONLY way that value can change, and it
// uses the service role key specifically to bypass RLS after independently
// re-verifying the caller is an admin, exactly like every other privileged
// action in this codebase.
//
// This function only ever touches the DATABASE switch. The environment
// kill switch (SOCIAL_AUTO_PUBLISH_ENABLED) is read-only here - it can
// never be changed from the UI, only reported so the dashboard can show
// whether it's currently blocking publishing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decideSetAutoPublish, envKillSwitchAllowsPublishing } from "../_shared/socialSchedulerSettings.ts";

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

const env = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const token = bearerToken(req);
  const actor = await authenticateAdmin(token);
  if (!actor) return json(req, { error: "Forbidden" }, 403);

  let body: { action?: string; auto_publish_enabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }

  const envAllows = envKillSwitchAllowsPublishing();

  // service role: the only client allowed to write this table (RLS has no
  // write policy at all - see the migration).
  const serviceSb = createClient(MAIN_URL, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.action === "get") {
    const { data, error } = await serviceSb.from("social_scheduler_settings").select("id, auto_publish_enabled, timezone, updated_by, updated_at").limit(1).maybeSingle();
    if (error || !data) return json(req, { error: "Unable to load scheduler settings" }, 500);
    return json(req, { ...data, env_kill_switch_allows: envAllows });
  }

  if (body.action === "set") {
    if (typeof body.auto_publish_enabled !== "boolean") {
      return json(req, { error: "auto_publish_enabled (boolean) is required" }, 400);
    }
    const nextEnabled = body.auto_publish_enabled;

    const { data: current, error: currentError } = await serviceSb.from("social_scheduler_settings").select("id, auto_publish_enabled").limit(1).maybeSingle();
    if (currentError || !current) return json(req, { error: "Unable to load scheduler settings" }, 500);

    // actor is always admin here (authenticateAdmin already gated the
    // whole request above); isAdmin: true reflects that boundary while
    // keeping the actual enable/no-op decision in a directly testable
    // pure function.
    const decision = decideSetAutoPublish({ isAdmin: true, currentEnabled: current.auto_publish_enabled, requestedEnabled: nextEnabled });

    if (decision.action === "no_change") {
      return json(req, { ok: true, auto_publish_enabled: decision.enabled, env_kill_switch_allows: envAllows, changed: false });
    }
    if (decision.action === "forbidden") return json(req, { error: "Forbidden" }, 403); // unreachable: authenticateAdmin already gated this request

    const nowIso = new Date().toISOString();
    const { error: updateError } = await serviceSb
      .from("social_scheduler_settings")
      .update({ auto_publish_enabled: decision.enabled, updated_by: actor.id, updated_at: nowIso })
      .eq("id", current.id);
    if (updateError) return json(req, { error: "Unable to update scheduler settings" }, 500);

    await serviceSb.from("system_activity_log").insert({
      actor_profile_id: actor.id,
      actor_role: "admin",
      action: decision.enabled ? "social_auto_publish_enabled" : "social_auto_publish_disabled",
      target_type: "social_scheduler_settings",
      target_id: current.id,
      metadata: { previous_value: current.auto_publish_enabled, new_value: decision.enabled, env_kill_switch_allows: envAllows },
    });

    return json(req, { ok: true, auto_publish_enabled: decision.enabled, env_kill_switch_allows: envAllows, changed: true });
  }

  return json(req, { error: "action must be 'get' or 'set'" }, 400);
});
