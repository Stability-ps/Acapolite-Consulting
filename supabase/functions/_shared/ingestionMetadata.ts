export const metadataFields = {
  tax_knowledge: ["title", "category", "source", "issuing_authority", "tax_type", "legislation", "section_reference", "publication_date", "effective_from", "effective_to", "version", "jurisdiction", "source_url", "summary", "tags"],
  past_case: ["title", "case_type", "tax_type", "sars_stage", "issue", "outcome", "success_status", "summary", "facts_summary", "key_arguments", "supporting_documents_summary", "lessons_learned", "precedent_value", "closed_date", "tags"],
  template: ["name", "correspondence_type", "tax_type", "case_type", "purpose", "body_structure"],
} as const;
export type IngestionKind = keyof typeof metadataFields;

// Templates are selected by this exact value in the case-aware SARS drafting
// flow. Keep extracted proposals within the supported selector vocabulary.
export const TEMPLATE_CORRESPONDENCE_TYPES = [
  "General SARS correspondence", "Audit response", "Verification response", "Request for Relevant Material response", "Supporting document cover letter", "Objection motivation", "Objection cover letter", "Appeal motivation", "ADR correspondence", "Suspension of payment request", "Payment arrangement request", "Compromise motivation", "Request for reasons", "Remission request", "Penalty remission correspondence", "Interest correspondence", "Extension request", "Compliance status correspondence", "VAT correspondence", "PAYE correspondence", "Income Tax correspondence", "Corporate Income Tax correspondence", "SARS follow-up", "Escalation", "Arrangement/default explanation", "Payment notification", "Withdrawal request", "Practitioner cover letter", "Other / custom",
] as const;

export function normalizeMetadata(kind: IngestionKind, raw: unknown): Record<string, string> {
  const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return Object.fromEntries(metadataFields[kind].map(key => {
    const value = Array.isArray(input[key]) && key === "tags" ? (input[key] as unknown[]).filter(v => typeof v === "string").join(", ") : input[key];
    let text = typeof value === "string" ? value.trim().slice(0, key === "body_structure" ? 24000 : 8000) : "";
    if (["publication_date", "effective_from", "effective_to", "closed_date"].includes(key)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text) text = "";
    }
    if (kind === "template" && key === "correspondence_type" && !TEMPLATE_CORRESPONDENCE_TYPES.includes(text as typeof TEMPLATE_CORRESPONDENCE_TYPES[number])) text = "Other / custom";
    return [key, text];
  }));
}
