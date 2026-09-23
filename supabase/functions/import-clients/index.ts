import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ALLOWED_CLIENT_FIELDS,
  buildClientInsertPayload,
  clientDisplayName,
  matchAgainstExistingClients,
  matchPortalAccount,
  matchWithinBatch,
  normalizeEmail,
  resolveRowOutcome,
  sanitizeMappedRow,
  validateRow,
  type ExistingClientRecord,
  type MappedClientData,
  type UserAction,
} from "../_shared/clientImportServer.ts";

// Executes a previously-previewed (PR 5) bulk client import. Never trusts
// the browser's preview verdict: every validation/duplicate/portal check
// re-runs here, fresh, against the current database, immediately before
// each row is written - this is what catches "someone else created the
// same client between preview and confirm".
//
// Idempotent by design: the caller generates `batch_id` once, before the
// first request attempt. A batch already marked 'completed' is replayed
// (its stored result returned) instead of re-executed, so a double-click,
// browser retry, or edge function retry can never create the same rows
// twice. See client_import_batches/client_import_batch_rows.

type SubmittedRow = {
  row_number: number;
  mapped: Record<string, unknown>;
  user_action: UserAction;
};

type ImportPayload = {
  batch_id?: string;
  source_filename?: string;
  rows?: SubmittedRow[];
};

type RowResult = {
  row_number: number;
  status: string;
  client_id: string | null;
  client_name: string;
  reason: string | null;
  duplicate_reason: string | null;
  matched_client_ids: string[];
};

function buildCorsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function jsonResponse(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: buildCorsHeaders(request) });
}

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ACTIONS = new Set<UserAction>(["import", "skip", "import_anyway"]);
const MAX_ROWS_PER_BATCH = 5000;

// deno-lint-ignore no-explicit-any
async function loadStoredResult(adminClient: any, batchId: string) {
  const { data: batch } = await adminClient.from("client_import_batches").select("*").eq("id", batchId).maybeSingle();
  if (!batch) return null;

  const { data: rows } = await adminClient
    .from("client_import_batch_rows")
    .select("row_number,status,client_id,client_name,reason,duplicate_reason,matched_client_ids")
    .eq("batch_id", batchId)
    .order("row_number", { ascending: true });

  return {
    batch,
    // deno-lint-ignore no-explicit-any
    rows: (rows ?? []).map((row: any): RowResult => ({
      row_number: row.row_number,
      status: row.status,
      client_id: row.client_id,
      client_name: row.client_name ?? "",
      reason: row.reason,
      duplicate_reason: row.duplicate_reason,
      matched_client_ids: row.matched_client_ids ?? [],
    })),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(request) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed" }, 405);
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return jsonResponse(request, { error: "Missing authorization header." }, 401);
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser }, error: callerAuthError } = await callerClient.auth.getUser();
    if (callerAuthError || !callerUser) {
      return jsonResponse(request, { error: "You must be signed in to import clients." }, 401);
    }

    const { data: callerProfile, error: callerProfileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (callerProfileError) {
      return jsonResponse(request, { error: callerProfileError.message }, 400);
    }
    if (callerProfile?.role !== "admin" && callerProfile?.role !== "consultant") {
      return jsonResponse(request, { error: "Only Acapolite staff can import clients." }, 403);
    }

    const payload = (await request.json()) as ImportPayload;
    const batchId = payload.batch_id?.trim() ?? "";
    const submittedRows = Array.isArray(payload.rows) ? payload.rows : [];

    if (!batchId || !UUID_PATTERN.test(batchId)) {
      return jsonResponse(request, { error: "A valid batch_id is required." }, 400);
    }
    if (submittedRows.length === 0) {
      return jsonResponse(request, { error: "No rows submitted." }, 400);
    }
    if (submittedRows.length > MAX_ROWS_PER_BATCH) {
      return jsonResponse(request, { error: `A single import is limited to ${MAX_ROWS_PER_BATCH} rows.` }, 400);
    }
    for (const row of submittedRows) {
      if (typeof row.row_number !== "number" || !VALID_ACTIONS.has(row.user_action)) {
        return jsonResponse(request, { error: "Malformed row submission." }, 400);
      }
    }

    // --- Idempotency -------------------------------------------------
    const existing = await loadStoredResult(adminClient, batchId);
    if (existing) {
      if (existing.batch.status === "completed") {
        return jsonResponse(request, {
          batch_id: batchId,
          replayed: true,
          summary: {
            total_rows: existing.batch.total_rows,
            imported_count: existing.batch.imported_count,
            skipped_count: existing.batch.skipped_count,
            blocked_count: existing.batch.blocked_count,
            failed_count: existing.batch.failed_count,
          },
          rows: existing.rows,
        }, 200);
      }
      return jsonResponse(request, { error: "This import batch is already being processed." }, 409);
    }

    const { error: insertBatchError } = await adminClient.from("client_import_batches").insert({
      id: batchId,
      actor_profile_id: callerUser.id,
      status: "processing",
      source_filename: payload.source_filename ?? null,
      total_rows: submittedRows.length,
    });
    if (insertBatchError) {
      // Unique-violation on id = a concurrent request for the same batch
      // won the race to create it first. Treat identically to "already
      // processing" rather than silently proceeding twice.
      if (insertBatchError.code === "23505") {
        return jsonResponse(request, { error: "This import batch is already being processed." }, 409);
      }
      return jsonResponse(request, { error: insertBatchError.message }, 400);
    }

    // --- Fresh data for revalidation (never trust the stale preview) --
    const { data: existingClientsData, error: existingClientsError } = await adminClient
      .from("clients")
      .select("id,email,phone,vat_number,tax_number,sars_reference_number,company_registration_number,client_code,first_name,last_name,company_name");
    if (existingClientsError) throw existingClientsError;
    const existingClients = (existingClientsData ?? []) as ExistingClientRecord[];

    const sanitizedRows: MappedClientData[] = submittedRows.map((row) => sanitizeMappedRow(row.mapped ?? {}));

    // A row the user explicitly skipped will never be written, so it must
    // not "claim" an identifier for other rows' within-batch duplicate
    // checks - only rows actually headed for a write attempt participate.
    const activeIndices = submittedRows
      .map((row, index) => (row.user_action === "skip" ? -1 : index))
      .filter((index) => index !== -1);
    const activeMatches = matchWithinBatch(activeIndices.map((index) => sanitizedRows[index]));
    const withinBatchMatches: ReturnType<typeof matchWithinBatch>[number][] = sanitizedRows.map(() => []);
    activeIndices.forEach((originalIndex, activePosition) => {
      withinBatchMatches[originalIndex] = activeMatches[activePosition];
    });

    const uniqueEmails = Array.from(new Set(sanitizedRows.map((row) => normalizeEmail(row.email)).filter(Boolean)));
    const { data: profilesData, error: profilesError } = uniqueEmails.length
      ? await adminClient.from("profiles").select("email").in("email", uniqueEmails)
      : { data: [] as { email: string | null }[], error: null };
    if (profilesError) throw profilesError;
    const portalEmails = new Set((profilesData ?? []).map((p) => normalizeEmail(p.email ?? "")).filter(Boolean));

    // --- Row-by-row processing ----------------------------------------
    const results: RowResult[] = [];
    let importedCount = 0;
    let skippedCount = 0;
    let blockedCount = 0;
    let failedCount = 0;

    for (let index = 0; index < submittedRows.length; index += 1) {
      const submitted = submittedRows[index];
      const mapped = sanitizedRows[index];
      const validation = validateRow(mapped);
      const duplicates = [...matchAgainstExistingClients(mapped, existingClients), ...withinBatchMatches[index]];
      const hasPortalCollision = matchPortalAccount(mapped, portalEmails);
      const outcome = resolveRowOutcome({ userAction: submitted.user_action, validation, duplicates, hasPortalCollision });
      const clientName = clientDisplayName(mapped);

      let finalStatus: string = outcome.status;
      let clientId: string | null = null;
      let reason = outcome.reason;

      if (outcome.status === "proceed_import") {
        const insertPayload = buildClientInsertPayload(mapped, callerUser.id);
        const { data: created, error: insertError } = await adminClient
          .from("clients")
          .insert(insertPayload)
          .select("id")
          .single();

        if (insertError) {
          finalStatus = "failed";
          reason = insertError.message;
          failedCount += 1;
        } else {
          finalStatus = "imported";
          clientId = created!.id as string;
          importedCount += 1;
          // A row that just got its own client_id inserted mid-batch must
          // be visible to any later row's existing-client duplicate check
          // in this same run.
          existingClients.push({
            id: clientId,
            email: insertPayload.email,
            phone: insertPayload.phone,
            vat_number: insertPayload.vat_number,
            tax_number: insertPayload.tax_number,
            sars_reference_number: insertPayload.sars_reference_number,
            company_registration_number: insertPayload.company_registration_number,
            client_code: insertPayload.client_code,
            first_name: insertPayload.first_name,
            last_name: insertPayload.last_name,
            company_name: insertPayload.company_name,
          });
        }
      } else if (outcome.status === "skipped_user") {
        skippedCount += 1;
      } else {
        blockedCount += 1;
      }

      const forcedImportAnyway = submitted.user_action === "import_anyway" && finalStatus === "imported";

      results.push({
        row_number: submitted.row_number,
        status: finalStatus,
        client_id: clientId,
        client_name: clientName,
        reason,
        duplicate_reason: outcome.duplicateReason,
        matched_client_ids: outcome.matchedClientIds,
      });

      await adminClient.from("client_import_batch_rows").insert({
        batch_id: batchId,
        row_number: submitted.row_number,
        status: finalStatus,
        client_id: clientId,
        client_name: clientName,
        reason,
        duplicate_reason: outcome.duplicateReason,
        matched_client_ids: outcome.matchedClientIds.length ? outcome.matchedClientIds : null,
        forced_import_anyway: forcedImportAnyway,
      });
    }

    await adminClient
      .from("client_import_batches")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        imported_count: importedCount,
        skipped_count: skippedCount,
        blocked_count: blockedCount,
        failed_count: failedCount,
      })
      .eq("id", batchId);

    await adminClient.from("system_activity_log").insert({
      actor_profile_id: callerUser.id,
      actor_role: callerProfile.role,
      action: "clients_imported",
      target_type: "client_import_batch",
      target_id: batchId,
      metadata: {
        filename: payload.source_filename ?? null,
        total_rows: submittedRows.length,
        imported_count: importedCount,
        skipped_count: skippedCount,
        blocked_count: blockedCount,
        failed_count: failedCount,
      },
    });

    return jsonResponse(request, {
      batch_id: batchId,
      replayed: false,
      summary: {
        total_rows: submittedRows.length,
        imported_count: importedCount,
        skipped_count: skippedCount,
        blocked_count: blockedCount,
        failed_count: failedCount,
      },
      rows: results,
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while importing clients.";
    return jsonResponse(request, { error: message }, 500);
  }
});

// Exposed for completeness/allowlist verification by callers that want to
// confirm the server and client agree on the supported field set.
export { ALLOWED_CLIENT_FIELDS };
