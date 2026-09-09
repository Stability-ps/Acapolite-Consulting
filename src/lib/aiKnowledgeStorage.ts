import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Shared storage/validation/status helpers for the Tax Knowledge Library and
 * Past Cases (AI Knowledge) upload flows. Both reuse the existing private
 * "documents" storage bucket under an "ai-knowledge/" prefix rather than a
 * new bucket, and both are gated to admin-only management via RLS.
 */

export const AI_KNOWLEDGE_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
] as const;

export const AI_KNOWLEDGE_MAX_FILE_BYTES = 25 * 1024 * 1024;

export function sanitizeAiKnowledgeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

export function validateAiKnowledgeFile(file: File): string | null {
  if (!AI_KNOWLEDGE_ALLOWED_MIME_TYPES.includes(file.type as typeof AI_KNOWLEDGE_ALLOWED_MIME_TYPES[number])) {
    return `Unsupported file type${file.type ? `: ${file.type}` : ""}. Allowed: PDF, Word, Excel, plain text, JPEG, PNG, WebP.`;
  }

  if (file.size > AI_KNOWLEDGE_MAX_FILE_BYTES) {
    return `File exceeds the ${(AI_KNOWLEDGE_MAX_FILE_BYTES / (1024 * 1024)).toFixed(0)} MB limit.`;
  }

  return null;
}

export async function computeFileChecksumSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function buildTaxKnowledgeStoragePath(fileName: string) {
  return `ai-knowledge/tax-library/${Date.now()}-${sanitizeAiKnowledgeFileName(fileName)}`;
}

export function buildPastCaseDocumentStoragePath(pastCaseId: string, fileName: string) {
  return `ai-knowledge/past-cases/${pastCaseId}/${Date.now()}-${sanitizeAiKnowledgeFileName(fileName)}`;
}

export async function uploadToDocumentsBucket(path: string, file: File) {
  const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function removeFromDocumentsBucket(path: string) {
  const { error } = await supabase.storage.from("documents").remove([path]);
  if (error) throw new Error(error.message);
}

export async function getAiKnowledgeSignedUrl(path: string, expiresInSeconds = 600) {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Unable to create a signed URL for this file.");
  }
  return data.signedUrl;
}

export async function downloadAiKnowledgeFile(path: string, fileName?: string) {
  const { data, error } = await supabase.storage.from("documents").download(path);
  if (error || !data) throw new Error(error?.message ?? "Unable to download this private file.");
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || path.split("/").pop() || "download";
  link.click();
  URL.revokeObjectURL(url);
}

export async function findTaxKnowledgeDuplicateByChecksum(checksum: string) {
  const { data, error } = await supabase
    .from("tax_knowledge_library")
    .select("id, title, status, created_at")
    .eq("checksum_sha256", checksum)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function findPastCaseDocumentDuplicateByChecksum(checksum: string) {
  const { data, error } = await supabase
    .from("past_case_documents")
    .select("id, file_name, past_case_id, created_at")
    .eq("checksum_sha256", checksum)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export type AiIndexStatus = Database["public"]["Enums"]["ai_index_status"];

export const AI_INDEX_STATUS_LABELS: Record<AiIndexStatus, string> = {
  not_applicable: "Not Indexed",
  pending: "Pending",
  processing: "Processing",
  indexed: "Indexed",
  failed: "Failed",
  outdated: "Outdated",
  removed: "Removed",
};

export function getAiIndexStatusBadgeClass(status: AiIndexStatus): string {
  switch (status) {
    case "indexed":
      return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "processing":
    case "pending":
      return "bg-amber-100 text-amber-700 border-amber-300";
    case "failed":
      return "bg-red-100 text-red-700 border-red-300";
    case "outdated":
      return "bg-orange-100 text-orange-700 border-orange-300";
    case "removed":
      return "bg-gray-200 text-gray-600 border-gray-300";
    default:
      return "bg-slate-100 text-slate-600 border-slate-300";
  }
}

export type KnowledgeStatus = Database["public"]["Enums"]["knowledge_status"];

export const KNOWLEDGE_STATUS_LABELS: Record<KnowledgeStatus, string> = {
  current: "Current",
  superseded: "Superseded",
  draft: "Draft",
  archived: "Archived",
};

export function getKnowledgeStatusBadgeClass(status: KnowledgeStatus): string {
  switch (status) {
    case "current":
      return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "superseded":
      return "bg-orange-100 text-orange-700 border-orange-300";
    case "draft":
      return "bg-amber-100 text-amber-700 border-amber-300";
    case "archived":
      return "bg-gray-200 text-gray-600 border-gray-300";
    default:
      return "bg-slate-100 text-slate-600 border-slate-300";
  }
}

export type PastCaseAnonymisationStatus = Database["public"]["Enums"]["past_case_anonymisation_status"];

export const ANONYMISATION_STATUS_LABELS: Record<PastCaseAnonymisationStatus, string> = {
  not_reviewed: "Not Reviewed",
  anonymised: "Anonymised",
  partially_anonymised: "Partially Anonymised",
  contains_confidential_information: "Contains Confidential Information",
};

export function getAnonymisationStatusBadgeClass(status: PastCaseAnonymisationStatus): string {
  switch (status) {
    case "anonymised":
      return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "partially_anonymised":
      return "bg-amber-100 text-amber-700 border-amber-300";
    case "contains_confidential_information":
      return "bg-red-100 text-red-700 border-red-300";
    default:
      return "bg-slate-100 text-slate-600 border-slate-300";
  }
}

// Bounded status checks only: they never start another upload.
export async function runKnowledgeIndex(table: "tax_knowledge_library" | "past_case_documents", id: string, action: "index" | "remove") {
  const invoke = async (nextAction: string) => {
    const {data, error} = await supabase.functions.invoke("ai-knowledge-index", {body: {table, id, action: nextAction}});
    if (error || data?.error || data?.status === "failed") throw new Error(data?.error || error?.message || "Indexing failed; original preserved.");
    return data?.status;
  };
  let status = await invoke(action);
  for (let attempt = 0; status === "processing" && attempt < 10; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    status = await invoke("status");
  }
  return status;
}

export async function deleteAiKnowledgeRecord(table: "tax_knowledge_library" | "past_cases" | "past_case_documents" | "correspondence_templates", id: string) {
  const { data, error } = await supabase.functions.invoke("delete-ai-knowledge", { body: { table, id } });
  if (error || data?.error || data?.success !== true) {
    throw new Error(data?.error ?? error?.message ?? "Unable to delete this knowledge record.");
  }
  return data as { success: true; table: string; id: string; deletedCount: number };
}
