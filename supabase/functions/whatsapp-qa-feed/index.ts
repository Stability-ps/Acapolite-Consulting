import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAIN_URL = "https://frormnagythfpiuzgfkz.supabase.co";
const MAIN_PUBLISHABLE_KEY = "sb_publishable_MxFecwRlAUn7Z1Pa7-it6A_QDYO9rW8";
const MAIN_LEAD_SYNC_URL = `${MAIN_URL}/functions/v1/whatsapp-lead-sync`;
const MEDIA_BUCKET = "service-request-attachments";
const SIGNED_URL_SECONDS = 300;
const MAX_LEAD_ATTACHMENTS = 10;
const MAX_REPLY_LENGTH = 1000;
const ALLOWED_ORIGINS = new Set([
  "https://acapolite-consulting.vercel.app",
  "https://acapoliteconsulting.co.za",
  "https://www.acapoliteconsulting.co.za",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
]);
const ACAPOLITE_PREVIEW_ORIGIN = /^https:\/\/acapolite-consulting-[a-z0-9-]+-acapolite\.vercel\.app$/;

type StaffProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
};

type PreviewClient = ReturnType<typeof createClient>;
type StoredMessage = {
  media_storage_path: string | null;
  [key: string]: unknown;
};

type JsonRecord = Record<string, unknown>;

type WhatsAppConversationForLead = {
  id: string;
  wa_id: string;
  display_name: string | null;
  linked_client_id: string | null;
  linked_client_profile_id: string | null;
  linked_client_at: string | null;
  linked_client_by: string | null;
  status: string;
  inbox_status: string;
  priority_level: string | null;
  ai_enabled: boolean;
  human_handoff_requested_at: string | null;
  service_request_id: string | null;
  ai_summary: string | null;
  submission_state: string | null;
  intake_payload: JsonRecord | null;
  intake_missing_fields: string[] | null;
  intake_ready: boolean | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  assigned_staff_id: string | null;
  assigned_staff_name: string | null;
  first_staff_reply_at: string | null;
  created_at: string;
  updated_at: string;
};

type WhatsAppNote = {
  id: string;
  conversation_id: string;
  author_id: string;
  author_name: string;
  body: string;
  mentioned_staff_ids: string[];
  created_at: string;
};

type WhatsAppStaffAction = {
  id: string;
  conversation_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  details: JsonRecord;
  created_at: string;
};

type LeadAttachmentRow = {
  media_storage_path: string | null;
  media_filename: string | null;
  media_mime_type: string | null;
  media_size_bytes: number | null;
  created_at: string | null;
};

type LeadSyncAttachment = {
  source_path: string;
  signed_url: string;
  file_name: string;
  title: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
};

type LeadSyncResult = {
  id: string;
  service_request_id?: string;
  created?: boolean;
  updated?: boolean;
  synced_documents?: number;
  skipped_documents?: number;
  warnings?: string[];
  payload: JsonRecord;
};

type WhatsAppSendResult = {
  metaMessageId: string | null;
  deliveryMethod: "text" | "template";
};

type MainProfile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type MainClientRow = {
  id: string;
  profile_id: string;
  client_code: string | null;
  client_type: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  province: string | null;
  updated_at: string | null;
  profiles?: MainProfile | MainProfile[] | null;
};

type MainServiceRequestRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  client_profile_id: string | null;
  service_needed: string | null;
  status: string | null;
  lifecycle_stage: string | null;
  priority_level: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const SERVICE_CATEGORIES = new Set([
  "individual_tax",
  "business_tax",
  "accounting",
  "business_support",
  "trust_services",
  "npo_organisation_services",
]);

const CLIENT_TYPES = new Set(["individual", "company", "trust", "npo_organisation"]);
const PRIORITY_VALUES = new Set(["low", "medium", "high", "urgent"]);
const RISK_VALUES = new Set(["low", "medium", "high"]);

const SERVICE_CATEGORY_BY_SERVICE: Record<string, string> = {
  individual_personal_income_tax_returns: "individual_tax",
  individual_late_return_submissions: "individual_tax",
  individual_tax_number_registration: "individual_tax",
  individual_tax_compliance_issues: "individual_tax",
  individual_tax_status_corrections: "individual_tax",
  individual_tax_clearance_certificates: "individual_tax",
  individual_tax_compliance_status_assistance: "individual_tax",
  individual_voluntary_disclosure_programme: "individual_tax",
  individual_sars_verification_refund_assistance: "individual_tax",
  individual_tax_directives: "individual_tax",
  individual_sars_debt_assistance: "individual_tax",
  individual_estate_pension_tax_matters: "individual_tax",
  individual_objections_and_disputes: "individual_tax",
  individual_other: "individual_tax",
  business_vat_registration: "business_tax",
  business_paye_registration: "business_tax",
  business_tax_clearance_certificates: "business_tax",
  business_vat_returns: "business_tax",
  business_paye_compliance: "business_tax",
  business_company_income_tax: "business_tax",
  business_tax_compliance_support: "business_tax",
  business_vat_paye_corrections: "business_tax",
  business_tax_debt_compromise: "business_tax",
  business_sars_debt_arrangements: "business_tax",
  business_vat_objections_disputes: "business_tax",
  business_sars_audits_support: "business_tax",
  business_tax_other: "business_tax",
  trust_tax_returns: "trust_services",
  trust_compliance: "trust_services",
  trust_tax_clearance: "trust_services",
  trust_sars_assistance: "trust_services",
  trust_financial_statements: "trust_services",
  trust_representative_assistance: "trust_services",
  trust_advisory_support: "trust_services",
  trust_sars_disputes_objections: "trust_services",
  trust_other: "trust_services",
  npo_registration_assistance: "npo_organisation_services",
  npo_tax_exemption_assistance: "npo_organisation_services",
  npo_annual_compliance_filing: "npo_organisation_services",
  npo_sars_compliance: "npo_organisation_services",
  npo_payroll_accounting: "npo_organisation_services",
  npo_financial_reporting: "npo_organisation_services",
  npo_pbo_applications_assistance: "npo_organisation_services",
  npo_donor_tax_section18a_assistance: "npo_organisation_services",
  npo_governance_advisory: "npo_organisation_services",
  npo_audit_compliance_support: "npo_organisation_services",
  npo_organisation_other: "npo_organisation_services",
  accounting_bookkeeping: "accounting",
  accounting_payroll_services: "accounting",
  accounting_monthly_accounting_services: "accounting",
  accounting_financial_statements: "accounting",
  accounting_management_accounts: "accounting",
  accounting_cash_flow_management: "accounting",
  accounting_budget_planning: "accounting",
  accounting_annual_financial_reporting: "accounting",
  accounting_independent_reviews: "accounting",
  accounting_other: "accounting",
  support_company_registration: "business_support",
  support_cipc_services: "business_support",
  support_annual_returns_filing: "business_support",
  support_beneficial_ownership_filings: "business_support",
  support_director_shareholder_changes: "business_support",
  support_business_compliance: "business_support",
  support_financial_compliance: "business_support",
  support_business_advisory: "business_support",
  support_bee_assistance: "business_support",
  business_support_other: "business_support",
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function booleanValue(record: JsonRecord, key: string) {
  return typeof record[key] === "boolean" ? record[key] as boolean : null;
}

function numberValue(record: JsonRecord, key: string) {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function arrayValue(record: JsonRecord, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") as string[] : [];
}

function normalizePhone(waId: string) {
  const digits = waId.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function chooseClientType(intake: JsonRecord) {
  const explicit = stringValue(intake, "client_type");
  if (CLIENT_TYPES.has(explicit)) return explicit;
  if (stringValue(intake, "company_name") || stringValue(intake, "company_registration_number")) return "company";
  const service = stringValue(intake, "service_needed");
  if (service.startsWith("business_") || service.startsWith("support_") || service.startsWith("accounting_")) return "company";
  if (service.startsWith("trust_")) return "trust";
  if (service.startsWith("npo_")) return "npo_organisation";
  return "individual";
}

function chooseService(intake: JsonRecord, clientType: string) {
  const explicit = stringValue(intake, "service_needed");
  if (SERVICE_CATEGORY_BY_SERVICE[explicit]) return explicit;
  const text = [
    stringValue(intake, "description"),
    stringValue(intake, "tax_types"),
    stringValue(intake, "enforcement_stage"),
    stringValue(intake, "desired_outcome"),
  ].join(" ").toLowerCase();
  const hasDebt = booleanValue(intake, "has_debt_flag") === true
    || numberValue(intake, "sars_debt_amount") > 0
    || /\bdebt|arrangement|compromise|owe|owed|outstanding\b/.test(text);
  if (clientType === "company" && hasDebt) return text.includes("compromise") ? "business_tax_debt_compromise" : "business_sars_debt_arrangements";
  if (clientType === "individual" && hasDebt) return "individual_sars_debt_assistance";
  if (clientType === "trust") return "trust_sars_assistance";
  if (clientType === "npo_organisation") return "npo_sars_compliance";
  if (clientType === "company") return "business_tax_other";
  return "individual_other";
}

function chooseCategory(intake: JsonRecord, service: string, clientType: string) {
  const explicit = stringValue(intake, "service_category");
  if (SERVICE_CATEGORIES.has(explicit)) return explicit;
  if (SERVICE_CATEGORY_BY_SERVICE[service]) return SERVICE_CATEGORY_BY_SERVICE[service];
  if (clientType === "trust") return "trust_services";
  if (clientType === "npo_organisation") return "npo_organisation_services";
  return clientType === "company" ? "business_tax" : "individual_tax";
}

function choosePriority(intake: JsonRecord, debtAmount: number) {
  const explicit = stringValue(intake, "priority_level").toLowerCase();
  if (PRIORITY_VALUES.has(explicit)) return explicit;
  const urgency = stringValue(intake, "urgency").toLowerCase();
  const enforcement = stringValue(intake, "enforcement_stage").toLowerCase();
  if (urgency.includes("urgent") || debtAmount >= 1_000_000 || /(final demand|bank|attachment|judgment|levy|collection)/i.test(enforcement)) return "urgent";
  if (debtAmount >= 250_000) return "high";
  return "medium";
}

function chooseRisk(intake: JsonRecord, priority: string, debtAmount: number) {
  const explicit = stringValue(intake, "risk_indicator").toLowerCase();
  if (RISK_VALUES.has(explicit)) return explicit;
  if (priority === "urgent" || debtAmount >= 1_000_000) return "high";
  if (priority === "high" || debtAmount > 0) return "medium";
  return "low";
}

function serviceLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildDescription(conversation: WhatsAppConversationForLead, intake: JsonRecord, service: string) {
  const description = stringValue(intake, "description");
  if (description) return description;
  const pieces = [
    conversation.ai_summary,
    stringValue(intake, "document_summary"),
    stringValue(intake, "desired_outcome") ? `Desired outcome: ${stringValue(intake, "desired_outcome")}` : "",
    stringValue(intake, "enforcement_stage") ? `Enforcement stage: ${stringValue(intake, "enforcement_stage")}` : "",
  ].filter(Boolean);
  return pieces.join("\n") || `WhatsApp lead for ${serviceLabel(service)}. Staff review is needed because the WhatsApp intake is still incomplete.`;
}

function buildMainServiceRequestPayload(conversation: WhatsAppConversationForLead) {
  const intake = asRecord(conversation.intake_payload);
  const clientType = chooseClientType(intake);
  const service = chooseService(intake, clientType);
  const category = chooseCategory(intake, service, clientType);
  const debtAmount = numberValue(intake, "sars_debt_amount");
  const priority = choosePriority(intake, debtAmount);
  const risk = chooseRisk(intake, priority, debtAmount);
  const phone = stringValue(intake, "phone") || normalizePhone(conversation.wa_id);
  const capturedEmail = stringValue(intake, "email").toLowerCase();
  const hasRealEmail = isValidEmail(capturedEmail);
  const email = hasRealEmail ? capturedEmail : `whatsapp-${conversation.wa_id.replace(/\D/g, "") || conversation.id.slice(0, 8)}@acapolite.local`;
  const fullName = stringValue(intake, "full_name")
    || conversation.display_name?.trim()
    || `WhatsApp ${phone || conversation.wa_id}`;
  const companyName = clientType === "company"
    ? stringValue(intake, "company_name") || conversation.display_name?.trim() || null
    : null;
  const returnsFiled = booleanValue(intake, "returns_filed");
  const missingFields = Array.isArray(conversation.intake_missing_fields)
    ? conversation.intake_missing_fields
    : [];
  const description = buildDescription(conversation, intake, service);
  const categories = Array.from(new Set([category, ...arrayValue(intake, "service_categories").filter((item) => SERVICE_CATEGORIES.has(item))]));
  const services = Array.from(new Set([service, ...arrayValue(intake, "service_needed_list").filter((item) => SERVICE_CATEGORY_BY_SERVICE[item])]));

  return {
    full_name: fullName,
    email,
    phone,
    client_type: clientType,
    company_name: companyName,
    company_registration_number: clientType === "company" ? stringValue(intake, "company_registration_number") || null : null,
    service_category: category,
    service_categories: categories,
    service_needed: service,
    service_needed_list: services,
    description,
    province: stringValue(intake, "province") || null,
    city: stringValue(intake, "city") || null,
    priority_level: priority,
    risk_indicator: risk,
    sars_debt_amount: debtAmount,
    has_debt_flag: booleanValue(intake, "has_debt_flag") === true || debtAmount > 0,
    returns_filed: returnsFiled ?? true,
    missing_returns_flag: returnsFiled === false,
    missing_documents_flag: missingFields.includes("documents") || !conversation.intake_ready,
    has_sars_audit: /\baudit|verification\b/i.test(description),
    has_adr: /\badr\b/i.test(description),
    has_vat_investigation: /\bvat\b/i.test(description) && /\binvestigation|audit|verification\b/i.test(description),
    has_payroll_dispute: /\bpaye|emp201|emp501|payroll\b/i.test(description) && /\bdispute|audit|verification\b/i.test(description),
    has_multiple_tax_types: /\b(vat|paye|income tax|cit|payroll)\b.*\b(vat|paye|income tax|cit|payroll)\b/i.test(stringValue(intake, "tax_types")),
    has_legal_complexity: /\bjudgment|attorney|court|sheriff|legal|summons\b/i.test(description),
    status: "new",
    lifecycle_stage: "open_marketplace",
    contact_preference: "WhatsApp",
    marketing_consent: false,
    submitted_with_account: false,
    client_profile_id: null,
    intake_payload: {
      who: { entityType: clientType, province: stringValue(intake, "province") || null, city: stringValue(intake, "city") || "" },
      what: { selectedServices: services.map((item) => ({ value: item, label: serviceLabel(item), category: SERVICE_CATEGORY_BY_SERVICE[item] || category })), otherDetails: {} },
      details: {
        answers: {
          efilingAccess: stringValue(intake, "efiling_access") || null,
          taxTypes: stringValue(intake, "tax_types") || null,
          enforcementStage: stringValue(intake, "enforcement_stage") || null,
          desiredOutcome: stringValue(intake, "desired_outcome") || null,
          authorisedRepresentative: booleanValue(intake, "authorised_representative"),
        },
        additionalNotes: description,
        questions: [],
      },
      contact: {
        fullName,
        email: hasRealEmail ? email : "",
        phone,
        province: stringValue(intake, "province") || null,
        city: stringValue(intake, "city") || "",
        contactPreference: "WhatsApp",
        marketingConsent: false,
      },
      whatsapp: {
        source: "whatsapp_qa_inbox",
        sourceProject: "whatsapp-admin-ai-test",
        qaConversationId: conversation.id,
        waId: conversation.wa_id,
        displayName: conversation.display_name,
        aiSummary: conversation.ai_summary,
        submissionState: conversation.submission_state || "collecting",
        intakeReady: Boolean(conversation.intake_ready),
        missingFields,
        placeholderEmail: hasRealEmail ? null : email,
        allCapturedDetails: intake,
        createdFrom: "staff_whatsapp_qa",
      },
    },
  };
}

async function loadLeadAttachments(sb: PreviewClient, conversationId: string) {
  const { data, error } = await sb
    .from("whatsapp_messages")
    .select("media_storage_path,media_filename,media_mime_type,media_size_bytes,created_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .not("media_storage_path", "is", null)
    .order("created_at", { ascending: true })
    .limit(MAX_LEAD_ATTACHMENTS);
  if (error) throw new Error("Unable to load WhatsApp attachments");

  const attachments: LeadSyncAttachment[] = [];
  for (const row of (data || []) as LeadAttachmentRow[]) {
    const sourcePath = String(row.media_storage_path || "");
    if (!sourcePath) continue;
    const { data: signed, error: signedError } = await sb.storage.from(MEDIA_BUCKET).createSignedUrl(sourcePath, SIGNED_URL_SECONDS);
    if (signedError || !signed?.signedUrl) {
      console.error("Unable to sign WhatsApp attachment", sourcePath, signedError);
      continue;
    }
    const fileName = row.media_filename || sourcePath.split("/").pop() || "whatsapp-document";
    attachments.push({
      source_path: sourcePath,
      signed_url: signed.signedUrl,
      file_name: fileName,
      title: row.media_filename || "WhatsApp document",
      mime_type: row.media_mime_type || null,
      file_size: row.media_size_bytes || null,
      uploaded_at: row.created_at || null,
    });
  }
  return attachments;
}

async function syncMainLead(token: string, sb: PreviewClient, conversation: WhatsAppConversationForLead): Promise<LeadSyncResult> {
  const payload = buildMainServiceRequestPayload(conversation);
  const attachments = await loadLeadAttachments(sb, conversation.id);
  const response = await fetch(MAIN_LEAD_SYNC_URL, {
    method: "POST",
    headers: {
      ...mainHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "upsert_lead",
      service_request_id: conversation.service_request_id,
      payload,
      attachments,
    }),
  });
  const body = await response.text();
  let result: JsonRecord = {};
  try {
    result = body ? JSON.parse(body) as JsonRecord : {};
  } catch {
    result = {};
  }
  const id = typeof result.service_request_id === "string"
    ? result.service_request_id
    : typeof result.id === "string"
      ? result.id
      : "";
  if (!response.ok || !id) {
    console.error("Main WhatsApp lead sync failed", response.status, body.slice(0, 500));
    throw new Error(typeof result.error === "string" ? result.error : "Unable to sync the lead in the main Leads dashboard");
  }
  return {
    id,
    service_request_id: id,
    created: result.created === true,
    updated: result.updated === true,
    synced_documents: typeof result.synced_documents === "number" ? result.synced_documents : 0,
    skipped_documents: typeof result.skipped_documents === "number" ? result.skipped_documents : 0,
    warnings: Array.isArray(result.warnings) ? result.warnings.filter((warning) => typeof warning === "string") as string[] : [],
    payload,
  };
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) || ACAPOLITE_PREVIEW_ORIGIN.test(origin);
  return {
    "Access-Control-Allow-Origin": allowedOrigin ? origin : "https://acapolite-consulting.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function bearerToken(req: Request) {
  return (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || "";
}

function mainHeaders(token: string) {
  return { apikey: MAIN_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
}

function restHeaders(token: string, extra: Record<string, string> = {}) {
  return { ...mainHeaders(token), ...extra };
}

function displayName(profile: Pick<StaffProfile, "full_name" | "email">) {
  return profile.full_name?.trim() || profile.email?.trim() || "Acapolite staff";
}

function digitsOnly(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value: string | null | undefined) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function pickMainProfile(profile: MainClientRow["profiles"]): MainProfile | null {
  if (Array.isArray(profile)) return profile[0] || null;
  return profile || null;
}

function getConversationContact(conversation: WhatsAppConversationForLead) {
  const intake = asRecord(conversation.intake_payload);
  const email = stringValue(intake, "email").toLowerCase();
  const phone = stringValue(intake, "phone") || normalizePhone(conversation.wa_id);
  const fullName = stringValue(intake, "full_name") || conversation.display_name || "";
  const company = stringValue(intake, "company_name");
  return {
    email,
    phone,
    phoneDigits: digitsOnly(phone || conversation.wa_id),
    fullName,
    normalizedName: normalizeText(fullName),
    company,
    normalizedCompany: normalizeText(company),
  };
}

async function fetchMainRows<T>(token: string, table: string, params: Record<string, string>) {
  const url = new URL(`${MAIN_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: restHeaders(token) });
  if (!response.ok) {
    console.error(`Unable to load main ${table}`, response.status, await response.text().catch(() => ""));
    return [] as T[];
  }
  return await response.json().catch(() => []) as T[];
}

function scoreClientMatch(conversation: WhatsAppConversationForLead, client: MainClientRow) {
  const contact = getConversationContact(conversation);
  const profile = pickMainProfile(client.profiles);
  const email = String(profile?.email || "").toLowerCase();
  const phoneDigits = digitsOnly(profile?.phone);
  const clientName = normalizeText(profile?.full_name || [client.first_name, client.last_name].filter(Boolean).join(" "));
  const companyName = normalizeText(client.company_name);
  let score = 0;
  const reasons: string[] = [];

  if (conversation.linked_client_id && conversation.linked_client_id === client.id) {
    score += 100;
    reasons.push("Linked CRM client");
  }
  if (conversation.linked_client_profile_id && conversation.linked_client_profile_id === client.profile_id) {
    score += 90;
    reasons.push("Linked profile");
  }
  if (contact.email && email && contact.email === email) {
    score += 80;
    reasons.push("Same email");
  }
  if (contact.phoneDigits && phoneDigits && contact.phoneDigits === phoneDigits) {
    score += 85;
    reasons.push("Same phone");
  }
  if (contact.normalizedName && clientName && contact.normalizedName === clientName) {
    score += 35;
    reasons.push("Same name");
  }
  if (contact.normalizedCompany && companyName && contact.normalizedCompany === companyName) {
    score += 35;
    reasons.push("Same company");
  }

  return { score, reasons };
}

function scoreRequestMatch(conversation: WhatsAppConversationForLead, request: MainServiceRequestRow) {
  const contact = getConversationContact(conversation);
  const email = String(request.email || "").toLowerCase();
  const phoneDigits = digitsOnly(request.phone);
  const name = normalizeText(request.full_name);
  const company = normalizeText(request.company_name);
  let score = 0;
  const reasons: string[] = [];

  if (conversation.service_request_id && conversation.service_request_id === request.id) {
    score += 100;
    reasons.push("Linked lead");
  }
  if (conversation.linked_client_profile_id && conversation.linked_client_profile_id === request.client_profile_id) {
    score += 70;
    reasons.push("Same client profile");
  }
  if (contact.email && email && contact.email === email) {
    score += 60;
    reasons.push("Same email");
  }
  if (contact.phoneDigits && phoneDigits && contact.phoneDigits === phoneDigits) {
    score += 65;
    reasons.push("Same phone");
  }
  if (contact.normalizedName && name && contact.normalizedName === name) {
    score += 25;
    reasons.push("Same name");
  }
  if (contact.normalizedCompany && company && contact.normalizedCompany === company) {
    score += 25;
    reasons.push("Same company");
  }

  return { score, reasons };
}

async function loadMainContext(token: string, conversations: WhatsAppConversationForLead[]) {
  if (!conversations.length) return { client_matches: [], related_service_requests: [] };

  const linkedRequestIds = Array.from(new Set(conversations.map((item) => item.service_request_id).filter(Boolean))) as string[];
  const serviceRequestParams: Record<string, string> = {
    select: "id,full_name,email,phone,company_name,client_profile_id,service_needed,status,lifecycle_stage,priority_level,created_at,updated_at",
    order: "updated_at.desc",
    limit: "500",
  };
  const linkedParams = linkedRequestIds.length
    ? { ...serviceRequestParams, id: `in.(${linkedRequestIds.join(",")})` }
    : null;

  const [recentRequests, linkedRequests, clients] = await Promise.all([
    fetchMainRows<MainServiceRequestRow>(token, "service_requests", serviceRequestParams),
    linkedParams ? fetchMainRows<MainServiceRequestRow>(token, "service_requests", linkedParams) : Promise.resolve([]),
    fetchMainRows<MainClientRow>(token, "clients", {
      select: "id,profile_id,client_code,client_type,company_name,first_name,last_name,city,province,updated_at,profiles!clients_profile_id_fkey(full_name,email,phone)",
      order: "updated_at.desc",
      limit: "500",
    }),
  ]);
  const requestRows = [...linkedRequests, ...recentRequests].filter((request, index, rows) => rows.findIndex((item) => item.id === request.id) === index);

  const clientMatches = conversations.flatMap((conversation) => clients
    .map((client) => ({ client, ...scoreClientMatch(conversation, client) }))
    .filter((match) => match.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ client, score, reasons }) => {
      const profile = pickMainProfile(client.profiles);
      return {
        conversation_id: conversation.id,
        client_id: client.id,
        profile_id: client.profile_id,
        client_code: client.client_code,
        client_type: client.client_type,
        label: client.company_name || profile?.full_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || client.client_code || "Client",
        company_name: client.company_name,
        full_name: profile?.full_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || null,
        email: profile?.email || null,
        phone: profile?.phone || null,
        city: client.city,
        province: client.province,
        confidence: Math.min(100, score),
        reason: reasons.join(", ") || "Possible match",
        linked: conversation.linked_client_id === client.id,
        updated_at: client.updated_at,
      };
    }));

  const relatedServiceRequests = conversations.flatMap((conversation) => requestRows
    .map((request) => ({ request, ...scoreRequestMatch(conversation, request) }))
    .filter((match) => match.score >= 55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ request, score, reasons }) => ({
      conversation_id: conversation.id,
      id: request.id,
      full_name: request.full_name,
      email: request.email,
      phone: request.phone,
      company_name: request.company_name,
      client_profile_id: request.client_profile_id,
      service_needed: request.service_needed,
      status: request.status,
      lifecycle_stage: request.lifecycle_stage,
      priority_level: request.priority_level,
      confidence: Math.min(100, score),
      reason: reasons.join(", ") || "Possible related lead",
      created_at: request.created_at,
      updated_at: request.updated_at,
    })));

  return { client_matches: clientMatches, related_service_requests: relatedServiceRequests };
}

async function recordMainActivity(token: string, actor: StaffProfile, conversationId: string, action: string, details: Record<string, unknown>) {
  const response = await fetch(`${MAIN_URL}/rest/v1/system_activity_log`, {
    method: "POST",
    headers: restHeaders(token, { "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({
      actor_profile_id: actor.id,
      actor_role: actor.role,
      action: `whatsapp_${action}`,
      target_type: "whatsapp_conversation",
      target_id: conversationId,
      metadata: details,
    }),
  });
  if (!response.ok) {
    console.error("Unable to mirror WhatsApp action to main activity log", response.status, await response.text().catch(() => ""));
  }
}

async function authenticateAdmin(token: string): Promise<StaffProfile | null> {
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

  const profileResponse = await fetch(
    `${MAIN_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,email,role,is_active&limit=1`,
    { headers },
  );
  if (!profileResponse.ok) return null;
  return (await profileResponse.json())?.[0] || null;
}

async function loadStaff(token: string, current: StaffProfile) {
  const response = await fetch(
    `${MAIN_URL}/rest/v1/profiles?select=id,full_name,email,role,is_active&role=in.(admin,consultant)&is_active=eq.true&order=full_name.asc`,
    { headers: mainHeaders(token) },
  );
  if (!response.ok) return [current];
  const rows = (await response.json()) as StaffProfile[];
  return rows.length ? rows : [current];
}

async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppSendResult> {
  const version = Deno.env.get("WHATSAPP_GRAPH_API_VERSION")?.trim();
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")?.trim();
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")?.trim();
  if (!version || !phoneNumberId || !accessToken) throw new Error("WhatsApp delivery is not configured");

  const endpoint = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("WhatsApp text send failed", response.status, payload);
    if (isFollowUpTemplateRequired(response.status, payload)) {
      const templateResult = await sendWhatsAppFollowUpTemplate(endpoint, accessToken, to, body);
      if (templateResult) return templateResult;
    }
    throw new Error(formatWhatsAppSendError(response.status, payload));
  }
  return { metaMessageId: String(payload?.messages?.[0]?.id || "") || null, deliveryMethod: "text" };
}

async function sendWhatsAppFollowUpTemplate(endpoint: string, accessToken: string, to: string, body: string): Promise<WhatsAppSendResult | null> {
  const templateName = Deno.env.get("WHATSAPP_FOLLOW_UP_TEMPLATE_NAME")?.trim();
  if (!templateName) return null;

  const languageCode = Deno.env.get("WHATSAPP_FOLLOW_UP_TEMPLATE_LANGUAGE")?.trim() || "en_US";
  const includeBodyParameter = Deno.env.get("WHATSAPP_FOLLOW_UP_TEMPLATE_BODY_PARAMETER")?.trim().toLowerCase() !== "false";
  const template: JsonRecord = {
    name: templateName,
    language: { code: languageCode },
  };

  if (includeBodyParameter) {
    template.components = [{
      type: "body",
      parameters: [{ type: "text", text: body }],
    }];
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("WhatsApp follow-up template send failed", response.status, payload);
    throw new Error(formatWhatsAppTemplateSendError(response.status, payload));
  }
  return { metaMessageId: String(payload?.messages?.[0]?.id || "") || null, deliveryMethod: "template" };
}

function isFollowUpTemplateRequired(status: number, payload: unknown) {
  const error = asRecord(asRecord(payload).error);
  const message = stringValue(error, "message");
  const details = stringValue(asRecord(error.error_data), "details");
  const codeValue = error.code;
  const code = typeof codeValue === "number" ? codeValue : Number(codeValue);
  const combined = `${message} ${details}`.toLowerCase();
  return status === 400 && (code === 131047 || /customer care|customer service|re-engagement|outside.*window|24[-\s]?hour|template/.test(combined));
}

function formatWhatsAppSendError(status: number, payload: unknown) {
  const error = asRecord(asRecord(payload).error);
  const message = stringValue(error, "message");
  if (isFollowUpTemplateRequired(status, payload)) {
    return "Reply saved in Acapolite for staff follow-up. It is recorded on this chat even if WhatsApp delivery is unavailable.";
  }
  return `WhatsApp delivery failed (${status})${message ? `: ${message}` : ""}`;
}

function formatWhatsAppTemplateSendError(status: number, payload: unknown) {
  const error = asRecord(asRecord(payload).error);
  const message = stringValue(error, "message");
  const details = stringValue(asRecord(error.error_data), "details");
  const reason = [message, details].filter(Boolean).join(": ");
  return `Follow-up template delivery failed (${status})${reason ? `: ${reason}` : ""}`;
}

async function recordAction(sb: PreviewClient, token: string, conversationId: string, actor: StaffProfile, action: string, details: Record<string, unknown> = {}) {
  const { error } = await sb.from("whatsapp_staff_actions").insert({
    conversation_id: conversationId,
    actor_id: actor.id,
    actor_name: displayName(actor),
    action,
    details,
  });
  if (error) throw error;
  await recordMainActivity(token, actor, conversationId, action, details).catch((activityError) => {
    console.error("WhatsApp main activity mirror failed", activityError);
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "GET" && req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const token = bearerToken(req);
  const actor = await authenticateAdmin(token);
  if (!actor) return json(req, { error: "Forbidden" }, 403);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "delete_conversations") {
      const conversationIds = Array.from(new Set(
        (Array.isArray(body?.conversation_ids) ? body.conversation_ids : [])
          .map((value: unknown) => String(value || ""))
          .filter(Boolean),
      )).slice(0, 50);
      if (!conversationIds.length) return json(req, { error: "Select at least one client record" }, 400);

      const [{ data: conversations, error: conversationsError }, { data: messages, error: messagesError }] = await Promise.all([
        sb.from("whatsapp_conversations").select("id,service_request_id").in("id", conversationIds),
        sb.from("whatsapp_messages").select("id,conversation_id,media_storage_path").in("conversation_id", conversationIds),
      ]);
      if (conversationsError || messagesError || !conversations?.length) return json(req, { error: "Unable to load the selected client records" }, 500);

      const auditRows = conversations.map((conversation) => {
        const related = (messages || []).filter((message) => message.conversation_id === conversation.id);
        return {
          conversation_id: conversation.id,
          actor_id: actor.id,
          actor_name: displayName(actor),
          preserved_service_request_id: conversation.service_request_id,
          message_count: related.length,
          attachment_count: related.filter((message) => message.media_storage_path).length,
        };
      });
      const { data: createdAudits, error: auditError } = await sb.from("whatsapp_deletion_audit").insert(auditRows).select("id");
      if (auditError) return json(req, { error: "Unable to create the deletion audit" }, 500);

      const existingIds = conversations.map((conversation) => conversation.id);
      const { error: deleteError } = await sb.from("whatsapp_conversations").delete().in("id", existingIds);
      if (deleteError) {
        const auditIds = (createdAudits || []).map((row) => row.id);
        if (auditIds.length) await sb.from("whatsapp_deletion_audit").delete().in("id", auditIds);
        return json(req, { error: "Unable to delete the selected client records" }, 500);
      }

      const storagePaths = (messages || []).map((message) => message.media_storage_path).filter((path): path is string => Boolean(path));
      const storageResult = storagePaths.length ? await sb.storage.from(MEDIA_BUCKET).remove(storagePaths) : { error: null };
      return json(req, {
        ok: true,
        deleted: existingIds.length,
        preserved_service_requests: conversations.filter((conversation) => conversation.service_request_id).length,
        attachment_cleanup_warning: storageResult.error ? "Some private attachment files could not be removed automatically." : null,
      });
    }

    const conversationId = String(body?.conversation_id || "");
    if (!conversationId) return json(req, { error: "Conversation is required" }, 400);

    const { data: conversation, error: conversationError } = await sb
      .from("whatsapp_conversations")
      .select("id,wa_id,display_name,linked_client_id,linked_client_profile_id,linked_client_at,linked_client_by,status,inbox_status,priority_level,ai_enabled,human_handoff_requested_at,service_request_id,ai_summary,submission_state,intake_payload,intake_missing_fields,intake_ready,last_inbound_at,last_outbound_at,assigned_staff_id,assigned_staff_name,first_staff_reply_at,created_at,updated_at")
      .eq("id", conversationId)
      .maybeSingle();
    if (conversationError || !conversation) return json(req, { error: "Conversation not found" }, 404);
    const selectedConversation = conversation as WhatsAppConversationForLead;

    if (action === "add_note") {
      const note = String(body?.note || "").replace(/\s+/g, " ").trim();
      if (!note) return json(req, { error: "Write a private note first" }, 400);
      if (note.length > 2000) return json(req, { error: "Keep private notes under 2000 characters" }, 400);
      const mentionedStaffIds = Array.from(new Set(
        (Array.isArray(body?.mentioned_staff_ids) ? body.mentioned_staff_ids : [])
          .map((value: unknown) => String(value || ""))
          .filter(isUuid),
      )).slice(0, 10);
      const { data: insertedNote, error } = await sb.from("whatsapp_internal_notes").insert({
        conversation_id: conversationId,
        author_id: actor.id,
        author_name: displayName(actor),
        body: note,
        mentioned_staff_ids: mentionedStaffIds,
      }).select("id").single();
      if (error || !insertedNote) return json(req, { error: "Unable to save the private note" }, 500);
      await recordAction(sb, token, conversationId, actor, "internal_note_added", {
        conversation_name: selectedConversation.display_name,
        wa_id: selectedConversation.wa_id,
        note_id: insertedNote.id,
        preview: note.slice(0, 140),
        mentioned_staff_ids: mentionedStaffIds,
      });
      return json(req, { ok: true, note_id: insertedNote.id });
    }

    if (action === "link_client") {
      const clientId = String(body?.client_id || "");
      const clientProfileId = String(body?.client_profile_id || "");
      if (!isUuid(clientId) || !isUuid(clientProfileId)) return json(req, { error: "Select a valid Client 360 match" }, 400);
      const linkedAt = new Date().toISOString();
      const { error } = await sb.from("whatsapp_conversations").update({
        linked_client_id: clientId,
        linked_client_profile_id: clientProfileId,
        linked_client_at: linkedAt,
        linked_client_by: actor.id,
        updated_at: linkedAt,
      }).eq("id", conversationId);
      if (error) return json(req, { error: "Unable to link this client" }, 500);
      await recordAction(sb, token, conversationId, actor, "client_linked", {
        conversation_name: selectedConversation.display_name,
        wa_id: selectedConversation.wa_id,
        client_id: clientId,
        client_profile_id: clientProfileId,
        client_label: String(body?.client_label || "").slice(0, 160) || null,
      });
      return json(req, { ok: true });
    }

    if (action === "unlink_client") {
      const changedAt = new Date().toISOString();
      const { error } = await sb.from("whatsapp_conversations").update({
        linked_client_id: null,
        linked_client_profile_id: null,
        linked_client_at: null,
        linked_client_by: null,
        updated_at: changedAt,
      }).eq("id", conversationId);
      if (error) return json(req, { error: "Unable to unlink this client" }, 500);
      await recordAction(sb, token, conversationId, actor, "client_unlinked", {
        conversation_name: selectedConversation.display_name,
        wa_id: selectedConversation.wa_id,
        previous_client_id: selectedConversation.linked_client_id,
        previous_client_profile_id: selectedConversation.linked_client_profile_id,
      });
      return json(req, { ok: true });
    }

    if (action === "create_service_request") {
      let synced: Awaited<ReturnType<typeof syncMainLead>>;
      try {
        synced = await syncMainLead(token, sb, selectedConversation);
      } catch (error) {
        return json(req, { error: error instanceof Error ? error.message : "Unable to sync the lead" }, 500);
      }

      const changedAt = new Date().toISOString();
      const { error: linkError } = await sb.from("whatsapp_conversations").update({
        service_request_id: synced.id,
        submission_state: "submitted",
        status: "human_handoff",
        inbox_status: selectedConversation.assigned_staff_id ? "assigned" : "unassigned",
        ai_enabled: false,
        human_handoff_requested_at: selectedConversation.human_handoff_requested_at || changedAt,
        updated_at: changedAt,
      }).eq("id", conversationId);
      if (linkError) console.error("Lead synced but WhatsApp conversation link failed", linkError);

      try {
        await recordAction(sb, token, conversationId, actor, synced.created ? "service_request_created" : "service_request_synced", {
          conversation_name: selectedConversation.display_name,
          wa_id: selectedConversation.wa_id,
          service_request_id: synced.id,
          lead_url: `/dashboard/staff/service-requests?leadId=${synced.id}`,
          missing_fields: selectedConversation.intake_missing_fields || [],
          synced_documents: synced.synced_documents || 0,
          skipped_documents: synced.skipped_documents || 0,
          warnings: synced.warnings || [],
          placeholder_email: (synced.payload.intake_payload as JsonRecord)?.whatsapp
            ? asRecord((synced.payload.intake_payload as JsonRecord).whatsapp).placeholderEmail
            : null,
        });
      } catch (auditError) {
        console.error("Lead sync action audit failed", auditError);
      }

      return json(req, {
        ok: true,
        service_request_id: synced.id,
        lead_url: `/dashboard/staff/service-requests?leadId=${synced.id}`,
        created: synced.created,
        updated: synced.updated,
        synced_documents: synced.synced_documents || 0,
        skipped_documents: synced.skipped_documents || 0,
        warnings: synced.warnings || [],
        link_warning: linkError ? "Lead synced, but the WhatsApp chat link could not be saved automatically." : null,
      });
    }

    if (action === "assign") {
      const staff = await loadStaff(token, actor);
      const assignee = staff.find((item) => item.id === String(body?.staff_id || ""));
      if (!assignee) return json(req, { error: "Select an active staff member" }, 400);
      const assignedAt = new Date().toISOString();
      const nextAction = conversation.assigned_staff_id ? "reassigned" : "assigned";
      const { error } = await sb.from("whatsapp_conversations").update({
        assigned_staff_id: assignee.id,
        assigned_staff_name: displayName(assignee),
        assigned_at: assignedAt,
        assigned_by: actor.id,
        status: "human_handoff",
        inbox_status: "assigned",
        ai_enabled: false,
        human_handoff_requested_at: conversation.human_handoff_requested_at || assignedAt,
        updated_at: assignedAt,
      }).eq("id", conversationId);
      if (error) return json(req, { error: "Unable to assign this chat" }, 500);
      await recordAction(sb, token, conversationId, actor, nextAction, { conversation_name: selectedConversation.display_name, wa_id: selectedConversation.wa_id, staff_id: assignee.id, staff_name: displayName(assignee) });
      return json(req, { ok: true });
    }

    if (action === "mark_read") {
      const readAt = new Date().toISOString();
      const { error } = await sb.from("whatsapp_conversation_reads").upsert({
        conversation_id: conversationId,
        staff_id: actor.id,
        last_read_at: readAt,
      }, { onConflict: "conversation_id,staff_id" });
      if (error) return json(req, { error: "Unable to mark this chat as read" }, 500);
      await sb.from("whatsapp_alerts").update({ is_resolved: true, resolved_at: readAt, resolved_by: actor.id })
        .eq("conversation_id", conversationId).eq("alert_type", "customer_reply").eq("is_resolved", false);
      return json(req, { ok: true });
    }

    if (action === "resolve") {
      const resolvedAt = new Date().toISOString();
      const { error } = await sb.from("whatsapp_conversations").update({
        inbox_status: "resolved",
        resolved_at: resolvedAt,
        resolved_by: actor.id,
        ai_enabled: false,
        updated_at: resolvedAt,
      }).eq("id", conversationId);
      if (error) return json(req, { error: "Unable to resolve this chat" }, 500);
      await sb.from("whatsapp_alerts").update({ is_resolved: true, resolved_at: resolvedAt, resolved_by: actor.id })
        .eq("conversation_id", conversationId).eq("is_resolved", false);
      await recordAction(sb, token, conversationId, actor, "resolved", { conversation_name: selectedConversation.display_name, wa_id: selectedConversation.wa_id });
      return json(req, { ok: true });
    }

    if (action === "reopen") {
      const changedAt = new Date().toISOString();
      const { error } = await sb.from("whatsapp_conversations").update({
        inbox_status: conversation.assigned_staff_id ? "assigned" : "unassigned",
        status: "human_handoff",
        ai_enabled: false,
        resolved_at: null,
        resolved_by: null,
        updated_at: changedAt,
      }).eq("id", conversationId);
      if (error) return json(req, { error: "Unable to reopen this chat" }, 500);
      await recordAction(sb, token, conversationId, actor, "reopened", { conversation_name: selectedConversation.display_name, wa_id: selectedConversation.wa_id });
      return json(req, { ok: true });
    }

    if (action === "reply") {
      const message = String(body?.message || "").replace(/\s+/g, " ").trim();
      if (!message) return json(req, { error: "Write a reply first" }, 400);
      if (message.length > MAX_REPLY_LENGTH) return json(req, { error: `Keep replies under ${MAX_REPLY_LENGTH} characters` }, 400);

      const sentAt = new Date().toISOString();
      const staffName = displayName(actor);
      const { data: pendingMessage, error: pendingMessageError } = await sb.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        direction: "outbound",
        sender_type: "staff",
        message_type: "text",
        content: message,
        delivery_status: "sending",
        staff_sender_id: actor.id,
        staff_sender_name: staffName,
      }).select("id").single();
      if (pendingMessageError || !pendingMessage) {
        console.error("Unable to create pending WhatsApp transcript row", pendingMessageError);
        return json(req, { error: "The reply was not sent because the transcript could not be created" }, 500);
      }

      let sendResult: WhatsAppSendResult | null = null;
      try {
        sendResult = await sendWhatsAppText(conversation.wa_id, message);
      } catch (error) {
        const deliveryError = error instanceof Error ? error.message : "WhatsApp delivery failed";
        const deliveryStatus = /follow-up template|reply saved in acapolite|customer[-\s]?care|customer service|outside.*window|24[-\s]?hour|131047/i.test(deliveryError)
          ? "saved_local"
          : "failed";
        await sb.from("whatsapp_messages").update({ delivery_status: deliveryStatus }).eq("id", pendingMessage.id);
        await sb.from("whatsapp_conversations").update({
          status: "human_handoff",
          inbox_status: conversation.assigned_staff_id ? "assigned" : "unassigned",
          ai_enabled: false,
          last_staff_reply_at: sentAt,
          updated_at: sentAt,
        }).eq("id", conversationId);
        await recordAction(sb, token, conversationId, actor, "staff_reply", {
          conversation_name: selectedConversation.display_name,
          wa_id: selectedConversation.wa_id,
          delivery_status: deliveryStatus,
          delivery_error: deliveryError,
        });
        return json(req, {
          ok: true,
          delivery_status: deliveryStatus,
          delivery_error: deliveryError,
          warning: "Reply saved in Acapolite for staff follow-up. It is recorded on this chat even if WhatsApp delivery is unavailable.",
        }, 202);
      }

      const { error: messageError } = await sb.from("whatsapp_messages").update({
        meta_message_id: sendResult.metaMessageId,
        delivery_status: "submitted",
      }).eq("id", pendingMessage.id);
      if (messageError) console.error("WhatsApp reply delivered; transcript status update failed", messageError);

      const assignmentPatch = conversation.assigned_staff_id ? {} : {
        assigned_staff_id: actor.id,
        assigned_staff_name: staffName,
        assigned_at: sentAt,
        assigned_by: actor.id,
      };
      await sb.from("whatsapp_conversations").update({
        ...assignmentPatch,
        status: "human_handoff",
        inbox_status: "waiting_client",
        ai_enabled: false,
        first_staff_reply_at: conversation.first_staff_reply_at || sentAt,
        last_outbound_at: sentAt,
        last_staff_reply_at: sentAt,
        updated_at: sentAt,
      }).eq("id", conversationId);
      await recordAction(sb, token, conversationId, actor, "staff_reply", { conversation_name: selectedConversation.display_name, wa_id: selectedConversation.wa_id, meta_message_id: sendResult.metaMessageId, delivery_method: sendResult.deliveryMethod });
      return json(req, { ok: true, delivery_method: sendResult.deliveryMethod });
    }

    if (action === "return_to_ai") {
      const changedAt = new Date().toISOString();
      const { error } = await sb.from("whatsapp_conversations").update({
        status: "active",
        inbox_status: "resolved",
        ai_enabled: true,
        assigned_staff_id: null,
        assigned_staff_name: null,
        assigned_at: null,
        assigned_by: null,
        updated_at: changedAt,
      }).eq("id", conversationId);
      if (error) return json(req, { error: "Unable to return this chat to AI" }, 500);
      await recordAction(sb, token, conversationId, actor, "returned_to_ai", { conversation_name: selectedConversation.display_name, wa_id: selectedConversation.wa_id, previous_staff_id: conversation.assigned_staff_id, previous_staff_name: conversation.assigned_staff_name });
      return json(req, { ok: true });
    }

    return json(req, { error: "Unsupported action" }, 400);
  }

  const overdueCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: overdueConversations } = await sb.from("whatsapp_conversations")
    .select("id,display_name,wa_id")
    .eq("status", "human_handoff")
    .is("assigned_staff_id", null)
    .neq("inbox_status", "resolved")
    .lte("human_handoff_requested_at", overdueCutoff);
  if (overdueConversations?.length) {
    await sb.from("whatsapp_conversations").update({ inbox_status: "unassigned" })
      .in("id", overdueConversations.map((conversation) => conversation.id)).eq("inbox_status", "new");
    await Promise.all(overdueConversations.map((conversation) => sb.from("whatsapp_alerts").insert({
        conversation_id: conversation.id,
        alert_type: "unassigned_overdue",
        severity: "warning",
        title: "Unassigned WhatsApp chat is overdue",
        body: `${conversation.display_name || conversation.wa_id} has waited more than 10 minutes.`,
      })));
  }

  const [{ data: conversations, error: conversationsError }, { data: messages, error: messagesError }, { data: reads }, { data: alerts }, staff] = await Promise.all([
    sb.from("whatsapp_conversations").select("id,wa_id,display_name,linked_client_id,linked_client_profile_id,linked_client_at,linked_client_by,status,inbox_status,priority_level,ai_enabled,human_handoff_requested_at,service_request_id,ai_summary,intake_payload,intake_missing_fields,intake_ready,submission_state,last_inbound_at,last_outbound_at,assigned_staff_id,assigned_staff_name,assigned_at,last_staff_reply_at,first_staff_reply_at,resolved_at,resolved_by,created_at,updated_at").order("updated_at", { ascending: false }).limit(100),
    sb.from("whatsapp_messages").select("id,conversation_id,direction,sender_type,message_type,content,delivery_status,media_mime_type,media_filename,media_size_bytes,media_storage_path,staff_sender_id,staff_sender_name,created_at").order("created_at", { ascending: true }),
    sb.from("whatsapp_conversation_reads").select("conversation_id,last_read_at").eq("staff_id", actor.id),
    sb.from("whatsapp_alerts").select("id,conversation_id,alert_type,severity,title,body,assigned_staff_id,is_resolved,created_at").eq("is_resolved", false).order("created_at", { ascending: false }).limit(100),
    loadStaff(token, actor),
  ]);
  if (conversationsError || messagesError) {
    // Structured, secret-free diagnostics: which query failed and the
    // Postgres error code/message only (e.g. 42703 undefined_column after a
    // schema/code drift) - never the row data or request headers.
    if (conversationsError) console.error(JSON.stringify({ event: "whatsapp_qa_feed_query_failed", operation: "whatsapp_conversations.select", code: conversationsError.code, message: conversationsError.message }));
    if (messagesError) console.error(JSON.stringify({ event: "whatsapp_qa_feed_query_failed", operation: "whatsapp_messages.select", code: messagesError.code, message: messagesError.message }));
    return json(req, { error: "Unable to load WhatsApp data" }, 500);
  }
  const conversationRows = (conversations || []) as WhatsAppConversationForLead[];
  const conversationIds = conversationRows.map((conversation) => conversation.id);

  const messagesWithAttachments = await Promise.all(((messages || []) as StoredMessage[]).map(async (message) => {
    if (!message.media_storage_path) return { ...message, attachment_url: null };
    const { data, error } = await sb.storage.from(MEDIA_BUCKET).createSignedUrl(message.media_storage_path, SIGNED_URL_SECONDS);
    return { ...message, attachment_url: error ? null : data?.signedUrl || null };
  }));

  const [notesResult, actionsResult, mainContext] = await Promise.all([
    conversationIds.length
      ? sb.from("whatsapp_internal_notes").select("id,conversation_id,author_id,author_name,body,mentioned_staff_ids,created_at").in("conversation_id", conversationIds).order("created_at", { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    conversationIds.length
      ? sb.from("whatsapp_staff_actions").select("id,conversation_id,actor_id,actor_name,action,details,created_at").in("conversation_id", conversationIds).order("created_at", { ascending: false }).limit(400)
      : Promise.resolve({ data: [], error: null }),
    loadMainContext(token, conversationRows),
  ]);
  if (notesResult.error) console.error("Unable to load WhatsApp internal notes", notesResult.error);
  if (actionsResult.error) console.error("Unable to load WhatsApp staff actions", actionsResult.error);

  return json(req, {
    features: { inbox_v2: true },
    conversations: conversationRows,
    messages: messagesWithAttachments,
    reads: reads || [],
    alerts: alerts || [],
    notes: (notesResult.data || []) as WhatsAppNote[],
    staff_actions: (actionsResult.data || []) as WhatsAppStaffAction[],
    client_matches: mainContext.client_matches,
    related_service_requests: mainContext.related_service_requests,
    staff,
    current_staff: actor,
    attachment_url_ttl_seconds: SIGNED_URL_SECONDS,
    environment: "whatsapp-admin-ai-test",
  });
});
