// Canonical mirror of the `service_request_service_needed` Postgres enum
// (see supabase/migrations/20260409110000_..., 20260411140000_...,
// 20260520100000_..., 20260527120000_...). Keep in sync with any future
// migration that adds a value. This is the single source of truth used to
// validate every WhatsApp-created or WhatsApp-updated service request before
// it reaches the database, so free-form AI/customer wording can never be
// inserted directly into the enum column again.
export const SERVICE_NEEDED_VALUES = [
  "tax_return",
  "sars_debt_assistance",
  "vat_registration",
  "company_tax",
  "paye_issues",
  "objection_dispute",
  "bookkeeping",
  "other",
  "individual_personal_income_tax_returns",
  "individual_sars_debt_assistance",
  "individual_tax_compliance_issues",
  "individual_tax_clearance_certificates",
  "individual_objections_and_disputes",
  "individual_late_return_submissions",
  "individual_tax_number_registration",
  "individual_tax_status_corrections",
  "individual_tax_compliance_status_assistance",
  "individual_voluntary_disclosure_programme",
  "individual_sars_verification_refund_assistance",
  "individual_tax_directives",
  "individual_estate_pension_tax_matters",
  "individual_other",
  "business_company_income_tax",
  "business_vat_registration",
  "business_vat_returns",
  "business_paye_registration",
  "business_paye_compliance",
  "business_sars_debt_arrangements",
  "business_tax_compliance_support",
  "business_tax_clearance_certificates",
  "business_sars_audits_support",
  "business_vat_paye_corrections",
  "business_tax_debt_compromise",
  "business_vat_objections_disputes",
  "business_tax_other",
  "accounting_bookkeeping",
  "accounting_financial_statements",
  "accounting_management_accounts",
  "accounting_payroll_services",
  "accounting_monthly_accounting_services",
  "accounting_cash_flow_management",
  "accounting_budget_planning",
  "accounting_annual_financial_reporting",
  "accounting_independent_reviews",
  "accounting_other",
  "support_company_registration",
  "support_business_compliance",
  "support_annual_returns_filing",
  "support_cipc_services",
  "support_business_advisory",
  "support_financial_compliance",
  "support_beneficial_ownership_filings",
  "support_director_shareholder_changes",
  "support_bee_assistance",
  "business_support_other",
  "trust_tax_returns",
  "trust_compliance",
  "trust_sars_assistance",
  "trust_tax_clearance",
  "trust_financial_statements",
  "trust_advisory_support",
  "trust_representative_assistance",
  "trust_sars_disputes_objections",
  "trust_other",
  "npo_registration_assistance",
  "npo_tax_exemption_assistance",
  "npo_annual_compliance_filing",
  "npo_payroll_accounting",
  "npo_sars_compliance",
  "npo_financial_reporting",
  "npo_governance_advisory",
  "npo_pbo_applications_assistance",
  "npo_donor_tax_section18a_assistance",
  "npo_audit_compliance_support",
  "npo_organisation_other",
] as const;

export type ServiceNeeded = (typeof SERVICE_NEEDED_VALUES)[number];

const VALID_SET = new Set<string>(SERVICE_NEEDED_VALUES);

export function isValidServiceNeeded(value: unknown): value is ServiceNeeded {
  return typeof value === "string" && VALID_SET.has(value);
}

export type NormalizationContext = {
  clientType?: string | null;
  hasDebtFlag?: boolean | null;
  description?: string | null;
};

export type NormalizationResult = {
  value: ServiceNeeded;
  matched: boolean;
  method: "exact" | "keyword" | "fallback";
  ruleLabel: string | null;
  original: string;
};

// The genuinely generic, category-agnostic fallback that has existed since
// the enum's first migration. Always valid, regardless of client type.
const GENERIC_OTHER: ServiceNeeded = "other";

// Every category-specific catch-all the enum currently defines, keyed by
// service_category. Used when the client type is known but no keyword rule
// matched, so the fallback at least lands in the right practice area.
const CATEGORY_OTHER: Record<string, ServiceNeeded> = {
  company: "business_tax_other",
  trust: "trust_other",
  npo_organisation: "npo_organisation_other",
  individual: "individual_other",
};

export function categoryOtherFor(clientType?: string | null): ServiceNeeded {
  if (clientType && CATEGORY_OTHER[clientType]) return CATEGORY_OTHER[clientType];
  return GENERIC_OTHER;
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCompanyLike(normalized: string, ctx: NormalizationContext): boolean {
  if (ctx.clientType === "company") return true;
  return /\b(company|business|pty|cc|enterprise|corporate)\b/.test(normalized);
}

function isTrustLike(normalized: string, ctx: NormalizationContext): boolean {
  if (ctx.clientType === "trust") return true;
  return /\btrust\b/.test(normalized);
}

function isNpoLike(normalized: string, ctx: NormalizationContext): boolean {
  if (ctx.clientType === "npo_organisation") return true;
  return /\bnpo\b|non\s*profit|nonprofit|public benefit organisation|\bpbo\b/.test(normalized);
}

type Rule = {
  label: string;
  test: (normalized: string, ctx: NormalizationContext) => boolean;
  resolve: (normalized: string, ctx: NormalizationContext) => ServiceNeeded;
};

// Ordered most-specific-first: the first matching rule wins. Every rule
// resolves to a value already present in SERVICE_NEEDED_VALUES above, so a
// match can never itself produce an invalid enum value (double-checked by
// the guard in normalizeServiceNeeded).
const RULES: Rule[] = [
  {
    label: "debt-compromise",
    test: (n) => /\bcompromise\b/.test(n),
    resolve: (n, ctx) => (isCompanyLike(n, ctx) ? "business_tax_debt_compromise" : "individual_sars_debt_assistance"),
  },
  {
    label: "debt-arrangement",
    test: (n) => /\b(defer(ment)?|payment arrangement|instal?ment|arrangement)\b/.test(n),
    resolve: (n, ctx) => (isCompanyLike(n, ctx) ? "business_sars_debt_arrangements" : "individual_sars_debt_assistance"),
  },
  {
    label: "sars-debt",
    test: (n, ctx) => ctx.hasDebtFlag === true || /\b(debt|owe|owing|owes)\b/.test(n),
    resolve: (n, ctx) => (isCompanyLike(n, ctx) ? "business_sars_debt_arrangements" : "individual_sars_debt_assistance"),
  },
  {
    label: "vat-returns",
    test: (n) => /\bvat\b/.test(n) && /\breturns?\b/.test(n),
    resolve: () => "business_vat_returns",
  },
  {
    label: "vat-paye-corrections",
    test: (n) => /\b(vat|paye)\b/.test(n) && /\bcorrection/.test(n),
    resolve: () => "business_vat_paye_corrections",
  },
  {
    label: "vat-paye-objections",
    test: (n) => /\b(vat|paye)\b/.test(n) && /\b(object|dispute)/.test(n),
    resolve: () => "business_vat_objections_disputes",
  },
  {
    label: "vat-registration-or-general",
    test: (n) => /\bvat\b/.test(n),
    resolve: () => "business_vat_registration",
  },
  {
    label: "paye-registration",
    test: (n) => /\bpaye\b/.test(n) && /\bregist/.test(n),
    resolve: () => "business_paye_registration",
  },
  {
    label: "paye-general",
    test: (n) => /\bpaye\b/.test(n) || /\bemp201\b/.test(n) || /\bemp501\b/.test(n),
    resolve: () => "business_paye_compliance",
  },
  {
    label: "itr14-company-return",
    test: (n, ctx) => /\bitr14\b/.test(n) || (isCompanyLike(n, ctx) && /\b(income tax|tax) returns?\b/.test(n)),
    resolve: () => "business_company_income_tax",
  },
  {
    label: "itr12-individual-return",
    test: (n) => /\bitr12\b/.test(n) || /\b(income tax|personal income tax|tax) returns?\b/.test(n),
    resolve: () => "individual_personal_income_tax_returns",
  },
  {
    label: "late-returns",
    test: (n) => /\blate\b/.test(n) && /\breturns?\b/.test(n),
    resolve: () => "individual_late_return_submissions",
  },
  {
    label: "tax-clearance",
    test: (n) => /\bclearance\b/.test(n),
    resolve: (n, ctx) => (isTrustLike(n, ctx) ? "trust_tax_clearance" : isCompanyLike(n, ctx) ? "business_tax_clearance_certificates" : "individual_tax_clearance_certificates"),
  },
  {
    label: "compliance-status",
    test: (n) => /\bcompliance\b/.test(n) && /\bstatus\b/.test(n),
    resolve: (n, ctx) => (isCompanyLike(n, ctx) ? "business_tax_compliance_support" : "individual_tax_compliance_status_assistance"),
  },
  {
    label: "voluntary-disclosure",
    test: (n) => /\bvoluntary disclosure\b|\bvdp\b/.test(n),
    resolve: () => "individual_voluntary_disclosure_programme",
  },
  {
    label: "tax-directive",
    test: (n) => /\bdirective\b/.test(n),
    resolve: () => "individual_tax_directives",
  },
  {
    label: "estate-pension",
    test: (n) => /\b(estate|pension|deceased)\b/.test(n),
    resolve: () => "individual_estate_pension_tax_matters",
  },
  {
    label: "administrative-penalties",
    test: (n) => /\bpenalt/.test(n),
    resolve: (n, ctx) => (isCompanyLike(n, ctx) ? "business_sars_debt_arrangements" : "individual_sars_debt_assistance"),
  },
  {
    label: "audit-verification",
    test: (n) => /\b(audit|verificat)/.test(n),
    resolve: (n, ctx) => (isTrustLike(n, ctx) ? "trust_sars_assistance" : isCompanyLike(n, ctx) ? "business_sars_audits_support" : "individual_sars_verification_refund_assistance"),
  },
  {
    label: "refund",
    test: (n) => /\brefund/.test(n),
    resolve: (n, ctx) => (isCompanyLike(n, ctx) ? "business_tax_compliance_support" : "individual_sars_verification_refund_assistance"),
  },
  {
    label: "deregistration",
    test: (n) => /\bderegist/.test(n),
    resolve: (n, ctx) => (isCompanyLike(n, ctx) ? "support_company_registration" : categoryOtherFor(ctx.clientType)),
  },
  {
    label: "efiling-profile-admin",
    test: (n) => /\be ?filing\b/.test(n) || /\bprofile merge\b/.test(n) || /\bbanking details\b/.test(n) || /\bstatement of account\b/.test(n) || /\b(locked out|login|password)\b/.test(n),
    resolve: (n, ctx) => categoryOtherFor(ctx.clientType),
  },
  {
    label: "trust-objections",
    test: (n, ctx) => isTrustLike(n, ctx) && /\b(object|dispute)/.test(n),
    resolve: () => "trust_sars_disputes_objections",
  },
  {
    label: "objections-disputes-adr",
    test: (n) => /\b(object|dispute|\badr\b|alternative dispute resolution)/.test(n),
    resolve: (n, ctx) => (isTrustLike(n, ctx) ? "trust_sars_disputes_objections" : isCompanyLike(n, ctx) ? "business_vat_objections_disputes" : "individual_objections_and_disputes"),
  },
  {
    label: "tax-registration",
    test: (n) => /\bregist/.test(n) && /\b(sars|tax|income tax)\b/.test(n),
    resolve: (n, ctx) => (isCompanyLike(n, ctx) ? "business_company_income_tax" : "individual_tax_number_registration"),
  },
  {
    label: "company-registration-cipc",
    test: (n, ctx) => /\bregist/.test(n) && (isCompanyLike(n, ctx) || /\bcipc\b/.test(n)),
    resolve: () => "support_company_registration",
  },
  {
    label: "bookkeeping",
    test: (n) => /\bbook\s*keep/.test(n),
    resolve: () => "accounting_bookkeeping",
  },
  {
    label: "financial-statements",
    test: (n) => /\bfinancial statements?\b/.test(n),
    resolve: (n, ctx) => (isTrustLike(n, ctx) ? "trust_financial_statements" : "accounting_financial_statements"),
  },
  {
    label: "npo-general",
    test: (n, ctx) => isNpoLike(n, ctx),
    resolve: () => "npo_sars_compliance",
  },
  {
    label: "trust-general",
    test: (n, ctx) => isTrustLike(n, ctx) && /\btax\b/.test(n),
    resolve: () => "trust_compliance",
  },
  {
    label: "company-tax-general",
    test: (n, ctx) => isCompanyLike(n, ctx) && /\btax\b/.test(n),
    resolve: () => "business_tax_compliance_support",
  },
  {
    label: "individual-tax-general",
    test: (n) => /\btax\b/.test(n),
    resolve: () => "individual_tax_compliance_issues",
  },
];

/**
 * Canonical normalization layer for `service_request_service_needed`.
 * Every WhatsApp-created or WhatsApp-updated service request MUST pass its
 * raw AI/customer wording through this function before insert/update — never
 * write that wording to the enum column directly.
 *
 * Guarantees:
 *  - Always returns a value in SERVICE_NEEDED_VALUES (never throws, never
 *    passes through an unrecognised string).
 *  - Case-insensitive, punctuation/whitespace-normalized matching.
 *  - Already-valid enum values pass through unchanged (method "exact").
 *  - Unrecognised wording never fails the request: it falls back to the
 *    best available category "_other" value (or the fully generic "other"
 *    when the category itself is unknown).
 */
export function normalizeServiceNeeded(raw: string | null | undefined, ctx: NormalizationContext = {}): NormalizationResult {
  const original = typeof raw === "string" ? raw : "";
  const trimmed = original.trim();

  if (isValidServiceNeeded(trimmed)) {
    return { value: trimmed, matched: true, method: "exact", ruleLabel: null, original };
  }

  const normalized = normalizeText(trimmed || String(ctx.description || ""));

  if (normalized) {
    for (const rule of RULES) {
      if (rule.test(normalized, ctx)) {
        const value = rule.resolve(normalized, ctx);
        if (isValidServiceNeeded(value)) {
          return { value, matched: true, method: "keyword", ruleLabel: rule.label, original };
        }
      }
    }
  }

  return { value: categoryOtherFor(ctx.clientType), matched: false, method: "fallback", ruleLabel: null, original };
}
