import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type VerifiedCaseFacts = {
  caseId: string;
  clientId: string;
  caseNumber: string;
  caseTitle: string;
  caseType: string;
  caseStatus: string;
  sarsCaseReference: string | null;
  dueDate: string | null;
  clientLegalName: string;
  clientTaxNumber: string | null;
  clientSarsReference: string | null;
  clientCompanyRegistrationNumber: string | null;
  clientVatNumber: string | null;
  clientSarsOutstandingDebt: number | null;
  practitionerName: string | null;
  practitionerDesignation: string | null;
  practitionerTaxPractitionerNumber: string | null;
};

/**
 * Fetches only verified, stored facts about a case via the CALLER's own
 * JWT-scoped client, so this is subject to the same RLS as everything else
 * this staff member can see - no elevated access. Used to ground SARS
 * correspondence drafting so the AI never has to guess taxpayer/case facts.
 */
export async function fetchVerifiedCaseFacts(
  client: SupabaseClient,
  caseId: string,
): Promise<VerifiedCaseFacts | null> {
  const { data: caseRow, error: caseError } = await client
    .from("cases")
    .select("id, client_id, case_number, case_title, case_type, status, sars_case_reference, due_date, assigned_consultant_id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseError || !caseRow) return null;

  const { data: clientRow } = await client
    .from("clients")
    .select("first_name, last_name, company_name, client_type, tax_number, sars_reference_number, company_registration_number, vat_number, sars_outstanding_debt")
    .eq("id", caseRow.client_id)
    .maybeSingle();

  let practitionerName: string | null = null;
  let practitionerDesignation: string | null = null;
  let practitionerTaxPractitionerNumber: string | null = null;

  if (caseRow.assigned_consultant_id) {
    const [{ data: profileRow }, { data: practitionerProfileRow }] = await Promise.all([
      client.from("profiles").select("full_name").eq("id", caseRow.assigned_consultant_id).maybeSingle(),
      client.from("practitioner_profiles").select("professional_title, tax_practitioner_number").eq("profile_id", caseRow.assigned_consultant_id).maybeSingle(),
    ]);
    practitionerName = profileRow?.full_name ?? null;
    practitionerDesignation = practitionerProfileRow?.professional_title ?? null;
    practitionerTaxPractitionerNumber = practitionerProfileRow?.tax_practitioner_number ?? null;
  }

  const clientLegalName = clientRow?.company_name
    || [clientRow?.first_name, clientRow?.last_name].filter(Boolean).join(" ")
    || "Unknown Client";

  return {
    caseId: caseRow.id,
    clientId: caseRow.client_id,
    caseNumber: caseRow.case_number,
    caseTitle: caseRow.case_title,
    caseType: caseRow.case_type,
    caseStatus: caseRow.status,
    sarsCaseReference: caseRow.sars_case_reference,
    dueDate: caseRow.due_date,
    clientLegalName,
    clientTaxNumber: clientRow?.tax_number ?? null,
    clientSarsReference: clientRow?.sars_reference_number ?? null,
    clientCompanyRegistrationNumber: clientRow?.company_registration_number ?? null,
    clientVatNumber: clientRow?.vat_number ?? null,
    clientSarsOutstandingDebt: clientRow?.sars_outstanding_debt ?? null,
    practitionerName,
    practitionerDesignation,
    practitionerTaxPractitionerNumber,
  };
}

export function formatVerifiedCaseFactsBlock(facts: VerifiedCaseFacts): string {
  return [
    "[VERIFIED CASE FACTS - use exactly as given, never alter, never invent additional values not listed here]",
    `Client/Taxpayer legal name: ${facts.clientLegalName}`,
    facts.clientTaxNumber ? `Tax reference number: ${facts.clientTaxNumber}` : "Tax reference number: NOT ON RECORD",
    facts.clientSarsReference ? `Client SARS reference: ${facts.clientSarsReference}` : "Client SARS reference: NOT ON RECORD",
    facts.clientCompanyRegistrationNumber ? `Company registration number: ${facts.clientCompanyRegistrationNumber}` : null,
    facts.clientVatNumber ? `VAT number: ${facts.clientVatNumber}` : null,
    facts.clientSarsOutstandingDebt !== null ? `SARS outstanding debt on record: R${facts.clientSarsOutstandingDebt}` : null,
    `Case number: ${facts.caseNumber}`,
    `Case title: ${facts.caseTitle}`,
    `Case type: ${facts.caseType}`,
    `Case status: ${facts.caseStatus}`,
    facts.sarsCaseReference ? `Case SARS reference: ${facts.sarsCaseReference}` : "Case SARS reference: NOT ON RECORD",
    facts.dueDate ? `Case due date: ${facts.dueDate}` : null,
    facts.practitionerName ? `Practitioner: ${facts.practitionerName}` : null,
    facts.practitionerDesignation ? `Practitioner designation: ${facts.practitionerDesignation}` : null,
    facts.practitionerTaxPractitionerNumber ? `Practitioner tax practitioner number: ${facts.practitionerTaxPractitionerNumber}` : null,
    "Any fact needed for this letter that is not listed above (assessment amounts, notice dates, specific deadlines not on the case record, etc.) is NOT VERIFIED - list it in missingInformation, do not guess a value.",
  ].filter(Boolean).join("\n");
}
