import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };
const TEXT_HEADERS = { "Content-Type": "text/plain" };
const MEDIA_BUCKET = "service-request-attachments";
const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const encoder = new TextEncoder();

type Intake = Record<string, unknown>;
type Incoming = {
  waId: string;
  messageId: string;
  kind: "text" | "image" | "document" | "unsupported";
  text: string;
  displayName: string | null;
  referral: Record<string, unknown> | null;
  mediaId: string | null;
  mime: string | null;
  filename: string | null;
  sha256: string | null;
};

type Extracted = {
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
  document_summary: string | null;
  authorised_representative: boolean | null;
  efiling_access: "Yes" | "No" | "Not sure" | null;
  urgency: "Urgent / Immediate" | "Within a few days" | "Flexible" | null;
  has_debt_flag: boolean | null;
  sars_debt_amount: number | null;
  tax_types: string | null;
  enforcement_stage: string | null;
  desired_outcome: string | null;
  returns_filed: boolean | null;
  priority_level: "low" | "medium" | "high" | "urgent" | null;
  risk_indicator: "low" | "medium" | "high" | null;
};

type AIResult = {
  reply: string;
  submission_decision: "yes" | "no" | "unclear";
  human_handoff_requested: boolean;
  extracted: Extracted;
};

const env = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function hmacSha256(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validSignature(req: Request, body: string) {
  const provided = req.headers.get("x-hub-signature-256")?.trim() || "";
  if (!provided.startsWith("sha256=")) return false;
  return timingSafeEqual(provided, `sha256=${await hmacSha256(env("WHATSAPP_APP_SECRET"), body)}`);
}

function incomingEvents(payload: any): Incoming[] {
  const out: Incoming[] = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const names = new Map<string, string>();
      for (const contact of value?.contacts || []) {
        if (contact?.wa_id && contact?.profile?.name) names.set(String(contact.wa_id), String(contact.profile.name));
      }
      for (const m of value?.messages || []) {
        const waId = String(m?.from || "").trim();
        const messageId = String(m?.id || "").trim();
        if (!waId || !messageId) continue;
        const base = { waId, messageId, displayName: names.get(waId) || null, referral: m.referral || null };
        if (m.type === "text" && m.text?.body) {
          out.push({ ...base, kind: "text", text: String(m.text.body).trim(), mediaId: null, mime: null, filename: null, sha256: null });
        } else if (m.type === "image") {
          out.push({ ...base, kind: "image", text: String(m.image?.caption || "").trim(), mediaId: m.image?.id || null, mime: m.image?.mime_type || null, filename: null, sha256: m.image?.sha256 || null });
        } else if (m.type === "document") {
          out.push({ ...base, kind: "document", text: String(m.document?.caption || "").trim(), mediaId: m.document?.id || null, mime: m.document?.mime_type || null, filename: m.document?.filename || null, sha256: m.document?.sha256 || null });
        } else {
          out.push({ ...base, kind: "unsupported", text: "", mediaId: null, mime: null, filename: null, sha256: null });
        }
      }
    }
  }
  return out;
}

function normalizePhone(waId: string) {
  const digits = waId.replace(/\D/g, "");
  return digits ? `+${digits}` : waId;
}

function cleanReply(raw: string) {
  let text = String(raw || "")
    .replace(/[—–]/g, ",")
    .replace(/^\s*[•-]\s+/gm, "")
    .replace(/\s+,/g, ",")
    .replace(/,{2,}/g, ",")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  text = text.replace(/\b(Thanks|Thank you|Okay|Great|Perfect|Got it),?\s+(I(?:'ve| have)?\s+)?(noted|recorded|captured)\b[^.!?]*[.!?]?\s*/gi, "").trim();
  const sentences = text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  if (!text.includes("\n\n") && sentences.length > 2) {
    text = `${sentences.slice(0, 2).join(" ")}\n\n${sentences.slice(2, 4).join(" ")}`.trim();
  }
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).slice(0, 2);
  text = paragraphs.join("\n\n");
  if (text.length > 360) {
    const cut = text.slice(0, 360);
    const stop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"), cut.lastIndexOf("!"));
    text = (stop > 180 ? cut.slice(0, stop + 1) : cut).trim();
  }
  return text;
}

function requestsHumanHandoff(text: string) {
  const normalized = text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  const person = "human|person|someone|practitioner|consultant|advisor|adviser|agent|team|staff|manager|supervisor";
  const action = "speak|talk|chat|connect|transfer|handover|hand over|put me through|call|phone|contact|assist|help";
  return new RegExp(`\\b(?:${action})\\b.{0,50}\\b(?:${person})\\b`, "i").test(normalized)
    || new RegExp(`\\b(?:${person})\\b.{0,40}\\b(?:please|now|instead|directly|call|phone|contact|assist|help|speak|talk|chat)\\b`, "i").test(normalized)
    || /\b(i want|i need|give me|get me)\b.{0,35}\b(human|person|someone|practitioner|consultant|advisor|adviser)\b/i.test(normalized)
    || /ngifuna ukukhuluma.{0,35}(nomuntu|nomeluleki)|ngixhumanise.{0,35}(nomuntu|nomeluleki)/i.test(normalized);
}

function containsFalseActionClaim(text: string) {
  return /\b(i('|’)ll|i will|we('|’)ll|we will|i have|we have)\s+(prepare|send|issue|email|create|submit|file|lodge|contact|assign|connect|start|open|escalate|forward|arrange)\b/i.test(text)
    || /\b(mandate|engagement letter|authority form)\b/i.test(text)
    || /\b(has been|was)\s+(submitted|filed|lodged|sent|assigned|connected|escalated|forwarded)\b/i.test(text);
}

function repeatedQuestion(answer: string, question: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const a = normalize(answer);
  const q = normalize(question);
  if (!a || !q) return false;
  if (a.includes(q) || q.includes(a)) return true;
  const qWords = new Set(q.split(" ").filter((word) => word.length > 3));
  if (qWords.size < 3) return false;
  const overlap = [...qWords].filter((word) => a.includes(` ${word} `) || a.startsWith(`${word} `) || a.endsWith(` ${word}`)).length;
  return overlap / qWords.size >= 0.75 && /\?/.test(answer);
}

function looksLikeQuestion(text: string) {
  return /\?|\b(why|how|what|when|where|who|can|could|would|will|do i|does|is it|are you|ngani|kanjani|yini|nini|kuphi|ubani)\b/i.test(text);
}

const CITY_PROVINCE: Record<string, string> = {
  pretoria: "Gauteng", tshwane: "Gauteng", johannesburg: "Gauteng", sandton: "Gauteng", midrand: "Gauteng", nigel: "Gauteng", benoni: "Gauteng", boksburg: "Gauteng",
  mbombela: "Mpumalanga", nelspruit: "Mpumalanga", emalahleni: "Mpumalanga", witbank: "Mpumalanga",
  durban: "KwaZulu-Natal", pietermaritzburg: "KwaZulu-Natal", "cape town": "Western Cape", bloemfontein: "Free State", polokwane: "Limpopo", rustenburg: "North West", kimberley: "Northern Cape", gqeberha: "Eastern Cape", "east london": "Eastern Cape"
};

function locationConflict(current: Intake, x: Extracted) {
  const newCity = x.city?.trim();
  const newProvince = x.province?.trim();
  const currentCity = typeof current.city === "string" ? current.city.trim() : "";
  const currentProvince = typeof current.province === "string" ? current.province.trim() : "";
  if (newCity) {
    const expected = CITY_PROVINCE[newCity.toLowerCase()];
    const compared = newProvince || currentProvince;
    if (expected && compared && expected.toLowerCase() !== compared.toLowerCase()) return { city: newCity, expected, compared };
  }
  if (newProvince && currentCity) {
    const expected = CITY_PROVINCE[currentCity.toLowerCase()];
    if (expected && expected.toLowerCase() !== newProvince.toLowerCase()) return { city: currentCity, expected, compared: newProvince };
  }
  return null;
}

function normalizeKnownLocation(x: Extracted) {
  const city = x.city?.trim();
  if (!city) return x;
  const province = CITY_PROVINCE[city.toLowerCase()];
  return province ? { ...x, city, province } : x;
}

function mergeIntake(current: Intake, x: Extracted, waId: string, displayName: string | null, skipLocation = false) {
  const next: Intake = { ...current, phone: normalizePhone(waId), source: "whatsapp_admin_ai" };
  if (!next.whatsapp_display_name && displayName) next.whatsapp_display_name = displayName;
  for (const [key, value] of Object.entries(x)) {
    if (value === null || value === "") continue;
    if (skipLocation && (key === "city" || key === "province")) continue;
    next[key] = value;
  }
  return next;
}

function coreMissing(intake: Intake) {
  const m: string[] = [];
  if (!intake.full_name) m.push("full_name");
  if (!intake.client_type) m.push("client_type");
  if (!intake.service_needed) m.push("service_needed");
  if (!intake.description) m.push("description");
  if (!intake.email) m.push("email");
  if (intake.client_type === "company" && !intake.company_name) m.push("company_name");
  if (!intake.province) m.push("province");
  if (intake.province !== "Any / Nationwide" && !intake.city) m.push("city");
  if (intake.has_debt_flag === true && (intake.sars_debt_amount === null || intake.sars_debt_amount === undefined)) m.push("sars_debt_amount");
  return m;
}

function nextPriority(intake: Intake) {
  const service = String(intake.service_needed || "");
  const debtCase = intake.has_debt_flag === true || service.includes("debt") || /sars debt/i.test(String(intake.description || ""));
  if (debtCase) {
    if (intake.sars_debt_amount === null || intake.sars_debt_amount === undefined) return "sars_debt_amount";
    if (!intake.tax_types) return "tax_types";
    if (!intake.enforcement_stage) return "enforcement_stage";
    if (!intake.desired_outcome) return "desired_outcome";
    if (!intake.efiling_access) return "efiling_access";
  }
  if (intake.client_type === "company" && !intake.company_name) return "company_name";
  if (!intake.full_name) return "full_name";
  if (!intake.email) return "email";
  if (!intake.province) return "province";
  if (intake.province !== "Any / Nationwide" && !intake.city) return "city";
  if (intake.client_type === "company" && intake.authorised_representative === undefined) return "authorised_representative";
  const missing = coreMissing(intake);
  return missing[0] || null;
}

const QUESTION: Record<string, string> = {
  sars_debt_amount: "Approximately how much does SARS say is owed?",
  tax_types: "Do you know which taxes make up the debt, for example VAT, PAYE or company income tax?",
  enforcement_stage: "Has SARS already sent a final demand, taken money from the account, or started any collection action?",
  desired_outcome: "What are you hoping to achieve, a payment arrangement, a compromise, or another solution?",
  efiling_access: "Do you currently have access to the SARS eFiling profile?",
  company_name: "What is the company name?",
  full_name: "What is your full name?",
  email: "What email address can we use for this matter?",
  province: "Which province are you based in?",
  city: "Which town or city are you based in?",
  authorised_representative: "Are you authorised to deal with this matter for the company?",
  client_type: "Is this for you personally or for a company, trust or NPO?",
  service_needed: "What would you like us to help with?",
  description: "Tell me briefly what happened and what you need help with."
};

function inferCategory(intake: Intake) {
  const explicit = String(intake.service_category || "");
  if (["individual_tax", "business_tax", "accounting", "business_support", "trust_services", "npo_organisation_services"].includes(explicit)) return explicit;
  const service = String(intake.service_needed || "");
  if (service.startsWith("business_")) return "business_tax";
  if (service.startsWith("accounting_")) return "accounting";
  if (service.startsWith("support_")) return "business_support";
  if (service.startsWith("trust_")) return "trust_services";
  if (service.startsWith("npo_")) return "npo_organisation_services";
  return intake.client_type === "company" ? "business_tax" : "individual_tax";
}

function requestPayload(intake: Intake) {
  const company = intake.client_type === "company";
  const service = String(intake.service_needed || (company ? "business_tax_other" : "individual_other"));
  const category = inferCategory(intake);
  const returnsFiled = typeof intake.returns_filed === "boolean" ? intake.returns_filed : true;
  return {
    full_name: String(intake.full_name || "").trim(),
    email: String(intake.email || "").trim().toLowerCase(),
    phone: String(intake.phone || "").trim(),
    client_type: intake.client_type,
    company_name: company ? String(intake.company_name || "").trim() || null : null,
    company_registration_number: company ? String(intake.company_registration_number || "").trim() || null : null,
    service_category: category,
    service_categories: [category],
    service_needed: service,
    service_needed_list: [service],
    description: String(intake.description || "").trim(),
    province: String(intake.province || "").trim() || null,
    city: String(intake.city || "").trim() || null,
    priority_level: intake.priority_level || "medium",
    risk_indicator: intake.risk_indicator || "low",
    sars_debt_amount: Number(intake.sars_debt_amount || 0),
    has_debt_flag: Boolean(intake.has_debt_flag),
    returns_filed: returnsFiled,
    missing_returns_flag: returnsFiled === false,
    missing_documents_flag: false,
    has_sars_audit: false,
    has_adr: false,
    has_vat_investigation: false,
    has_payroll_dispute: false,
    has_multiple_tax_types: false,
    has_legal_complexity: false,
    contact_preference: "WhatsApp",
    marketing_consent: false,
    submitted_with_account: false,
    client_profile_id: null,
    intake_payload: {
      who: { entityType: intake.client_type, province: intake.province, city: intake.city || "" },
      what: { selectedServices: [{ value: service, label: service.replace(/_/g, " "), category }], otherDetails: {} },
      details: { answers: { efilingAccess: intake.efiling_access || null, taxTypes: intake.tax_types || null, enforcementStage: intake.enforcement_stage || null, desiredOutcome: intake.desired_outcome || null }, additionalNotes: String(intake.description || ""), questions: [] },
      contact: { fullName: intake.full_name, email: intake.email, phone: intake.phone, province: intake.province, city: intake.city || "", contactPreference: "WhatsApp", marketingConsent: false },
      whatsapp: { source: "whatsapp_admin_ai", authorisedRepresentative: intake.authorised_representative ?? null, documentSummary: intake.document_summary ?? null, displayName: intake.whatsapp_display_name ?? null, allCapturedDetails: intake }
    }
  };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function downloadMedia(mediaId: string) {
  const token = env("WHATSAPP_ACCESS_TOKEN");
  const version = env("WHATSAPP_GRAPH_API_VERSION");
  const lookup = await fetch(`https://graph.facebook.com/${version}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  const info = await lookup.json().catch(() => ({}));
  if (!lookup.ok || !info?.url) throw new Error(`Meta media lookup failed (${lookup.status})`);
  if (Number(info.file_size || 0) > MAX_MEDIA_BYTES) throw new Error("Attachment too large");
  const response = await fetch(String(info.url), { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Meta media download failed (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_MEDIA_BYTES) throw new Error("Attachment too large");
  return { bytes, mime: String(info.mime_type || response.headers.get("content-type") || "application/octet-stream"), size: bytes.byteLength, sha256: String(info.sha256 || "") || null };
}

async function sendText(to: string, body: string) {
  const response = await fetch(`https://graph.facebook.com/${env("WHATSAPP_GRAPH_API_VERSION")}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: cleanReply(body) } })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Meta send failed (${response.status}): ${JSON.stringify(data).slice(0, 300)}`);
  return String(data?.messages?.[0]?.id || "") || null;
}

async function storeOutbound(sb: any, conversationId: string, waId: string, text: string, sender = "ai") {
  const body = cleanReply(text);
  if (!body) return;
  const metaId = await sendText(waId, body);
  await sb.from("whatsapp_messages").insert({ conversation_id: conversationId, meta_message_id: metaId, direction: "outbound", sender_type: sender, message_type: "text", content: body, delivery_status: "submitted" });
}

async function localize(message: string, latest: string, history: any[]) {
  const recent = history.slice(-8).map((m) => `${m.direction}: ${m.content || ""}`).join("\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env("OPENAI_WHATSAPP_MODEL"), store: false,
      instructions: "Rewrite the supplied Acapolite WhatsApp message in the customer's current conversational language. South African customers may naturally mix English with isiZulu or another language, preserve that style when appropriate. Keep the meaning exact. Sound like a real office conversation, not a form. No bullets, headings, em dash or en dash. Return only the message.",
      input: `Recent chat:\n${recent}\n\nLatest customer message:\n${latest}\n\nMessage:\n${message}`
    })
  });
  if (!response.ok) return cleanReply(message);
  const data = await response.json();
  let output = typeof data?.output_text === "string" ? data.output_text : "";
  if (!output) for (const item of data?.output || []) for (const part of item?.content || []) if (part?.type === "output_text") output = part.text;
  return cleanReply(output || message);
}

async function askAI(history: any[], latest: string, current: Intake, state: string, attachment?: { kind: "image" | "document"; bytes: Uint8Array; mime: string; filename?: string | null }) {
  const recent = history.slice(-16).map((m) => `${m.direction === "inbound" ? "Customer" : "Acapolite"}: ${m.content || ""}`).join("\n");
  const priority = nextPriority(current);
  const instructions = [
    "You support Acapolite Consulting customers on WhatsApp in South Africa.",
    "Do not volunteer that you are AI or automated. Never mention bots, automation, automated replies, models, prompts, backend, database, workflow, intake or fields.",
    "If directly asked whether you are AI, answer truthfully and briefly that this is Acapolite's AI assisted WhatsApp assistant, then offer a human if they prefer. Never pretend to be a named human.",
    "Sound like a capable member of an office team, not a questionnaire.",
    "Keep the reply to at most two short WhatsApp paragraphs. Do not use numbered lists unless the customer explicitly asks for a list.",
    "Reply in the customer's current conversational language and handle natural mixing between South African official languages and English.",
    "Your reply field should answer or react to the customer's message only. Do not ask routine intake questions in reply. The application will choose the next question separately.",
    "Do not say noted, recorded, captured, got it, intake, or confirm information the customer just gave unless clarification is genuinely needed.",
    "For tax matters, understand the problem before asking administrative details. For SARS debt, extract amount, tax types, enforcement stage, desired outcome and eFiling access when the customer provides them.",
    "Do not repeatedly request a document after the customer says they do not have it. Explain alternatives if they ask, otherwise continue the conversation.",
    "Never ask for passwords, OTPs, PINs, card details or ID numbers.",
    "Never claim SARS, eFiling, a practitioner or another person was contacted or that work was performed unless system context confirms it.",
    "Never invent or offer a mandate, engagement letter, authority form, signature process or document-sending workflow. No mandate capability exists here.",
    "If the customer asks for a practitioner, consultant, person or human, set human_handoff_requested true immediately. Do not ask them to choose between handoff and another workflow.",
    "Only set authorised_representative true when the customer explicitly confirms authority or permission.",
    "For a company SARS debt case use service_needed business_sars_debt_arrangements unless compromise is specifically requested. For an individual use individual_sars_debt_assistance.",
    `Current submission state is ${state}.`,
    "submission_decision classifies only the latest message. It is yes only if the customer is currently answering an explicit request creation confirmation.",
    "human_handoff_requested is true whenever the customer asks for a person, consultant, practitioner, team member or human assistance in any supported language.",
    "description is a concise cumulative case summary, not just the latest message."
  ].join(" ");

  const content: any[] = [{ type: "input_text", text: `Current details: ${JSON.stringify(current)}\nSuggested next priority: ${priority || "none"}\nRecent chat:\n${recent}\nLatest customer message: ${latest || "Please review the attached document."}` }];
  if (attachment) {
    const b64 = bytesToBase64(attachment.bytes);
    if (attachment.kind === "image") content.push({ type: "input_image", image_url: `data:${attachment.mime};base64,${b64}`, detail: "high" });
    else content.push({ type: "input_file", file_data: b64, filename: attachment.filename || "whatsapp-document.pdf" });
  }

  const ns = { anyOf: [{ type: "string" }, { type: "null" }] };
  const nb = { anyOf: [{ type: "boolean" }, { type: "null" }] };
  const nn = { anyOf: [{ type: "number" }, { type: "null" }] };
  const ne = (values: string[]) => ({ anyOf: [{ type: "string", enum: values }, { type: "null" }] });
  const schema = {
    type: "object", additionalProperties: false,
    required: ["reply", "submission_decision", "human_handoff_requested", "extracted"],
    properties: {
      reply: { type: "string" },
      submission_decision: { type: "string", enum: ["yes", "no", "unclear"] },
      human_handoff_requested: { type: "boolean" },
      extracted: {
        type: "object", additionalProperties: false,
        required: ["full_name", "email", "client_type", "company_name", "company_registration_number", "province", "city", "service_category", "service_needed", "description", "document_summary", "authorised_representative", "efiling_access", "urgency", "has_debt_flag", "sars_debt_amount", "tax_types", "enforcement_stage", "desired_outcome", "returns_filed", "priority_level", "risk_indicator"],
        properties: {
          full_name: ns, email: ns, client_type: ne(["individual", "company", "trust", "npo_organisation"]), company_name: ns, company_registration_number: ns,
          province: ns, city: ns, service_category: ne(["individual_tax", "business_tax", "accounting", "business_support", "trust_services", "npo_organisation_services"]), service_needed: ns,
          description: ns, document_summary: ns, authorised_representative: nb, efiling_access: ne(["Yes", "No", "Not sure"]), urgency: ne(["Urgent / Immediate", "Within a few days", "Flexible"]),
          has_debt_flag: nb, sars_debt_amount: nn, tax_types: ns, enforcement_stage: ns, desired_outcome: ns, returns_filed: nb,
          priority_level: ne(["low", "medium", "high", "urgent"]), risk_indicator: ne(["low", "medium", "high"])
        }
      }
    }
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: env("OPENAI_WHATSAPP_MODEL"), store: false, instructions, input: [{ role: "user", content }], text: { verbosity: "low", format: { type: "json_schema", name: "acapolite_whatsapp", strict: true, schema } } })
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenAI failed (${response.status}): ${raw.slice(0, 400)}`);
  const data = JSON.parse(raw);
  let output = typeof data?.output_text === "string" ? data.output_text : "";
  if (!output) for (const item of data?.output || []) for (const part of item?.content || []) if (part?.type === "output_text") output = part.text;
  if (!output) throw new Error("OpenAI returned no structured output");
  return JSON.parse(output) as AIResult;
}

async function storePrivateMedia(sb: any, conversationId: string, event: Incoming, bytes: Uint8Array, mime: string) {
  const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const safe = (event.filename || `whatsapp.${ext}`).replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `whatsapp/${conversationId}/${Date.now()}-${event.messageId}-${safe}`;
  const { error } = await sb.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(`Private media storage failed: ${error.message}`);
  return path;
}

async function linkDocuments(sb: any, conversationId: string, requestId: string) {
  const { data: rows, error } = await sb.from("whatsapp_messages").select("media_storage_path,media_filename,media_mime_type,media_size_bytes,created_at").eq("conversation_id", conversationId).eq("direction", "inbound").not("media_storage_path", "is", null);
  if (error) throw error;
  for (const row of rows || []) {
    const path = String(row.media_storage_path || "");
    if (!path) continue;
    const { data: exists } = await sb.from("service_request_documents").select("id").eq("service_request_id", requestId).eq("file_path", path).maybeSingle();
    if (exists) continue;
    await sb.from("service_request_documents").insert({ service_request_id: requestId, title: row.media_filename || "WhatsApp document", file_name: row.media_filename || path.split("/").pop() || "document", file_path: path, file_size: row.media_size_bytes || null, mime_type: row.media_mime_type || null, uploaded_at: row.created_at || new Date().toISOString() });
  }
}

async function notifyRequest(sb: any, requestId: string, p: any) {
  const common = { requestId, clientName: p.full_name, clientEmail: p.email, serviceType: String(p.service_needed || "Tax assistance").replace(/_/g, " "), province: p.province || "South Africa", status: "Open", priority: p.priority_level || "medium", submittedAt: new Date().toLocaleDateString("en-ZA"), summary: p.description };
  await Promise.allSettled([
    sb.functions.invoke("send-portal-email", { body: { type: "service_request_received", ...common, clientPhone: p.phone } }),
    sb.functions.invoke("send-portal-email", { body: { type: "service_request_received_admin", ...common } }),
    sb.functions.invoke("send-portal-email", { body: { type: "service_request_received_practitioner", ...common } })
  ]);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const challenge = url.searchParams.get("hub.challenge");
      const token = url.searchParams.get("hub.verify_token") || "";
      if (url.searchParams.get("hub.mode") === "subscribe" && challenge && timingSafeEqual(token, env("WHATSAPP_VERIFY_TOKEN"))) return new Response(challenge, { status: 200, headers: TEXT_HEADERS });
      return new Response("Forbidden", { status: 403, headers: TEXT_HEADERS });
    }
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: TEXT_HEADERS });

    const rawBody = await req.text();
    if (!(await validSignature(req, rawBody))) return new Response("Invalid signature", { status: 401, headers: TEXT_HEADERS });
    const events = incomingEvents(JSON.parse(rawBody));
    if (!events.length) return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: JSON_HEADERS });

    const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

    for (const event of events) {
      try {
        const { data: duplicate } = await sb.from("whatsapp_messages").select("id").eq("meta_message_id", event.messageId).maybeSingle();
        if (duplicate) continue;

        const patch: Record<string, unknown> = { wa_id: event.waId, phone_number: event.waId, last_inbound_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        if (event.displayName) patch.display_name = event.displayName;
        if (event.referral?.source_type) patch.referral_source = event.referral.source_type;
        if (event.referral?.source_id) patch.referral_ad_id = event.referral.source_id;
        if (event.referral?.headline) patch.referral_headline = event.referral.headline;
        if (event.referral?.ctwa_clid) patch.referral_campaign_id = event.referral.ctwa_clid;

        const { data: conversation, error: conversationError } = await sb.from("whatsapp_conversations").upsert(patch, { onConflict: "wa_id" }).select("id,status,ai_enabled,intake_payload,intake_missing_fields,service_request_id,submission_state").single();
        if (conversationError) throw conversationError;

        let attachment: { kind: "image" | "document"; bytes: Uint8Array; mime: string; filename?: string | null } | undefined;
        let mime = event.mime, size: number | null = null, sha256 = event.sha256, storagePath: string | null = null;
        if ((event.kind === "image" || event.kind === "document") && event.mediaId) {
          const media = await downloadMedia(event.mediaId);
          mime = media.mime; size = media.size; sha256 = media.sha256 || sha256;
          const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(mime || "");
          if (!allowed || (event.kind === "document" && mime !== "application/pdf")) {
            await sb.from("whatsapp_messages").insert({ conversation_id: conversation.id, meta_message_id: event.messageId, direction: "inbound", sender_type: "customer", message_type: event.kind, content: event.text || "[Document attached]", media_id: event.mediaId, media_mime_type: mime, media_filename: event.filename, media_size_bytes: size });
            await storeOutbound(sb, conversation.id, event.waId, await localize("Please resend that as a clear image or PDF and I can help from there.", event.text, []));
            continue;
          }
          storagePath = await storePrivateMedia(sb, conversation.id, event, media.bytes, mime || "application/octet-stream");
          attachment = { kind: event.kind, bytes: media.bytes, mime: mime || "application/octet-stream", filename: event.filename };
        }

        const inbound = event.text || (event.kind === "image" ? "[Image attached]" : event.kind === "document" ? "[Document attached]" : "[Unsupported WhatsApp message]");
        const { error: inboundError } = await sb.from("whatsapp_messages").insert({ conversation_id: conversation.id, meta_message_id: event.messageId, direction: "inbound", sender_type: "customer", message_type: event.kind, content: inbound, media_id: event.mediaId, media_mime_type: mime, media_filename: event.filename, media_sha256: sha256, media_size_bytes: size, media_storage_path: storagePath });
        if (inboundError?.code === "23505") continue;
        if (inboundError) throw inboundError;

        if (event.kind === "unsupported") {
          await storeOutbound(sb, conversation.id, event.waId, await localize("Please send that as text, an image or a PDF and I’ll help you from there.", event.text, []));
          continue;
        }
        if (!conversation.ai_enabled || conversation.status === "human_handoff") continue;

        if (event.kind === "text" && requestsHumanHandoff(event.text)) {
          await sb.from("whatsapp_conversations").update({ status: "human_handoff", ai_enabled: false, human_handoff_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);
          await storeOutbound(sb, conversation.id, event.waId, "Of course. I’ll hand this chat over to the Acapolite team so someone can assist you.", "system");
          continue;
        }

        const { data: rows } = await sb.from("whatsapp_messages").select("direction,content").eq("conversation_id", conversation.id).neq("meta_message_id", event.messageId).order("created_at", { ascending: false }).limit(16);
        const history = [...(rows || [])].reverse();
        const current = (conversation.intake_payload || {}) as Intake;
        const ai = await askAI(history, event.text, current, conversation.submission_state || "collecting", attachment);

        if (ai.human_handoff_requested) {
          await sb.from("whatsapp_conversations").update({ status: "human_handoff", ai_enabled: false, human_handoff_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);
          await storeOutbound(sb, conversation.id, event.waId, await localize("Of course. I’ll hand this chat over to the Acapolite team so someone can assist you.", event.text, history), "system");
          continue;
        }

        const extracted = normalizeKnownLocation(ai.extracted);
        const conflict = locationConflict(current, extracted);
        const next = mergeIntake(current, extracted, event.waId, event.displayName, Boolean(conflict));
        const missing = coreMissing(next);
        const ready = missing.length === 0;
        await sb.from("whatsapp_conversations").update({ intake_payload: next, intake_missing_fields: missing, intake_ready: ready, intake_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);

        if (conflict) {
          await sb.from("whatsapp_conversations").update({ submission_state: "collecting" }).eq("id", conversation.id);
          await storeOutbound(sb, conversation.id, event.waId, await localize(`You mentioned ${conflict.compared}, but ${conflict.city} is in ${conflict.expected}. Which location should I use?`, event.text, history));
          continue;
        }

        if (conversation.service_request_id) {
          const p = requestPayload(next);
          await sb.from("service_requests").update({ ...p, updated_at: new Date().toISOString() }).eq("id", conversation.service_request_id);
          if (storagePath) await linkDocuments(sb, conversation.id, conversation.service_request_id);
          let answer = cleanReply(ai.reply);
          if (containsFalseActionClaim(answer)) answer = "A practitioner will decide the correct next step after reviewing the matter.";
          if (answer && looksLikeQuestion(event.text)) await storeOutbound(sb, conversation.id, event.waId, answer);
          else await storeOutbound(sb, conversation.id, event.waId, await localize("Thanks. The new information is now part of your Acapolite request.", event.text, history));
          continue;
        }

        if (ready && conversation.submission_state === "awaiting_confirmation") {
          if (ai.submission_decision === "yes") {
            const p = requestPayload(next);
            const { data: created, error } = await sb.from("service_requests").insert(p).select("id").single();
            if (error || !created?.id) throw new Error(`Service request creation failed: ${error?.message || "unknown"}`);
            await linkDocuments(sb, conversation.id, created.id);
            await sb.from("whatsapp_conversations").update({ service_request_id: created.id, submission_state: "submitted", intake_ready: true, updated_at: new Date().toISOString() }).eq("id", conversation.id);
            await notifyRequest(sb, created.id, p);
            await storeOutbound(sb, conversation.id, event.waId, await localize("Your Acapolite request has been created and sent to the team for review. Any documents you sent here are attached to the request. Nothing has been submitted to SARS yet.", event.text, history), "system");
            continue;
          }
          if (ai.submission_decision === "no") {
            await sb.from("whatsapp_conversations").update({ submission_state: "collecting" }).eq("id", conversation.id);
            await storeOutbound(sb, conversation.id, event.waId, await localize("That’s fine. I won’t create the request yet.", event.text, history));
            continue;
          }
          await storeOutbound(sb, conversation.id, event.waId, await localize("I have enough information to create your Acapolite request. Would you like me to create it now?", event.text, history));
          continue;
        }

        const priority = nextPriority(next);
        if (!priority && ready) {
          await sb.from("whatsapp_conversations").update({ submission_state: "awaiting_confirmation" }).eq("id", conversation.id);
          await storeOutbound(sb, conversation.id, event.waId, await localize("I have enough information to create your Acapolite request. Would you like me to create it now?", event.text, history));
          continue;
        }

        let answer = cleanReply(ai.reply);
        const question = priority ? await localize(QUESTION[priority] || "What else should we know about the matter?", event.text, history) : "";
        if (containsFalseActionClaim(answer)) answer = "A practitioner should review the matter before any formal step is taken.";
        const safeQuestion = repeatedQuestion(answer, question) ? "" : question;
        if (answer && looksLikeQuestion(event.text)) {
          const combined = cleanReply(`${answer}\n\n${safeQuestion}`);
          await storeOutbound(sb, conversation.id, event.waId, combined || safeQuestion || answer);
        } else {
          await storeOutbound(sb, conversation.id, event.waId, safeQuestion || answer || await localize("How can we help with this matter?", event.text, history));
        }
      } catch (messageError) {
        console.error("message processing error", messageError instanceof Error ? messageError.message : messageError);
        try {
          const { data: convo } = await sb.from("whatsapp_conversations").select("id").eq("wa_id", event.waId).maybeSingle();
          if (convo?.id) await storeOutbound(sb, convo.id, event.waId, "Sorry, I had a technical problem with that message. Please send it again.", "system");
        } catch (fallbackError) {
          console.error("fallback send error", fallbackError instanceof Error ? fallbackError.message : fallbackError);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    console.error("whatsapp-agent error", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: JSON_HEADERS });
  }
});
