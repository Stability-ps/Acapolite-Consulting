import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };
const textHeaders = { "Content-Type": "text/plain" };
const encoder = new TextEncoder();
const MAX_MEDIA_BYTES = 12 * 1024 * 1024;

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
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyMetaSignature(req: Request, rawBody: string) {
  const provided = req.headers.get("x-hub-signature-256")?.trim();
  if (!provided?.startsWith("sha256=")) return false;
  const expected = `sha256=${await hmacSha256Hex(requiredEnv("WHATSAPP_APP_SECRET"), rawBody)}`;
  return timingSafeEqual(provided, expected);
}

type MetaMedia = { id?: string; mime_type?: string; sha256?: string; caption?: string; filename?: string };
type MetaMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  image?: MetaMedia;
  document?: MetaMedia;
  referral?: { source_type?: string; source_id?: string; source_url?: string; headline?: string; body?: string; ctwa_clid?: string };
};

type IncomingEvent = {
  waId: string;
  messageId: string;
  kind: "text" | "image" | "document" | "unsupported";
  text: string;
  displayName: string | null;
  referral: MetaMessage["referral"] | null;
  mediaId: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  mediaSha256: string | null;
};

function extractIncomingEvents(payload: unknown): IncomingEvent[] {
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
        const waId = String(rawMessage?.from || "").trim();
        const messageId = String(rawMessage?.id || "").trim();
        if (!waId || !messageId) continue;

        let kind: IncomingEvent["kind"] = "unsupported";
        let text = "";
        let media: MetaMedia | undefined;
        if (rawMessage.type === "text") {
          kind = "text";
          text = String(rawMessage.text?.body || "").trim();
          if (!text) continue;
        } else if (rawMessage.type === "image") {
          kind = "image";
          media = rawMessage.image;
          text = String(media?.caption || "").trim();
        } else if (rawMessage.type === "document") {
          kind = "document";
          media = rawMessage.document;
          text = String(media?.caption || "").trim();
        }

        events.push({
          waId,
          messageId,
          kind,
          text,
          displayName: displayNameByWaId.get(waId) || null,
          referral: rawMessage.referral || null,
          mediaId: media?.id?.trim() || null,
          mediaMimeType: media?.mime_type?.trim() || null,
          mediaFilename: media?.filename?.trim() || null,
          mediaSha256: media?.sha256?.trim() || null,
        });
      }
    }
  }
  return events;
}

function wantsHuman(text: string) {
  return /\b(human|person|someone|admin|call me|phone me|speak to|talk to|real person)\b/i.test(text);
}

function normalizeForPrompt(value: string, max = 1500) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function downloadMetaMedia(mediaId: string) {
  const token = requiredEnv("WHATSAPP_ACCESS_TOKEN");
  const graphVersion = requiredEnv("WHATSAPP_GRAPH_API_VERSION");
  const meta = await fetch(`https://graph.facebook.com/${graphVersion}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  const metadata = await meta.json().catch(() => ({}));
  if (!meta.ok || !metadata?.url) throw new Error(`Meta media lookup failed (${meta.status})`);
  if (Number(metadata.file_size || 0) > MAX_MEDIA_BYTES) throw new Error("Attachment exceeds Acapolite test size limit");

  const mediaResponse = await fetch(String(metadata.url), { headers: { Authorization: `Bearer ${token}` } });
  if (!mediaResponse.ok) throw new Error(`Meta media download failed (${mediaResponse.status})`);
  const bytes = new Uint8Array(await mediaResponse.arrayBuffer());
  if (bytes.byteLength > MAX_MEDIA_BYTES) throw new Error("Attachment exceeds Acapolite test size limit");

  return {
    bytes,
    mimeType: String(metadata.mime_type || mediaResponse.headers.get("content-type") || "application/octet-stream"),
    sha256: String(metadata.sha256 || "") || null,
    fileSize: bytes.byteLength,
  };
}

const serviceNeededValues = [
  "tax_return", "sars_debt_assistance", "vat_registration", "company_tax", "paye_issues", "objection_dispute", "bookkeeping",
  "individual_personal_income_tax_returns", "individual_sars_debt_assistance", "individual_tax_compliance_issues", "individual_objections_and_disputes",
  "individual_late_return_submissions", "individual_tax_number_registration", "individual_sars_verification_refund_assistance",
  "business_company_income_tax", "business_vat_registration", "business_vat_returns", "business_paye_registration", "business_paye_compliance",
  "business_sars_debt_arrangements", "business_tax_debt_compromise", "business_vat_objections_disputes", "business_sars_audits_support",
  "accounting_bookkeeping", "accounting_financial_statements", "accounting_management_accounts", "accounting_payroll_services", "accounting_monthly_accounting_services",
  "support_company_registration", "support_business_compliance", "support_cipc_services", "support_annual_returns_filing", "support_beneficial_ownership_filings",
  "trust_tax_returns", "trust_compliance", "trust_sars_assistance", "trust_sars_disputes_objections",
  "npo_registration_assistance", "npo_tax_exemption_assistance", "npo_annual_compliance_filing", "npo_sars_compliance", "npo_financial_reporting", "other",
] as const;

type IntakePayload = Record<string, unknown>;
type AIResult = {
  reply: string;
  extracted: {
    full_name: string | null;
    email: string | null;
    client_type: "individual" | "company" | "trust" | "npo_organisation" | null;
    company_name: string | null;
    company_registration_number: string | null;
    province: string | null;
    city: string | null;
    service_category: "individual_tax" | "business_tax" | "accounting" | "business_support" | "trust_services" | "npo_organisation_services" | null;
    service_needed: string | null;
    description: string | null;
    sars_debt_amount: number | null;
    returns_filed: boolean | null;
    has_debt_flag: boolean | null;
    has_sars_audit: boolean | null;
    has_adr: boolean | null;
    has_vat_investigation: boolean | null;
    has_payroll_dispute: boolean | null;
    has_multiple_tax_types: boolean | null;
    has_legal_complexity: boolean | null;
    priority_level: "low" | "medium" | "high" | "urgent" | null;
    risk_indicator: "low" | "medium" | "high" | null;
    contact_preference: string | null;
    authorised_representative: boolean | null;
    document_summary: string | null;
  };
};

function mergeIntake(current: IntakePayload, extracted: AIResult["extracted"], waId: string, displayName: string | null) {
  const next: IntakePayload = { ...current, phone: waId, source: "whatsapp" };
  if (!next.whatsapp_display_name && displayName) next.whatsapp_display_name = displayName;
  for (const [key, value] of Object.entries(extracted)) if (value !== null && value !== "") next[key] = value;
  if (typeof next.description === "string") next.description = normalizeForPrompt(next.description, 5000);
  return next;
}

function intakeMissingFields(intake: IntakePayload) {
  const missing: string[] = [];
  if (!intake.full_name) missing.push("full_name");
  if (!intake.client_type) missing.push("client_type");
  if (!intake.service_needed) missing.push("service_needed");
  if (!intake.description) missing.push("description");
  if (!intake.province) missing.push("province");
  if (!intake.email) missing.push("email");
  if (intake.client_type === "company" && !intake.company_name) missing.push("company_name");
  if (intake.has_debt_flag === true && intake.sars_debt_amount === undefined) missing.push("sars_debt_amount");
  if (intake.has_debt_flag === true && intake.returns_filed === undefined) missing.push("returns_filed");
  return missing;
}

function nextMissingQuestion(missing: string[], intake: IntakePayload) {
  const field = missing[0];
  if (!field) return "Thanks, I have the main details I need for now.";
  const questions: Record<string, string> = {
    full_name: "What is the client’s full name?",
    client_type: "Is this for an individual, company, trust or NPO?",
    service_needed: "What would you like us to help with?",
    description: "Can you briefly tell me what happened and what you need help with?",
    province: "Which province is the client based in?",
    email: "What email address can we use for the client?",
    company_name: "What is the company name?",
    sars_debt_amount: "Approximately how much does SARS say is owed?",
    returns_filed: "Are the required tax returns up to date?",
  };
  const firstName = typeof intake.full_name === "string" ? intake.full_name.split(/\s+/)[0] : "the client";
  return questions[field]?.replace("the client", firstName) || "What other important detail should we know?";
}

function hasUnconfirmedActionClaim(text: string) {
  return /\b(i(?:'ll| will)|we(?:'ll| will)|i am going to|we are going to)\b[^.!?\n]{0,100}\b(open|create|submit|send|share|upload|assign|escalate|confirm)\b[^.!?\n]{0,100}\b(service request|request|link|documents?|practitioner|case)\b/i.test(text)
    || /\bsecure upload link\b/i.test(text)
    || /\bi(?:'ve| have) (opened|created|submitted|sent|assigned|escalated)\b/i.test(text);
}

function sanitizeWhatsAppReply(raw: string, missing: string[], intake: IntakePayload) {
  let text = raw.trim();

  if (!text || hasUnconfirmedActionClaim(text)) return nextMissingQuestion(missing, intake);

  text = text
    .replace(/[—–]/g, ",")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\bintake\b/gi, "details")
    .replace(/\bservice request\b/gi, "request")
    .replace(/\s+,/g, ",")
    .replace(/,{2,}/g, ",")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const questionPositions = [...text.matchAll(/\?/g)].map((m) => m.index ?? -1).filter((i) => i >= 0);
  if (questionPositions.length > 1) text = text.slice(0, questionPositions[0] + 1);

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).slice(0, 3);
  text = paragraphs.join("\n\n");

  if (text.length > 520) {
    const shortened = text.slice(0, 520);
    const lastStop = Math.max(shortened.lastIndexOf("."), shortened.lastIndexOf("?"));
    text = (lastStop > 240 ? shortened.slice(0, lastStop + 1) : shortened).trim();
  }

  if (!text.includes("\n\n") && text.length > 220) {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [text];
    if (sentences.length >= 2) text = `${sentences[0]}\n\n${sentences.slice(1).join(" ")}`;
  }

  return text || nextMissingQuestion(missing, intake);
}

function extractStructuredOutput(response: Record<string, unknown>) {
  const direct = typeof response?.output_text === "string" ? response.output_text.trim() : "";
  if (direct) return JSON.parse(direct) as AIResult;
  const output = Array.isArray(response?.output) ? response.output : [];
  for (const rawItem of output as Array<Record<string, unknown>>) {
    if (rawItem?.type !== "message") continue;
    const content = Array.isArray(rawItem?.content) ? rawItem.content : [];
    for (const rawContent of content as Array<Record<string, unknown>>) {
      if (rawContent?.type === "output_text" && typeof rawContent?.text === "string") return JSON.parse(rawContent.text) as AIResult;
    }
  }
  throw new Error("OpenAI returned no structured output");
}

async function callOpenAI(
  history: { direction: string; sender_type: string; content: string | null }[],
  latest: string,
  currentIntake: IntakePayload,
  missingBefore: string[],
  attachment?: { kind: "image" | "document"; bytes: Uint8Array; mimeType: string; filename?: string | null },
): Promise<AIResult> {
  const recentHistory = history.filter((m) => m.content).slice(-12).map((m) => `${m.direction === "inbound" ? "Customer" : "Acapolite"}: ${normalizeForPrompt(m.content || "", 700)}`).join("\n");

  const instructions = [
    "You are chatting with a customer on WhatsApp on behalf of Acapolite in South Africa.",
    "Sound like a real helpful person from the Acapolite office, never like a chatbot, form, call centre script or formal letter.",
    "Quietly extract every relevant fact that maps to Acapolite's service request, even when the client gives several facts at once, answers out of order or changes topic.",
    "Never discard information already collected and never ask for information already present in the current details or recent conversation.",
    "If the client asks a side question, answer it naturally first, then if appropriate ask one missing question without abruptly changing the subject.",
    "Ask only one main question at a time.",
    "Never say recorded, captured, added to the intake, added to the system or similar internal workflow language. Just continue naturally.",
    "Never mention intake, database, field, workflow or backend to the customer.",
    "Never claim or promise that you opened, created or submitted a request, sent or will send a link, received documents, assigned a practitioner, escalated a case or completed any external action. Those actions are not available yet.",
    "Do not ask for ID numbers, passport numbers, bank PINs, card details, eFiling passwords, OTPs or authentication secrets in WhatsApp.",
    "Write like normal WhatsApp. Usually 1 to 3 very short paragraphs, with a blank line between thoughts. Usually stay under 300 characters unless explaining a document or answering a question requires more.",
    "Do not use em dashes or en dashes. Avoid hyphens as punctuation. Use commas, full stops or a new paragraph instead.",
    "Do not use bullet lists, numbered lists or headings unless the customer specifically asks for a checklist.",
    "Do not repeat document lists or previously explained facts unless the customer asks for them again.",
    "Do not keep asking shall we continue, are you ready, or similar permission questions once the client has already asked Acapolite for help.",
    "When an image or PDF is attached, explain what it appears to be and extract relevant facts, dates and requested actions. Keep the customer explanation concise.",
    "The description field must be a concise consolidated summary of the client's overall issue using current details plus new information, not merely the last message.",
    "Do not make definitive legal or tax conclusions and do not promise SARS outcomes, refunds or turnaround times.",
    `When mapping service_needed, use one of these exact values when clearly applicable: ${serviceNeededValues.join(", ")}. Otherwise use other.`,
    "The extracted object must contain only facts clearly stated or strongly supported by the conversation or attached document. Use null for unknown values.",
  ].join(" ");

  const contextText = [
    `CURRENT DETAILS: ${JSON.stringify(currentIntake)}`,
    `FIELDS STILL MISSING BEFORE THIS MESSAGE: ${missingBefore.join(", ") || "none"}`,
    recentHistory ? `RECENT CHAT:\n${recentHistory}` : "",
    `LATEST CUSTOMER MESSAGE: ${normalizeForPrompt(latest || "Please review the attached document.")}`,
  ].filter(Boolean).join("\n\n");

  const content: Record<string, unknown>[] = [{ type: "input_text", text: contextText }];
  if (attachment) {
    const base64 = bytesToBase64(attachment.bytes);
    if (attachment.kind === "image") content.push({ type: "input_image", image_url: `data:${attachment.mimeType};base64,${base64}`, detail: "high" });
    else content.push({ type: "input_file", file_data: base64, filename: attachment.filename || "whatsapp-document.pdf" });
  }

  const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
  const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] };
  const nullableBoolean = { anyOf: [{ type: "boolean" }, { type: "null" }] };
  const nullableEnum = (values: string[]) => ({ anyOf: [{ type: "string", enum: values }, { type: "null" }] });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${requiredEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: requiredEnv("OPENAI_WHATSAPP_MODEL"),
      instructions,
      input: [{ role: "user", content }],
      store: false,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "acapolite_whatsapp_intake",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["reply", "extracted"],
            properties: {
              reply: { type: "string" },
              extracted: {
                type: "object",
                additionalProperties: false,
                required: ["full_name", "email", "client_type", "company_name", "company_registration_number", "province", "city", "service_category", "service_needed", "description", "sars_debt_amount", "returns_filed", "has_debt_flag", "has_sars_audit", "has_adr", "has_vat_investigation", "has_payroll_dispute", "has_multiple_tax_types", "has_legal_complexity", "priority_level", "risk_indicator", "contact_preference", "authorised_representative", "document_summary"],
                properties: {
                  full_name: nullableString,
                  email: nullableString,
                  client_type: nullableEnum(["individual", "company", "trust", "npo_organisation"]),
                  company_name: nullableString,
                  company_registration_number: nullableString,
                  province: nullableString,
                  city: nullableString,
                  service_category: nullableEnum(["individual_tax", "business_tax", "accounting", "business_support", "trust_services", "npo_organisation_services"]),
                  service_needed: nullableEnum([...serviceNeededValues]),
                  description: nullableString,
                  sars_debt_amount: nullableNumber,
                  returns_filed: nullableBoolean,
                  has_debt_flag: nullableBoolean,
                  has_sars_audit: nullableBoolean,
                  has_adr: nullableBoolean,
                  has_vat_investigation: nullableBoolean,
                  has_payroll_dispute: nullableBoolean,
                  has_multiple_tax_types: nullableBoolean,
                  has_legal_complexity: nullableBoolean,
                  priority_level: nullableEnum(["low", "medium", "high", "urgent"]),
                  risk_indicator: nullableEnum(["low", "medium", "high"]),
                  contact_preference: nullableString,
                  authorised_representative: nullableBoolean,
                  document_summary: nullableString,
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 700)}`);
  }
  return extractStructuredOutput((await response.json()) as Record<string, unknown>);
}

async function sendWhatsAppText(to: string, body: string) {
  const response = await fetch(`https://graph.facebook.com/${requiredEnv("WHATSAPP_GRAPH_API_VERSION")}/${requiredEnv("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requiredEnv("WHATSAPP_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Meta send failed (${response.status}): ${JSON.stringify(data).slice(0, 500)}`);
  return String(data?.messages?.[0]?.id || "").trim() || null;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token && timingSafeEqual(token, requiredEnv("WHATSAPP_VERIFY_TOKEN")) && challenge) return new Response(challenge, { status: 200, headers: textHeaders });
      return new Response("Forbidden", { status: 403, headers: textHeaders });
    }
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: textHeaders });

    const rawBody = await req.text();
    if (!(await verifyMetaSignature(req, rawBody))) return new Response("Invalid signature", { status: 401, headers: textHeaders });

    const events = extractIncomingEvents(JSON.parse(rawBody));
    if (events.length === 0) return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: jsonHeaders });

    const supabase = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

    for (const event of events) {
      const { data: duplicate, error: duplicateError } = await supabase.from("whatsapp_messages").select("id").eq("meta_message_id", event.messageId).maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) continue;

      const referral = event.referral || {};
      const conversationPatch: Record<string, unknown> = { wa_id: event.waId, phone_number: event.waId, last_inbound_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (event.displayName) conversationPatch.display_name = event.displayName;
      if (referral?.source_type) conversationPatch.referral_source = referral.source_type;
      if (referral?.source_id) conversationPatch.referral_ad_id = referral.source_id;
      if (referral?.headline) conversationPatch.referral_headline = referral.headline;
      if (referral?.ctwa_clid) conversationPatch.referral_campaign_id = referral.ctwa_clid;

      const { data: conversation, error: conversationError } = await supabase.from("whatsapp_conversations").upsert(conversationPatch, { onConflict: "wa_id" }).select("id, status, ai_enabled, intake_payload, intake_missing_fields, intake_ready").single();
      if (conversationError) throw conversationError;

      let attachment: { kind: "image" | "document"; bytes: Uint8Array; mimeType: string; filename?: string | null } | undefined;
      let mediaSizeBytes: number | null = null;
      let resolvedMime = event.mediaMimeType;
      let resolvedSha = event.mediaSha256;

      if ((event.kind === "image" || event.kind === "document") && event.mediaId) {
        const media = await downloadMetaMedia(event.mediaId);
        mediaSizeBytes = media.fileSize;
        resolvedMime = media.mimeType || resolvedMime;
        resolvedSha = media.sha256 || resolvedSha;
        if (event.kind === "document" && resolvedMime !== "application/pdf") {
          const text = "I can read images and PDF files here. Please resend this one as a PDF if you can.";
          await supabase.from("whatsapp_messages").insert({ conversation_id: conversation.id, meta_message_id: event.messageId, direction: "inbound", sender_type: "customer", message_type: event.kind, content: event.text || "[Document attached]", media_id: event.mediaId, media_mime_type: resolvedMime, media_filename: event.mediaFilename, media_sha256: resolvedSha, media_size_bytes: mediaSizeBytes });
          await sendWhatsAppText(event.waId, text);
          continue;
        }
        attachment = { kind: event.kind, bytes: media.bytes, mimeType: resolvedMime || "application/octet-stream", filename: event.mediaFilename };
      }

      const inboundContent = event.text || (event.kind === "image" ? "[Image attached]" : event.kind === "document" ? "[Document attached]" : "[Unsupported WhatsApp message]");
      const { error: inboundError } = await supabase.from("whatsapp_messages").insert({ conversation_id: conversation.id, meta_message_id: event.messageId, direction: "inbound", sender_type: "customer", message_type: event.kind, content: inboundContent, media_id: event.mediaId, media_mime_type: resolvedMime, media_filename: event.mediaFilename, media_sha256: resolvedSha, media_size_bytes: mediaSizeBytes });
      if (inboundError) {
        if (inboundError.code === "23505") continue;
        throw inboundError;
      }

      if (event.kind === "unsupported") {
        const text = "Please send that as text, an image or a PDF and I’ll help you from there.";
        const metaMessageId = await sendWhatsAppText(event.waId, text);
        await supabase.from("whatsapp_messages").insert({ conversation_id: conversation.id, meta_message_id: metaMessageId, direction: "outbound", sender_type: "system", message_type: "text", content: text, delivery_status: "submitted" });
        continue;
      }

      if (wantsHuman(event.text)) {
        await supabase.from("whatsapp_conversations").update({ status: "human_handoff", ai_enabled: false, human_handoff_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);
        const text = "Of course. I’ve paused the automated replies so the Acapolite admin team can take over this chat.";
        const metaMessageId = await sendWhatsAppText(event.waId, text);
        await supabase.from("whatsapp_messages").insert({ conversation_id: conversation.id, meta_message_id: metaMessageId, direction: "outbound", sender_type: "system", message_type: "text", content: text, delivery_status: "submitted" });
        continue;
      }

      if (!conversation.ai_enabled || conversation.status === "human_handoff") continue;

      const { data: history, error: historyError } = await supabase.from("whatsapp_messages").select("direction, sender_type, content").eq("conversation_id", conversation.id).neq("meta_message_id", event.messageId).order("created_at", { ascending: false }).limit(12);
      if (historyError) throw historyError;

      const currentIntake = (conversation.intake_payload || {}) as IntakePayload;
      const missingBefore = Array.isArray(conversation.intake_missing_fields) ? conversation.intake_missing_fields : intakeMissingFields(currentIntake);
      const ai = await callOpenAI([...(history || [])].reverse(), event.text, currentIntake, missingBefore, attachment);
      const mergedIntake = mergeIntake(currentIntake, ai.extracted, event.waId, event.displayName);
      const missingAfter = intakeMissingFields(mergedIntake);
      const ready = missingAfter.length === 0;

      await supabase.from("whatsapp_conversations").update({ intake_payload: mergedIntake, intake_missing_fields: missingAfter, intake_ready: ready, intake_updated_at: new Date().toISOString(), last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);

      const reply = sanitizeWhatsAppReply(ai.reply, missingAfter, mergedIntake);
      const metaMessageId = await sendWhatsAppText(event.waId, reply);
      await supabase.from("whatsapp_messages").insert({ conversation_id: conversation.id, meta_message_id: metaMessageId, direction: "outbound", sender_type: "ai", message_type: "text", content: reply, delivery_status: "submitted" });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error("whatsapp-agent error", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ ok: false, error: "Webhook processing failed" }), { status: 500, headers: jsonHeaders });
  }
});