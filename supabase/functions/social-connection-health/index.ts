// Admin-triggered token health check for every connected social_accounts
// row, using the same caller-token + RLS pattern as social-campaign-activate.
// Only reads Deno.env.get("META_ACCESS_TOKEN") server-side; the value never
// appears in the response, logs, or the database.
//
// Two things changed in the 2026-08-22 audit:
//  1. Any account whose stored provider_account_id is not a numeric Graph
//     API ID (e.g. a facebook.com/instagram.com profile URL) is resolved
//     via a discovery call to /me/accounts (Page id, name, and its linked
//     instagram_business_account) and corrected in place before the health
//     check runs - this is what requirement #5/#6 asked for.
//  2. Health is now verified by actually calling Meta for the SPECIFIC
//     account id (a direct GET on that id), not by inferring permission
//     state from the token's flat `scopes` array alone - see
//     _shared/socialConnectionHealth.ts for why that under-reported
//     Business System User "full access to specific assets" grants as
//     "permission missing" across the board.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateAccountHealth, type AssetProbeResult, type DebugTokenData } from "../_shared/socialConnectionHealth.ts";

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

type MetaPage = {
  id: string;
  name: string;
  instagram_business_account?: { id: string; username?: string };
};

async function discoverPages(version: string, token: string): Promise<{ pages: MetaPage[] } | { error: string }> {
  const url = `https://graph.facebook.com/${version}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}&limit=100`;
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { error: body?.error?.message || `Discovery request failed (${response.status})` };
  return { pages: (body?.data || []) as MetaPage[] };
}

async function probeAsset(version: string, token: string, id: string, fields: string): Promise<AssetProbeResult> {
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${id}?fields=${fields}&access_token=${encodeURIComponent(token)}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, httpStatus: response.status, body };
    return { ok: true, id: String(body.id || id) };
  } catch (error) {
    return { ok: false, httpStatus: 0, body: { error: { message: error instanceof Error ? error.message : "Network error" } } };
  }
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

  const { data: accounts, error } = await sb.from("social_accounts").select("id, platform, provider_account_id, display_name").eq("is_active", true);
  if (error) return json(req, { error: "Unable to load connected accounts" }, 500);

  // One shared debug_token call for the whole check - the token's validity
  // and granular scopes are the same regardless of how many accounts use it.
  const debugResponse = await fetch(
    `https://graph.facebook.com/${version}/debug_token?input_token=${encodeURIComponent(metaToken)}&access_token=${encodeURIComponent(metaToken)}`,
  );
  const debugBody = await debugResponse.json().catch(() => ({}));
  const debugToken: DebugTokenData = debugResponse.ok ? debugBody?.data || {} : { error: debugBody?.error || { message: `HTTP ${debugResponse.status}` } };

  // Discovery: only run the /me/accounts call if at least one account
  // actually needs it (its stored ID isn't numeric) - keeps this a no-op
  // extra request once IDs are corrected.
  const needsDiscovery = (accounts || []).some((a) => !/^[0-9]+$/.test(a.provider_account_id.trim()));
  let discoveredPages: MetaPage[] = [];
  let discoveryError: string | null = null;
  if (needsDiscovery) {
    const discovery = await discoverPages(version, metaToken);
    if ("error" in discovery) discoveryError = discovery.error;
    else discoveredPages = discovery.pages;
  }

  const results = [];
  for (const account of accounts || []) {
    let providerAccountId = account.provider_account_id.trim();
    let corrected: { from: string; to: string } | null = null;

    if (!/^[0-9]+$/.test(providerAccountId)) {
      // Attempt to resolve a numeric ID from discovery. Match by name when
      // there are multiple pages; if there's exactly one, use it directly.
      let match: MetaPage | undefined;
      if (discoveredPages.length === 1) {
        match = discoveredPages[0];
      } else if (discoveredPages.length > 1) {
        const needle = (account.display_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        match = discoveredPages.find((page) => page.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(needle) && needle.length > 0);
      }

      if (match) {
        const resolvedId = account.platform === "instagram" ? match.instagram_business_account?.id : match.id;
        if (resolvedId) {
          corrected = { from: providerAccountId, to: resolvedId };
          providerAccountId = resolvedId;
          await sb.from("social_accounts").update({ provider_account_id: resolvedId, updated_at: new Date().toISOString() }).eq("id", account.id);
        }
      }
    }

    const checkedAt = new Date().toISOString();
    let health;
    if (!/^[0-9]+$/.test(providerAccountId)) {
      health = { status: "wrong_account_id", message: discoveryError ? `Could not resolve a numeric ID automatically: ${discoveryError}` : "Could not resolve a numeric Meta ID automatically - multiple pages found and none matched by name. Connect using the numeric ID directly." };
    } else {
      const fields = account.platform === "instagram" ? "id,username" : "id,name";
      const probe = await probeAsset(version, metaToken, providerAccountId, fields);
      health = evaluateAccountHealth(account.platform === "linkedin" ? "facebook" : (account.platform as "facebook" | "instagram"), providerAccountId, debugToken, probe, Math.floor(Date.now() / 1000));
    }

    await sb.from("social_accounts").update({
      last_health_check_at: checkedAt,
      last_health_check_status: health.status,
      last_health_check_message: health.message,
      updated_at: checkedAt,
    }).eq("id", account.id);

    results.push({ account_id: account.id, platform: account.platform, provider_account_id: providerAccountId, corrected, status: health.status, message: health.message });
  }

  return json(req, {
    ok: true,
    results,
    token_scopes: debugToken.scopes || [],
    token_granular_scopes: debugToken.granular_scopes || [],
    discovered_pages: discoveredPages.map((page) => ({ id: page.id, name: page.name, instagram_business_account: page.instagram_business_account || null })),
    discovery_error: discoveryError,
  });
});
