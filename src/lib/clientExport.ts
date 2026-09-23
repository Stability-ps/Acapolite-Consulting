import * as XLSX from "xlsx";

// Bulk + single client export (CSV/XLSX). Column set mirrors the fields a
// staff member can see on the client list/detail screens, plus the
// portal-account fields (email/phone/full name) when linked.

export type ClientExportRecord = {
  client_code: string | null;
  client_type: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  company_registration_number: string | null;
  id_number: string | null;
  tax_number: string | null;
  sars_reference_number: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  returns_filed: boolean;
  sars_outstanding_debt: number;
  is_archived: boolean;
  created_at: string;
};

const EXPORT_COLUMNS: { key: keyof ClientExportRecord; label: string }[] = [
  { key: "client_code", label: "Client Code" },
  { key: "client_type", label: "Client Type" },
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "company_name", label: "Company Name" },
  { key: "company_registration_number", label: "Company Registration Number" },
  { key: "id_number", label: "ID Number" },
  { key: "tax_number", label: "Income Tax Number" },
  { key: "sars_reference_number", label: "SARS Reference Number" },
  { key: "vat_number", label: "VAT Number" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address_line_1", label: "Address Line 1" },
  { key: "address_line_2", label: "Address Line 2" },
  { key: "city", label: "City" },
  { key: "province", label: "Province" },
  { key: "postal_code", label: "Postal Code" },
  { key: "country", label: "Country" },
  { key: "notes", label: "Notes" },
  { key: "returns_filed", label: "Returns Filed" },
  { key: "sars_outstanding_debt", label: "SARS Outstanding / Debt" },
  { key: "is_archived", label: "Archived" },
  { key: "created_at", label: "Joined" },
];

// CSV/XLSX formula-injection protection (PR8): a cell whose text starts
// with =, +, -, @, a tab, or a carriage return is interpreted as a formula
// by Excel/Google Sheets/LibreOffice on open - not just for CSV, spreadsheet
// apps apply the same leading-character rule to text cells in .xlsx too.
// Every value here can originate from an uploaded CSV/XLSX (client_name,
// notes, address fields, etc. all flow through unvalidated free text), so
// this is applied to every exported string cell, not just ones a staff
// member typed by hand. Prefixing a bare apostrophe is the standard
// mitigation (OWASP CSV Injection): it forces the cell to open as literal
// text instead of being evaluated.
const FORMULA_TRIGGER_PATTERN = /^[=+\-@\t\r]/;

export function sanitizeCellText(value: string): string {
  return FORMULA_TRIGGER_PATTERN.test(value) ? `'${value}` : value;
}

function toCellValue(record: ClientExportRecord, key: keyof ClientExportRecord): string | number {
  const value = record[key];
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return sanitizeCellText(value);
  return value;
}

// Exported so tests can assert on the exact row shape fed to both the CSV
// and XLSX writers, instead of only the pure sanitizeCellText() helper.
export function buildRows(records: ClientExportRecord[]) {
  return records.map((record) => {
    const row: Record<string, string | number> = {};
    for (const column of EXPORT_COLUMNS) {
      row[column.label] = toCellValue(record, column.key);
    }
    return row;
  });
}

// Exported so other report generators (e.g. importReport.ts) reuse the same
// CSV-escaping/download primitives instead of a second implementation.
export function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportClientsToCsv(records: ClientExportRecord[], filename: string) {
  const rows = buildRows(records);
  const header = EXPORT_COLUMNS.map((column) => escapeCsvCell(column.label)).join(",");
  const lines = rows.map((row) => EXPORT_COLUMNS.map((column) => escapeCsvCell(row[column.label])).join(","));
  const csv = [header, ...lines].join("\r\n");
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export function exportClientsToXlsx(records: ClientExportRecord[], filename: string) {
  const rows = buildRows(records);
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS.map((column) => column.label) });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
  XLSX.writeFile(workbook, filename);
}

export type ExportFormat = "csv" | "xlsx";

export function exportClients(records: ClientExportRecord[], format: ExportFormat, baseName: string) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${baseName}-${timestamp}.${format}`;
  if (format === "csv") {
    exportClientsToCsv(records, filename);
  } else {
    exportClientsToXlsx(records, filename);
  }
}
