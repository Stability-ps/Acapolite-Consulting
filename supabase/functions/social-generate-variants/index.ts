// Admin-triggered: generate (or regenerate) platform-safe variants for one
// or more media assets. Uses the caller's own bearer token for every query
// and storage operation, same as social-campaign-activate - RLS (admin
// only) is the actual authorization boundary here, not the service role
// key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { platformKeyForAccountPlatform, validateAssetForPlatform } from "../_shared/socialPlatformRules.ts";
import {
  chooseInstagramFeedTarget, computeContainLayout, FACEBOOK_FALLBACK_TARGET, needsManualAdjustment,
} from "../_shared/socialImageTransform.ts";
import { generateContainVariant, sha256Hex } from "../_shared/socialImageProcessor.ts";

const MAIN_URL = "https://frormnagythfpiuzgfkz.supabase.co";
const MAIN_PUBLISHABLE_KEY = "sb_publishable_MxFecwRlAUn7Z1Pa7-it6A_QDYO9rW8";
const BUCKET = "social-media-assets";
const JSON_HEADERS = { "Content-Type": "application/json" };
const PLATFORMS = ["facebook", "instagram"] as const;

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

type VariantResult = {
  media_asset_id: string;
  platform: string;
  status: "already_valid" | "generated" | "needs_manual_adjustment" | "error";
  message?: string;
  variant_id?: string;
  storage_path?: string;
  width?: number;
  height?: number;
  fill_ratio?: number;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const token = bearerToken(req);
  const actor = await authenticateAdmin(token);
  if (!actor) return json(req, { error: "Forbidden" }, 403);

  let body: { media_asset_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }
  const assetIds = Array.isArray(body.media_asset_ids) ? body.media_asset_ids : [];
  if (!assetIds.length) return json(req, { error: "media_asset_ids is required" }, 400);

  const sb = createClient(MAIN_URL, MAIN_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const results: VariantResult[] = [];

  for (const assetId of assetIds) {
    const { data: asset, error: assetError } = await sb.from("social_media_assets").select("*").eq("id", assetId).maybeSingle();
    if (assetError || !asset) {
      results.push({ media_asset_id: assetId, platform: "*", status: "error", message: "Asset not found" });
      continue;
    }

    for (const platform of PLATFORMS) {
      const platformKey = platformKeyForAccountPlatform(platform);
      const original = { mimeType: asset.mime_type, width: asset.width_px, height: asset.height_px, fileSizeBytes: asset.file_size_bytes };
      const originalValidation = validateAssetForPlatform(original, platformKey);
      if (originalValidation.valid) {
        results.push({ media_asset_id: assetId, platform, status: "already_valid" });
        continue;
      }

      const target = platform === "instagram" ? chooseInstagramFeedTarget(asset.width_px, asset.height_px) : FACEBOOK_FALLBACK_TARGET;
      const layout = computeContainLayout(asset.width_px, asset.height_px, target);
      if (needsManualAdjustment(layout)) {
        results.push({ media_asset_id: assetId, platform, status: "needs_manual_adjustment", fill_ratio: layout.fillRatio, message: "Automatic conversion would pad away more than half the frame - adjust the source image manually." });
        continue;
      }

      const { data: existingVariant } = await sb.from("social_platform_variants").select("id, storage_path").eq("media_asset_id", asset.id).eq("platform", platform).maybeSingle();

      const { data: fileBlob, error: downloadError } = await sb.storage.from(BUCKET).download(asset.storage_path);
      if (downloadError || !fileBlob) {
        results.push({ media_asset_id: assetId, platform, status: "error", message: "Unable to download the original asset" });
        continue;
      }

      let generated;
      try {
        const sourceBytes = new Uint8Array(await fileBlob.arrayBuffer());
        generated = await generateContainVariant(sourceBytes, asset.mime_type, target);
      } catch (error) {
        results.push({ media_asset_id: assetId, platform, status: "error", message: error instanceof Error ? error.message : "Image transform failed" });
        continue;
      }

      // Defense in depth: the variant was generated specifically to pass
      // this platform's rules, but re-validate before persisting it.
      const variantValidation = validateAssetForPlatform(
        { mimeType: generated.mimeType, width: generated.width, height: generated.height, fileSizeBytes: generated.bytes.byteLength },
        platformKey,
      );
      if (!variantValidation.valid) {
        results.push({ media_asset_id: assetId, platform, status: "error", message: `Generated variant still fails validation: ${variantValidation.failures.map((f) => f.message).join(" ")}` });
        continue;
      }

      const ext = generated.mimeType === "image/png" ? "png" : "jpg";
      const variantPath = `${asset.created_by || "system"}/variants/${asset.id}-${platform}-${Date.now()}.${ext}`;
      const { error: uploadError } = await sb.storage.from(BUCKET).upload(variantPath, generated.bytes, { contentType: generated.mimeType, upsert: false });
      if (uploadError) {
        results.push({ media_asset_id: assetId, platform, status: "error", message: uploadError.message });
        continue;
      }

      const checksum = await sha256Hex(generated.bytes);
      const aspectRatio = Number((generated.width / generated.height).toFixed(3));

      const { data: variantRow, error: upsertError } = await sb
        .from("social_platform_variants")
        .upsert(
          {
            media_asset_id: asset.id,
            platform,
            storage_path: variantPath,
            width_px: generated.width,
            height_px: generated.height,
            aspect_ratio: aspectRatio,
            mime_type: generated.mimeType,
            file_size_bytes: generated.bytes.byteLength,
            transformation_metadata: { ...generated.transformationMetadata, checksum_sha256: checksum },
          },
          { onConflict: "media_asset_id,platform" },
        )
        .select("id, storage_path, width_px, height_px")
        .single();

      if (upsertError || !variantRow) {
        await sb.storage.from(BUCKET).remove([variantPath]);
        results.push({ media_asset_id: assetId, platform, status: "error", message: upsertError?.message || "Unable to save the variant record" });
        continue;
      }

      // Clean up the previous variant's storage object now that the new
      // one is safely persisted, so regeneration doesn't leak files.
      if (existingVariant && existingVariant.storage_path !== variantPath) {
        await sb.storage.from(BUCKET).remove([existingVariant.storage_path]);
      }

      await sb.from("system_activity_log").insert({
        actor_profile_id: actor.id,
        actor_role: "admin",
        action: "social_variant_generated",
        target_type: "social_media_asset",
        target_id: asset.id,
        metadata: { platform, width: generated.width, height: generated.height, regenerated: Boolean(existingVariant) },
      });

      results.push({
        media_asset_id: assetId,
        platform,
        status: "generated",
        variant_id: variantRow.id,
        storage_path: variantRow.storage_path,
        width: variantRow.width_px,
        height: variantRow.height_px,
        fill_ratio: layout.fillRatio,
      });
    }
  }

  return json(req, { ok: true, results });
});
