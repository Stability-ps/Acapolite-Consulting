import * as XLSX from "xlsx";
import { escapeCsvCell, triggerDownload } from "@/lib/clientExport";
import { isIssueRow, rowStatusLabel } from "@/lib/clientImportHistory";

// The single report-generation implementation for import results, used both
// by the PR6 "just finished importing" Results screen and by a reopened
// historical batch (PR7) - same function, same columns, same behaviour,
// deliberately not two separate implementations.
//
// Built only on what's actually available in both contexts: the persisted
// row shape (row_number/status/client_id/client_name/reason/
// duplicate_reason). Raw submitted email/phone/client_type were never
// persisted per row (see clientImportHistory.ts), so those three columns
// are populated only for successful rows, from the *current* clients table
// record (via `enrichment`, keyed by client_id) - never reconstructed for
// skipped/blocked/failed rows, and never claimed to reflect what was
// originally submitted rather than what the client record looks like now.

export type ImportReportRowSource = {
  row_number: number;
  status: string;
  client_id: string | null;
  client_name: string | null;
  reason: string | null;
  duplicate_reason: string | null;
};

export type ClientEnrichmentRecord = {
  client_type: string | null;
  email: string | null;
  phone: string | null;
};

export type ClientEnrichmentMap = Record<string, ClientEnrichmentRecord>;

const REPORT_COLUMNS = [
  "Source Row",
  "Client Name",
  "Client Type",
  "Email",
  "Phone",
  "Outcome",
  "Reason",
  "Created Client ID",
  "Duplicate/Review Information",
] as const;

function buildReportRow(row: ImportReportRowSource, enrichment: ClientEnrichmentMap): Record<string, string> {
  const enriched = row.client_id ? enrichment[row.client_id] : undefined;
  return {
    "Source Row": String(row.row_number),
    "Client Name": row.client_name ?? "",
    "Client Type": enriched?.client_type ?? "",
    Email: enriched?.email ?? "",
    Phone: enriched?.phone ?? "",
    Outcome: rowStatusLabel(row.status),
    Reason: row.reason ?? "",
    "Created Client ID": row.client_id ?? "",
    "Duplicate/Review Information": row.duplicate_reason ?? "",
  };
}

export function buildImportReportRows(
  rows: ImportReportRowSource[],
  enrichment: ClientEnrichmentMap,
  options: { issuesOnly?: boolean } = {},
): Record<string, string>[] {
  const filtered = options.issuesOnly ? rows.filter((row) => isIssueRow(row.status)) : rows;
  return filtered.map((row) => buildReportRow(row, enrichment));
}

export type ImportReportFormat = "csv" | "xlsx";

export type ExportImportReportResult = { exported: boolean; rowCount: number };

export function exportImportReport(
  rows: ImportReportRowSource[],
  enrichment: ClientEnrichmentMap,
  format: ImportReportFormat,
  baseName: string,
  options: { issuesOnly?: boolean } = {},
): ExportImportReportResult {
  const reportRows = buildImportReportRows(rows, enrichment, options);
  if (reportRows.length === 0) {
    return { exported: false, rowCount: 0 };
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${baseName}-${timestamp}.${format}`;

  if (format === "csv") {
    const header = REPORT_COLUMNS.map((column) => escapeCsvCell(column)).join(",");
    const lines = reportRows.map((row) => REPORT_COLUMNS.map((column) => escapeCsvCell(row[column])).join(","));
    const csv = [header, ...lines].join("\r\n");
    triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
  } else {
    const worksheet = XLSX.utils.json_to_sheet(reportRows, { header: [...REPORT_COLUMNS] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Import Report");
    XLSX.writeFile(workbook, filename);
  }

  return { exported: true, rowCount: reportRows.length };
}
