export type WhatsAppLeadQualityStatus = "ready" | "needs_info" | "weak";

export type WhatsAppLeadQualityInput = {
  intakePayload?: Record<string, unknown> | null;
  displayName?: string | null;
  waId?: string | null;
  aiSummary?: string | null;
  intakeReady?: boolean | null;
  missingFields?: string[] | null;
  hasAttachments?: boolean;
};

export type WhatsAppLeadQualityCheck = {
  key: string;
  label: string;
  passed: boolean;
  required: boolean;
  weight: number;
  missingField: string;
};

export type WhatsAppLeadQuality = {
  score: number;
  status: WhatsAppLeadQualityStatus;
  label: string;
  description: string;
  nextAction: string;
  missingFields: string[];
  blockingFields: string[];
  followUpFields: string[];
  checks: WhatsAppLeadQualityCheck[];
};

export type WhatsAppLeadGate = {
  qualityStatus: WhatsAppLeadQualityStatus;
  serviceRequestStatus: "new" | "pending_client_confirmation" | "dead_lead";
  lifecycleStage: "open_marketplace" | "pending_client_confirmation" | "expired";
  marketplaceVisible: boolean;
  label: string;
  description: string;
  actionLabel: string;
  confirmTitle: string;
  confirmBody: string;
  savedMessage: string;
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "full name",
  email: "email address",
  phone: "WhatsApp number",
  client_type: "client type",
  company_name: "company name",
  company_registration_number: "company registration number",
  service_category: "service category",
  service_needed: "service needed",
  description: "problem summary",
  province: "province",
  city: "city",
  urgency: "urgency",
  priority_level: "priority",
  risk_indicator: "risk level",
  sars_debt_amount: "SARS debt amount",
  tax_types: "tax type",
  enforcement_stage: "SARS stage",
  efiling_access: "eFiling access",
  desired_outcome: "desired outcome",
  documents: "supporting documents",
};

const FOLLOW_UP_PRIORITY = [
  "full_name",
  "province",
  "service_needed",
  "description",
  "urgency",
  "email",
  "city",
  "client_type",
  "company_name",
  "company_registration_number",
  "sars_debt_amount",
  "tax_types",
  "enforcement_stage",
  "efiling_access",
  "desired_outcome",
  "documents",
];

const FOLLOW_UP_PROMPTS: Record<string, string> = {
  full_name: "your full legal name",
  province: "your province",
  service_needed: "which Acapolite service you need",
  description: "a short summary of the SARS or tax issue",
  urgency: "how urgent this is",
  email: "your email address",
  city: "your city or town",
  client_type: "whether this is for you, a company, a trust, or an NPO",
  company_name: "your company name",
  company_registration_number: "your company registration number, if available",
  sars_debt_amount: "the SARS debt amount, if any",
  tax_types: "the tax type involved, for example VAT, PAYE, or income tax",
  enforcement_stage: "the SARS stage, for example audit, verification, or final demand",
  efiling_access: "whether you have eFiling access",
  desired_outcome: "what outcome you want from us",
  documents: "any SARS letter or document you received",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function booleanValue(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "boolean" ? record[key] as boolean : null;
}

function numberValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") as string[] : [];
}

function normalizeField(value: string) {
  const key = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (key === "name") return "full_name";
  if (key === "mobile" || key === "whatsapp") return "phone";
  if (key === "summary" || key === "problem") return "description";
  if (key === "service") return "service_needed";
  if (key === "document") return "documents";
  return key;
}

function uniqueFields(values: string[]) {
  return Array.from(new Set(values.map(normalizeField).filter(Boolean)));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hasTaxSignal(text: string) {
  return /\b(sars|tax|vat|paye|income|return|debt|audit|verification|refund|efiling|compliance|company|trust|npo)\b/i.test(text);
}

function qualityStatus(score: number, blockingFields: string[]): WhatsAppLeadQualityStatus {
  if (score >= 85 && blockingFields.length === 0) return "ready";
  if (score >= 60) return "needs_info";
  return "weak";
}

export function formatWhatsAppMissingFieldLabel(field: string) {
  const normalized = normalizeField(field);
  return FIELD_LABELS[normalized] || normalized.replace(/_/g, " ");
}

export function getWhatsAppLeadQualityBadgeClass(status: WhatsAppLeadQualityStatus) {
  if (status === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "needs_info") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-700";
}

export function getWhatsAppLeadQualityCardClass(status: WhatsAppLeadQualityStatus) {
  if (status === "ready") return "border-emerald-200 bg-emerald-50/60";
  if (status === "needs_info") return "border-amber-200 bg-amber-50/70";
  return "border-red-200 bg-red-50/70";
}

export function getWhatsAppLeadGate(quality: WhatsAppLeadQuality): WhatsAppLeadGate {
  if (quality.status === "ready") {
    return {
      qualityStatus: "ready",
      serviceRequestStatus: "pending_client_confirmation",
      lifecycleStage: "pending_client_confirmation",
      marketplaceVisible: false,
      label: "Ready for admin review",
      description: "This WhatsApp lead has the core details. Send it to Service Requests so admin can review and approve marketplace visibility.",
      actionLabel: "Send request",
      confirmTitle: "Send this request for admin review?",
      confirmBody: "It has the main client and case details, so it will be saved to Service Requests for admin review before marketplace release.",
      savedMessage: "Request sent for admin review.",
    };
  }

  if (quality.status === "needs_info") {
    return {
      qualityStatus: "needs_info",
      serviceRequestStatus: "pending_client_confirmation",
      lifecycleStage: "pending_client_confirmation",
      marketplaceVisible: false,
      label: "Hold for missing info",
      description: "This lead is saved for staff follow-up, but hidden from practitioners until the missing details are collected.",
      actionLabel: "Save as needs info",
      confirmTitle: "Save this incomplete lead?",
      confirmBody: "It will go to Service Requests as Pending Client Confirmation and stay hidden from practitioners until staff returns it to the marketplace.",
      savedMessage: "Lead saved as needs info.",
    };
  }

  return {
    qualityStatus: "weak",
    serviceRequestStatus: "dead_lead",
    lifecycleStage: "expired",
    marketplaceVisible: false,
    label: "Park for staff review",
    description: "This chat does not have enough signal for the marketplace. Staff should review it before reviving the lead.",
    actionLabel: "Park weak lead",
    confirmTitle: "Park this weak lead?",
    confirmBody: "It will be saved as a Dead Lead and kept out of the practitioner marketplace until an admin revives it.",
    savedMessage: "Weak lead parked for staff review.",
  };
}

export function getWhatsAppLeadQuality(input: WhatsAppLeadQualityInput): WhatsAppLeadQuality {
  const intake = asRecord(input.intakePayload);
  const text = [
    stringValue(intake, "description"),
    stringValue(intake, "document_summary"),
    stringValue(intake, "service_needed"),
    stringValue(intake, "tax_types"),
    stringValue(intake, "enforcement_stage"),
    stringValue(intake, "desired_outcome"),
    input.aiSummary || "",
  ].join(" ");
  const clientType = stringValue(intake, "client_type");
  const serviceNeeded = stringValue(intake, "service_needed");
  const isCompany = clientType === "company"
    || serviceNeeded.startsWith("business_")
    || serviceNeeded.startsWith("support_")
    || serviceNeeded.startsWith("accounting_")
    || Boolean(stringValue(intake, "company_name") || stringValue(intake, "company_registration_number"));
  const debtAmount = numberValue(intake, "sars_debt_amount");
  const explicitMissing = uniqueFields(input.missingFields || []);
  const fullName = stringValue(intake, "full_name");
  const email = stringValue(intake, "email");
  const checks: WhatsAppLeadQualityCheck[] = [
    {
      key: "phone",
      label: "Reachable client",
      passed: Boolean(stringValue(intake, "phone") || input.waId),
      required: true,
      weight: 15,
      missingField: "phone",
    },
    {
      key: "full_name",
      label: "Client name",
      passed: Boolean(fullName && !/^whatsapp\b/i.test(fullName)),
      required: true,
      weight: 12,
      missingField: "full_name",
    },
    {
      key: "service",
      label: "Service needed",
      passed: Boolean(stringValue(intake, "service_needed") || stringValue(intake, "service_category") || hasTaxSignal(text)),
      required: true,
      weight: 18,
      missingField: "service_needed",
    },
    {
      key: "summary",
      label: "Problem summary",
      passed: Boolean(text.trim().length >= 18),
      required: true,
      weight: 18,
      missingField: "description",
    },
    {
      key: "location",
      label: "Province",
      passed: Boolean(stringValue(intake, "province")),
      required: true,
      weight: 12,
      missingField: "province",
    },
    {
      key: "urgency",
      label: "Urgency or risk",
      passed: Boolean(stringValue(intake, "urgency") || stringValue(intake, "priority_level") || stringValue(intake, "risk_indicator") || stringValue(intake, "enforcement_stage") || debtAmount > 0),
      required: true,
      weight: 10,
      missingField: "urgency",
    },
    {
      key: "client_type",
      label: "Client type",
      passed: Boolean(clientType || isCompany),
      required: false,
      weight: 5,
      missingField: "client_type",
    },
    {
      key: "email",
      label: "Email address",
      passed: isValidEmail(email),
      required: false,
      weight: 4,
      missingField: "email",
    },
    {
      key: "company",
      label: "Company details",
      passed: !isCompany || Boolean(stringValue(intake, "company_name")),
      required: isCompany,
      weight: 3,
      missingField: "company_name",
    },
    {
      key: "documents",
      label: "Supporting documents",
      passed: input.hasAttachments === true || !explicitMissing.includes("documents") && booleanValue(intake, "missing_documents_flag") !== true,
      required: false,
      weight: 3,
      missingField: "documents",
    },
  ];

  const score = Math.max(0, Math.min(100, Math.round(checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0))));
  const inferredMissing = checks.filter((check) => !check.passed).map((check) => check.missingField);
  const missingFields = uniqueFields([...explicitMissing, ...inferredMissing])
    .filter((field) => !["company_name", "company_registration_number"].includes(field) || isCompany);
  const blockingFields = checks
    .filter((check) => check.required && !check.passed)
    .map((check) => check.missingField);
  const followUpFields = FOLLOW_UP_PRIORITY.filter((field) => missingFields.includes(field));
  const status = qualityStatus(score, blockingFields);
  const label = status === "ready" ? "Quality lead" : status === "needs_info" ? "Needs info" : "Keep collecting";
  const description = status === "ready"
    ? "This lead has enough detail for staff or practitioner action."
    : status === "needs_info"
      ? "This lead is usable, but staff should collect the missing details."
      : "This chat should keep collecting basics before it becomes a strong lead.";
  const nextAction = followUpFields.length
    ? `Ask for ${followUpFields.slice(0, 3).map(formatWhatsAppMissingFieldLabel).join(", ")}${followUpFields.length > 3 ? " and more" : ""}.`
    : status === "ready"
      ? "Send or refresh the lead."
      : "Review the transcript.";

  return { score, status, label, description, nextAction, missingFields, blockingFields, followUpFields, checks };
}

export function getWhatsAppLeadQualityFromIntakePayload(intakePayload: unknown) {
  const root = asRecord(intakePayload);
  const whatsapp = asRecord(root.whatsapp);
  if (!whatsapp.source && !whatsapp.qaConversationId && !whatsapp.waId) return null;
  return getWhatsAppLeadQuality({
    intakePayload: asRecord(whatsapp.allCapturedDetails),
    displayName: typeof whatsapp.displayName === "string" ? whatsapp.displayName : null,
    waId: typeof whatsapp.waId === "string" ? whatsapp.waId : null,
    aiSummary: typeof whatsapp.aiSummary === "string" ? whatsapp.aiSummary : null,
    intakeReady: typeof whatsapp.intakeReady === "boolean" ? whatsapp.intakeReady : null,
    missingFields: stringArray(whatsapp.missingFields),
  });
}

export function getWhatsAppLeadSource(intakePayload: unknown) {
  const root = asRecord(intakePayload);
  const whatsapp = asRecord(root.whatsapp);
  if (!whatsapp.source && !whatsapp.qaConversationId && !whatsapp.waId) return null;
  return {
    source: typeof whatsapp.source === "string" ? whatsapp.source : "whatsapp",
    qaConversationId: typeof whatsapp.qaConversationId === "string" ? whatsapp.qaConversationId : null,
    waId: typeof whatsapp.waId === "string" ? whatsapp.waId : null,
    displayName: typeof whatsapp.displayName === "string" ? whatsapp.displayName : null,
    aiSummary: typeof whatsapp.aiSummary === "string" ? whatsapp.aiSummary : null,
    missingFields: stringArray(whatsapp.missingFields),
  };
}

export function buildWhatsAppMissingInfoReply(input: WhatsAppLeadQualityInput, quality: WhatsAppLeadQuality) {
  const intake = asRecord(input.intakePayload);
  const fullName = stringValue(intake, "full_name");
  const displayName = input.displayName?.trim() || "";
  const firstName = (fullName || displayName).split(/\s+/)[0] || "";
  const fields = quality.followUpFields.slice(0, 4);
  if (!fields.length) {
    return `Thanks${firstName ? ` ${firstName}` : ""}. We have enough detail to move your Acapolite request forward.`;
  }

  const intro = `Thanks${firstName ? ` ${firstName}` : ""}. To complete your Acapolite request, please send:`;
  const items = fields.map((field, index) => `${index + 1}. ${FOLLOW_UP_PROMPTS[field] || formatWhatsAppMissingFieldLabel(field)}`);
  return `${intro}\n${items.join("\n")}`;
}
