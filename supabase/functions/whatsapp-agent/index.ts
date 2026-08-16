import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };
const textHeaders = { "Content-Type": "text/plain" };
const encoder = new TextEncoder();
const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const MEDIA_BUCKET = "service-request-attachments";

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
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
  submission_decision: "yes" | "no" | "unclear";
  human_handoff_requested: boolean;
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

const serviceNeededValues = new Set([
  "individual_personal_income_tax_returns","individual_late_return_submissions","individual_tax_number_registration","individual_tax_compliance_issues","individual_tax_status_corrections","individual_tax_clearance_certificates","individual_tax_compliance_status_assistance","individual_voluntary_disclosure_programme","individual_sars_verification_refund_assistance","individual_tax_directives","individual_sars_debt_assistance","individual_estate_pension_tax_matters","individual_objections_and_disputes","individual_other",
  "business_vat_registration","business_paye_registration","business_tax_clearance_certificates","business_vat_returns","business_paye_compliance","business_company_income_tax","business_tax_compliance_support","business_vat_paye_corrections","business_tax_debt_compromise","business_sars_debt_arrangements","business_vat_objections_disputes","business_sars_audits_support","business_tax_other",
  "accounting_bookkeeping","accounting_payroll_services","accounting_monthly_accounting_services","accounting_financial_statements","accounting_management_accounts","accounting_cash_flow_management","accounting_budget_planning","accounting_annual_financial_reporting","accounting_independent_reviews","accounting_other",
  "support_company_registration","support_cipc_services","support_annual_returns_filing","support_beneficial_ownership_filings","support_director_shareholder_changes","support_business_compliance","support_financial_compliance","support_business_advisory","support_bee_assistance","business_support_other",
  "trust_tax_returns","trust_compliance","trust_tax_clearance","trust_sars_assistance","trust_financial_statements","trust_representative_assistance","trust_advisory_support","trust_sars_disputes_objections","trust_other",
  "npo_registration_assistance","npo_tax_exemption_assistance","npo_annual_compliance_filing","npo_sars_compliance","npo_payroll_accounting","npo_financial_reporting","npo_pbo_applications_assistance","npo_donor_tax_section18a_assistance","npo_governance_advisory","npo_audit_compliance_support","npo_organisation_other"
]);

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
        events.push({
          waId, messageId, kind, text,
          displayName: names.get(waId) || null,
          referral: message.referral || null,
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

function normalizeForPrompt(value: string, max = 2500) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
function normalizePhone(waId: string) {
  const digits = waId.replace(/\D/g, "");
  return digits ? `+${digits}` : waId;
}
function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function extensionForMime(mime: string) {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
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
  return {
    bytes,
    mimeType: String(metadata.mime_type || response.headers.get("content-type") || "application/octet-stream"),
    sha256: String(metadata.sha256 || "") || null,
    fileSize: bytes.byteLength,
  };
}

const cityProvinceMap: Record<string, string> = {
  pretoria: "Gauteng", tshwane: "Gauteng", johannesburg: "Gauteng", sandton: "Gauteng", midrand: "Gauteng", germiston: "Gauteng", benoni: "Gauteng", boksburg: "Gauteng", nigel: "Gauteng",
  "cape town": "Western Cape", stellenbosch: "Western Cape", paarl: "Western Cape", george: "Western Cape",
  durban: "KwaZulu-Natal", pietermaritzburg: "KwaZulu-Natal", richardsbay: "KwaZulu-Natal", "richards bay": "KwaZulu-Natal",
  mbombela: "Mpumalanga", nelspruit: "Mpumalanga", witbank: "Mpumalanga", emalahleni: "Mpumalanga",
  polokwane: "Limpopo", thohoyandou: "Limpopo", mahikeng: "North West", mafikeng: "North West", rustenburg: "North West",
  bloemfontein: "Free State", kimberley: "Northern Cape", "port elizabeth": "Eastern Cape", gqeberha: "Eastern Cape", "east london": "Eastern Cape"
};

function locationConflict(current: IntakePayload, extracted: AIResult["extracted"]) {
  const newCity = extracted.city?.trim();
  const newProvince = extracted.province?.trim();
  const currentProvince = typeof current.province === "string" ? current.province.trim() : "";
  const currentCity = typeof current.city === "string" ? current.city.trim() : "";
  if (newCity) {
    const expected = cityProvinceMap[newCity.toLowerCase()];
    const provinceToCheck = newProvince || currentProvince;
    if (expected && provinceToCheck && expected.toLowerCase() !== provinceToCheck.toLowerCase()) return { city: newCity, expectedProvince: expected, conflictingProvince: provinceToCheck };
  }
  if (newProvince && currentCity) {
    const expected = cityProvinceMap[currentCity.toLowerCase()];
    if (expected && expected.toLowerCase() !== newProvince.toLowerCase()) return { city: currentCity, expectedProvince: expected, conflictingProvince: newProvince };
  }
  return null;
}

function mergeIntake(current: IntakePayload, extracted: AIResult["extracted"], waId: string, displayName: string | null, skipLocation = false) {
  const next: IntakePayload = { ...current, phone: normalizePhone(waId), source: "whatsapp_admin_ai" };
  if (!next.whatsapp_display_name && displayName) next.whatsapp_display_name = displayName;
  for (const [key, value] of Object.entries(extracted)) {
    if (value === null || value === "") continue;
    if (skipLocation && (key === "city" || key === "province")) continue;
    next[key] = value;
  }
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

function inferCategory(intake: IntakePayload): ServiceCategory {
  const explicit = String(intake.service_category || "");
  if (["individual_tax","business_tax","accounting","business_support","trust_services","npo_organisation_services"].includes(explicit)) return explicit as ServiceCategory;
  const service = String(intake.service_needed || "");
  if (service.startsWith("business_")) return "business_tax";
  if (service.startsWith("accounting_")) return "accounting";
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
    individual_tax_number_registration: "Tax Number Registration",
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
    whatsapp: { source: "whatsapp_admin_ai", authorisedRepresentative: intake.authorised_representative ?? null, documentSummary: intake.document_summary ?? null, displayName: intake.whatsapp_display_name ?? null, sarsDebtAmount: intake.sars_debt_amount ?? null, returnsFiled: intake.returns_filed ?? null, allCapturedDetails: intake }
  };
}

function buildRequestPayload(intake: IntakePayload) {
  const requested = String(intake.service_needed || "");
  const safeService = serviceNeededValues.has(requested) ? requested : (intake.client_type === "company" ? "business_tax_other" : "individual_other");
  const category = inferCategory({ ...intake, service_needed: safeService });
  const returnsFiled = typeof intake.returns_filed === "boolean" ? intake.returns_filed : true;
  return {
    full_name: String(intake.full_name || "").trim(), email: String(intake.email || "").trim().toLowerCase(), phone: String(intake.phone || "").trim(), client_type: intake.client_type,
    company_name: intake.client_type === "company" ? String(intake.company_name || "").trim() || null : null,
    company_registration_number: intake.client_type === "company" ? String(intake.company_registration_number || "").trim() || null : null,
    service_category: category, service_categories: [category], service_needed: safeService, service_needed_list: [safeService], priority_level: intake.priority_level || "medium",
    description: String(intake.description || "").trim(), sars_debt_amount: Number(intake.sars_debt_amount || 0), returns_filed: returnsFiled, has_debt_flag: Boolean(intake.has_debt_flag),
    missing_returns_flag: returnsFiled === false, missing_documents_flag: false, risk_indicator: intake.risk_indicator || "low", has_sars_audit: Boolean(intake.has_sars_audit), has_adr: Boolean(intake.has_adr),
    has_vat_investigation: Boolean(intake.has_vat_investigation), has_payroll_dispute: Boolean(intake.has_payroll_dispute), has_multiple_tax_types: Boolean(intake.has_multiple_tax_types), has_legal_complexity: Boolean(intake.has_legal_complexity),
    province: String(intake.province || "").trim() || null, city: String(intake.city || "").trim() || null, contact_preference: "WhatsApp", marketing_consent: false, submitted_with_account: false, client_profile_id: null,
    intake_payload: buildServiceIntake(intake, category, safeService)
  };
}

function cleanReply(raw: string) {
  let text = raw.replace(/[—–]/g, ",").replace(/^\s*[-•]\s+/gm, "").replace(/\s+,/g, ",").replace(/,{2,}/g, ",").replace(/\n{3,}/g, "\n\n").trim();
  const questionMarks = [...text.matchAll(/\?/g)];
  if (questionMarks.length > 1) text = text.slice(0, (questionMarks[0].index || 0) + 1);
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).slice(0, 3);
  text = paras.join("\n\n");
  if (text.length > 520) {
    const cut = text.slice(0, 520);
    const stop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"));
    text = (stop > 220 ? cut.slice(0, stop + 1) : cut).trim();
  }
  return text;
}

function unsafeOperationalClaim(text: string) {
  return /\b(i|we)\b[^.!?\n]{0,90}\b(submit|submitted|upload|uploaded|message|contact|notify|assign|reviewed|approved|send)\b[^.!?\n]{0,90}\b(SARS|eFiling|practitioner|Staby|team|documents?|files?)\b/i.test(text)
    || /\bqualified practitioner\b[^.!?\n]{0,80}\b(sign off|review|assist)\b/i.test(text)
    || /\bi can arrange that\b/i.test(text);
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

async function callOpenAI(history: { direction: string; content: string | null }[], latest: string, current: IntakePayload, missing: string[], submissionState: string, requestSubmitted: boolean, attachment?: { kind: "image" | "document"; bytes: Uint8Array; mimeType: string; filename?: string | null }) {
  const recent = history.filter((m) => m.content).slice(-14).map((m) => `${m.direction === "inbound" ? "Customer" : "Acapolite"}: ${normalizeForPrompt(m.content || "", 700)}`).join("\n");
  const instructions = [
    "You are a real sounding Acapolite office assistant chatting on WhatsApp in South Africa.",
    "Reply in the same language as the customer's latest meaningful message. If the message is very short, use the language established by the recent conversation.",
    "Support South Africa's official written languages naturally: English, Afrikaans, isiZulu, isiXhosa, Sepedi, Sesotho, Setswana, siSwati, Tshivenda, Xitsonga and isiNdebele. South African Sign Language is also official, but a text chat cannot render signing, so if that is requested, explain this briefly in the customer's chosen written language.",
    "Be warm, capable and concise. Do not sound like a bot, form or call centre script.",
    "Use current captured details and recent conversation as memory. Never ask for a fact already known, including facts extracted from an earlier document.",
    "Extract every relevant new fact even when the customer changes topic or gives several answers at once.",
    "Never infer that the WhatsApp display name is the client's authorised representative. Only set authorised_representative true when the customer explicitly says they have permission or authority.",
    "Answer side questions naturally first, then ask at most one genuinely useful missing question if needed.",
    "Use short WhatsApp paragraphs with blank lines. Do not use em dashes, en dashes, bullet lists, headings or mathematical symbols such as ≤ in normal conversation. Say 'within the last 3 months' instead.",
    "Do not say recorded, captured, intake, database, field, workflow or backend.",
    "Never claim that you can submit anything to SARS, operate eFiling, message a practitioner, notify a person, assign a practitioner, approve documents, sign off work, or personally review a case unless the system context explicitly confirms that action already happened.",
    "You may truthfully explain that documents sent in this WhatsApp chat can be read and securely attached to the Acapolite request. Do not claim SARS received them.",
    "Do not ask for ID numbers, passwords, OTPs, bank PINs or card details in WhatsApp.",
    "If an image or PDF is attached, identify the document, important dates and requested actions, and keep the explanation concise.",
    "For a SARS Request for Relevant Material about finalising eFiling registration, use service_needed individual_tax_compliance_issues unless the conversation clearly shows another service.",
    `SUBMISSION STATE IS ${submissionState}. REQUEST ALREADY SUBMITTED IS ${requestSubmitted ? "YES" : "NO"}.`,
    "submission_decision must classify ONLY the customer's latest message. Return yes only when the latest message clearly confirms submission of the Acapolite request in context. Return no for a clear refusal, otherwise unclear. Never use an older yes from conversation history.",
    "human_handoff_requested must classify the latest message across any supported language.",
    "description must remain a concise consolidated case summary, not merely the latest message. Use null for unknown extracted values."
  ].join(" ");
  const context = [`CURRENT CAPTURED DETAILS: ${JSON.stringify(current)}`, `MISSING CORE DETAILS: ${missing.join(", ") || "none"}`, recent ? `RECENT CHAT:\n${recent}` : "", `LATEST CUSTOMER MESSAGE: ${normalizeForPrompt(latest || "Please review the attached document.")}`].filter(Boolean).join("\n\n");
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
        type: "object", additionalProperties: false, required: ["reply","submission_decision","human_handoff_requested","extracted"], properties: {
          reply: { type: "string" }, submission_decision: { type: "string", enum: ["yes","no","unclear"] }, human_handoff_requested: { type: "boolean" },
          extracted: { type: "object", additionalProperties: false,
            required: ["full_name","email","client_type","company_name","company_registration_number","province","city","service_category","service_needed","description","sars_debt_amount","returns_filed","has_debt_flag","has_sars_audit","has_adr","has_vat_investigation","has_payroll_dispute","has_multiple_tax_types","has_legal_complexity","priority_level","risk_indicator","authorised_representative","document_summary","efiling_access","urgency","business_structure","annual_turnover","employee_count","tax_years"],
            properties: {
              full_name: nullableString, email: nullableString, client_type: nullableEnum(["individual","company","trust","npo_organisation"]), company_name: nullableString, company_registration_number: nullableString,
              province: nullableString, city: nullableString, service_category: nullableEnum(["individual_tax","business_tax","accounting","business_support","trust_services","npo_organisation_services"]), service_needed: nullableString,
              description: nullableString, sars_debt_amount: nullableNumber, returns_filed: nullableBoolean, has_debt_flag: nullableBoolean, has_sars_audit: nullableBoolean, has_adr: nullableBoolean, has_vat_investigation: nullableBoolean,
              has_payroll_dispute: nullableBoolean, has_multiple_tax_types: nullableBoolean, has_legal_complexity: nullableBoolean, priority_level: nullableEnum(["low","medium","high","urgent"]), risk_indicator: nullableEnum(["low","medium","high"]),
              authorised_representative: nullableBoolean, document_summary: nullableString, efiling_access: nullableEnum(["Yes","No","Not sure"]), urgency: nullableEnum(["Urgent / Immediate","Within a few days","Flexible"]),
              business_structure: nullableString, annual_turnover: nullableString, employee_count: nullableString, tax_years: nullableString
            }
          }
        }
      } } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI failed (${response.status}): ${(await response.text()).slice(0, 600)}`);
  return extractStructured((await response.json()) as Record<string, unknown>);
}

async function localizeFixedMessage(message: string, latest: string, history: { direction: string; content: string | null }[]) {
  const recent = history.filter((m) => m.content).slice(-6).map((m) => `${m.direction}: ${m.content}`).join("\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { Authorization: `Bearer ${requiredEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: requiredEnv("OPENAI_WHATSAPP_MODEL"), instructions: "Translate or adapt the supplied Acapolite WhatsApp message into the same language as the customer's latest meaningful message, using recent chat only to identify language. Keep it natural, short and faithful. Do not add facts. Do not use em dashes, en dashes, bullet lists or mathematical symbols. Return only the message text.", input: `RECENT CHAT:\n${recent}\n\nLATEST CUSTOMER MESSAGE:\n${latest}\n\nMESSAGE TO ADAPT:\n${message}`, store: false, text: { verbosity: "low" } })
  });
  if (!response.ok) return message;
  const data = await response.json();
  const direct = typeof data?.output_text === "string" ? data.output_text.trim() : "";
  if (direct) return cleanReply(direct);
  for (const item of Array.isArray(data?.output) ? data.output : []) for (const part of Array.isArray(item?.content) ? item.content : []) if (part?.type === "output_text" && typeof part?.text === "string") return cleanReply(part.text);
  return message;
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
  const clean = cleanReply(text);
  const metaId = await sendWhatsAppText(waId, clean);
  await supabase.from("whatsapp_messages").insert({ conversation_id: conversationId, meta_message_id: metaId, direction: "outbound", sender_type: sender, message_type: "text", content: clean, delivery_status: "submitted" });
}

async function uploadPrivateMedia(supabase: ReturnType<typeof createClient>, conversationId: string, event: IncomingEvent, bytes: Uint8Array, mimeType: string) {
  const ext = extensionForMime(mimeType);
  const safeName = (event.mediaFilename || `whatsapp-${event.messageId}.${ext}`).replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `whatsapp/${conversationId}/${Date.now()}-${event.messageId}-${safeName}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`Private media storage failed: ${error.message}`);
  return path;
}

async function linkStoredMediaToRequest(supabase: ReturnType<typeof createClient>, conversationId: string, requestId: string) {
  const { data: rows, error } = await supabase.from("whatsapp_messages").select("id,media_storage_path,media_filename,media_mime_type,media_size_bytes,created_at").eq("conversation_id", conversationId).eq("direction", "inbound").not("media_storage_path", "is", null);
  if (error) throw error;
  for (const row of rows || []) {
    const filePath = String(row.media_storage_path || "");
    if (!filePath) continue;
    const { data: existing } = await supabase.from("service_request_documents").select("id").eq("service_request_id", requestId).eq("file_path", filePath).maybeSingle();
    if (existing) continue;
    await supabase.from("service_request_documents").insert({ service_request_id: requestId, title: row.media_filename || "WhatsApp document", file_name: row.media_filename || filePath.split("/").pop() || "document", file_path: filePath, file_size: row.media_size_bytes || null, mime_type: row.media_mime_type || null, uploaded_at: row.created_at || new Date().toISOString() });
  }
}

async function notifyRequest(supabase: ReturnType<typeof createClient>, requestId: string, payload: Record<string, unknown>) {
  const serviceType = serviceLabel(String(payload.service_needed || "Tax assistance"));
  const common = { requestId, clientName: payload.full_name, clientEmail: payload.email, serviceType, province: payload.province || "South Africa", status: "Open", priority: payload.priority_level || "medium", submittedAt: new Date().toLocaleDateString("en-ZA"), summary: payload.description };
  await Promise.allSettled([
    supabase.functions.invoke("send-portal-email", { body: { type: "service_request_received", ...common, clientPhone: payload.phone } }),
    supabase.functions.invoke("send-portal-email", { body: { type: "service_request_received_admin", ...common } }),
    supabase.functions.invoke("send-portal-email", { body: { type: "service_request_received_practitioner", ...common } })
  ]);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode"), token = url.searchParams.get("hub.verify_token"), challenge = url.searchParams.get("hub.challenge");
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
      const { data: conversation, error: conversationError } = await supabase.from("whatsapp_conversations").upsert(patch, { onConflict: "wa_id" }).select("id,status,ai_enabled,intake_payload,intake_missing_fields,intake_ready,service_request_id,submission_state").single();
      if (conversationError) throw conversationError;

      let attachment: { kind: "image" | "document"; bytes: Uint8Array; mimeType: string; filename?: string | null } | undefined;
      let mediaSize: number | null = null, mime = event.mediaMimeType, sha = event.mediaSha256, storagePath: string | null = null;
      if ((event.kind === "image" || event.kind === "document") && event.mediaId) {
        const media = await downloadMetaMedia(event.mediaId);
        mediaSize = media.fileSize; mime = media.mimeType || mime; sha = media.sha256 || sha;
        const allowed = ["image/jpeg","image/png","image/webp","application/pdf"].includes(mime || "");
        if (!allowed || (event.kind === "document" && mime !== "application/pdf")) {
          await supabase.from("whatsapp_messages").insert({ conversation_id: conversation.id, meta_message_id: event.messageId, direction: "inbound", sender_type: "customer", message_type: event.kind, content: event.text || "[Document attached]", media_id: event.mediaId, media_mime_type: mime, media_filename: event.mediaFilename, media_sha256: sha, media_size_bytes: mediaSize });
          await storeOutbound(supabase, conversation.id, event.waId, await localizeFixedMessage("Please resend that file as a clear image or PDF and I can help from there.", event.text, []));
          continue;
        }
        storagePath = await uploadPrivateMedia(supabase, conversation.id, event, media.bytes, mime || "application/octet-stream");
        attachment = { kind: event.kind, bytes: media.bytes, mimeType: mime || "application/octet-stream", filename: event.mediaFilename };
      }
      const inboundContent = event.text || (event.kind === "image" ? "[Image attached]" : event.kind === "document" ? "[Document attached]" : "[Unsupported WhatsApp message]");
      const { error: inboundError } = await supabase.from("whatsapp_messages").insert({ conversation_id: conversation.id, meta_message_id: event.messageId, direction: "inbound", sender_type: "customer", message_type: event.kind, content: inboundContent, media_id: event.mediaId, media_mime_type: mime, media_filename: event.mediaFilename, media_sha256: sha, media_size_bytes: mediaSize, media_storage_path: storagePath });
      if (inboundError?.code === "23505") continue;
      if (inboundError) throw inboundError;
      if (event.kind === "unsupported") {
        await storeOutbound(supabase, conversation.id, event.waId, await localizeFixedMessage("Please send that as text, an image or a PDF and I’ll help you from there.", event.text, []));
        continue;
      }
      if (!conversation.ai_enabled || conversation.status === "human_handoff") continue;

      const { data: history, error: historyError } = await supabase.from("whatsapp_messages").select("direction,content").eq("conversation_id", conversation.id).neq("meta_message_id", event.messageId).order("created_at", { ascending: false }).limit(14);
      if (historyError) throw historyError;
      const chronological = [...(history || [])].reverse();
      const current = (conversation.intake_payload || {}) as IntakePayload;
      const before = Array.isArray(conversation.intake_missing_fields) ? conversation.intake_missing_fields : missingFields(current);
      const ai = await callOpenAI(chronological, event.text, current, before, conversation.submission_state || "collecting", Boolean(conversation.service_request_id), attachment);

      if (ai.human_handoff_requested) {
        await supabase.from("whatsapp_conversations").update({ status: "human_handoff", ai_enabled: false, human_handoff_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);
        await storeOutbound(supabase, conversation.id, event.waId, await localizeFixedMessage("Of course. I’ve paused the automated replies so the Acapolite team can take over this chat.", event.text, chronological), "system");
        continue;
      }

      const conflict = locationConflict(current, ai.extracted);
      const merged = mergeIntake(current, ai.extracted, event.waId, event.displayName, Boolean(conflict));
      const after = missingFields(merged), ready = after.length === 0;
      await supabase.from("whatsapp_conversations").update({ intake_payload: merged, intake_missing_fields: after, intake_ready: ready, intake_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id);

      if (conflict) {
        await supabase.from("whatsapp_conversations").update({ submission_state: "collecting" }).eq("id", conversation.id);
        const message = `You mentioned ${conflict.conflictingProvince}, but ${conflict.city} is in ${conflict.expectedProvince}. Which location should I use for the request?`;
        await storeOutbound(supabase, conversation.id, event.waId, await localizeFixedMessage(message, event.text, chronological));
        continue;
      }

      if (conversation.service_request_id) {
        const requestPayload = buildRequestPayload(merged);
        await supabase.from("service_requests").update({ ...requestPayload, updated_at: new Date().toISOString() }).eq("id", conversation.service_request_id);
        if (storagePath) await linkStoredMediaToRequest(supabase, conversation.id, conversation.service_request_id);
        let reply = cleanReply(ai.reply);
        if (!reply || unsafeOperationalClaim(reply)) reply = await localizeFixedMessage("I’ve added the new information to your Acapolite request. Any SARS submission or practitioner action will only happen after the case is reviewed.", event.text, chronological);
        await storeOutbound(supabase, conversation.id, event.waId, reply);
        continue;
      }

      if (ready && conversation.submission_state === "awaiting_confirmation") {
        if (ai.submission_decision === "yes") {
          const payload = buildRequestPayload(merged);
          const { data: created, error: createError } = await supabase.from("service_requests").insert(payload).select("id").single();
          if (createError || !created?.id) {
            await supabase.from("whatsapp_conversations").update({ status: "human_handoff", ai_enabled: false, human_handoff_requested_at: new Date().toISOString() }).eq("id", conversation.id);
            await storeOutbound(supabase, conversation.id, event.waId, await localizeFixedMessage("I have the details, but I’m having trouble creating the Acapolite request right now. I’ve paused the automated replies for the team to check this.", event.text, chronological), "system");
            continue;
          }
          await linkStoredMediaToRequest(supabase, conversation.id, created.id);
          await supabase.from("whatsapp_conversations").update({ service_request_id: created.id, submission_state: "submitted", intake_ready: true, updated_at: new Date().toISOString() }).eq("id", conversation.id);
          await notifyRequest(supabase, created.id, payload);
          await storeOutbound(supabase, conversation.id, event.waId, await localizeFixedMessage("Your Acapolite service request has been created and the documents you sent here have been attached to it. Nothing has been submitted to SARS yet. The case still needs to be reviewed through the normal Acapolite process.", event.text, chronological), "system");
          continue;
        }
        if (ai.submission_decision === "no") {
          await supabase.from("whatsapp_conversations").update({ submission_state: "collecting" }).eq("id", conversation.id);
          let reply = cleanReply(ai.reply);
          if (!reply || unsafeOperationalClaim(reply)) reply = await localizeFixedMessage("That’s fine. I’ll keep the details here and won’t create the Acapolite request yet.", event.text, chronological);
          await storeOutbound(supabase, conversation.id, event.waId, reply);
          continue;
        }
        await storeOutbound(supabase, conversation.id, event.waId, await localizeFixedMessage("I have enough information to create the Acapolite service request. Would you like me to submit the request now?", event.text, chronological));
        continue;
      }

      if (ready) {
        await supabase.from("whatsapp_conversations").update({ submission_state: "awaiting_confirmation" }).eq("id", conversation.id);
        await storeOutbound(supabase, conversation.id, event.waId, await localizeFixedMessage("I have enough information to create the Acapolite service request. Would you like me to submit the request now?", event.text, chronological));
        continue;
      }

      let reply = cleanReply(ai.reply);
      if (!reply || unsafeOperationalClaim(reply)) {
        const nextField = after[0];
        const fallback: Record<string, string> = { full_name: "What is the client’s full name?", client_type: "Is this for an individual, company, trust or NPO?", service_needed: "What would you like us to help with?", description: "Can you briefly tell me what happened and what you need help with?", province: "Which province is the client based in?", city: "Which town or city is the client based in?", email: "What email address can we use for the client?", company_name: "What is the company name?", sars_debt_amount: "Approximately how much does SARS say is owed?" };
        reply = await localizeFixedMessage(fallback[nextField] || "What other important detail should we know?", event.text, chronological);
      }
      await storeOutbound(supabase, conversation.id, event.waId, reply);
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error("whatsapp-agent error", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ ok: false, error: "Webhook processing failed" }), { status: 500, headers: jsonHeaders });
  }
});