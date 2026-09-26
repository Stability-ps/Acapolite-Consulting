// Prospect campaign queue worker.
//
// campaign -> recipients -> queue (claim_prospect_campaign_recipients)
//          -> this worker -> Mailtrap (existing Acapolite email provider)
//          -> delivery log (recipient row + prospect timeline)
//
// Safety properties:
//  - nothing is sent unless prospect_campaign_settings.sending_enabled is
//    true (admin switch) and the campaign was approved/queued by a user with
//    can_send_prospect_campaigns;
//  - recipients are claimed with FOR UPDATE SKIP LOCKED and suppression is
//    re-checked at claim time, so overlapping runs, retries or timeouts
//    cannot send the same campaign to the same prospect twice;
//  - only responses that prove Mailtrap did NOT accept the email (429/5xx)
//    are retried; a network error after the request was sent is treated as
//    uncertain and is never retried automatically;
//  - daily limit and per-run batch size cap the send rate.
// "sent" means the provider accepted the message. Delivery, bounces and
// complaints are only recorded when Mailtrap reports them via webhook.

import {
  authorizeProspectCaller,
  createAdminClient,
  jsonResponse,
  preflight,
  requireEnv,
} from "../_shared/prospectHttp.ts";
import { buildCampaignEmail, isRetryableStatus, renderTemplate } from "../_shared/prospectCampaign.ts";

const MAILTRAP_URLS = {
  transactional: "https://send.api.mailtrap.io/api/send",
  bulk: "https://bulk.api.mailtrap.io/api/send",
} as const;
const RUN_BUDGET_MS = 45_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  const caller = await authorizeProspectCaller(req, "can_send_prospect_campaigns");
  if (!caller) return jsonResponse(req, { error: "Forbidden" }, 403);

  const sb = createAdminClient();
  const startedAt = Date.now();
  const { data: settings, error: settingsError } = await sb.from("prospect_campaign_settings").select("*").order("created_at").limit(1).single();
  if (settingsError) return jsonResponse(req, { ok: false, error: settingsError.message }, 500);
  if (!settings.sending_enabled) return jsonResponse(req, { ok: true, skipped: true, reason: "sending_disabled" });

  const token = requireEnv("MAILTRAP_API_TOKEN");
  const fromEmail = Deno.env.get("MAILTRAP_FROM_EMAIL")?.trim() || "noreply@acapoliteconsulting.co.za";
  const replyTo = settings.reply_to || Deno.env.get("PORTAL_SUPPORT_EMAIL")?.trim() || null;
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const endpoint = MAILTRAP_URLS[settings.mailtrap_stream as keyof typeof MAILTRAP_URLS] ?? MAILTRAP_URLS.transactional;

  const { data: claimed, error: claimError } = await sb.rpc("claim_prospect_campaign_recipients", { p_limit: settings.batch_size });
  if (claimError) return jsonResponse(req, { ok: false, error: claimError.message }, 500);

  const stats = { claimed: claimed?.length ?? 0, sent: 0, retried: 0, failed: 0, skipped: 0 };
  const campaigns = new Map<string, any>();
  const touched = new Set<string>();
  let halt = false;

  for (const recipient of claimed ?? []) {
    touched.add(recipient.campaign_id);
    if (halt || Date.now() - startedAt > RUN_BUDGET_MS) {
      // Not attempted: hand back to the queue untouched.
      await sb.from("prospect_campaign_recipients").update({ status: "queued", locked_at: null, attempt_count: Math.max(0, recipient.attempt_count - 1) }).eq("id", recipient.id).eq("status", "sending");
      continue;
    }
    if (!campaigns.has(recipient.campaign_id)) {
      const { data } = await sb.from("prospect_campaigns").select("id,name,subject,body_text,status").eq("id", recipient.campaign_id).single();
      campaigns.set(recipient.campaign_id, data);
    }
    const campaign = campaigns.get(recipient.campaign_id);
    if (!campaign || !["queued", "sending"].includes(campaign.status)) {
      await sb.from("prospect_campaign_recipients").update({ status: "queued", locked_at: null }).eq("id", recipient.id).eq("status", "sending");
      continue;
    }

    const { data: prospect } = await sb.from("prospects").select("id,company_name,contact_name,sector,city,province,status").eq("id", recipient.prospect_id).single();
    const values = { company_name: prospect?.company_name, contact_name: prospect?.contact_name, sector: prospect?.sector, city: prospect?.city, province: prospect?.province };
    const subject = renderTemplate(campaign.subject, values);
    const body = renderTemplate(campaign.body_text, values);
    const missing = [...new Set([...subject.missing, ...body.missing])];
    if (missing.length) {
      stats.skipped++;
      await sb.from("prospect_campaign_recipients").update({ status: "skipped", skip_reason: "missing_template_variable:" + missing.join(","), locked_at: null }).eq("id", recipient.id);
      continue;
    }

    const unsubscribeUrl = `${settings.unsubscribe_base_url}?token=${recipient.unsubscribe_token}`;
    const oneClickUrl = `${supabaseUrl}/functions/v1/prospect-unsubscribe?token=${recipient.unsubscribe_token}`;
    const email = buildCampaignEmail({ body: body.text, footer: settings.footer_text, unsubscribeUrl });

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: { email: fromEmail, name: settings.from_name },
          to: [{ email: recipient.email }],
          subject: subject.text,
          text: email.text,
          html: email.html,
          category: "prospect_campaign",
          headers: {
            "List-Unsubscribe": `<${oneClickUrl}>, <${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          custom_variables: { prospect_campaign_recipient_id: recipient.id, prospect_campaign_id: recipient.campaign_id },
          ...(replyTo ? { reply_to: { email: replyTo } } : {}),
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      // The request may have reached Mailtrap. Never auto-retry an uncertain send.
      stats.failed++;
      await sb.from("prospect_campaign_recipients").update({
        status: "failed", failed_at: new Date().toISOString(), locked_at: null,
        error_message: "uncertain_delivery: " + (error instanceof Error ? error.message : String(error)).slice(0, 300),
      }).eq("id", recipient.id);
      continue;
    }

    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload?.success !== false) {
      stats.sent++;
      const now = new Date().toISOString();
      const messageId = Array.isArray(payload?.message_ids) ? payload.message_ids[0] : null;
      await sb.from("prospect_campaign_recipients").update({
        status: "sent", sent_at: now, provider_message_id: messageId, locked_at: null, error_message: null,
        rendered_subject: subject.text, rendered_body_text: body.text,
      }).eq("id", recipient.id);
      await sb.from("prospect_activities").insert({
        prospect_id: recipient.prospect_id, activity_type: "campaign", direction: "outbound",
        summary: `Campaign email sent: ${campaign.name}`,
        metadata: { campaign_id: recipient.campaign_id, recipient_id: recipient.id, provider_message_id: messageId, subject: subject.text },
      });
      await sb.from("prospects").update({
        last_contacted_at: now,
        ...(prospect?.status === "new" ? { status: "contacted" } : {}),
      }).eq("id", recipient.prospect_id);
    } else if (isRetryableStatus(response.status) && recipient.attempt_count < settings.max_attempts) {
      stats.retried++;
      await sb.from("prospect_campaign_recipients").update({
        status: "queued", locked_at: null,
        next_attempt_at: new Date(Date.now() + recipient.attempt_count * 5 * 60_000).toISOString(),
        error_message: `provider HTTP ${response.status}; will retry`,
      }).eq("id", recipient.id);
    } else {
      stats.failed++;
      const errors = Array.isArray(payload?.errors) ? payload.errors.join("; ") : JSON.stringify(payload).slice(0, 300);
      await sb.from("prospect_campaign_recipients").update({
        status: "failed", failed_at: new Date().toISOString(), locked_at: null,
        error_message: `provider HTTP ${response.status}: ${errors}`.slice(0, 500),
      }).eq("id", recipient.id);
      if (response.status === 401 || response.status === 403) {
        await sb.from("prospect_campaign_settings").update({ last_error: "Mailtrap rejected the API token" }).eq("id", settings.id);
        halt = true;
      }
    }
    await sleep(250);
  }

  for (const campaignId of touched) await sb.rpc("refresh_prospect_campaign_counts", { p_campaign_id: campaignId });
  await sb.rpc("complete_prospect_campaigns");
  await sb.from("prospect_campaign_settings").update({ last_run_at: new Date().toISOString() }).eq("id", settings.id);
  return jsonResponse(req, { ok: true, ...stats });
});
