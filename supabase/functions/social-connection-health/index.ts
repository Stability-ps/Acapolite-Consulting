// Admin-triggered token health check for every connected social_accounts
// row, using the same caller-token + RLS pattern as social-campaign-activate.
// Only reads Deno.env.get("META_ACCESS_TOKEN") server-side; the value never
// appears in the response, logs, or the database.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateTokenHealth } from "../_shared/socialConnectionHealth.ts";

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
  const roleResponse = await fetch(`${MAIN_URL}/rest/v1/rpc/get_my_role`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" });
  if (!roleResponse.ok || (await roleResponse.json()) !== "admin") return null;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const token = bearerToken(req);
  const isAdmin = await authenticateAdmin(token);
  if (!isAdmin) return json(req, { error: "Forbidden" }, 403);

  const version = Deno.env.get("META_GRAPH_API_VERSION")?.trim();
  const metaToken = Deno.env.get("META_ACCESS_TOKEN")?.trim();
  if (!version || !metaToken) {
    return json(req, { error: "META_ACCESS_TOKEN or META_GRAPH_API_VERSION is not configured yet" }, 400);
  }

  const sb = createClient(MAIN_URL, MAIN_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: accounts, error } = await sb.from("social_accounts").select("id, platform").eq("is_active", true);
  if (error) return json(req, { error: "Unable to load connected accounts" }, 500);

  const results = [];
  for (const account of accounts || []) {
    const checkedAt = new Date().toISOString();
    let status: string;
    let message: string;
    try {
      const response = await fetch(
        `https://graph.facebook.com/${version}/debug_token?input_token=${encodeURIComponent(metaToken)}&access_token=${encodeURIComponent(metaToken)}`,
      );
      const body = await response.json().catch(() => ({}));
      const data = response.ok ? body?.data || {} : { error: body?.error || { message: `HTTP ${response.status}` } };
      const platform = account.platform === "linkedin" ? "facebook" : (account.platform as "facebook" | "instagram");
      const result = evaluateTokenHealth(platform, data, Math.floor(Date.now() / 1000));
      status = result.status;
      message = result.message;
    } catch (fetchError) {
      status = "unavailable";
      message = fetchError instanceof Error ? fetchError.message : "Network error contacting Meta";
    }

    await sb.from("social_accounts").update({
      last_health_check_at: checkedAt,
      last_health_check_status: status,
      last_health_check_message: message,
      updated_at: checkedAt,
    }).eq("id", account.id);

    results.push({ account_id: account.id, platform: account.platform, status, message });
  }

  return json(req, { ok: true, results });
});
