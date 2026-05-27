import type { Enums } from "@/integrations/supabase/types";
import { serviceCategoryOptions, serviceNeededOptions } from "@/lib/serviceRequests";

export type WizardStep = 1 | 2 | 3 | 4 | 5;
export type WizardEntityType = Enums<"service_request_client_type">;
export type WizardServiceCategory = Enums<"service_request_category">;
export type WizardService = Enums<"service_request_service_needed">;
export type ContactPreference = "Phone call" | "WhatsApp" | "Email" | "Any of the above";

export type WizardWhoData = {
  entityType: WizardEntityType | "";
  province: string;
  city: string;
};

export type WizardWhatData = {
  selectedServices: WizardService[];
  otherDetails: Partial<Record<WizardServiceCategory, string>>;
};

export type WizardDetailsData = {
  answers: Record<string, string>;
  additionalNotes: string;
};

export type WizardContactData = {
  fullName: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  province: string;
  city: string;
  contactPreference: ContactPreference | "";
  marketingConsent: boolean;
};

export type WizardDraft = {
  who: WizardWhoData;
  what: WizardWhatData;
  details: WizardDetailsData;
  contact: WizardContactData;
};

export type ServiceOptionConfig = {
  value: WizardService;
  label: string;
  credits: number;
  isOther?: boolean;
};

export type ServiceCategoryConfig = {
  key: WizardServiceCategory;
  title: string;
  description: string;
  services: ServiceOptionConfig[];
};

export type QuestionConfig =
  | {
      key: string;
      type: "radio";
      label: string;
      options: string[];
    }
  | {
      key: string;
      type: "year-range";
      label: string;
      fromKey: string;
      toKey: string;
      helperText?: string;
      dependsOnKey?: string;
    }
  | {
      key: string;
      type: "textarea";
      label: string;
      maxLength: number;
      optional?: boolean;
    };

type StepStorageKey = keyof WizardDraft;

const serviceLabelMap = new Map(serviceNeededOptions.map((option) => [option.value, option.label]));
const serviceCreditMap = new Map<WizardService, number>([
  ["individual_personal_income_tax_returns", 2],
  ["individual_late_return_submissions", 2],
  ["individual_tax_number_registration", 2],
  ["individual_tax_compliance_issues", 2],
  ["individual_tax_status_corrections", 2],
  ["individual_tax_clearance_certificates", 3],
  ["individual_tax_compliance_status_assistance", 3],
  ["individual_voluntary_disclosure_programme", 4],
  ["individual_sars_verification_refund_assistance", 4],
  ["individual_tax_directives", 4],
  ["individual_sars_debt_assistance", 5],
  ["individual_estate_pension_tax_matters", 5],
  ["individual_objections_and_disputes", 7],
  ["individual_other", 4],
  ["business_vat_registration", 3],
  ["business_paye_registration", 3],
  ["business_tax_clearance_certificates", 3],
  ["business_vat_returns", 4],
  ["business_paye_compliance", 4],
  ["business_company_income_tax", 5],
  ["business_tax_compliance_support", 5],
  ["business_vat_paye_corrections", 5],
  ["business_tax_debt_compromise", 6],
  ["business_sars_debt_arrangements", 6],
  ["business_vat_objections_disputes", 6],
  ["business_sars_audits_support", 7],
  ["business_tax_other", 5],
  ["trust_tax_returns", 4],
  ["trust_compliance", 4],
  ["trust_tax_clearance", 4],
  ["trust_sars_assistance", 5],
  ["trust_financial_statements", 5],
  ["trust_representative_assistance", 5],
  ["trust_advisory_support", 6],
  ["trust_sars_disputes_objections", 7],
  ["trust_other", 5],
  ["npo_registration_assistance", 4],
  ["npo_tax_exemption_assistance", 4],
  ["npo_annual_compliance_filing", 4],
  ["npo_sars_compliance", 5],
  ["npo_payroll_accounting", 5],
  ["npo_financial_reporting", 5],
  ["npo_pbo_applications_assistance", 5],
  ["npo_donor_tax_section18a_assistance", 5],
  ["npo_governance_advisory", 6],
  ["npo_audit_compliance_support", 6],
  ["npo_organisation_other", 5],
  ["accounting_bookkeeping", 5],
  ["accounting_payroll_services", 5],
  ["accounting_monthly_accounting_services", 5],
  ["accounting_financial_statements", 6],
  ["accounting_management_accounts", 6],
  ["accounting_cash_flow_management", 6],
  ["accounting_budget_planning", 6],
  ["accounting_annual_financial_reporting", 6],
  ["accounting_independent_reviews", 7],
  ["accounting_other", 6],
  ["support_company_registration", 4],
  ["support_cipc_services", 4],
  ["support_annual_returns_filing", 4],
  ["support_beneficial_ownership_filings", 4],
  ["support_director_shareholder_changes", 4],
  ["support_business_compliance", 5],
  ["support_financial_compliance", 6],
  ["support_business_advisory", 6],
  ["support_bee_assistance", 6],
  ["business_support_other", 5],
]);

function getServiceLabel(service: WizardService) {
  return serviceLabelMap.get(service) ?? service.replace(/_/g, " ");
}

function createService(value: WizardService, credits: number, isOther = false): ServiceOptionConfig {
  return {
    value,
    label: getServiceLabel(value),
    credits,
    isOther,
  };
}

export const REQUEST_WIZARD_QUERY_KEY = "step";

export const REQUEST_WIZARD_STORAGE_KEYS: Record<StepStorageKey, string> = {
  who: "acapolite-request-wizard-step-1",
  what: "acapolite-request-wizard-step-2",
  details: "acapolite-request-wizard-step-3",
  contact: "acapolite-request-wizard-step-4",
};

export const REQUEST_WIZARD_STEPS = [
  { step: 1 as WizardStep, title: "Who", shortLabel: "Step 1" },
  { step: 2 as WizardStep, title: "What", shortLabel: "Step 2" },
  { step: 3 as WizardStep, title: "Details", shortLabel: "Step 3" },
  { step: 4 as WizardStep, title: "Contact", shortLabel: "Step 4" },
  { step: 5 as WizardStep, title: "Review", shortLabel: "Step 5" },
];

export const SOUTH_AFRICAN_PROVINCES = [
  "Any / Nationwide",
  "Gauteng",
  "Western Cape",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
] as const;

export const PHONE_COUNTRY_OPTIONS = [
  { value: "+27", label: "South Africa (+27)" },
  { value: "+44", label: "United Kingdom (+44)" },
  { value: "+1", label: "United States / Canada (+1)" },
  { value: "+263", label: "Zimbabwe (+263)" },
  { value: "+267", label: "Botswana (+267)" },
  { value: "+264", label: "Namibia (+264)" },
  { value: "+266", label: "Lesotho (+266)" },
  { value: "+268", label: "Eswatini (+268)" },
  { value: "+254", label: "Kenya (+254)" },
  { value: "+233", label: "Ghana (+233)" },
  { value: "+971", label: "United Arab Emirates (+971)" },
  { value: "+91", label: "India (+91)" },
] as const;

export const TAX_YEAR_OPTIONS = Array.from({ length: 16 }, (_, index) => `${2025 - index}`);

export const ENTITY_OPTIONS = [
  {
    value: "individual" as WizardEntityType,
    label: "Individual",
    description: "Personal tax returns, SARS support and compliance help.",
  },
  {
    value: "company" as WizardEntityType,
    label: "Company / Business",
    description: "Business tax, accounting, payroll and CIPC compliance.",
  },
  {
    value: "trust" as WizardEntityType,
    label: "Trust",
    description: "Trust tax returns, compliance and SARS assistance.",
  },
  {
    value: "npo_organisation" as WizardEntityType,
    label: "NPO / Organisation",
    description: "NPO, PBO and organisation compliance and reporting support.",
  },
];

export const CONTACT_PREFERENCE_OPTIONS: ContactPreference[] = [
  "Phone call",
  "WhatsApp",
  "Email",
  "Any of the above",
];

const categoryCatalog: Record<WizardServiceCategory, ServiceCategoryConfig> = {
  individual_tax: {
    key: "individual_tax",
    title: "Individual Tax Services",
    description: "Helping individuals with tax returns, compliance and SARS related matters.",
    services: [
      createService("individual_personal_income_tax_returns", 2),
      createService("individual_late_return_submissions", 2),
      createService("individual_tax_number_registration", 2),
      createService("individual_tax_compliance_issues", 2),
      createService("individual_tax_status_corrections", 2),
      createService("individual_tax_clearance_certificates", 3),
      createService("individual_tax_compliance_status_assistance", 3),
      createService("individual_voluntary_disclosure_programme", 4),
      createService("individual_sars_verification_refund_assistance", 4),
      createService("individual_tax_directives", 4),
      createService("individual_sars_debt_assistance", 5),
      createService("individual_estate_pension_tax_matters", 5),
      createService("individual_objections_and_disputes", 7),
      createService("individual_other", 4, true),
    ],
  },
  business_tax: {
    key: "business_tax",
    title: "Business Tax Services",
    description: "Tax and SARS support for companies, private businesses and growing enterprises.",
    services: [
      createService("business_vat_registration", 3),
      createService("business_paye_registration", 3),
      createService("business_tax_clearance_certificates", 3),
      createService("business_vat_returns", 4),
      createService("business_paye_compliance", 4),
      createService("business_company_income_tax", 5),
      createService("business_tax_compliance_support", 5),
      createService("business_vat_paye_corrections", 5),
      createService("business_tax_debt_compromise", 6),
      createService("business_sars_debt_arrangements", 6),
      createService("business_vat_objections_disputes", 6),
      createService("business_sars_audits_support", 7),
      createService("business_tax_other", 5, true),
    ],
  },
  accounting: {
    key: "accounting",
    title: "Accounting & Financial Services",
    description: "Bookkeeping, financial reporting and ongoing business accounting support.",
    services: [
      createService("accounting_bookkeeping", 5),
      createService("accounting_payroll_services", 5),
      createService("accounting_monthly_accounting_services", 5),
      createService("accounting_financial_statements", 6),
      createService("accounting_management_accounts", 6),
      createService("accounting_cash_flow_management", 6),
      createService("accounting_budget_planning", 6),
      createService("accounting_annual_financial_reporting", 6),
      createService("accounting_independent_reviews", 7),
      createService("accounting_other", 6, true),
    ],
  },
  business_support: {
    key: "business_support",
    title: "Business Support & Compliance Services",
    description: "CIPC, annual return filings and business compliance support for South African companies.",
    services: [
      createService("support_company_registration", 4),
      createService("support_cipc_services", 4),
      createService("support_annual_returns_filing", 4),
      createService("support_beneficial_ownership_filings", 4),
      createService("support_director_shareholder_changes", 4),
      createService("support_business_compliance", 5),
      createService("support_financial_compliance", 6),
      createService("support_business_advisory", 6),
      createService("support_bee_assistance", 6),
      createService("business_support_other", 5, true),
    ],
  },
  trust_services: {
    key: "trust_services",
    title: "Trust Services",
    description: "Trust tax, compliance and advisory support for trustees and authorised representatives.",
    services: [
      createService("trust_tax_returns", 4),
      createService("trust_compliance", 4),
      createService("trust_tax_clearance", 4),
      createService("trust_sars_assistance", 5),
      createService("trust_financial_statements", 5),
      createService("trust_representative_assistance", 5),
      createService("trust_advisory_support", 6),
      createService("trust_sars_disputes_objections", 7),
      createService("trust_other", 5, true),
    ],
  },
  npo_organisation_services: {
    key: "npo_organisation_services",
    title: "NPO / Organisation Services",
    description: "Compliance, tax exemption, payroll and governance support for mission-driven organisations.",
    services: [
      createService("npo_registration_assistance", 4),
      createService("npo_tax_exemption_assistance", 4),
      createService("npo_annual_compliance_filing", 4),
      createService("npo_sars_compliance", 5),
      createService("npo_payroll_accounting", 5),
      createService("npo_financial_reporting", 5),
      createService("npo_pbo_applications_assistance", 5),
      createService("npo_donor_tax_section18a_assistance", 5),
      createService("npo_governance_advisory", 6),
      createService("npo_audit_compliance_support", 6),
      createService("npo_organisation_other", 5, true),
    ],
  },
};

export const SERVICE_CATEGORIES_BY_ENTITY: Record<WizardEntityType, ServiceCategoryConfig[]> = {
  individual: [
    categoryCatalog.individual_tax,
    categoryCatalog.business_tax,
    categoryCatalog.accounting,
    categoryCatalog.business_support,
  ],
  company: [
    categoryCatalog.business_tax,
    categoryCatalog.accounting,
    categoryCatalog.business_support,
    categoryCatalog.individual_tax,
  ],
  trust: [
    categoryCatalog.trust_services,
    categoryCatalog.accounting,
    categoryCatalog.business_tax,
    categoryCatalog.business_support,
  ],
  npo_organisation: [
    categoryCatalog.npo_organisation_services,
    categoryCatalog.accounting,
    categoryCatalog.business_tax,
    categoryCatalog.business_support,
  ],
};

export const DETAIL_QUESTIONS_BY_ENTITY: Record<WizardEntityType, QuestionConfig[]> = {
  individual: [
    {
      key: "yearsNeeded",
      type: "radio",
      label: "How many tax years do you need help with?",
      options: ["1 year", "2–3 years", "4–7 years", "More than 7 years"],
    },
    {
      key: "taxYearRange",
      type: "year-range",
      label: "Select tax years",
      fromKey: "taxYearFrom",
      toKey: "taxYearTo",
      helperText: "For example, 2016 to 2024",
      dependsOnKey: "yearsNeeded",
    },
    {
      key: "hasEfilingAccess",
      type: "radio",
      label: "Do you have access to SARS eFiling?",
      options: ["Yes", "No", "Not sure"],
    },
    {
      key: "urgency",
      type: "radio",
      label: "How urgent is your request?",
      options: ["Urgent / Immediate", "Within a few days", "Flexible"],
    },
    {
      key: "additionalNotes",
      type: "textarea",
      label: "Is there anything else we should know?",
      maxLength: 500,
      optional: true,
    },
  ],
  company: [
    {
      key: "businessStructure",
      type: "radio",
      label: "What is your business structure?",
      options: [
        "Sole Proprietor",
        "Close Corporation (CC)",
        "Private Company (Pty Ltd)",
        "Partnership",
        "Other",
      ],
    },
    {
      key: "annualTurnover",
      type: "radio",
      label: "What is your estimated annual turnover?",
      options: [
        "Under R1 million",
        "R1 million–R5 million",
        "R5 million–R20 million",
        "R20 million–R50 million",
        "Above R50 million",
        "Not sure",
      ],
    },
    {
      key: "employeeCount",
      type: "radio",
      label: "How many employees does your business have?",
      options: ["None", "1–5", "6–20", "21–50", "More than 50"],
    },
    {
      key: "urgency",
      type: "radio",
      label: "How urgent is your request?",
      options: ["Urgent / Immediate", "Within a few days", "Flexible"],
    },
    {
      key: "additionalNotes",
      type: "textarea",
      label: "Is there anything else we should know?",
      maxLength: 500,
      optional: true,
    },
  ],
  trust: [
    {
      key: "trustType",
      type: "radio",
      label: "What type of trust is it?",
      options: [
        "Family Trust",
        "Charitable Trust",
        "Special Trust",
        "Testamentary Trust",
        "Discretionary Trust",
        "Other",
      ],
    },
    {
      key: "taxYearRange",
      type: "year-range",
      label: "For which tax years do you need assistance?",
      fromKey: "taxYearFrom",
      toKey: "taxYearTo",
    },
    {
      key: "hasEmployees",
      type: "radio",
      label: "Does the trust have employees?",
      options: ["Yes", "No", "Not sure"],
    },
    {
      key: "representativeType",
      type: "radio",
      label: "Are you the trustee or an authorised representative?",
      options: ["Trustee", "Authorised Representative", "Other"],
    },
    {
      key: "urgency",
      type: "radio",
      label: "How urgent is your request?",
      options: ["Urgent / Immediate", "Within a few days", "Flexible"],
    },
    {
      key: "additionalNotes",
      type: "textarea",
      label: "Is there anything else we should know?",
      maxLength: 500,
      optional: true,
    },
  ],
  npo_organisation: [
    {
      key: "organisationType",
      type: "radio",
      label: "What type of organisation is it?",
      options: [
        "Non-Profit Organisation (NPO)",
        "Public Benefit Organisation (PBO)",
        "Section 21 Company",
        "Trust",
        "Association/Club/Society",
        "Other",
      ],
    },
    {
      key: "taxYearRange",
      type: "year-range",
      label: "For which tax years do you need assistance?",
      fromKey: "taxYearFrom",
      toKey: "taxYearTo",
    },
    {
      key: "annualTurnover",
      type: "radio",
      label: "What is your organisation's annual turnover?",
      options: [
        "Under R500,000",
        "R500,000–R2 million",
        "R2 million–R5 million",
        "Above R5 million",
        "Not sure",
      ],
    },
    {
      key: "hasEmployees",
      type: "radio",
      label: "Does your organisation have employees?",
      options: ["Yes", "No", "Not sure"],
    },
    {
      key: "urgency",
      type: "radio",
      label: "How urgent is your request?",
      options: ["Urgent / Immediate", "Within a few days", "Flexible"],
    },
    {
      key: "additionalNotes",
      type: "textarea",
      label: "Is there anything else we should know?",
      maxLength: 500,
      optional: true,
    },
  ],
};

const categoryLabelMap = new Map(serviceCategoryOptions.map((option) => [option.value, option.label]));

export function getEntityLabel(entityType?: WizardEntityType | "") {
  return ENTITY_OPTIONS.find((option) => option.value === entityType)?.label ?? "";
}

export function getCategoryLabel(category: WizardServiceCategory) {
  return categoryLabelMap.get(category) ?? category.replace(/_/g, " ");
}

export function getCategoryForService(service: WizardService) {
  for (const categories of Object.values(SERVICE_CATEGORIES_BY_ENTITY)) {
    for (const category of categories) {
      if (category.services.some((item) => item.value === service)) {
        return category.key;
      }
    }
  }

  return "individual_tax";
}

export function getServiceCredits(service: WizardService) {
  return serviceCreditMap.get(service) ?? 4;
}

export function isNationwideSelection(province?: string | null) {
  return province === "Any / Nationwide";
}

export function getInitialWizardDraft(): WizardDraft {
  return {
    who: {
      entityType: "",
      province: "",
      city: "",
    },
    what: {
      selectedServices: [],
      otherDetails: {},
    },
    details: {
      answers: {},
      additionalNotes: "",
    },
    contact: {
      fullName: "",
      email: "",
      phoneCountryCode: "+27",
      phoneNumber: "",
      province: "",
      city: "",
      contactPreference: "",
      marketingConsent: true,
    },
  };
}

function readSessionStorage<T>(key: string, fallback: T) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const storedValue = window.sessionStorage.getItem(key);
  if (!storedValue) {
    return fallback;
  }

  try {
    return JSON.parse(storedValue) as T;
  } catch {
    return fallback;
  }
}

export function loadWizardDraft() {
  const initial = getInitialWizardDraft();

  return {
    who: { ...initial.who, ...readSessionStorage(REQUEST_WIZARD_STORAGE_KEYS.who, initial.who) },
    what: { ...initial.what, ...readSessionStorage(REQUEST_WIZARD_STORAGE_KEYS.what, initial.what) },
    details: { ...initial.details, ...readSessionStorage(REQUEST_WIZARD_STORAGE_KEYS.details, initial.details) },
    contact: { ...initial.contact, ...readSessionStorage(REQUEST_WIZARD_STORAGE_KEYS.contact, initial.contact) },
  } satisfies WizardDraft;
}

export function saveWizardStep<Key extends StepStorageKey>(key: Key, value: WizardDraft[Key]) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(REQUEST_WIZARD_STORAGE_KEYS[key], JSON.stringify(value));
}

export function clearWizardDraft() {
  if (typeof window === "undefined") {
    return;
  }

  Object.values(REQUEST_WIZARD_STORAGE_KEYS).forEach((key) => window.sessionStorage.removeItem(key));
}

export function getStepFromSearchParam(value: string | null): WizardStep {
  const step = Number(value);
  if (step >= 1 && step <= 5) {
    return step as WizardStep;
  }
  return 1;
}

export function getGroupedSelectedServices(entityType: WizardEntityType, selectedServices: WizardService[]) {
  const categories = SERVICE_CATEGORIES_BY_ENTITY[entityType] ?? [];
  return categories
    .map((category) => ({
      ...category,
      selectedServices: category.services.filter((service) => selectedServices.includes(service.value)),
    }))
    .filter((category) => category.selectedServices.length > 0);
}

export function buildRequestDescription(draft: WizardDraft) {
  const entityLabel = getEntityLabel(draft.who.entityType);
  const serviceGroups = draft.who.entityType
    ? getGroupedSelectedServices(draft.who.entityType, draft.what.selectedServices)
    : [];
  const detailLines = draft.who.entityType
    ? getDetailSummaryRows(draft.who.entityType, draft.details).map((item) => `${item.label}: ${item.value}`)
    : [];

  const otherLines = Object.entries(draft.what.otherDetails)
    .filter(([, value]) => value?.trim())
    .map(([category, value]) => `${getCategoryLabel(category as WizardServiceCategory)} Other: ${value?.trim()}`);

  if (draft.details.additionalNotes.trim()) {
    detailLines.push(`Additional notes: ${draft.details.additionalNotes.trim()}`);
  }

  return [
    entityLabel ? `Request for: ${entityLabel}` : null,
    serviceGroups.length
      ? `Services: ${serviceGroups
          .flatMap((group) => group.selectedServices.map((service) => service.label))
          .join(", ")}`
      : null,
    otherLines.length ? `Other details:\n${otherLines.join("\n")}` : null,
    detailLines.length ? `Details:\n${detailLines.join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function getDetailSummaryRows(entityType: WizardEntityType, details: WizardDetailsData) {
  const rows: Array<{ label: string; value: string }> = [];

  DETAIL_QUESTIONS_BY_ENTITY[entityType].forEach((question) => {
    if (question.type === "year-range") {
      const dependencyValue = question.dependsOnKey ? details.answers[question.dependsOnKey] : "show";
      if (question.dependsOnKey && !dependencyValue) {
        return;
      }

      const fromYear = details.answers[question.fromKey];
      const toYear = details.answers[question.toKey];
      if (fromYear || toYear) {
        rows.push({
          label: question.label,
          value: [fromYear || "—", toYear || "—"].join(" to "),
        });
      }
      return;
    }

    if (question.type === "textarea") {
      const value = details.additionalNotes.trim();
      if (value) {
        rows.push({ label: question.label, value });
      }
      return;
    }

    const value = details.answers[question.key];
    if (value) {
      rows.push({ label: question.label, value });
    }
  });

  return rows;
}

export function buildIntakePayload(draft: WizardDraft) {
  return {
    who: draft.who,
    what: {
      selectedServices: draft.what.selectedServices.map((service) => ({
        value: service,
        label: getServiceLabel(service),
        category: getCategoryForService(service),
        credits: getServiceCredits(service),
      })),
      otherDetails: draft.what.otherDetails,
    },
    details: {
      answers: draft.details.answers,
      additionalNotes: draft.details.additionalNotes.trim() || null,
      questions: DETAIL_QUESTIONS_BY_ENTITY[draft.who.entityType || "individual"],
    },
    contact: {
      ...draft.contact,
      phone: formatPhoneForStorage(draft.contact.phoneCountryCode, draft.contact.phoneNumber),
    },
  };
}

export function formatPhoneForStorage(countryCode: string, phoneNumber: string) {
  return `${countryCode} ${phoneNumber}`.trim();
}

export function getPrimaryCategoryForSelection(entityType: WizardEntityType, selectedServices: WizardService[]) {
  const grouped = getGroupedSelectedServices(entityType, selectedServices);
  return grouped[0]?.key ?? SERVICE_CATEGORIES_BY_ENTITY[entityType]?.[0]?.key ?? "individual_tax";
}

export function getPrimaryServiceForSelection(selectedServices: WizardService[]) {
  return selectedServices[0] ?? "individual_personal_income_tax_returns";
}

export function buildRegisterQueryFromContact(contact: WizardContactData) {
  const params = new URLSearchParams({
    full_name: contact.fullName,
    email: contact.email,
    phone: formatPhoneForStorage(contact.phoneCountryCode, contact.phoneNumber),
    province: contact.province,
    source: "service-request",
  });

  return params.toString();
}
