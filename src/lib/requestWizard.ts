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

export type ServiceCategoryConfig = {
  key: WizardServiceCategory;
  title: string;
  description: string;
  services: { value: WizardService; label: string }[];
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
    }
  | {
      key: string;
      type: "textarea";
      label: string;
      maxLength: number;
      optional?: boolean;
    };

type StepStorageKey = keyof WizardDraft;

export const REQUEST_WIZARD_QUERY_KEY = "step";

export const REQUEST_WIZARD_STORAGE_KEYS: Record<StepStorageKey, string> = {
  who: "acapolite-request-wizard-step-1",
  what: "acapolite-request-wizard-step-2",
  details: "acapolite-request-wizard-step-3",
  contact: "acapolite-request-wizard-step-4",
};

export const REQUEST_WIZARD_STEPS: Array<{
  step: WizardStep;
  title: string;
  shortLabel: string;
}> = [
  { step: 1, title: "Who", shortLabel: "Step 1" },
  { step: 2, title: "What", shortLabel: "Step 2" },
  { step: 3, title: "Details", shortLabel: "Step 3" },
  { step: 4, title: "Contact", shortLabel: "Step 4" },
  { step: 5, title: "Review", shortLabel: "Step 5" },
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

export const TAX_YEAR_OPTIONS = Array.from({ length: 16 }, (_, index) => `${2025 - index}`);

export const ENTITY_OPTIONS: Array<{
  value: WizardEntityType;
  label: string;
  description: string;
}> = [
  {
    value: "individual",
    label: "Individual",
    description: "Personal tax returns, SARS support and compliance help.",
  },
  {
    value: "company",
    label: "Company / Business",
    description: "Business tax, accounting, payroll and CIPC compliance.",
  },
  {
    value: "trust",
    label: "Trust",
    description: "Trust tax returns, compliance and SARS assistance.",
  },
  {
    value: "npo_organisation",
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

const serviceLabelMap = new Map(
  serviceNeededOptions.map((option) => [option.value, option.label]),
);

function getServiceLabel(service: WizardService) {
  return serviceLabelMap.get(service) ?? service.replace(/_/g, " ");
}

export const SERVICE_CATEGORIES_BY_ENTITY: Record<
  WizardEntityType,
  ServiceCategoryConfig[]
> = {
  individual: [
    {
      key: "individual_tax",
      title: "Individual Tax Services",
      description:
        "Helping individuals with tax returns, compliance and SARS related matters.",
      services: [
        "individual_personal_income_tax_returns",
        "individual_late_return_submissions",
        "individual_sars_debt_assistance",
        "individual_tax_clearance_certificates",
        "individual_tax_number_registration",
        "individual_objections_and_disputes",
        "individual_tax_status_corrections",
        "individual_tax_compliance_status_assistance",
        "individual_tax_compliance_issues",
      ].map((value) => ({ value, label: getServiceLabel(value) })),
    },
  ],
  company: [
    {
      key: "business_tax",
      title: "Business Tax Services",
      description:
        "Tax and SARS support for companies, private businesses and growing enterprises.",
      services: [
        "business_company_income_tax",
        "business_vat_registration",
        "business_vat_returns",
        "business_paye_registration",
        "business_paye_compliance",
        "business_sars_debt_arrangements",
        "business_tax_compliance_support",
        "business_sars_audits_support",
        "business_tax_clearance_certificates",
      ].map((value) => ({ value, label: getServiceLabel(value) })),
    },
    {
      key: "accounting",
      title: "Accounting and Financial Services",
      description:
        "Bookkeeping, financial reporting and ongoing business accounting support.",
      services: [
        "accounting_bookkeeping",
        "accounting_financial_statements",
        "accounting_management_accounts",
        "accounting_payroll_services",
        "accounting_monthly_accounting_services",
        "accounting_cash_flow_management",
        "accounting_budget_planning",
        "accounting_annual_financial_reporting",
      ].map((value) => ({ value, label: getServiceLabel(value) })),
    },
    {
      key: "business_support",
      title: "Business Support and Compliance Services",
      description:
        "CIPC, annual return filings and business compliance support for South African companies.",
      services: [
        "support_company_registration",
        "support_cipc_services",
        "support_annual_returns_filing",
        "support_business_compliance",
        "support_business_advisory",
        "support_financial_compliance",
      ].map((value) => ({ value, label: getServiceLabel(value) })),
    },
  ],
  trust: [
    {
      key: "trust_services",
      title: "Trust Services",
      description:
        "Trust tax, compliance and advisory support for trustees and authorised representatives.",
      services: [
        "trust_tax_returns",
        "trust_compliance",
        "trust_sars_assistance",
        "trust_tax_clearance",
        "trust_financial_statements",
        "trust_advisory_support",
      ].map((value) => ({ value, label: getServiceLabel(value) })),
    },
  ],
  npo_organisation: [
    {
      key: "npo_organisation_services",
      title: "NPO / Organisation Services",
      description:
        "Compliance, tax exemption, payroll and governance support for mission-driven organisations.",
      services: [
        "npo_registration_assistance",
        "npo_tax_exemption_assistance",
        "npo_annual_compliance_filing",
        "npo_payroll_accounting",
        "npo_sars_compliance",
        "npo_financial_reporting",
        "npo_governance_advisory",
      ].map((value) => ({ value, label: getServiceLabel(value) })),
    },
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
      label: "Which tax years do you need help with?",
      fromKey: "taxYearFrom",
      toKey: "taxYearTo",
      helperText: "For example, 2016 to 2024",
    },
    {
      key: "hasEfilingAccess",
      type: "radio",
      label: "Do you have access to SARS eFiling?",
      options: ["Yes", "No", "Not sure"],
    },
    {
      key: "mainReason",
      type: "radio",
      label: "What best describes your main reason for seeking help?",
      options: [
        "Late or outstanding tax returns",
        "SARS debt or payment arrangement",
        "Received SARS letter or notice",
        "Tax clearance certificate",
        "Tax compliance status",
        "Other",
      ],
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
      key: "mainReason",
      type: "radio",
      label: "What best describes your main reason for seeking help?",
      options: [
        "Tax compliance and submissions",
        "VAT related (Registration/Returns)",
        "PAYE related (Registration/Returns)",
        "SARS debt or payment arrangement",
        "Received SARS letter or audit",
        "Ongoing monthly accounting/bookkeeping",
        "Business registration or CIPC compliance",
        "Other",
      ],
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
      key: "mainReason",
      type: "radio",
      label: "What best describes your main reason for seeking help?",
      options: [
        "Tax returns and submissions",
        "Tax compliance assistance",
        "SARS debt or payment arrangement",
        "Trust tax clearance certificate",
        "SARS letter or notice received",
        "Other",
      ],
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
      key: "mainReason",
      type: "radio",
      label: "What best describes your main reason for seeking help?",
      options: [
        "Tax compliance and submissions",
        "SARS audit or investigation",
        "SARS registration/PBO approval",
        "Tax clearance certificate",
        "SARS letter or notice received",
        "Donor tax certificates (Section 18A)",
        "VAT registration/Returns",
        "Other",
      ],
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
      key: "additionalNotes",
      type: "textarea",
      label: "Is there anything else we should know?",
      maxLength: 500,
      optional: true,
    },
  ],
};

const categoryLabelMap = new Map(
  serviceCategoryOptions.map((option) => [option.value, option.label]),
);

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

  return "individual_tax" as WizardServiceCategory;
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

export function saveWizardStep<Key extends StepStorageKey>(
  key: Key,
  value: WizardDraft[Key],
) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    REQUEST_WIZARD_STORAGE_KEYS[key],
    JSON.stringify(value),
  );
}

export function clearWizardDraft() {
  if (typeof window === "undefined") {
    return;
  }

  Object.values(REQUEST_WIZARD_STORAGE_KEYS).forEach((key) => {
    window.sessionStorage.removeItem(key);
  });
}

export function getStepFromSearchParam(value: string | null): WizardStep {
  const step = Number(value);

  if (step >= 1 && step <= 5) {
    return step as WizardStep;
  }

  return 1;
}

export function getGroupedSelectedServices(
  entityType: WizardEntityType,
  selectedServices: WizardService[],
) {
  const categories = SERVICE_CATEGORIES_BY_ENTITY[entityType] ?? [];

  return categories
    .map((category) => ({
      ...category,
      selectedServices: category.services.filter((service) =>
        selectedServices.includes(service.value),
      ),
    }))
    .filter((category) => category.selectedServices.length > 0);
}

export function buildRequestDescription(draft: WizardDraft) {
  const entityLabel = getEntityLabel(draft.who.entityType);
  const services = draft.what.selectedServices.map(getServiceLabel).join(", ");
  const detailLines = getDetailSummaryRows(draft.who.entityType || "individual", draft.details)
    .map((item) => `${item.label}: ${item.value}`);

  if (draft.details.additionalNotes.trim()) {
    detailLines.push(`Additional notes: ${draft.details.additionalNotes.trim()}`);
  }

  return [
    entityLabel ? `Request for: ${entityLabel}` : null,
    services ? `Services: ${services}` : null,
    detailLines.length ? `Details:\n${detailLines.join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function getDetailSummaryRows(
  entityType: WizardEntityType,
  details: WizardDetailsData,
) {
  const rows: Array<{ label: string; value: string }> = [];

  DETAIL_QUESTIONS_BY_ENTITY[entityType].forEach((question) => {
    if (question.type === "year-range") {
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
        rows.push({
          label: question.label,
          value,
        });
      }
      return;
    }

    const value = details.answers[question.key];
    if (value) {
      rows.push({
        label: question.label,
        value,
      });
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
      })),
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

export function getPrimaryCategoryForSelection(
  entityType: WizardEntityType,
  selectedServices: WizardService[],
) {
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
