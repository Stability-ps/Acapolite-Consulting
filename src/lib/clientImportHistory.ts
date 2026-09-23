// Pure logic for the Import History feature (PR7). Deliberately built only
// on what client_import_batches/client_import_batch_rows actually persist -
// see the PR description for what was checked before writing this. No raw
// per-row email/phone/client_type is available for historical rows (only
// client_name); those columns are enriched from the live `clients` table for
// successful rows only (see importReport.ts), never reconstructed.

export type ImportBatchStatus = "processing" | "completed";

export type ImportBatchSummary = {
  id: string;
  status: ImportBatchStatus | string;
  source_filename: string | null;
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  blocked_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
  actor_profile_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
};

export type ImportBatchRow = {
  id: string;
  batch_id: string;
  row_number: number;
  status: string;
  client_id: string | null;
  client_name: string | null;
  reason: string | null;
  duplicate_reason: string | null;
  matched_client_ids: string[] | null;
  forced_import_anyway: boolean;
  created_at: string;
};

// The 6 statuses the import-clients edge function actually writes. Any other
// value is treated as "unknown" rather than crashing or silently
// mis-bucketing it - historical data (or a future status this code hasn't
// been taught about yet) must degrade safely, not throw.
export type OutcomeBucket = "imported" | "skipped" | "blocked" | "failed" | "unknown";

export function outcomeBucket(status: string): OutcomeBucket {
  switch (status) {
    case "imported":
      return "imported";
    case "skipped_user":
      return "skipped";
    case "blocked_validation":
    case "blocked_duplicate_changed":
    case "blocked_portal_collision":
      return "blocked";
    case "failed":
      return "failed";
    default:
      return "unknown";
  }
}

export function isIssueRow(status: string): boolean {
  return outcomeBucket(status) !== "imported";
}

export const ROW_STATUS_LABELS: Record<string, string> = {
  imported: "Imported",
  skipped_user: "Skipped",
  blocked_validation: "Blocked — validation",
  blocked_duplicate_changed: "Blocked — duplicate",
  blocked_portal_collision: "Blocked — portal account",
  failed: "Failed",
};

export function rowStatusLabel(status: string): string {
  return ROW_STATUS_LABELS[status] ?? `Unrecognised status (${status})`;
}

export function sortBatchesNewestFirst(batches: ImportBatchSummary[]): ImportBatchSummary[] {
  return [...batches].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export type BatchCountReconciliation = {
  consistent: boolean;
  actual: { imported: number; skipped: number; blocked: number; failed: number; unknown: number };
  mismatches: string[];
};

// Item 6: historical counts must reconcile with the row-level records. Real
// production batches checked during development were exactly consistent,
// but this must not assume that holds forever - flag it instead of
// displaying (or exporting) contradictory numbers.
export function reconcileBatchCounts(
  batch: Pick<ImportBatchSummary, "total_rows" | "imported_count" | "skipped_count" | "blocked_count" | "failed_count">,
  rows: Pick<ImportBatchRow, "status">[],
): BatchCountReconciliation {
  const actual = { imported: 0, skipped: 0, blocked: 0, failed: 0, unknown: 0 };
  for (const row of rows) {
    actual[outcomeBucket(row.status)] += 1;
  }

  const mismatches: string[] = [];
  if (actual.imported !== batch.imported_count) {
    mismatches.push(`Imported count mismatch: batch says ${batch.imported_count}, rows show ${actual.imported}.`);
  }
  if (actual.skipped !== batch.skipped_count) {
    mismatches.push(`Skipped count mismatch: batch says ${batch.skipped_count}, rows show ${actual.skipped}.`);
  }
  if (actual.blocked !== batch.blocked_count) {
    mismatches.push(`Blocked count mismatch: batch says ${batch.blocked_count}, rows show ${actual.blocked}.`);
  }
  if (actual.failed !== batch.failed_count) {
    mismatches.push(`Failed count mismatch: batch says ${batch.failed_count}, rows show ${actual.failed}.`);
  }
  if (rows.length !== batch.total_rows) {
    mismatches.push(`Row count mismatch: batch says ${batch.total_rows} total rows, ${rows.length} row records found.`);
  }
  if (actual.unknown > 0) {
    mismatches.push(`${actual.unknown} row(s) have a status this UI doesn't recognise.`);
  }

  return { consistent: mismatches.length === 0, actual, mismatches };
}

export type RowClientLink = {
  hasLink: boolean;
  label: string;
};

// A row's client_id is nulled (ON DELETE SET NULL) if the created client is
// later deleted - the row itself, and its historical status/reason, must
// stay intact and keep rendering, just without a working link.
export function resolveRowClientLink(row: Pick<ImportBatchRow, "status" | "client_id" | "client_name">): RowClientLink {
  if (row.client_id) {
    return { hasLink: true, label: "Open" };
  }
  if (outcomeBucket(row.status) === "imported") {
    return { hasLink: false, label: "Client no longer exists" };
  }
  return { hasLink: false, label: "—" };
}

// Mirrors the can_view_client_import_history() RLS predicate applied in
// migration 20260913090000. This is a UI-convenience gate only (hide the
// button/nav entry) - the real enforcement is the RLS policy itself, so a
// direct API/URL access attempt is denied server-side regardless of what
// this function returns.
export function canViewImportHistory(role: string | null | undefined, canImportClients: boolean): boolean {
  if (role === "admin") return true;
  if (role === "consultant") return canImportClients;
  return false;
}
