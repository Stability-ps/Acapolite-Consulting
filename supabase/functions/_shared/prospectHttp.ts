// Shared HTTP + authorisation helpers for Prospect Hub edge functions.
//
// These functions are deployed with verify_jwt = false because pg_cron calls
// them with a shared secret instead of a user JWT. Every request must
// therefore pass one of two explicit checks inside the function:
//   1. a valid x-cron-secret header (timing-safe comparison), or
//   2. a signed-in user whose JWT satisfies the named Prospect Hub
//      permission function (evaluated in Postgres with the caller's JWT, so
//      the same rules as RLS apply).

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ProspectPermission =
  | "can_view_prospect_hub"
  | "can_manage_prospect_hub"
  | "can_send_prospect_campaigns";

export function buildCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

export function jsonResponse(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: buildCorsHeaders(request) });
}

export function preflight(request: Request) {
  return new Response("ok", { headers: buildCorsHeaders(request) });
}

export function requireEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

export function adminKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("Missing Supabase admin key");
  return JSON.parse(raw).default;
}

export function anonKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) throw new Error("Missing Supabase anon key");
  return JSON.parse(raw).default;
}

export function createAdminClient(): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), adminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function timingSafeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function isCronRequest(request: Request) {
  const expected = (Deno.env.get("PROSPECT_SYNC_CRON_SECRET") || Deno.env.get("SOCIAL_CRON_SECRET") || "").trim();
  const provided = request.headers.get("x-cron-secret") || "";
  return timingSafeEqual(expected, provided);
}

export type Caller =
  | { kind: "cron"; userId: null }
  | { kind: "user"; userId: string; userClient: SupabaseClient };

/**
 * Resolves the caller as cron or an authorised user. Returns null when the
 * request is neither (the function must then respond 401/403).
 */
export async function authorizeProspectCaller(
  request: Request,
  permission: ProspectPermission,
): Promise<Caller | null> {
  if (isCronRequest(request)) return { kind: "cron", userId: null };
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const userClient = createClient(requireEnv("SUPABASE_URL"), anonKey(), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;
  const { data: allowed, error: permissionError } = await userClient.rpc(permission);
  if (permissionError || allowed !== true) return null;
  return { kind: "user", userId: user.id, userClient };
}
