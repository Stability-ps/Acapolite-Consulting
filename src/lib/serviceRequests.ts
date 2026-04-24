import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

export const serviceCategoryOptions: { value: Enums<"service_request_category">; label: string }[] = [
  { value: "individual_tax", label: "Individual Tax Services" },
  { value: "business_tax", label: "Business Tax Services" },
  { value: "accounting", label: "Accounting Services" },
  { value: "business_support", label: "Business Support Services" },
];

export const serviceNeededOptions: { value: Enums<"service_request_service_needed">; label: string }[] = [
  { value: "individual_personal_income_tax_returns", label: "Personal Income Tax Returns" },
  { value: "individual_sars_debt_assistance", label: "SARS Debt Assistance" },
  { value: "individual_tax_compliance_issues", label: "Tax Compliance Issues" },
  { value: "individual_tax_clearance_certificates", label: "Tax Clearance Certificates" },
  { value: "individual_objections_and_disputes", label: "Objections and Disputes" },
  { value: "individual_late_return_submissions", label: "Late Return Submissions" },
  { value: "individual_tax_number_registration", label: "Tax Number Registration" },
  { value: "individual_tax_status_corrections", label: "Tax Status Corrections" },
  { value: "business_company_income_tax", label: "Company Income Tax" },
  { value: "business_vat_registration", label: "VAT Registration" },
  { value: "business_vat_returns", label: "VAT Returns" },
  { value: "business_paye_registration", label: "PAYE Registration" },
  { value: "business_paye_compliance", label: "PAYE Compliance" },
  { value: "business_sars_debt_arrangements", label: "SARS Debt Arrangements" },
  { value: "business_tax_clearance_certificates", label: "Tax Clearance Certificates" },
  { value: "business_sars_audits_support", label: "SARS Audits Support" },
  { value: "accounting_bookkeeping", label: "Bookkeeping" },
  { value: "accounting_financial_statements", label: "Financial Statements" },
  { value: "accounting_management_accounts", label: "Management Accounts" },
  { value: "accounting_payroll_services", label: "Payroll Services" },
  { value: "accounting_monthly_accounting_services", label: "Monthly Accounting Services" },
  { value: "accounting_annual_financial_reporting", label: "Annual Financial Reporting" },
  { value: "support_company_registration", label: "Company Registration" },
  { value: "support_business_compliance", label: "Business Compliance" },
  { value: "support_cipc_services", label: "CIPC Services" },
  { value: "support_business_advisory", label: "Business Advisory" },
  { value: "support_financial_compliance", label: "Financial Compliance" },
];

export const serviceCategoryMap: Record<Enums<"service_request_category">, Enums<"service_request_service_needed">[]> = {
  individual_tax: [
    "individual_personal_income_tax_returns",
    "individual_sars_debt_assistance",
    "individual_tax_compliance_issues",
    "individual_tax_clearance_certificates",
    "individual_objections_and_disputes",
    "individual_late_return_submissions",
    "individual_tax_number_registration",
    "individual_tax_status_corrections",
  ],
  business_tax: [
    "business_company_income_tax",
    "business_vat_registration",
    "business_vat_returns",
    "business_paye_registration",
    "business_paye_compliance",
    "business_sars_debt_arrangements",
    "business_tax_clearance_certificates",
    "business_sars_audits_support",
  ],
  accounting: [
    "accounting_bookkeeping",
    "accounting_financial_statements",
    "accounting_management_accounts",
    "accounting_payroll_services",
    "accounting_monthly_accounting_services",
    "accounting_annual_financial_reporting",
  ],
  business_support: [
    "support_company_registration",
    "support_business_compliance",
    "support_cipc_services",
    "support_business_advisory",
    "support_financial_compliance",
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
