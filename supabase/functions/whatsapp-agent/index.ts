import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };
const textHeaders = { "Content-Type": "text/plain" };
const encoder = new TextEncoder();

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyMetaSignature(req: Request, rawBody: string) {
  const appSecret = requiredEnv("WHATSAPP_APP_SECRET");
  const provided = req.headers.get("x-hub-signature-256")?.trim();
  if (!provided?.startsWith("sha256=")) return false;
  const expected = `sha256=${await hmacSha256Hex(appSecret, rawBody)}`;
  return timingSafeEqual(provided, expected);
}

type MetaMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  referral?: {
    source_type?: string;
    source_id?: string;
    source_url?: string;
    headline?: string;
    body?: string;
    ctwa_clid?: string;
  };
};

type IncomingEvent = {
  waId: string;
  messageId: string;
  text: string;
  displayName: string | null;
  referral: MetaMessage["referral"] | null;
};

function extractIncomingTextEvents(payload: unknown): IncomingEvent[] {
  const root = payload as Record<string, unknown>;
  const events: IncomingEvent[] = [];
  const entries = Array.isArray(root?.entry) ? root.entry : [];

  for (const entry of entries as Array<Record<string, unknown>>) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const rawChange of changes as Array<Record<string, unknown>>) {
      const value = rawChange?.value as Record<string, unknown> | undefined;
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      const displayNameByWaId = new Map<string, string>();

      for (const rawContact of contacts as Array<Record<string, unknown>>) {
        const profile = rawContact?.profile as Record<string, unknown> | undefined;
        const waId = String(rawContact?.wa_id || "").trim();
        const displayName = String(profile?.name || "").trim();
        if (waId && displayName) displayNameByWaId.set(waId, displayName);
      }

      const messages = Array.isArray(value?.messages) ? value.messages : [];
      for (const rawMessage of messages as MetaMessage[]) {
        if (rawMessage?.type !== "text") continue;
        const waId = String(rawMessage?.from || "").trim();
        const messageId = String(rawMessage?.id || "").trim();
        const text = String(rawMessage?.text?.body || "").trim();
        if (!waId || !messageId || !text) continue;

        events.push({
          waId,
          messageId,
          text,
          displayName: displayNameByWaId.get(waId) || null,
          referral: rawMessage?.referral || null,
        });
      }
    }
  }

  return events;
}

function wantsHuman(text: string) {
  return /\b(human|person|someone|admin|call me|phone me|speak to|talk to|real person)\b/i.test(text);
}

function normalizeForPrompt(value: string, max = 1200) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function extractResponseText(response: Record<string, unknown>) {
  const direct = typeof response?.output_text === "string" ? response.output_text.trim() : "";
  if (direct) return direct;

  const parts: string[] = [];
  const output = Array.isArray(response?.output) ? response.output : [];
  for (const rawItem of output as Array<Record<string, unknown>>) {
    if (rawItem?.type !== "message") continue;
    const content = Array.isArray(rawItem?.content) ? rawItem.content : [];
    for (const rawContent of content as Array<Record<string, unknown>>) {
      if (rawContent?.type === "output_text" && typeof rawContent?.text === "string") {
        parts.push(rawContent.text);
      }
    }
  }
  return parts.join("\n").trim();
}

async function callOpenAI(
  history: { direction: string; sender_type: string; content: string | null }[],
  latest: string,
) {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const model = requiredEnv("OPENAI_WHATSAPP_MODEL");

  const recentHistory = history
    .filter((message) => message.content)
    .slice(-8)
    .map(
      (message) =>
        `${message.direction === "inbound" ? "Customer" : "Acapolite"}: ${normalizeForPrompt(message.content || "", 500)}`,
    )
    .join("\n");

  const instructions = [
    "You are Acapolite's WhatsApp intake assistant for South Africa.",
    "Your job is to understand why the customer needs tax, SARS, CIPC, VAT, bookkeeping, accounting or compliance help and move them efficiently toward Acapolite's existing service-request process.",
    "Keep replies short: normally 1-3 sentences and at most one question at a time.",
    "Do not pretend to be a tax practitioner and do not give definitive legal or tax conclusions.",
    "Do not promise outcomes, refunds, SARS approvals, turnaround times or practitioner availability.",
    "Never ask for passwords, OTPs, eFiling credentials, bank PINs or card details.",
    "Never expose practitioner names, private client data, internal pricing rules, admin notes or platform secrets.",
    "If enough context is available, invite the customer to continue securely on Acapolite's existing service-request page instead of asking unnecessary questions.",
    "Use professional, natural South African English.",
  ].join(" ");

  const input = recentHistory
    ? `${recentHistory}\nCustomer: ${normalizeForPrompt(latest)}\nRespond as Acapolite:`
    : `Customer: ${normalizeForPrompt(latest)}\nRespond as Acapolite:`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      store: false,
      text: { verbosity: "low" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const text = extractResponseText(data);
  if (!text) throw new Error("OpenAI returned an empty response");
  return text.slice(0, 1800);
}

async function sendWhatsAppText(to: string, body: string) {
  const token = requiredEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requiredEnv("WHATSAPP_PHONE_NUMBER_ID");
  const graphVersion = requiredEnv("WHATSAPP_GRAPH_API_VERSION");

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Meta send failed (${response.status}): ${JSON.stringify(data).slice(0, 500)}`);
  }
  return String(data?.messages?.[0]?.id || "").trim() || null;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      const verifyToken = requiredEnv("WHATSAPP_VERIFY_TOKEN");

      if (mode === "subscribe" && token && timingSafeEqual(token, verifyToken) && challenge) {
        return new Response(challenge, { status: 200, headers: textHeaders });
      }
      return new Response("Forbidden", { status: 403, headers: textHeaders });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: textHeaders });
    }

    const rawBody = await req.text();
    if (!(await verifyMetaSignature(req, rawBody))) {
      return new Response("Invalid signature", { status: 401, headers: textHeaders });
    }

    const payload = JSON.parse(rawBody);
    const events = extractIncomingTextEvents(payload);
    if (events.length === 0) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const supabase = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    for (const event of events) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("meta_message_id", event.messageId)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) continue;

      const referral = event.referral || {};
      const conversationPatch: Record<string, unknown> = {
        wa_id: event.waId,
        phone_number: event.waId,
        last_inbound_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (event.displayName) conversationPatch.display_name = event.displayName;
      if (referral?.source_type) conversationPatch.referral_source = referral.source_type;
      if (referral?.source_id) conversationPatch.referral_ad_id = referral.source_id;
      if (referral?.headline) conversationPatch.referral_headline = referral.headline;
      if (referral?.ctwa_clid) conversationPatch.referral_campaign_id = referral.ctwa_clid;

      const { data: conversation, error: conversationError } = await supabase
        .from("whatsapp_conversations")
        .upsert(conversationPatch, { onConflict: "wa_id" })
        .select("id, status, ai_enabled")
        .single();
      if (conversationError) throw conversationError;

      const { error: inboundError } = await supabase.from("whatsapp_messages").insert({
        conversation_id: conversation.id,
        meta_message_id: event.messageId,
        direction: "inbound",
        sender_type: "customer",
        message_type: "text",
        content: event.text,
      });
      if (inboundError) {
        if (inboundError.code === "23505") continue;
        throw inboundError;
      }

      if (wantsHuman(event.text)) {
        const { error: handoffError } = await supabase
          .from("whatsapp_conversations")
          .update({
            status: "human_handoff",
            ai_enabled: false,
            human_handoff_requested_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);
        if (handoffError) throw handoffError;

        const handoffText =
          "Certainly. I’ve paused the automated assistant and flagged this conversation for the Acapolite admin team.";
        const metaMessageId = await sendWhatsAppText(event.waId, handoffText);
        const { error: handoffMessageError } = await supabase.from("whatsapp_messages").insert({
          conversation_id: conversation.id,
          meta_message_id: metaMessageId,
          direction: "outbound",
          sender_type: "system",
          message_type: "text",
          content: handoffText,
          delivery_status: "submitted",
        });
        if (handoffMessageError) throw handoffMessageError;
        continue;
      }

      if (!conversation.ai_enabled || conversation.status === "human_handoff") continue;

      const { data: history, error: historyError } = await supabase
        .from("whatsapp_messages")
        .select("direction, sender_type, content")
        .eq("conversation_id", conversation.id)
        .neq("meta_message_id", event.messageId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (historyError) throw historyError;

      const reply = await callOpenAI([...(history || [])].reverse(), event.text);
      const metaMessageId = await sendWhatsAppText(event.waId, reply);

      const { error: outboundError } = await supabase.from("whatsapp_messages").insert({
        conversation_id: conversation.id,
        meta_message_id: metaMessageId,
        direction: "outbound",
        sender_type: "ai",
        message_type: "text",
        content: reply,
        delivery_status: "submitted",
      });
      if (outboundError) throw outboundError;

      const { error: conversationUpdateError } = await supabase
        .from("whatsapp_conversations")
        .update({ last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", conversation.id);
      if (conversationUpdateError) throw conversationUpdateError;
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error("whatsapp-agent error", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ ok: false, error: "Webhook processing failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});