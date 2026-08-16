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
  referral?: { source_type?: string; source_id?: string; headline?: string; ctwa_clid?: string };
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

type IntakePayload = Record<string, unknown>;
type ClientType = "individual" | "company" | "trust" | "npo_organisation";
type ServiceCategory = "individual_tax" | "business_tax" | "accounting" | "business_support" | "trust_services" | "npo_organisation_services";

type AIResult = {
  reply: string;
  extracted: {
    full_name: string | null;
    email: string | null;
    client_type: ClientType | null;
    company_name: string | null;
    company_registration_number: string | null;
    province: string | null;
    city: string | null;
    service_category: ServiceCategory | null;
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
    authorised_representative: boolean | null;
    document_summary: string | null;
    efiling_access: "Yes" | "No" | "Not sure" | null;
    urgency: "Urgent / Immediate" | "Within a few days" | "Flexible" | null;
    business_structure: string | null;
    annual_turnover: string | null;
    employee_count: string | null;
    tax_years: string | null;
  };
};

const serviceNeededValues = [
  "individual_personal_income_tax_returns","individual_late_return_submissions","individual_tax_number_registration","individual_tax_compliance_issues","individual_tax_status_corrections","individual_tax_clearance_certificates","individual_tax_compliance_status_assistance","individual_voluntary_disclosure_programme","individual_sars_verification_refund_assistance","individual_tax_directives","individual_sars_debt_assistance","individual_estate_pension_tax_matters","individual_objections_and_disputes","individual_other",
  "business_vat_registration","business_paye_registration","business_tax_clearance_certificates","business_vat_returns","business_paye_compliance","business_company_income_tax","business_tax_compliance_support","business_vat_paye_corrections","business_tax_debt_compromise","business_sars_debt_arrangements","business_vat_objections_disputes","business_sars_audits_support","business_tax_other",
  "accounting_bookkeeping","accounting_payroll_services","accounting_monthly_accounting_services","accounting_financial_statements","accounting_management_accounts","accounting_cash_flow_management","accounting_budget_planning","accounting_annual_financial_reporting","accounting_independent_reviews","accounting_other",
  "support_company_registration","support_cipc_services","support_annual_returns_filing","support_beneficial_ownership_filings","support_director_shareholder_changes","support_business_compliance","support_financial_compliance","support_business_advisory","support_bee_assistance","business_support_other",
  "trust_tax_returns","trust_compliance","trust_tax_clearance","trust_sars_assistance","trust_financial_statements","trust_representative_assistance","trust_advisory_support","trust_sars_disputes_objections","trust_other",
  "npo_registration_assistance","npo_tax_exemption_assistance","npo_annual_compliance_filing","npo_sars_compliance","npo_payroll_accounting","npo_financial_reporting","npo_pbo_applications_assistance","npo_donor_tax_section18a_assistance","npo_governance_advisory","npo_audit_compliance_support","npo_organisation_other"
] as const;

function extractIncomingEvents(payload: unknown): IncomingEvent[] {
  const root = payload as Record<string, unknown>;
  const events: IncomingEvent[] = [];
  const entries = Array.isArray(root?.entry) ? root.entry : [];
  for (const entry of entries as Array<Record<string, unknown>>) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes as Array<Record<string, unknown>>) {
      const value = change.value as Record<string, unknown> | undefined;
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      const names = new Map<string, string>();
      for (const contact of contacts as Array<Record<string, unknown>>) {
        const waId = String(contact.wa_id || "").trim();
        const profile = contact.profile as Record<string, unknown> | undefined;
        const name = String(profile?.name || "").trim();
        if (waId && name) names.set(waId, name);
      }
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      for (const message of messages as MetaMessage[]) {
        const waId = String(message.from || "").trim();
        const messageId = String(message.id || "").trim();
        if (!waId || !messageId) continue;
        let kind: IncomingEvent["kind"] = "unsupported";
        let text = "";
        let media: MetaMedia | undefined;
        if (message.type === "text") {
          kind = "text";
          text = String(message.text?.body || "").trim();
          if (!text) continue;
        } else if (message.type === "image") {
          kind = "image";
          media = message.image;
          text = String(media?.caption || "").trim();
        } else if (message.type === "document") {
          kind = "document";
          media = message.document;
          text = String(media?.caption || "").trim();
        }
        events.push({ waId, messageId, kind, text, displayName: names.get(waId) || null, referral: message.referral || null, mediaId: media?.id?.trim() || null, mediaMimeType: media?.mime_type?.trim() || null, mediaFilename: media?.filename?.trim() || null, mediaSha256: media?.sha256?.trim() || null });
      }
    }
  }
  return events;
}

function normalizeForPrompt(value: string, max = 2500) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
function normalizePhone(waId: string) {
  const digits = waId.replace(/\D/g, "");
  return digits ? `+${digits}` : waId;
}
function wantsHuman(text: string) {
  return /\b(human|real person|admin|call me|phone me|speak to someone|talk to someone)\b/i.test(text);
}
function positiveProceedIntent(text: string) {
  return /\b(yes|yes please|please do|go ahead|proceed|continue|let'?s continue|start|submit|send it|what'?s next|what do i do|okay|ok|ohk)\b/i.test(text);
}
function simplePostSubmission(text: string) {
  return /^(ok|okay|ohk|yes|thanks|thank you|perfect|great|what'?s next|then what'?s next|what do i do|now what)\??[.!]?$/i.test(text.trim());
}
function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function downloadMetaMedia(mediaId: string) {
  const token = requiredEnv("WHATSAPP_ACCESS_TOKEN");
  const version = requiredEnv("WHATSAPP_GRAPH_API_VERSION");
  const lookup = await fetch(`https://graph.facebook.com/${version}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  const metadata = await lookup.json().catch(() => ({}));
  if (!lookup.ok || !metadata?.url) throw new Error(`Meta media lookup failed (${lookup.status})`);
  if (Number(metadata.file_size || 0) > MAX_MEDIA_BYTES) throw new Error("Attachment too large");
  const response = await fetch(String(metadata.url), { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Meta media download failed (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_MEDIA_BYTES) throw new Error("Attachment too large");
  return { bytes, mimeType: String(metadata.mime_type || response.headers.get("content-type") || "application/octet-stream"), sha256: String(metadata.sha256 || "") || null, fileSize: bytes.byteLength };
}

function mergeIntake(current: IntakePayload, extracted: AIResult["extracted"], waId: string, displayName: string | null) {
  const next: IntakePayload = { ...current, phone: normalizePhone(waId), source: "whatsapp_admin_ai" };
  if (!next.whatsapp_display_name && displayName) next.whatsapp_display_name = displayName;
  for (const [key, value] of Object.entries(extracted)) if (value !== null && value !== "") next[key] = value;
  if (typeof next.description === "string") next.description = normalizeForPrompt(next.description, 5000);
  return next;
}

function missingFields(intake: IntakePayload) {
  const missing: string[] = [];
  if (!intake.full_name) missing.push("full_name");
  if (!intake.client_type) missing.push("client_type");
  if (!intake.service_needed) missing.push("service_needed");
  if (!intake.description) missing.push("description");
  if (!intake.province) missing.push("province");
  if (intake.province !== "Any / Nationwide" && !intake.city) missing.push("city");
  if (!intake.email) missing.push("email");
  if (intake.client_type === "company" && !intake.company_name) missing.push("company_name");
  if (intake.has_debt_flag === true && intake.sars_debt_amount === undefined) missing.push("sars_debt_amount");
  return missing;
}

function nextQuestion(missing: string[], intake: IntakePayload) {
  const first = typeof intake.full_name === "string" ? intake.full_name.split(/\s+/)[0] : "the client";
  const map: Record<string, string> = {
    full_name: "What is the client’s full name?",
    client_type: "Is this for an individual, company, trust or NPO?",
    service_needed: "What would you like us to help with?",
    description: "Can you briefly tell me what happened and what you need help with?",
    province: `Which province is ${first} based in?`,
    city: `Which town or city is ${first} based in?`,
    email: `What email address can we use for ${first}?`,
    company_name: "What is the company name?",
    sars_debt_amount: "Approximately how much does SARS say is owed?"
  };
  return map[missing[0]] || "What other important detail should we know?";
}

function inferCategory(intake: IntakePayload): ServiceCategory {
  const explicit = String(intake.service_category || "");
  if (["individual_tax","business_tax","accounting","business_support","trust_services","npo_organisation_services"].includes(explicit)) return explicit as ServiceCategory;
  const service = String(intake.service_needed || "");
  if (service.startsWith("business_") || ["vat_registration","company_tax","paye_issues"].includes(service)) return "business_tax";
  if (service.startsWith("accounting_") || service === "bookkeeping") return "accounting";
  if (service.startsWith("support_")) return "business_support";
  if (service.startsWith("trust_")) return "trust_services";
  if (service.startsWith("npo_")) return "npo_organisation_services";
  if (intake.client_type === "company") return "business_tax";
  if (intake.client_type === "trust") return "trust_services";
  if (intake.client_type === "npo_organisation") return "npo_organisation_services";
  return "individual_tax";
}

function serviceLabel(service: string) {
  const special: Record<string, string> = {
    individual_tax_compliance_issues: "Review of SARS Notices and Letters",
    individual_sars_debt_assistance: "SARS Debt Assistance",
    business_sars_debt_arrangements: "SARS Debt Arrangements",
    business_tax_debt_compromise: "Tax Debt Compromise",
    business_vat_registration: "VAT Registration",
    support_company_registration: "Company Registration (CIPC)"
  };
  return special[service] || service.replace(/^(individual|business|accounting|support|trust|npo)_/, "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildServiceIntake(intake: IntakePayload, category: ServiceCategory, service: string) {
  const answers: Record<string, string> = {};
  if (intake.efiling_access) answers.hasEfilingAccess = String(intake.efiling_access);
  if (intake.urgency) answers.urgency = String(intake.urgency);
  if (intake.business_structure) answers.businessStructure = String(intake.business_structure);
  if (intake.annual_turnover) answers.annualTurnover = String(intake.annual_turnover);
  if (intake.employee_count) answers.employeeCount = String(intake.employee_count);
  if (intake.tax_years) answers.taxYears = String(intake.tax_years);
  return {
    who: { entityType: intake.client_type, province: intake.province, city: intake.city || "" },
    what: { selectedServices: [{ value: service, label: serviceLabel(service), category }], otherDetails: {} },
    details: { answers, additionalNotes: String(intake.description || ""), questions: [] },
    contact: { fullName: intake.full_name, email: intake.email, province: intake.province, city: intake.city || "", contactPreference: "WhatsApp", marketingConsent: false, phone: intake.phone },
    whatsapp: {
      source: "whatsapp_admin_ai",
      authorisedRepresentative: intake.authorised_representative ?? null,
      documentSummary: intake.document_summary ?? null,
      displayName: intake.whatsapp_display_name ?? null,
      sarsDebtAmount: intake.sars_debt_amount ?? null,
      returnsFiled: intake.returns_filed ?? null,
      hasSarsAudit: intake.has_sars_audit ?? false,
      hasAdr: intake.has_adr ?? false,
      hasVatInvestigation: intake.has_vat_investigation ?? false,
      hasPayrollDispute: intake.has_payroll_dispute ?? false,
      allCapturedDetails: intake
    }
  };
}

function buildRequestPayload(intake: IntakePayload) {
  const service = String(intake.service_needed || "individual_tax_compliance_issues");
  const safeService = serviceNeededValues.includes(service as typeof serviceNeededValues[number]) ? service : (intake.client_type === "company" ? "business_tax_other" : "individual_other");
  const category = inferCategory({ ...intake, service_needed: safeService });
  const returnsFiled = typeof intake.returns_filed === "boolean" ? intake.returns_filed : true;
  return {
    full_name: String(intake.full_name || "").trim(),
    email: String(intake.email || "").trim().toLowerCase(),
    phone: String(intake.phone || "").trim(),
    client_type: intake.client_type,
    company_name: intake.client_type === "company" ? String(intake.company_name || "").trim() || null : null,
    company_registration_number: intake.client_type === "company" ? String(intake.company_registration_number || "").trim() || null : null,
    service_category: category,
    service_categories: [category],
    service_needed: safeService,
    service_needed_list: [safeService],
    priority_level: intake.priority_level || "medium",
    description: String(intake.description || "").trim(),
    sars_debt_amount: Number(intake.sars_debt_amount || 0),
    returns_filed: returnsFiled,
    has_debt_flag: Boolean(intake.has_debt_flag),
    missing_returns_flag: returnsFiled === false,
    missing_documents_flag: true,
    risk_indicator: intake.risk_indicator || "low",
    has_sars_audit: Boolean(intake.has_sars_audit),
    has_adr: Boolean(intake.has_adr),
    has_vat_investigation: Boolean(intake.has_vat_investigation),
    has_payroll_dispute: Boolean(intake.has_payroll_dispute),
    has_multiple_tax_types: Boolean(intake.has_multiple_tax_types),
    has_legal_complexity: Boolean(intake.has_legal_complexity),
    province: String(intake.province || "").trim() || null,
    city: String(intake.city || "").trim() || null,
    contact_preference: "WhatsApp",
    marketing_consent: false,
    submitted_with_account: false,
    client_profile_id: null,
    intake_payload: buildServiceIntake(intake, category, safeService)
  };
}

function cleanReply(raw: string) {
  let text = raw.replace(/[—–]/g, ",").replace(/^\s*[-•]\s+/gm, "").replace(/\n{3,}/g, "\n\n").trim();
  const questions = [...text.matchAll(/\?/g)];
  if (questions.length > 1) text = text.slice(0, (questions[0].index || 0) + 1);
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).slice(0, 3);
  text = paras.join("\n\n");
  if (text.length > 600) {
    const cut = text.slice(0, 600);
    const stop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"));
    text = (stop > 250 ? cut.slice(0, stop + 1) : cut).trim();
  }
  return text;
}

function extractStructured(response: Record<string, unknown>) {
  const direct = typeof response.output_text === "string" ? response.output_text.trim() : "";
  if (direct) return JSON.parse(direct) as AIResult;
  for (const item of (Array.isArray(response.output) ? response.output : []) as Array<Record<string, unknown>>) {
    for (const part of (Array.isArray(item.content) ? item.content : []) as Array<Record<string, unknown>>) {
      if (part.type === "output_text" && typeof part.text === "string") return JSON.parse(part.text) as AIResult;
    }
  }
  throw new Error("OpenAI returned no structured output");
}

async function callOpenAI(history: { direction: string; content: string | null }[], latest: string, current: IntakePayload, missing: string[], submitted: boolean, attachment?: { kind: "image" | "document"; bytes: Uint8Array; mimeType: string; filename?: string | null }) {
  const recent = history.filter((m) => m.content).slice(-14).map((m) => `${m.direction === "inbound" ? "Customer" : "Acapolite"}: ${normalizeForPrompt(m.content || "", 700)}`).join("\n");
  const instructions = [
    "You are a real sounding Acapolite office assistant chatting on WhatsApp in South Africa.",
    "Be warm, capable and concise. Do not sound like a bot, form or call centre script.",
    "Use the current captured details and recent conversation as memory. Never ask for a fact already known, including facts extracted from an earlier document.",
    "Extract every relevant new fact even if the customer changes topic or gives several answers at once.",
    "Answer side questions naturally first. If the request is not submitted, then gently ask one genuinely missing useful question.",
    "Write short WhatsApp paragraphs with blank lines. Ask at most one question. Never use em dashes or en dashes.",
    "Do not say recorded, captured, intake, database, field, workflow or backend.",
    "Do not repeat document lists unless asked. Do not ask for ID numbers, passwords, OTPs, bank PINs or card details.",
    "Never claim an external action happened unless the system context says it already happened.",
    submitted ? "The service request is already submitted. Do not restart intake or ask the customer to submit it again. You may answer questions and extract later clarifications." : "The service request is not yet submitted. Do not promise a link or say you submitted anything.",
    "When reading images or PDFs, extract document type, dates, requested actions and other useful case facts. If a date was already extracted, use it later instead of asking for it again.",
    `service_needed must be one of: ${serviceNeededValues.join(", ")}. Choose the closest exact service. For a SARS Request for Relevant Material about eFiling registration, normally use individual_tax_compliance_issues unless the conversation clearly indicates another service.`,
    "description must remain a concise consolidated case summary, not merely the latest message. Use null for unknown extracted values."
  ].join(" ");
  const context = [`REQUEST SUBMITTED: ${submitted ? "yes" : "no"}`, `CURRENT CAPTURED DETAILS: ${JSON.stringify(current)}`, `MISSING CORE DETAILS: ${missing.join(", ") || "none"}`, recent ? `RECENT CHAT:\n${recent}` : "", `LATEST CUSTOMER MESSAGE: ${normalizeForPrompt(latest || "Please review the attached document.")}`].filter(Boolean).join("\n\n");
  const content: Record<string, unknown>[] = [{ type: "input_text", text: context }];
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
      model: requiredEnv("OPENAI_WHATSAPP_MODEL"), instructions, input: [{ role: "user", content }], store: false,
      text: { verbosity: "low", format: { type: "json_schema", name: "acapolite_whatsapp", strict: true, schema: {
        type: "object", additionalProperties: false, required: ["reply","extracted"], properties: {
          reply: { type: "string" }, extracted: { type: "object", additionalProperties: false,
            required: ["full_name","email","client_type","company_name","company_registration_number","province","city","service_category","service_needed","description","sars_debt_amount","returns_filed","has_debt_flag","has_sars_audit","has_adr","has_vat_investigation","has_payroll_dispute","has_multiple_tax_types","has_legal_complexity","priority_level","risk_indicator","authorised_representative","document_summary","efiling_access","urgency","business_structure","annual_turnover","employee_count","tax_years"],
            properties: {
              full_name: nullableString, email: nullableString, client_type: nullableEnum(["individual","company","trust","npo_organisation"]), company_name: nullableString, company_registration_number: nullableString, province: nullableString, city: nullableString,
              service_category: nullableEnum(["individual_tax","business_tax","accounting","business_support","trust_services","npo_organisation_services"]), service_needed: nullableEnum([...serviceNeededValues]), description: nullableString, sars_debt_amount: nullableNumber, returns_filed: nullableBoolean, has_debt_flag: nullableBoolean, has_sars_audit: nullableBoolean, has_adr: nullableBoolean, has_vat_investigation: nullableBoolean, has_payroll_dispute: nullableBoolean, has_multiple_tax_types: nullableBoolean, has_legal_complexity: nullableBoolean,
              priority_level: nullableEnum(["low","medium","high","urgent"]), risk_indicator: nullableEnum(["low","medium","high"]), authorised_representative: nullableBoolean, document_summary: nullableString, efiling_access: nullableEnum(["Yes","No","Not sure"]), urgency: nullableEnum(["Urgent / Immediate","Within a few days","Flexible"]), business_structure: nullableString, annual_turnover: nullableString, employee_count: nullableString, tax_years: nullableString
            }
          }
        }
      } } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI failed (${response.status}): ${(await response.text()).slice(0, 600)}`);
  return extractStructured((await response.json()) as Record<string, unknown>);
}

async function sendWhatsAppText(to: string, body: string) {
  const response = await fetch(`https://graph.facebook.com/${requiredEnv("WHATSAPP_GRAPH_API_VERSION")}/${requiredEnv("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${requiredEnv("WHATSAPP_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Meta send failed (${response.status})`);
  return String(data?.messages?.[0]?.id || "").trim() || null;
}

async function storeOutbound(supabase: ReturnType<typeof createClient>, conversationId: string, waId: string, text: string, sender = "ai") {
  const metaId = await sendWhatsAppText(waId, text);
  await supabase.from("whatsapp_messages").insert({ conversation_id: conversationId, meta_message_id: metaId, direction: "outbound", sender_type: sender, message_type: "text", content: text, delivery_status: "submitted" });
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
    if (!events.length) return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: jsonHeaders });

    const supabase = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

    for (const event of events) {
      const { data: duplicate } = await supabase.from("whatsapp_messages").select("id").eq("meta_message_id", event.messageId).maybeSingle();
      if (duplicate) continue;
      const referral = event.referral || {};
      const patch: Record<string, unknown> = { wa_id: event.waId, phone_number: event.waId, last_inbound_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (event.displayName) patch.display_name = event.displayName;
      if (referral?.source_type) patch.referral_source = referral.source_type;
      if (referral?.source_id) patch.referral_ad_id = referral.source_id;
      if (referral?.headline) patch.referral_headline = referral.headline;
      if (referral?.ctwa_clid) patch.referral_campaign_id = referral.ctwa_clid;
      const { data: conversation, error: conversationError } = await supabase.from("whatsapp_conversations").upsert(patch, { onConflict: "wa_id" }).select("id,status,ai_enabled,intake_payload,intake_missing_fields,intake_ready,service_request_id").single();
      if (conversationError) throw conversationError;

      let attachment: { kind: "image" | "document"; bytes: Uint8Array; mimeType: string; filename?: string | null } | undefined;
      let mediaSize: number | null = null;
      let mime = event.mediaMimeType;
      let sha = event.mediaSha256;
      if ((event.kind === "image" || event.kind === "document") && event.mediaId) {
        const media = await downloadMetaMedia(event.mediaId);
        mediaSize = media.fileSize; mime = media.mimeType || mime; sha = media.sha256 || sha;
        if (event.kind === "document" && mime !== "application/pdf") {
          await supabase.from("whatsapp_messages").insert({ conversation_id: conversation.id, meta_message_id: event.messageId, direction: "inbound", sender_type: "customer", message_type: event.kind, content: event.text || "[Document attached]", media_id: event.mediaId, media_mime_type: mime, media_filename: event.mediaFilename, media_sha256: sha, media_size_bytes: mediaSize });
          await storeOutbound(supabase, conversation.id, event.waId, "Please resend that document as a PDF if you can. I can read PDFs and images here.");
          continue;
        }
        attachment = { kind: event.kind, bytes: media.bytes, mimeType: mime || "application/octet-stream", filename: event.mediaFilename };
      }

      const inboundContent = event.text || (event.kind === "image" ? "[Image attached]" : event.kind === "document" ? "[Document attached]" : "[Unsupported WhatsApp message]");
      const { error: inboundError } = await supabase.from("whatsapp_messages").insert({ conversation_id: conversation.id, meta_message_id: event.messageId, direction: "inbound", sender_type: "customer", message_type: event.kind, content: inboundContent, media_id: event.mediaId, media_mime_type: mime, media_filename: event.mediaFilename, media_sha256: sha, media_size_bytes: mediaSize });
      if (inboundError?.code === "23505") continue;
      if (inboundError) throw inboundError;

      if (event.kind === "unsupported") {
        await storeOutbound(supabase, conversation.id, event.waId, "Please send that as text, an image or a PDF and I’ll help you from there.");
        continue;
      }
      if (wantsHuman(event.text)) {
        await supabase.from("whatsapp_conversations").update({ status: "human_handoff", ai_enabled: false, human_handoff_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);
        await storeOutbound(supabase, conversation.id, event.waId, "Of course. I’ve paused the automated replies so the Acapolite team can take over this chat.", "system");
        continue;
      }
      if (!conversation.ai_enabled || conversation.status === "human_handoff") continue;

      if (conversation.service_request_id && !attachment && simplePostSubmission(event.text)) {
        await storeOutbound(supabase, conversation.id, event.waId, "Your request has already been sent through to Acapolite.\n\nNothing else is needed from you right now.");
        continue;
      }

      const { data: history, error: historyError } = await supabase.from("whatsapp_messages").select("direction,content").eq("conversation_id", conversation.id).neq("meta_message_id", event.messageId).order("created_at", { ascending: false }).limit(14);
      if (historyError) throw historyError;
      const current = (conversation.intake_payload || {}) as IntakePayload;
      const before = Array.isArray(conversation.intake_missing_fields) ? conversation.intake_missing_fields : missingFields(current);
      const ai = await callOpenAI([...(history || [])].reverse(), event.text, current, before, Boolean(conversation.service_request_id), attachment);
      const merged = mergeIntake(current, ai.extracted, event.waId, event.displayName);
      const after = missingFields(merged);
      const ready = after.length === 0;
      await supabase.from("whatsapp_conversations").update({ intake_payload: merged, intake_missing_fields: after, intake_ready: ready, intake_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);

      if (conversation.service_request_id) {
        const requestPayload = buildRequestPayload(merged);
        const { error: updateError } = await supabase.from("service_requests").update({ ...requestPayload, updated_at: new Date().toISOString() }).eq("id", conversation.service_request_id);
        if (updateError) console.error("service request sync failed", updateError.message);
        await storeOutbound(supabase, conversation.id, event.waId, cleanReply(ai.reply));
        continue;
      }

      const recentInbound = [...(history || [])].filter((m) => m.direction === "inbound").map((m) => m.content || "").slice(-8).join(" ");
      const proceed = positiveProceedIntent(`${recentInbound} ${event.text}`);
      if (ready && proceed) {
        const payload = buildRequestPayload(merged);
        const { data: created, error: createError } = await supabase.from("service_requests").insert(payload).select("id").single();
        if (createError || !created?.id) {
          console.error("service request creation failed", createError?.message);
          await supabase.from("whatsapp_conversations").update({ status: "human_handoff", ai_enabled: false, human_handoff_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);
          await storeOutbound(supabase, conversation.id, event.waId, "I have the details I need, but I’m having trouble sending them through right now.\n\nI’ve flagged this for the Acapolite team.", "system");
          continue;
        }
        await supabase.from("whatsapp_conversations").update({ service_request_id: created.id, intake_ready: true, last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);
        await storeOutbound(supabase, conversation.id, event.waId, "Done, your details have been sent through to Acapolite.\n\nYou don’t need to do anything else right now.");
        continue;
      }

      if (ready) {
        await storeOutbound(supabase, conversation.id, event.waId, "I have enough information to send this through to Acapolite.\n\nWould you like me to submit it?");
        continue;
      }
      const reply = cleanReply(ai.reply);
      const safe = reply && !/\b(intake|database|workflow|backend)\b/i.test(reply) ? reply : nextQuestion(after, merged);
      await storeOutbound(supabase, conversation.id, event.waId, safe);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error("whatsapp-agent error", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ ok: false, error: "Webhook processing failed" }), { status: 500, headers: jsonHeaders });
  }
});