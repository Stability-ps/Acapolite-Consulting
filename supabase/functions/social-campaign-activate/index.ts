// Admin-triggered: preview (dry-run) or activate a social media campaign's
// schedule. Uses the caller's own bearer token for every query, so
// row-level security (admin-only on every social_* table) is the actual
// authorization boundary - this function does not use the service role key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeScheduleDates, nextOccurrenceAtOrAfter } from "../_shared/socialSchedule.ts";
import { buildIdempotencyKey } from "../_shared/socialIdempotency.ts";
import { platformKeyForAccountPlatform, validateAssetForPlatform } from "../_shared/socialPlatformRules.ts";

type PlatformVariantRow = { id: string; platform: string; storage_path: string; width_px: number; height_px: number; mime_type: string; file_size_bytes: number };

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

  const roleResponse = await fetch(`${MAIN_URL}/rest/v1/rpc/get_my_role`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!roleResponse.ok || (await roleResponse.json()) !== "admin") return null;
  return { id: user.id as string };
}

type ValidationIssue = { campaign_item_id: string; platform: string; failures: unknown[] };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const token = bearerToken(req);
  const actor = await authenticateAdmin(token);
  if (!actor) return json(req, { error: "Forbidden" }, 403);

  let body: { action?: string; campaign_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }

  const action = body.action;
  const campaignId = body.campaign_id;
  if (action !== "preview" && action !== "activate" && action !== "recalculate") {
    return json(req, { error: "action must be 'preview', 'activate', or 'recalculate'" }, 400);
  }
  if (!campaignId) return json(req, { error: "campaign_id is required" }, 400);

  const sb = createClient(MAIN_URL, MAIN_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: campaign, error: campaignError } = await sb.from("social_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (campaignError) return json(req, { error: "Unable to load campaign" }, 500);
  if (!campaign) return json(req, { error: "Campaign not found" }, 404);

  if (action === "activate" && campaign.status !== "approved") {
    return json(req, { error: `Campaign must be approved before activation (current status: ${campaign.status})` }, 400);
  }

  // "Recalculate schedule" is a distinct, explicitly-opt-in action: it
  // re-spaces every not-yet-published post starting from the next occurrence
  // of the campaign's usual posting time. Ordinary per-post reschedule
  // (done directly against social_scheduled_posts from the UI) never
  // cascades into other posts - only this action does, and only when an
  // admin explicitly chooses it.
  if (action === "recalculate") {
    if (campaign.status !== "active" && campaign.status !== "paused") {
      return json(req, { error: `Only active or paused campaigns can be recalculated (current status: ${campaign.status})` }, 400);
    }

    const { data: pendingRows, error: pendingError } = await sb
      .from("social_scheduled_posts")
      .select("id, media_asset_id, target_platform, social_account_id, scheduled_at")
      .eq("campaign_id", campaignId)
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true });
    if (pendingError) return json(req, { error: "Unable to load scheduled posts" }, 500);
    if (!pendingRows?.length) return json(req, { ok: true, recalculated: 0, poster_slots: 0 });

    // Rows sharing the same scheduled_at are the same "poster slot" (one
    // poster published to several platforms at once) - group them so the
    // whole slot moves together instead of splitting across platforms.
    const groups: (typeof pendingRows)[] = [];
    const groupIndexByInstant = new Map<string, number>();
    for (const row of pendingRows) {
      const key = new Date(row.scheduled_at).toISOString();
      let index = groupIndexByInstant.get(key);
      if (index === undefined) {
        index = groups.length;
        groupIndexByInstant.set(key, index);
        groups.push([]);
      }
      groups[index].push(row);
    }

    const { data: excludedRows } = await sb.from("social_campaign_excluded_dates").select("excluded_date").eq("campaign_id", campaignId);
    const excludedDates = (excludedRows || []).map((row) => String(row.excluded_date));

    const effectiveStartAt = nextOccurrenceAtOrAfter(new Date(), new Date(campaign.start_at), campaign.timezone);
    const slots = computeScheduleDates({
      startAt: effectiveStartAt,
      timezone: campaign.timezone,
      intervalDays: campaign.interval_days,
      count: groups.length,
      excludedDates,
    });

    let updatedCount = 0;
    const nowIso = new Date().toISOString();
    for (let i = 0; i < groups.length; i++) {
      const newScheduledAt = slots[i].scheduledAt;
      for (const row of groups[i]) {
        const newKey = await buildIdempotencyKey({
          campaignId,
          mediaAssetId: row.media_asset_id,
          targetPlatform: row.target_platform,
          socialAccountId: row.social_account_id,
          scheduledAt: newScheduledAt,
        });
        const { error: updateError } = await sb
          .from("social_scheduled_posts")
          .update({ scheduled_at: newScheduledAt.toISOString(), idempotency_key: newKey, next_retry_at: null, updated_at: nowIso })
          .eq("id", row.id);
        if (!updateError) updatedCount++;
      }
    }

    await sb.from("system_activity_log").insert({
      actor_profile_id: actor.id,
      actor_role: "admin",
      action: "social_campaign_schedule_recalculated",
      target_type: "social_campaign",
      target_id: campaignId,
      metadata: { poster_slots: groups.length, posts_updated: updatedCount },
    });

    return json(req, { ok: true, recalculated: updatedCount, poster_slots: groups.length });
  }

  const { data: items, error: itemsError } = await sb
    .from("social_campaign_items")
    .select("id, position, caption_override, hashtags_override, media_asset:social_media_assets(id, mime_type, width_px, height_px, file_size_bytes, default_caption)")
    .eq("campaign_id", campaignId)
    .order("position", { ascending: true });
  if (itemsError) return json(req, { error: "Unable to load campaign posters" }, 500);
  if (!items?.length) return json(req, { error: "Campaign has no posters to schedule" }, 400);

  const { data: excludedRows } = await sb.from("social_campaign_excluded_dates").select("excluded_date").eq("campaign_id", campaignId);
  const excludedDates = (excludedRows || []).map((row) => String(row.excluded_date));

  const platforms = (campaign.target_platforms || []) as string[];
  if (!platforms.length) return json(req, { error: "Campaign has no target platforms selected" }, 400);

  const accountsByPlatform = new Map<string, { id: string; provider_account_id: string; display_name: string }>();
  for (const platform of platforms) {
    const { data: account } = await sb
      .from("social_accounts")
      .select("id, provider_account_id, display_name")
      .eq("platform", platform)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!account) return json(req, { error: `No connected, active ${platform} account. Connect one under Connections / Settings first.` }, 400);
    accountsByPlatform.set(platform, account);
  }

  const slots = computeScheduleDates({
    startAt: new Date(campaign.start_at),
    timezone: campaign.timezone,
    intervalDays: campaign.interval_days,
    count: items.length,
    excludedDates,
  });

  const mediaAssetIds = items.map((item) => (item as unknown as { media_asset: { id: string } }).media_asset.id);
  const { data: variantRows } = await sb
    .from("social_platform_variants")
    .select("id, media_asset_id, platform, storage_path, width_px, height_px, mime_type, file_size_bytes")
    .in("media_asset_id", mediaAssetIds);
  const variantsByAssetPlatform = new Map<string, PlatformVariantRow>();
  for (const variant of (variantRows || []) as (PlatformVariantRow & { media_asset_id: string })[]) {
    variantsByAssetPlatform.set(`${variant.media_asset_id}:${variant.platform}`, variant);
  }

  const rows: Record<string, unknown>[] = [];
  const validationIssues: ValidationIssue[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as unknown as {
      id: string;
      caption_override: string | null;
      hashtags_override: string[] | null;
      media_asset: { id: string; mime_type: string; width_px: number; height_px: number; file_size_bytes: number; default_caption: string | null };
    };
    const slot = slots[i];
    const asset = item.media_asset;

    for (const platform of platforms) {
      const account = accountsByPlatform.get(platform)!;
      const platformKey = platformKeyForAccountPlatform(platform);
      const originalValidation = validateAssetForPlatform(
        { mimeType: asset.mime_type, width: asset.width_px, height: asset.height_px, fileSizeBytes: asset.file_size_bytes },
        platformKey,
      );

      // The original asset is preferred whenever it already passes on its
      // own. Only fall back to a generated platform variant when it
      // doesn't - and only if that variant itself actually passes; a
      // variant existing is not itself proof it's valid (rules can change).
      let platformVariantId: string | null = null;
      let validation = originalValidation;
      if (!originalValidation.valid) {
        const variant = variantsByAssetPlatform.get(`${asset.id}:${platform}`);
        if (variant) {
          const variantValidation = validateAssetForPlatform(
            { mimeType: variant.mime_type, width: variant.width_px, height: variant.height_px, fileSizeBytes: variant.file_size_bytes },
            platformKey,
          );
          if (variantValidation.valid) {
            validation = variantValidation;
            platformVariantId = variant.id;
          }
        }
      }

      if (!validation.valid) {
        validationIssues.push({ campaign_item_id: item.id, platform, failures: validation.failures });
        continue;
      }

      const caption = item.caption_override || campaign.default_caption_template || asset.default_caption || "";
      const hashtags = item.hashtags_override || campaign.default_hashtags || [];
      const idempotencyKey = await buildIdempotencyKey({
        campaignId,
        mediaAssetId: asset.id,
        targetPlatform: platform,
        socialAccountId: account.id,
        scheduledAt: slot.scheduledAt,
      });

      rows.push({
        campaign_id: campaignId,
        campaign_item_id: item.id,
        media_asset_id: asset.id,
        platform_variant_id: platformVariantId,
        target_platform: platform,
        social_account_id: account.id,
        scheduled_at: slot.scheduledAt.toISOString(),
        local_date: slot.localDate,
        shifted_for_exclusion: slot.shiftedForExclusion,
        caption,
        hashtags,
        idempotency_key: idempotencyKey,
        status: "scheduled",
      });
    }
  }

  if (action === "preview") {
    return json(req, { ok: true, preview: true, slots: rows, validation_issues: validationIssues });
  }

  if (validationIssues.length) {
    return json(req, { error: "Some posters fail platform validation and must be fixed or removed before activation.", validation_issues: validationIssues }, 400);
  }

  const insertRows = rows.map(({ local_date: _localDate, shifted_for_exclusion: _shifted, ...row }) => row);
  const { data: inserted, error: insertError } = await sb
    .from("social_scheduled_posts")
    .upsert(insertRows, { onConflict: "idempotency_key", ignoreDuplicates: true })
    .select("id");
  if (insertError) return json(req, { error: "Unable to create scheduled posts" }, 500);

  const activatedAt = new Date().toISOString();
  const { error: activateError } = await sb
    .from("social_campaigns")
    .update({ status: "active", activated_at: activatedAt, updated_at: activatedAt })
    .eq("id", campaignId);
  if (activateError) return json(req, { error: "Scheduled posts were created, but activating the campaign failed. Retry activation." }, 500);

  await sb.from("system_activity_log").insert({
    actor_profile_id: actor.id,
    actor_role: "admin",
    action: "social_campaign_activated",
    target_type: "social_campaign",
    target_id: campaignId,
    metadata: { poster_count: items.length, platforms, scheduled_post_count: inserted?.length || 0 },
  });

  return json(req, { ok: true, activated: true, scheduled_count: inserted?.length || 0 });
});
