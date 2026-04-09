import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

export const serviceNeededOptions: { value: Enums<"service_request_service_needed">; label: string }[] = [
  { value: "tax_return", label: "Tax Return" },
  { value: "sars_debt_assistance", label: "SARS Debt Assistance" },
  { value: "vat_registration", label: "VAT Registration" },
  { value: "company_tax", label: "Company Tax" },
  { value: "paye_issues", label: "PAYE Issues" },
  { value: "objection_dispute", label: "Objection / Dispute" },
  { value: "bookkeeping", label: "Bookkeeping" },
  { value: "other", label: "Other" },
];

export const serviceRequestStatusOptions: { value: Enums<"service_request_status">; label: string }[] = [
  { value: "new", label: "New" },
  { value: "viewed", label: "Viewed" },
  { value: "responded", label: "Responded" },
  { value: "assigned", label: "Assigned" },
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
    case "assigned":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "responded":
      return "border-violet-200 bg-violet-50 text-violet-700";
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
