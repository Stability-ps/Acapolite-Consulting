import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type OpenAiAnnotation = { type?: string; file_id?: string };
type OpenAiOutputContentItem = { type?: string; annotations?: OpenAiAnnotation[] };
type OpenAiOutputItem = { type?: string; content?: OpenAiOutputContentItem[] };

export function extractFileCitationIds(output: OpenAiOutputItem[] | undefined): string[] {
  if (!Array.isArray(output)) return [];

  const ids = new Set<string>();
  for (const item of output) {
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (annotation.type === "file_citation" && annotation.file_id) {
          ids.add(annotation.file_id);
        }
      }
    }
  }
  return Array.from(ids);
}

export type FileCitation = { citationLabel: string; classification: string };

/**
 * Resolves OpenAI file_search citation file_ids back to their originating
 * Acapolite record, using the openai_file_id we stored when indexing. This
 * is what lets a file_search citation ultimately point at the correct
 * Supabase document rather than a bare OpenAI file id.
 */
export async function resolveFileCitations(
  client: SupabaseClient,
  fileIds: string[],
): Promise<FileCitation[]> {
  if (fileIds.length === 0) return [];

  const [knowledgeMatches, pastCaseMatches, documentMatches] = await Promise.all([
    client.from("tax_knowledge_library").select("title, openai_file_id").in("openai_file_id", fileIds),
    client.from("past_case_documents").select("file_name, openai_file_id, past_case_id").in("openai_file_id", fileIds),
    client.from("documents").select("title, category, openai_file_id").in("openai_file_id", fileIds),
  ]);

  const citations: FileCitation[] = [];

  for (const row of knowledgeMatches.data ?? []) {
    citations.push({ citationLabel: `Tax Library: ${row.title}`, classification: "LEGISLATION / LAW" });
  }
  for (const row of pastCaseMatches.data ?? []) {
    citations.push({ citationLabel: `Past Case document: ${row.file_name}`, classification: "PAST CASE / PRECEDENT" });
  }
  for (const row of documentMatches.data ?? []) {
    citations.push({ citationLabel: `Client File: ${row.category || row.title}`, classification: "SARS DOCUMENT" });
  }

  return citations;
}
