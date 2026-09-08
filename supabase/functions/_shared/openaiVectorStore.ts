const OPENAI_BASE = "https://api.openai.com/v1";

export type VectorStoreFileStatus = "in_progress" | "completed" | "failed" | "cancelled" | "expired";

async function openaiJson(path: string, apiKey: string, init: RequestInit = {}) {
  const response = await fetch(`${OPENAI_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `OpenAI request to ${path} failed (${response.status})`);
  }
  return body;
}

export async function createVectorStore(apiKey: string, name: string): Promise<string> {
  const result = await openaiJson("/vector_stores", apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return result.id as string;
}

export async function uploadFile(
  apiKey: string,
  fileName: string,
  fileBytes: Uint8Array,
  mimeType: string,
): Promise<string> {
  const form = new FormData();
  form.append("purpose", "assistants");
  form.append("file", new Blob([new Uint8Array(fileBytes)], { type: mimeType || "application/octet-stream" }), fileName);

  const response = await fetch(`${OPENAI_BASE}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error?.message ?? `OpenAI file upload failed (${response.status})`);
  }
  return result.id as string;
}

export async function attachFileToVectorStore(
  apiKey: string,
  vectorStoreId: string,
  fileId: string,
  attributes: Record<string, string>,
): Promise<VectorStoreFileStatus> {
  const result = await openaiJson(`/vector_stores/${vectorStoreId}/files`, apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId, attributes }),
  });
  return result.status as VectorStoreFileStatus;
}

export async function getVectorStoreFileStatus(
  apiKey: string,
  vectorStoreId: string,
  fileId: string,
): Promise<{ status: VectorStoreFileStatus; lastError: string | null }> {
  const result = await openaiJson(`/vector_stores/${vectorStoreId}/files/${fileId}`, apiKey, { method: "GET" });
  return {
    status: result.status as VectorStoreFileStatus,
    lastError: result.last_error?.message ?? null,
  };
}

export async function pollUntilSettled(
  apiKey: string,
  vectorStoreId: string,
  fileId: string,
  { attempts = 5, delayMs = 1500 }: { attempts?: number; delayMs?: number } = {},
): Promise<{ status: VectorStoreFileStatus; lastError: string | null }> {
  let result: { status: VectorStoreFileStatus; lastError: string | null } = { status: "in_progress", lastError: null };

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    result = await getVectorStoreFileStatus(apiKey, vectorStoreId, fileId);
    if (result.status !== "in_progress") return result;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return result;
}

export async function removeFileFromVectorStore(apiKey: string, vectorStoreId: string, fileId: string): Promise<void> {
  try {
    await openaiJson(`/vector_stores/${vectorStoreId}/files/${fileId}`, apiKey, { method: "DELETE" });
  } catch (error) {
    console.error("Failed to remove file from OpenAI vector store", error instanceof Error ? error.message : "unknown error");
  }
}

export async function deleteFile(apiKey: string, fileId: string): Promise<void> {
  try {
    await openaiJson(`/files/${fileId}`, apiKey, { method: "DELETE" });
  } catch (error) {
    console.error("Failed to delete OpenAI file object", error instanceof Error ? error.message : "unknown error");
  }
}
