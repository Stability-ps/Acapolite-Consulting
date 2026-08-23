// Admin-triggered: generate (or regenerate) platform-safe variants for
// media assets. Uses the caller's own bearer token for every query and
// storage operation, same as social-campaign-activate - RLS (admin only)
// is the actual authorization boundary here, not the service role key.
//
// Strictly asset-scoped by construction: parseGenerateVariantsRequest
// rejects a multi-asset request unless it explicitly opts into bulk mode,
// and generateVariantsForAsset (see _shared/socialVariantGeneration.ts)
// processes exactly one asset id per call - there is no code path here
// that can touch a second asset's rows or storage objects from a
// single-asset request. See socialVariantGeneration.test.ts for the
// regression tests proving this.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateVariantsForAsset, parseGenerateVariantsRequest, type GenerateVariantsDeps, type MediaAssetRecord, type VariantResult } from "../_shared/socialVariantGeneration.ts";

const MAIN_URL = "https://frormnagythfpiuzgfkz.supabase.co";
const MAIN_PUBLISHABLE_KEY = "sb_publishable_MxFecwRlAUn7Z1Pa7-it6A_QDYO9rW8";
const BUCKET = "social-media-assets";
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

// deno-lint-ignore no-explicit-any
function makeDeps(sb: any, actorId: string): GenerateVariantsDeps {
  return {
    async getAsset(assetId) {
      const { data } = await sb.from("social_media_assets").select("*").eq("id", assetId).maybeSingle();
      return (data as MediaAssetRecord) || null;
    },
    async getExistingVariant(assetId, platform) {
      const { data } = await sb.from("social_platform_variants").select("id, storage_path").eq("media_asset_id", assetId).eq("platform", platform).maybeSingle();
      return data || null;
    },
    async downloadOriginal(storagePath) {
      const { data, error } = await sb.storage.from(BUCKET).download(storagePath);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
    async uploadVariant(path, bytes, contentType) {
      const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
      return { error: error?.message || null };
    },
    async upsertVariant(row) {
      const { data, error } = await sb
        .from("social_platform_variants")
        .upsert(row, { onConflict: "media_asset_id,platform" })
        .select("id, storage_path, width_px, height_px")
        .single();
      if (error || !data) return { error: error?.message || "Unable to save the variant record" };
      return data;
    },
    async removeObjects(paths) {
      if (paths.length) await sb.storage.from(BUCKET).remove(paths);
    },
    async logActivity(action, targetId, metadata) {
      await sb.from("system_activity_log").insert({
        actor_profile_id: actorId,
        actor_role: "admin",
        action,
        target_type: "social_media_asset",
        target_id: targetId,
        metadata,
      });
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const token = bearerToken(req);
  const actor = await authenticateAdmin(token);
  if (!actor) return json(req, { error: "Forbidden" }, 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }

  const parsed = parseGenerateVariantsRequest(body);
  if ("error" in parsed) return json(req, { error: parsed.error }, 400);

  const sb = createClient(MAIN_URL, MAIN_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const deps = makeDeps(sb, actor.id);

  const results: VariantResult[] = [];
  for (const assetId of parsed.assetIds) {
    results.push(...(await generateVariantsForAsset(deps, assetId)));
  }

  return json(req, { ok: true, bulk: parsed.bulk, asset_count: parsed.assetIds.length, results });
});
