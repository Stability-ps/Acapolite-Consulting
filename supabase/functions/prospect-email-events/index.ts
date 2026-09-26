// Mailtrap webhook receiver for prospect campaign email events.
//
// verify_jwt = false (Mailtrap cannot send a Supabase JWT). Requests must
// carry ?token=<PROSPECT_EMAIL_WEBHOOK_SECRET>; the function refuses to run
// if that secret is not configured. Only events for messages sent by the
// prospect campaign worker are recorded (matched by provider message id);
// everything else is ignored. Configure in Mailtrap: Sending Domains ->
// Webhooks -> URL https://<project>.supabase.co/functions/v1/prospect-email-events?token=<secret>

import { createAdminClient, jsonResponse, timingSafeEqual } from "../_shared/prospectHttp.ts";

const EVENT_MAP: Record<string, string> = {
  delivery: "delivery",
  open: "open",
  bounce: "bounce",
  reject: "reject",
  "soft bounce": "soft_bounce",
  soft_bounce: "soft_bounce",
  spam: "spam",
  unsubscribe: "unsubscribe",
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  const secret = Deno.env.get("PROSPECT_EMAIL_WEBHOOK_SECRET")?.trim();
  if (!secret) return jsonResponse(req, { error: "Webhook not configured" }, 503);
  const provided = new URL(req.url).searchParams.get("token") ?? "";
  if (!timingSafeEqual(secret, provided)) return jsonResponse(req, { error: "Forbidden" }, 403);

  const payload = await req.json().catch(() => null);
  const events: any[] = Array.isArray(payload?.events) ? payload.events : payload ? [payload] : [];
  const sb = createAdminClient();
  let recorded = 0;
  for (const event of events.slice(0, 500)) {
    const kind = EVENT_MAP[String(event?.event ?? "").toLowerCase()];
    const messageId = typeof event?.message_id === "string" ? event.message_id : null;
    if (!kind || !messageId) continue;
    const occurredAt = typeof event?.timestamp === "number" ? new Date(event.timestamp * 1000).toISOString() : new Date().toISOString();
    const detail = [event?.response, event?.reason, event?.bounce_category].filter(Boolean).join(" | ").slice(0, 500) || null;
    const { data } = await sb.rpc("record_prospect_email_event", { p_message_id: messageId, p_event: kind, p_occurred_at: occurredAt, p_detail: detail });
    if (data?.ok) recorded++;
  }
  return jsonResponse(req, { ok: true, received: events.length, recorded });
});
