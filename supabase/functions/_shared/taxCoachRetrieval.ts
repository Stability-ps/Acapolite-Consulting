import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type RetrievedSource = {
  citationLabel: string;
  classification: string;
  block: string;
};

const MAX_KNOWLEDGE_RESULTS = 5;
const MAX_PAST_CASE_RESULTS = 3;
const MAX_CASE_DOCUMENTS = 15;
const STATUS_RANK: Record<string, number> = { current: 0, draft: 1, superseded: 2, archived: 3 };

/**
 * Extracts a small set of safe search words from the latest user message.
 * Strips everything except letters/digits before it ever reaches a
 * PostgREST `.or()` filter string, so it cannot be used to inject filter
 * operators (commas, parentheses, dots).
 */
export function extractSearchWords(messages: ChatMessage[]): string[] {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!lastUserMessage) return [];

  return lastUserMessage.content
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter((word) => word.length >= 3)
    .slice(0, 8);
}

function buildOrFilter(words: string[], columns: string[]): string | null {
  if (words.length === 0) return null;
  const clauses = columns.flatMap((column) => words.map((word) => `${column}.ilike.%${word}%`));
  return clauses.join(",");
}

export async function retrieveTaxKnowledge(
  client: SupabaseClient,
  searchWords: string[],
): Promise<RetrievedSource[]> {
  let query = client
    .from("tax_knowledge_library")
    .select("id, title, category, issuing_authority, tax_type, legislation, section_reference, status, summary, source_url, jurisdiction")
    .eq("approved_for_ai_use", true)
    .neq("status", "archived")
    .limit(20);

  const filter = buildOrFilter(searchWords, ["title", "summary", "category", "tax_type", "legislation", "section_reference"]);
  if (filter) query = query.or(filter);

  const { data, error } = await query;
  if (error || !data) return [];

  const ranked = [...data].sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));

  return ranked.slice(0, MAX_KNOWLEDGE_RESULTS).map((row) => {
    const classification = row.legislation || row.category === "Legislation" ? "LEGISLATION / LAW" : "SARS GUIDANCE";
    const supersededNote = row.status === "superseded" ? " [SUPERSEDED — do not present as current authority]" : "";
    const citationLabel = `Tax Library: ${row.title}${row.section_reference ? ` — ${row.section_reference}` : ""}${supersededNote}`;

    return {
      citationLabel,
      classification,
      block: [
        `[TAX LIBRARY${supersededNote}]`,
        `Title: ${row.title}`,
        row.legislation ? `Legislation: ${row.legislation}${row.section_reference ? ` (${row.section_reference})` : ""}` : null,
        row.issuing_authority ? `Issuing authority: ${row.issuing_authority}` : null,
        row.tax_type ? `Tax type: ${row.tax_type}` : null,
        `Jurisdiction: ${row.jurisdiction}`,
        `Status: ${row.status}`,
        row.summary ? `Summary: ${row.summary}` : null,
        row.source_url ? `Source: ${row.source_url}` : null,
        `Citation key: "${citationLabel}"`,
      ].filter(Boolean).join("\n"),
    };
  });
}

export async function retrievePastCases(
  client: SupabaseClient,
  searchWords: string[],
): Promise<RetrievedSource[]> {
  let query = client
    .from("past_cases")
    .select("id, title, case_type, tax_type, sars_stage, issue, outcome, success_status, summary, key_arguments, lessons_learned, precedent_value")
    .eq("approved_for_ai_use", true)
    .eq("anonymisation_status", "anonymised")
    .limit(20);

  const filter = buildOrFilter(searchWords, ["title", "issue", "outcome", "summary", "case_type", "tax_type"]);
  if (filter) query = query.or(filter);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.slice(0, MAX_PAST_CASE_RESULTS).map((row) => {
    const citationLabel = `Past Case: ${row.title}${row.success_status ? ` — ${row.success_status}` : ""}`;

    return {
      citationLabel,
      classification: "PAST CASE / PRECEDENT",
      block: [
        "[PAST CASE / PRECEDENT — practical precedent, NOT binding law]",
        `Title: ${row.title}`,
        row.case_type ? `Case type: ${row.case_type}` : null,
        row.tax_type ? `Tax type: ${row.tax_type}` : null,
        row.sars_stage ? `SARS stage: ${row.sars_stage}` : null,
        row.success_status ? `Outcome status: ${row.success_status}` : null,
        row.issue ? `Issue: ${row.issue}` : null,
        row.outcome ? `Outcome: ${row.outcome}` : null,
        row.summary ? `Summary: ${row.summary}` : null,
        row.key_arguments ? `Key arguments: ${row.key_arguments}` : null,
        row.lessons_learned ? `Lessons learned: ${row.lessons_learned}` : null,
        row.precedent_value ? `Precedent value: ${row.precedent_value}` : null,
        `Citation key: "${citationLabel}"`,
      ].filter(Boolean).join("\n"),
    };
  });
}

/**
 * Case-scoped client documents. Uses the CALLER's own authenticated client
 * (JWT-scoped, not service role), so the existing documents_select_scoped /
 * can_access_document RLS policy enforces client/case isolation the same
 * way it already does for the Documents page — this function cannot
 * retrieve documents the caller isn't already allowed to see.
 */
export async function retrieveCaseDocuments(
  client: SupabaseClient,
  clientId: string,
  caseId: string,
): Promise<RetrievedSource[]> {
  const { data, error } = await client
    .from("documents")
    .select("id, title, category, document_type, tax_type, tax_period, sars_reference, assessment_reference, document_date, status, uploaded_at")
    .eq("client_id", clientId)
    .eq("case_id", caseId)
    .order("uploaded_at", { ascending: false })
    .limit(MAX_CASE_DOCUMENTS);

  if (error || !data) return [];

  return data.map((row) => {
    const citationLabel = `Client File: ${row.category || row.title}${row.document_date ? ` — ${row.document_date}` : ""}`;

    return {
      citationLabel,
      classification: "SARS DOCUMENT",
      block: [
        "[CLIENT FILE — confidential, this case only]",
        `Document: ${row.category || row.title}`,
        row.tax_type ? `Tax type: ${row.tax_type}` : null,
        row.tax_period ? `Tax period: ${row.tax_period}` : null,
        row.sars_reference ? `SARS reference: ${row.sars_reference}` : null,
        row.assessment_reference ? `Assessment reference: ${row.assessment_reference}` : null,
        row.document_date ? `Document date: ${row.document_date}` : null,
        `Status: ${row.status}`,
        `Citation key: "${citationLabel}"`,
        "(Full document content is not yet text-extracted in this release — only the metadata above is available to Tax AI. Say so if the answer depends on file content you cannot see.)",
      ].filter(Boolean).join("\n"),
    };
  });
}
