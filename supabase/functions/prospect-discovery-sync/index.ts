// Prospect Hub discovery: National Treasury eTenders OCDS (official API).
//
// Invoked by pg_cron (x-cron-secret) or manually by a user with
// can_manage_prospect_hub. The API requires dateFrom/dateTo and is slow and
// intermittently returns HTTP 500, so the worker:
//   - walks one-day windows forward from a stored cursor (catch-up / backfill),
//   - requests small pages with retries and back-off,
//   - only advances the cursor past a window after every page succeeded,
//   - stops within a time budget and resumes on the next run.
// Only awarded suppliers in target sectors/provinces are imported. Each
// award is stored as evidence and attached to one prospect per company via
// upsert_discovered_prospect (dedup by supplier id, registration number,
// normalised name). Supplier contact details are NOT taken from this feed
// (its contactPoint belongs to the procuring entity).

import {
  authorizeProspectCaller,
  createAdminClient,
  jsonResponse,
  preflight,
} from "../_shared/prospectHttp.ts";
import { addDays, awardedSuppliers, dayWindows, ETENDERS_API } from "../_shared/prospectDiscovery.ts";

const SOURCE_KEY = "etenders_ocds";
const SOURCE_NAME = "National Treasury eTenders OCDS";
const RUN_BUDGET_MS = 115_000;
const REQUEST_TIMEOUT_MS = 40_000;
const MAX_PAGES_PER_WINDOW = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(from: string, to: string, page: number, pageSize: number, deadline: number) {
  const url = `${ETENDERS_API}?PageNumber=${page}&PageSize=${pageSize}&dateFrom=${from}&dateTo=${to}`;
  let lastError = "";
  for (let attempt = 1; attempt <= 4; attempt++) {
    if (Date.now() + 5_000 > deadline) break;
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "AcapoliteProspectHub/1.0 (+https://acapoliteconsulting.co.za)" },
        signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, Math.max(5_000, deadline - Date.now()))),
      });
      if (response.ok) {
        const payload = await response.json();
        return { ok: true as const, releases: Array.isArray(payload?.releases) ? payload.releases : [] };
      }
      lastError = `eTenders API HTTP ${response.status}`;
      await response.body?.cancel();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(attempt * 2_000);
  }
  return { ok: false as const, error: lastError || "time budget exhausted" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  const caller = await authorizeProspectCaller(req, "can_manage_prospect_hub");
  if (!caller) return jsonResponse(req, { error: "Forbidden" }, 403);

  const sb = createAdminClient();
  const startedAt = Date.now();
  const deadline = startedAt + RUN_BUDGET_MS;
  let runId: string | null = null;
  let sourceId: string | null = null;

  try {
    const { data: settings, error: settingsError } = await sb.from("prospect_discovery_settings").select("*").eq("source_name", SOURCE_NAME).single();
    if (settingsError) throw settingsError;
    const { data: source, error: sourceError } = await sb.from("prospect_sources").select("*").eq("key", SOURCE_KEY).single();
    if (sourceError) throw sourceError;
    sourceId = source.id;
    if (caller.kind === "cron" && (!settings.enabled || !source.enabled)) {
      return jsonResponse(req, { ok: true, skipped: true, reason: "source_disabled" });
    }
    const today = new Date().toISOString().slice(0, 10);
    const lookback = Number(settings.lookback_days || 30);
    const cursor: string = settings.window_cursor ?? addDays(today, -lookback);
    // Caught up: every completed day up to yesterday has been scanned. Exit
    // without logging a run so frequent schedules stay quiet.
    if (cursor >= today) {
      return jsonResponse(req, { ok: true, skipped: true, reason: "caught_up", next_cursor: cursor });
    }

    const { data: run, error: runError } = await sb.from("prospect_discovery_runs")
      .insert({ source_name: SOURCE_NAME, source_id: sourceId, run_type: caller.kind === "cron" ? "scheduled" : "manual", triggered_by: caller.userId })
      .select("id").single();
    if (runError) throw runError;
    runId = run.id;
    await sb.from("prospect_sources").update({ last_attempt_at: new Date().toISOString() }).eq("id", sourceId);

    const windows = dayWindows(cursor, today, Number(settings.windows_per_run || 3));
    // Page within the first window to resume from (a busy day can span many runs).
    let startPage = Math.max(1, Number(settings.next_page || 1));

    const provinces: string[] = settings.provinces ?? [];
    const targets: string[] = settings.target_sectors ?? [];
    const pageSize = Math.min(100, Math.max(5, Number(settings.page_size || 20)));
    const maxNew = Number(settings.max_new_per_run || 100);
    const stats = { records: 0, pages: 0, suppliers: 0, created: 0, updated: 0, skipped: 0, outOfScope: 0, windowsCompleted: 0, budgetReached: false, failedWindow: null as string | null, error: null as string | null };
    let nextCursor = cursor;
    let nextPage = startPage;

    windowLoop:
    for (const window of windows) {
      for (let page = startPage; page <= MAX_PAGES_PER_WINDOW; page++) {
        nextPage = page;
        if (Date.now() + 25_000 > deadline) { stats.budgetReached = true; break windowLoop; }
        const result = await fetchPage(window.from, window.to, page, pageSize, deadline);
        if (!result.ok) { stats.failedWindow = window.from; stats.error = result.error; break windowLoop; }
        stats.pages++;
        stats.records += result.releases.length;
        for (const release of result.releases) {
          for (const supplier of awardedSuppliers(release)) {
            stats.suppliers++;
            if (provinces.length && supplier.province && !provinces.includes(supplier.province)) { stats.outOfScope++; continue; }
            if (provinces.length && !supplier.province) { stats.outOfScope++; continue; }
            if (targets.length && (!supplier.sector || !targets.includes(supplier.sector))) { stats.outOfScope++; continue; }
            // Daily cap reached: stop and re-read this page next run (idempotent).
            if (stats.created >= maxNew) { stats.budgetReached = true; break windowLoop; }
            const { data, error } = await sb.rpc("upsert_discovered_prospect", {
              p_source_key: SOURCE_KEY,
              p_prospect: {
                company_name: supplier.companyName,
                source_supplier_id: supplier.supplierId,
                sector: supplier.sector,
                province: supplier.province,
                supplier_size: supplier.supplierSize,
                source_url: supplier.sourceUrl,
                metadata: { csd_number: supplier.csdNumber, official_source: true },
              },
              p_record: {
                source_record_id: supplier.sourceRecordId,
                record_type: "award",
                ocid: supplier.ocid,
                tender_reference: supplier.tenderReference,
                tender_title: supplier.tenderTitle,
                tender_description: supplier.tenderDescription,
                tender_category: supplier.tenderCategory,
                tender_status: supplier.tenderStatus,
                buyer_name: supplier.buyerName,
                award_status: supplier.awardStatus,
                award_value: supplier.awardValue,
                award_currency: supplier.awardCurrency,
                award_date: supplier.awardDate,
                supplier_name: supplier.companyName,
                supplier_size: supplier.supplierSize,
                province: supplier.province,
                source_url: supplier.sourceUrl,
              },
            });
            if (error) { stats.skipped++; console.error("prospect-discovery-upsert", JSON.stringify({ ocid: supplier.ocid, message: error.message })); continue; }
            if (data?.status === "created") stats.created++;
            else if (data?.status === "updated") stats.updated++;
            else stats.skipped++;
          }
        }
        nextPage = page + 1;
        if (result.releases.length < pageSize) break;
      }
      stats.windowsCompleted++;
      nextCursor = window.to;
      nextPage = 1;
      startPage = 1;
    }

    const finishedAt = new Date().toISOString();
    // A run that fetched at least one page made progress (the cursor moved).
    const failed = stats.pages === 0 && !!stats.error;
    const runStatus = failed ? "failed" : stats.error ? "partial" : "completed";
    const consecutive = failed ? Number(source.consecutive_failures || 0) + 1 : 0;

    await sb.from("prospect_discovery_runs").update({
      status: runStatus,
      completed_at: finishedAt,
      records_fetched: stats.records,
      suppliers_seen: stats.suppliers,
      prospects_created: stats.created,
      prospects_updated: stats.updated,
      skipped: stats.skipped + stats.outOfScope,
      error_message: stats.error,
      metadata: { windows: windows.map((w) => w.from), windows_completed: stats.windowsCompleted, pages: stats.pages, failed_window: stats.failedWindow, out_of_scope: stats.outOfScope, next_cursor: nextCursor, next_page: nextPage, budget_reached: stats.budgetReached },
    }).eq("id", runId);
    await sb.from("prospect_discovery_settings").update({
      window_cursor: nextCursor,
      next_page: nextPage,
      last_run_at: finishedAt,
      ...(failed ? { last_error: stats.error } : { last_success_at: finishedAt, last_error: stats.error }),
    }).eq("id", settings.id);
    await sb.from("prospect_sources").update({
      status: failed ? (consecutive >= 3 ? "failing" : "degraded") : runStatus === "partial" ? "degraded" : "healthy",
      last_error: stats.error,
      consecutive_failures: consecutive,
      total_runs: Number(source.total_runs || 0) + 1,
      total_failures: Number(source.total_failures || 0) + (failed ? 1 : 0),
      records_discovered: Number(source.records_discovered || 0) + stats.suppliers,
      prospects_created: Number(source.prospects_created || 0) + stats.created,
      ...(failed ? {} : { last_success_at: finishedAt }),
    }).eq("id", sourceId);

    return jsonResponse(req, {
      ok: !failed,
      run_id: runId,
      status: runStatus,
      windows_scanned: stats.windowsCompleted,
      records_fetched: stats.records,
      suppliers_seen: stats.suppliers,
      prospects_created: stats.created,
      prospects_updated: stats.updated,
      out_of_scope: stats.outOfScope,
      skipped: stats.skipped,
      pages_fetched: stats.pages,
      next_cursor: nextCursor,
      next_page: nextPage,
      error: stats.error,
    }, failed ? 502 : 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("prospect-discovery-sync", JSON.stringify({ message }));
    const now = new Date().toISOString();
    if (runId) await sb.from("prospect_discovery_runs").update({ status: "failed", completed_at: now, error_message: message }).eq("id", runId);
    await sb.from("prospect_discovery_settings").update({ last_run_at: now, last_error: message }).eq("source_name", SOURCE_NAME);
    if (sourceId) await sb.from("prospect_sources").update({ status: "degraded", last_error: message }).eq("id", sourceId);
    return jsonResponse(req, { ok: false, error: "Discovery sync failed" }, 500);
  }
});
