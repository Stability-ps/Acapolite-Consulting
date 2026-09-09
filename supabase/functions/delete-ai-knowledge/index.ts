import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deleteFile, removeFileFromVectorStore } from "../_shared/openaiVectorStore.ts";

type DeleteTable = "tax_knowledge_library" | "past_cases" | "past_case_documents" | "correspondence_templates";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_TABLES: DeleteTable[] = ["tax_knowledge_library", "past_cases", "past_case_documents", "correspondence_templates"];

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function headers(request: Request) {
  return {
    "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}

async function detachFile(
  adminClient: SupabaseClient,
  apiKey: string,
  domain: "tax_knowledge" | "past_cases",
  row: { openai_file_id?: string | null; file_path?: string | null },
) {
  if (row.openai_file_id) {
    const { data: vectorStore } = await adminClient
      .from("ai_vector_stores")
      .select("openai_vector_store_id")
      .eq("domain", domain)
      .maybeSingle();
    if (vectorStore?.openai_vector_store_id) {
      await removeFileFromVectorStore(apiKey, vectorStore.openai_vector_store_id, row.openai_file_id);
    }
    await deleteFile(apiKey, row.openai_file_id);
  }

  if (row.file_path) {
    const { error } = await adminClient.storage.from("documents").remove([row.file_path]);
    if (error) throw new Error(`Unable to remove private source file: ${error.message}`);
  }
}

async function deleteExactlyOne(adminClient: SupabaseClient, table: DeleteTable, id: string) {
  const { data, error } = await adminClient.from(table).delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length !== 1) throw new Error(`Expected exactly one ${table} row to be deleted.`);
}

async function logLifecycle(
  adminClient: SupabaseClient,
  actorId: string,
  actorRole: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await adminClient.from("system_activity_log").insert({
    actor_profile_id: actorId,
    actor_role: actorRole,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
  if (error) console.error("Lifecycle activity log failed", error.message);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json(request, { error: "Authentication required." }, 401);

    const supabaseUrl = env("SUPABASE_URL");
    const callerClient = createClient(supabaseUrl, env("SUPABASE_ANON_KEY"), {
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
    if (profileError || !profile?.is_active || profile.role !== "admin") {
      return json(request, { error: "Administrator access required." }, 403);
    }

    const payload = await request.json().catch(() => null) as { table?: DeleteTable; id?: string } | null;
    const table = payload?.table;
    const id = payload?.id;
    if (!table || !VALID_TABLES.includes(table)) return json(request, { error: "Invalid table." }, 400);
    if (!id || !UUID_PATTERN.test(id)) return json(request, { error: "A valid record UUID is required." }, 400);

    const adminClient = createClient(supabaseUrl, env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const apiKey = env("OPENAI_API_KEY");

    if (table === "past_cases") {
      const { data: parent, error: parentError } = await adminClient
        .from("past_cases")
        .select("id,title")
        .eq("id", id)
        .maybeSingle();
      if (parentError || !parent) return json(request, { error: "Past Case not found." }, 404);

      const { data: documents, error: documentsError } = await adminClient
        .from("past_case_documents")
        .select("id,file_name,file_path,checksum_sha256,openai_file_id")
        .eq("past_case_id", id);
      if (documentsError) throw new Error(documentsError.message);

      for (const document of documents ?? []) {
        await detachFile(adminClient, apiKey, "past_cases", document);
        await deleteExactlyOne(adminClient, "past_case_documents", document.id);
        await logLifecycle(adminClient, user.id, profile.role, "past_case_document_removed", "past_case_document", document.id, {
          pastCaseId: id,
          fileName: document.file_name,
          checksumSha256: document.checksum_sha256,
        });
      }

      await deleteExactlyOne(adminClient, "past_cases", id);
      await logLifecycle(adminClient, user.id, profile.role, "past_case_deleted", "past_case", id, { title: parent.title, documentCount: documents?.length ?? 0 });
      return json(request, { success: true, table, id, deletedCount: 1 + (documents?.length ?? 0) });
    }

    const { data: row, error: rowError } = await adminClient
      .from(table)
      .select(table === "tax_knowledge_library" ? "id,title,file_name,file_path,checksum_sha256,openai_file_id" : table === "past_case_documents" ? "id,file_name,file_path,checksum_sha256,openai_file_id,past_case_id" : "id,name,source_file_name,source_file_path,source_checksum_sha256")
      .eq("id", id)
      .maybeSingle();
    if (rowError || !row) return json(request, { error: "Record not found." }, 404);

    if (table === "tax_knowledge_library" || table === "past_case_documents") {
      await detachFile(adminClient, apiKey, table === "tax_knowledge_library" ? "tax_knowledge" : "past_cases", row);
    } else if (row.source_file_path) {
      const { error } = await adminClient.storage.from("documents").remove([row.source_file_path]);
      if (error) throw new Error(`Unable to remove private source file: ${error.message}`);
    }

    await deleteExactlyOne(adminClient, table, id);
    const action = table === "tax_knowledge_library"
      ? "knowledge_entry_deleted"
      : table === "past_case_documents"
        ? "past_case_document_removed"
        : "template_deleted";
    const targetType = table === "tax_knowledge_library"
      ? "tax_knowledge_library"
      : table === "past_case_documents"
        ? "past_case_document"
        : "correspondence_template";
    await logLifecycle(adminClient, user.id, profile.role, action, targetType, id, {
      title: row.title ?? row.name ?? null,
      fileName: row.file_name ?? row.source_file_name ?? null,
      checksumSha256: row.checksum_sha256 ?? row.source_checksum_sha256 ?? null,
    });
    return json(request, { success: true, table, id, deletedCount: 1 });
  } catch (error) {
    console.error("AI knowledge deletion failed", error instanceof Error ? error.message : "unknown error");
    return json(request, { error: error instanceof Error ? error.message : "Deletion failed; source record was preserved where possible." }, 500);
  }
});
