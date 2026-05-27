import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const serviceCategoryOptions: { value: Enums<"service_request_category">; label: string }[] = [
  { value: "individual_tax", label: "Individual Tax Services" },
  { value: "business_tax", label: "Business Tax Services" },
  { value: "accounting", label: "Accounting and Financial Services" },
  { value: "business_support", label: "Business Support and Compliance Services" },
  { value: "trust_services", label: "Trust Services" },
  { value: "npo_organisation_services", label: "NPO / Organisation Services" },
];

export const serviceNeededOptions: { value: Enums<"service_request_service_needed">; label: string }[] = [
  { value: "individual_personal_income_tax_returns", label: "Personal Income Tax Returns (ITR12)" },
  { value: "individual_late_return_submissions", label: "Late Tax Return Submissions" },
  { value: "individual_tax_number_registration", label: "Tax Number Registration" },
  { value: "individual_tax_compliance_issues", label: "Review of SARS Notices and Letters" },
  { value: "individual_tax_status_corrections", label: "Correction of SARS Records" },
  { value: "individual_tax_clearance_certificates", label: "Tax Clearance Certificates" },
  { value: "individual_tax_compliance_status_assistance", label: "Tax Compliance Status Assistance" },
  { value: "individual_voluntary_disclosure_programme", label: "Voluntary Disclosure Programme (VDP)" },
  { value: "individual_sars_verification_refund_assistance", label: "SARS Verification / Refund Assistance" },
  { value: "individual_tax_directives", label: "Tax Directives" },
  { value: "individual_sars_debt_assistance", label: "SARS Debt Assistance" },
  { value: "individual_estate_pension_tax_matters", label: "Estate / Pension Tax Matters" },
  { value: "individual_objections_and_disputes", label: "Objections and Disputes" },
  { value: "individual_other", label: "Other" },
  { value: "business_vat_registration", label: "VAT Registration" },
  { value: "business_paye_registration", label: "PAYE Registration" },
  { value: "business_tax_clearance_certificates", label: "Company Tax Clearance Certificates" },
  { value: "business_vat_returns", label: "VAT Returns Submission" },
  { value: "business_paye_compliance", label: "PAYE Returns (EMP201 / EMP501)" },
  { value: "business_company_income_tax", label: "Company Income Tax Returns (ITR14)" },
  { value: "business_tax_compliance_support", label: "Business Tax Compliance Support" },
  { value: "business_vat_paye_corrections", label: "VAT / PAYE Corrections" },
  { value: "business_tax_debt_compromise", label: "Tax Debt Compromise" },
  { value: "business_sars_debt_arrangements", label: "SARS Debt Arrangements" },
  { value: "business_vat_objections_disputes", label: "VAT Objections / Disputes" },
  { value: "business_sars_audits_support", label: "SARS Audit Assistance" },
  { value: "business_tax_other", label: "Other" },
  { value: "trust_tax_returns", label: "Trust Tax Returns" },
  { value: "trust_compliance", label: "Trust Compliance Assistance" },
  { value: "trust_tax_clearance", label: "Trust Tax Clearance" },
  { value: "trust_sars_assistance", label: "SARS Trust Assistance" },
  { value: "trust_financial_statements", label: "Trust Financial Statements" },
  { value: "trust_representative_assistance", label: "Trustee / Authorised Representative Assistance" },
  { value: "trust_advisory_support", label: "Trust Advisory Support" },
  { value: "trust_sars_disputes_objections", label: "SARS Trust Disputes / Objections" },
  { value: "trust_other", label: "Other" },
  { value: "npo_registration_assistance", label: "NPO Registration Assistance" },
  { value: "npo_tax_exemption_assistance", label: "Tax Exemption Assistance" },
  { value: "npo_annual_compliance_filing", label: "Annual Compliance Filing" },
  { value: "npo_sars_compliance", label: "SARS Compliance" },
  { value: "npo_payroll_accounting", label: "Payroll & Accounting" },
  { value: "npo_financial_reporting", label: "Financial Reporting" },
  { value: "npo_pbo_applications_assistance", label: "PBO Applications / Assistance" },
  { value: "npo_donor_tax_section18a_assistance", label: "Donor Tax / Section 18A Assistance" },
  { value: "npo_governance_advisory", label: "Governance & Advisory" },
  { value: "npo_audit_compliance_support", label: "NPO Audit / Compliance Support" },
  { value: "npo_organisation_other", label: "Other" },
  { value: "accounting_bookkeeping", label: "Bookkeeping Services" },
  { value: "accounting_payroll_services", label: "Payroll Processing" },
  { value: "accounting_monthly_accounting_services", label: "Monthly Accounting Services" },
  { value: "accounting_financial_statements", label: "Preparation of Financial Statements" },
  { value: "accounting_management_accounts", label: "Management Accounts" },
  { value: "accounting_cash_flow_management", label: "Cash Flow Management" },
  { value: "accounting_budget_planning", label: "Budget Planning" },
  { value: "accounting_annual_financial_reporting", label: "Financial Reporting" },
  { value: "accounting_independent_reviews", label: "Independent Reviews" },
  { value: "accounting_other", label: "Other" },
  { value: "support_company_registration", label: "Company Registration (CIPC)" },
  { value: "support_cipc_services", label: "Business Amendments and Updates" },
  { value: "support_annual_returns_filing", label: "Annual Returns Filing" },
  { value: "support_beneficial_ownership_filings", label: "Beneficial Ownership Filings" },
  { value: "support_director_shareholder_changes", label: "Director / Shareholder Changes" },
  { value: "support_business_compliance", label: "Compliance Monitoring" },
  { value: "support_financial_compliance", label: "Regulatory Compliance Support" },
  { value: "support_business_advisory", label: "Business Advisory Services" },
  { value: "support_bee_assistance", label: "BEE Assistance" },
  { value: "business_support_other", label: "Other" },
];

export const serviceCategoryMap: Record<Enums<"service_request_category">, Enums<"service_request_service_needed">[]> = {
  individual_tax: [
    "individual_personal_income_tax_returns",
    "individual_late_return_submissions",
    "individual_tax_number_registration",
    "individual_tax_compliance_issues",
    "individual_tax_status_corrections",
    "individual_tax_clearance_certificates",
    "individual_tax_compliance_status_assistance",
    "individual_voluntary_disclosure_programme",
    "individual_sars_verification_refund_assistance",
    "individual_tax_directives",
    "individual_sars_debt_assistance",
    "individual_estate_pension_tax_matters",
    "individual_objections_and_disputes",
    "individual_other",
  ],
  business_tax: [
    "business_vat_registration",
    "business_paye_registration",
    "business_tax_clearance_certificates",
    "business_vat_returns",
    "business_paye_compliance",
    "business_company_income_tax",
    "business_tax_compliance_support",
    "business_vat_paye_corrections",
    "business_tax_debt_compromise",
    "business_sars_debt_arrangements",
    "business_vat_objections_disputes",
    "business_sars_audits_support",
    "business_tax_other",
  ],
  accounting: [
    "accounting_bookkeeping",
    "accounting_payroll_services",
    "accounting_monthly_accounting_services",
    "accounting_financial_statements",
    "accounting_management_accounts",
    "accounting_cash_flow_management",
    "accounting_budget_planning",
    "accounting_annual_financial_reporting",
    "accounting_independent_reviews",
    "accounting_other",
  ],
  business_support: [
    "support_company_registration",
    "support_cipc_services",
    "support_annual_returns_filing",
    "support_beneficial_ownership_filings",
    "support_director_shareholder_changes",
    "support_business_compliance",
    "support_financial_compliance",
    "support_business_advisory",
    "support_bee_assistance",
    "business_support_other",
  ],
  trust_services: [
    "trust_tax_returns",
    "trust_compliance",
    "trust_tax_clearance",
    "trust_sars_assistance",
    "trust_financial_statements",
    "trust_representative_assistance",
    "trust_advisory_support",
    "trust_sars_disputes_objections",
    "trust_other",
  ],
  npo_organisation_services: [
    "npo_registration_assistance",
    "npo_tax_exemption_assistance",
    "npo_annual_compliance_filing",
    "npo_sars_compliance",
    "npo_payroll_accounting",
    "npo_financial_reporting",
    "npo_pbo_applications_assistance",
    "npo_donor_tax_section18a_assistance",
    "npo_governance_advisory",
    "npo_audit_compliance_support",
    "npo_organisation_other",
  ],
};

export function getServicesForCategory(category: Enums<"service_request_category">) {
  return serviceCategoryMap[category] || [];
}

export const serviceRequestStatusOptions: { value: Enums<"service_request_status">; label: string }[] = [
  { value: "new", label: "New" },
  { value: "viewed", label: "Viewed" },
  { value: "responded", label: "Responded" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_response", label: "Waiting Response" },
  { value: "dead_lead", label: "Dead Lead" },
  { value: "pending_client_confirmation", label: "Pending Client Confirmation" },
  { value: "expired", label: "Expired" },
  { value: "converted_to_client", label: "Converted to Client" },
  { value: "closed", label: "Closed" },
];

export const serviceRequestPriorityOptions: { value: Enums<"service_request_priority">; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function formatServiceRequestLabel(value?: string | null) {
  return (value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getServiceRequestStatusClass(status?: string | null) {
  switch (status) {
    case "closed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "converted_to_client":
      return "border-teal-200 bg-teal-50 text-teal-700";
    case "assigned":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "in_progress":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "waiting_response":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "responded":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "dead_lead":
      return "border-red-200 bg-red-50 text-red-700";
    case "expired":
      return "border-red-200 bg-red-50 text-red-700";
    case "pending_client_confirmation":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "viewed":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

export function getServiceRequestRiskClass(risk?: string | null) {
  switch (risk) {
    case "high":
      return "border-red-200 bg-red-50 text-red-700";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

export function getServiceRequestIssueFlags(params: {
  hasDebtFlag?: boolean | null;
  missingReturnsFlag?: boolean | null;
  missingDocumentsFlag?: boolean | null;
}) {
  const flags: string[] = [];

  if (params.hasDebtFlag) flags.push("Debt");
  if (params.missingReturnsFlag) flags.push("Returns");
  if (params.missingDocumentsFlag) flags.push("Documents");

  return flags;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function uploadServiceRequestFile(file: File, requestId: string) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Files larger than 10 MB are not allowed.");
  }

  const safeFileName = sanitizeFileName(file.name);
  const uniqueFileName = `${Date.now()}-${safeFileName}`;
  const filePath = `service-requests/${requestId}/${uniqueFileName}`;

  const { error } = await supabase.storage.from("documents").upload(filePath, file, {
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return filePath;
}
