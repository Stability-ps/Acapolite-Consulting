import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  hasVectorStoreContent,
  attachFileToVectorStore,
  createVectorStore,
  deleteFile,
  pollUntilSettled,
  removeFileFromVectorStore,
  uploadFile,
} from "../_shared/openaiVectorStore.ts";

type TableName = "tax_knowledge_library" | "past_case_documents" | "documents";
type ActionName = "index" | "remove" | "status";

type IndexableRow = {
  id: string;
  case_id?: string | null;
  client_id?: string | null;
  past_case_id?: string;
  title?: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  checksum_sha256: string | null;
  ai_index_status: string;
  ai_index_started_at?: string | null;
  openai_file_id: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_TABLES: TableName[] = ["tax_knowledge_library", "past_case_documents", "documents"];

function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

async function getOrCreateDomainVectorStore(
  client: SupabaseClient,
  apiKey: string,
  domain: "tax_knowledge" | "past_cases",
): Promise<string> {
  const { data: existing } = await client
    .from("ai_vector_stores")
    .select("openai_vector_store_id")
    .eq("domain", domain)
    .maybeSingle();

  if (existing?.openai_vector_store_id) return existing.openai_vector_store_id;

  const vectorStoreId = await createVectorStore(apiKey, `acapolite-${domain}`);

  const { error } = await client
    .from("ai_vector_stores")
    .upsert({ domain, openai_vector_store_id: vectorStoreId }, { onConflict: "domain" });

  if (error) throw new Error(`Vector store created but failed to persist: ${error.message}`);

  return vectorStoreId;
}

async function getOrCreateCaseVectorStore(client: SupabaseClient, apiKey: string, caseId: string): Promise<string> {
  const { data: caseRow, error: caseError } = await client
    .from("cases")
    .select("id, openai_vector_store_id, case_number")
    .eq("id", caseId)
    .maybeSingle();

  if (caseError || !caseRow) throw new Error("Case not found or not accessible.");
  if (caseRow.openai_vector_store_id) return caseRow.openai_vector_store_id;

  const vectorStoreId = await createVectorStore(apiKey, `acapolite-case-${caseRow.case_number ?? caseId}`);

  const { error } = await client
    .from("cases")
    .update({ openai_vector_store_id: vectorStoreId })
    .eq("id", caseId);

  if (error) throw new Error(`Case vector store created but failed to persist: ${error.message}`);

  return vectorStoreId;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json(request, { error: "Authentication required." }, 401);

    const callerClient = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json(request, { error: "Authentication required." }, 401);

    const { data: profile, error: profileError } = await callerClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.is_active || (profile.role !== "admin" && profile.role !== "consultant")) {
      return json(request, { error: "Not authorised to manage AI indexing." }, 403);
    }

    const payload = await request.json().catch(() => null);
    const table = payload?.table as TableName | undefined;
    const id = payload?.id as string | undefined;
    const action = payload?.action as ActionName | undefined;

    if (!table || !VALID_TABLES.includes(table)) {
      return json(request, { error: "Invalid table." }, 400);
    }
    if (!id || !UUID_PATTERN.test(id)) {
      return json(request, { error: "Invalid id." }, 400);
    }
    if (action !== "index" && action !== "remove" && action !== "status") {
      return json(request, { error: "Invalid action." }, 400);
    }

    if (table !== "documents" && profile.role !== "admin") {
      return json(request, { error: "Only admins can manage Tax Knowledge Library or Past Case indexing." }, 403);
    }

    const selectColumns: string = table === "documents"
      ? "id, case_id, client_id, file_name, file_path, mime_type, checksum_sha256, ai_index_status, ai_index_started_at, openai_file_id"
      : table === "tax_knowledge_library"
        ? "id, title, file_name, file_path, mime_type, checksum_sha256, ai_index_status, ai_index_started_at, openai_file_id"
        : "id, past_case_id, file_name, file_path, mime_type, checksum_sha256, ai_index_status, ai_index_started_at, openai_file_id";

    const { data: rawRow, error: rowError } = await callerClient
      .from(table as "documents")
      .select(selectColumns)
      .eq("id", id)
      .maybeSingle();

    if (rowError || !rawRow) {
      return json(request, { error: "Record not found or not accessible." }, 404);
    }

    const row = rawRow as unknown as IndexableRow;

    const apiKey = env("OPENAI_API_KEY");

    if (action === "remove") {
      if (row.openai_file_id) {
        const vectorStoreId = table === "documents"
          ? (await callerClient.from("cases").select("openai_vector_store_id").eq("id", row.case_id).maybeSingle()).data?.openai_vector_store_id
          : table === "tax_knowledge_library"
            ? (await callerClient.from("ai_vector_stores").select("openai_vector_store_id").eq("domain", "tax_knowledge").maybeSingle()).data?.openai_vector_store_id
            : (await callerClient.from("ai_vector_stores").select("openai_vector_store_id").eq("domain", "past_cases").maybeSingle()).data?.openai_vector_store_id;

        if (vectorStoreId) await removeFileFromVectorStore(apiKey, vectorStoreId, row.openai_file_id);
        await deleteFile(apiKey, row.openai_file_id);
      }

      const { error: updateError } = await callerClient
        .from(table)
        .update({ ai_index_status: "removed", openai_file_id: null, ai_indexed_at: null, ai_index_error: null })
        .eq("id", id);

      if (updateError) return json(request, { error: updateError.message }, 500);
      return json(request, { status: "removed" });
    }

    // action === "index"
    if (!row.file_path) {
      return json(request, { error: "No file attached to this record." }, 400);
    }

    if (table === "documents" && !row.case_id) {
      return json(request, { error: "Only case-linked documents can be indexed for Case Tax AI." }, 400);
    }

    // Approval gate enforced server-side, not just in the UI: tax_knowledge_library
    // and past_case_documents share one global vector store per domain, so an
    // unapproved record must never be attached to it - file_search has no
    // per-query concept of "approved_for_ai_use", only "is this file in the
    // store". Case documents have no approval flag; isolation there comes
    // from the per-case vector store instead.
    if (table === "tax_knowledge_library") {
      const { data: knowledgeRow } = await callerClient
        .from("tax_knowledge_library")
        .select("approved_for_ai_use,status")
        .eq("id", id)
        .maybeSingle();

      if (!knowledgeRow?.approved_for_ai_use || knowledgeRow.status === "archived") {
        return json(request, { error: "This entry must be approved for AI use before it can be indexed." }, 400);
      }
    }

    if (table === "past_case_documents") {
      const { data: pastCaseDoc } = await callerClient
        .from("past_case_documents")
        .select("past_case_id, past_cases(approved_for_ai_use,anonymisation_status)")
        .eq("id", id)
        .maybeSingle();

      const parentPastCase = Array.isArray(pastCaseDoc?.past_cases) ? pastCaseDoc.past_cases[0] : pastCaseDoc?.past_cases;
      if (!parentPastCase?.approved_for_ai_use || parentPastCase.anonymisation_status !== "anonymised") {
        return json(request, { error: "The parent past case must be approved for AI use before its documents can be indexed." }, 400);
      }
    }

    const updateState = async (values: Record<string, unknown>) => {
      const {error} = await callerClient.from(table).update(values).eq("id", id);
      if (error) throw error;
    };
    if (table !== "documents" && !row.file_path.startsWith("ai-knowledge/")) return json(request, {error: "Global knowledge must use a private knowledge source path."}, 400);
    // Any persisted file can be reconciled without uploading it again.
    if (row.openai_file_id && ["processing", "indexed"].includes(row.ai_index_status)) {
      try {
        const vectorStoreId = table === "documents"
          ? await getOrCreateCaseVectorStore(callerClient, apiKey, row.case_id!)
          : await getOrCreateDomainVectorStore(callerClient, apiKey, table === "tax_knowledge_library" ? "tax_knowledge" : "past_cases");
        const settled = await pollUntilSettled(apiKey, vectorStoreId, row.openai_file_id, {attempts: 1});
        if (settled.status === "completed") {
          if (!await hasVectorStoreContent(apiKey, vectorStoreId, row.openai_file_id)) throw new Error("OpenAI completed processing but no searchable text was found. Try a text-based PDF, DOCX or TXT.");
          await updateState({ai_index_status: "indexed", ai_indexed_at: new Date().toISOString(), ai_index_error: null});
          return json(request, {status: "indexed"});
        }
        if (settled.status === "in_progress") return json(request, {status: "processing", message: "OpenAI is still processing. Check status again shortly."});
        await updateState({ai_index_status: "failed", ai_index_error: settled.lastError ?? settled.status});
        return json(request, {status: "failed", error: settled.lastError ?? settled.status});
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to check indexing status";
        await updateState({ai_index_error: message});
        return json(request, {error: message}, 502);
      }
    }
    if (row.ai_index_status === "processing" && !row.openai_file_id && (!row.ai_index_started_at || Date.now() - Date.parse(row.ai_index_started_at) > 300000)) {
      await updateState({ai_index_status: "failed", ai_index_error: "Upload was interrupted before indexing was attached. Original preserved; retry indexing."});
      return json(request, {status: "failed", error: "Interrupted upload. Original preserved; retry indexing."});
    }
    if (action === "status") return json(request, {status: row.ai_index_status, error: "No completed upload to check. Use Retry Indexing."});
    // Claim a row before uploading so concurrent retries cannot duplicate files.
    if (row.ai_index_status === "processing") return json(request, {error: "An upload is already in progress. Check status before retrying."}, 409);
    const {data: claimed, error: claimError} = await callerClient.from(table).update({ai_index_status: "processing", ai_index_error: null, ai_index_started_at: new Date().toISOString()}).eq("id", id).eq("ai_index_status", row.ai_index_status).select("id").maybeSingle();
    if (claimError || !claimed) return json(request, {error: "Another indexing request is already running."}, 409);

    let vectorStoreId: string;
    try {
      vectorStoreId = table === "documents"
        ? await getOrCreateCaseVectorStore(callerClient, apiKey, row.case_id!)
        : await getOrCreateDomainVectorStore(callerClient, apiKey, table === "tax_knowledge_library" ? "tax_knowledge" : "past_cases");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to prepare a vector store.";
      await callerClient.from(table).update({ ai_index_status: "failed", ai_index_error: message }).eq("id", id);
      return json(request, { error: message }, 502);
    }

    const { data: fileBlob, error: downloadError } = await callerClient.storage.from("documents").download(row.file_path);
    if (downloadError || !fileBlob) {
      const message = downloadError?.message ?? "Unable to download the source file from storage.";
      await callerClient.from(table).update({ ai_index_status: "failed", ai_index_error: message }).eq("id", id);
      return json(request, { error: message }, 500);
    }

    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());
    if (!/\.(pdf|docx|txt)$/i.test(row.file_name) || fileBytes.length === 0 || fileBytes.length > 25 * 1024 * 1024) {
      await updateState({ai_index_status: "failed", ai_index_error: "Use a non-empty PDF, DOCX or TXT under 25 MB."});
      return json(request, {error: "Unsupported indexing file"}, 400);
    }
    const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", fileBytes))).map(b => b.toString(16).padStart(2, "0")).join("");
    if (row.checksum_sha256 && row.checksum_sha256 !== checksum) {
      await updateState({ai_index_status: "failed", ai_index_error: "The private file no longer matches its recorded checksum."});
      return json(request, {error: "Source checksum mismatch"}, 409);
    }
    await updateState({checksum_sha256: checksum});

    let openaiFileId: string;
    try {
      openaiFileId = await uploadFile(apiKey, row.file_name, fileBytes, row.mime_type ?? "application/octet-stream");
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenAI file upload failed.";
      await callerClient.from(table).update({ ai_index_status: "failed", ai_index_error: message }).eq("id", id);
      return json(request, { error: message }, 502);
    }

    try {
      await attachFileToVectorStore(apiKey, vectorStoreId, openaiFileId, {
        source_table: table,
        source_id: id,
        checksum,
      });
    } catch (error) {
      await deleteFile(apiKey, openaiFileId);
      const message = error instanceof Error ? error.message : "Unable to attach file to the vector store.";
      await callerClient.from(table).update({ ai_index_status: "failed", ai_index_error: message }).eq("id", id);
      return json(request, { error: message }, 502);
    }

    await updateState({openai_file_id: openaiFileId});
    const settled = await pollUntilSettled(apiKey, vectorStoreId, openaiFileId);
    if (settled.status === "completed" && !await hasVectorStoreContent(apiKey, vectorStoreId, openaiFileId)) {
      await updateState({ai_index_status: "failed", ai_index_error: "No searchable text was extracted. Original preserved."});
      return json(request, {status: "failed", error: "No searchable text was extracted."});
    }

    if (settled.status === "completed") {
      await callerClient.from(table).update({
        ai_index_status: "indexed",
        openai_file_id: openaiFileId,
        ai_indexed_at: new Date().toISOString(),
        ai_index_error: null,
      }).eq("id", id);
      return json(request, { status: "indexed" });
    }

    if (settled.status === "in_progress") {
      await callerClient.from(table).update({ ai_index_status: "processing", openai_file_id: openaiFileId }).eq("id", id);
      return json(request, { status: "processing" });
    }

    await deleteFile(apiKey, openaiFileId);
    await callerClient.from(table).update({
      ai_index_status: "failed",
      openai_file_id: null,
      ai_index_error: settled.lastError ?? settled.status,
    }).eq("id", id);
    return json(request, { status: "failed", error: settled.lastError });
  } catch (error) {
    console.error("AI knowledge indexing failed", error instanceof Error ? error.message : "Unknown error");
    return json(request, { error: "AI indexing is temporarily unavailable." }, 500);
  }
});
