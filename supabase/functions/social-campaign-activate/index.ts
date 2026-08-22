// Admin-triggered: preview (dry-run) or activate a social media campaign's
// schedule. Uses the caller's own bearer token for every query, so
// row-level security (admin-only on every social_* table) is the actual
// authorization boundary - this function does not use the service role key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeScheduleDates } from "../_shared/socialSchedule.ts";
import { buildIdempotencyKey } from "../_shared/socialIdempotency.ts";
import { platformKeyForAccountPlatform, validateAssetForPlatform } from "../_shared/socialPlatformRules.ts";

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
  if (action !== "preview" && action !== "activate") return json(req, { error: "action must be 'preview' or 'activate'" }, 400);
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
      const validation = validateAssetForPlatform(
        { mimeType: asset.mime_type, width: asset.width_px, height: asset.height_px, fileSizeBytes: asset.file_size_bytes },
        platformKeyForAccountPlatform(platform),
      );
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
