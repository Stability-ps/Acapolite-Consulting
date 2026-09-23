import * as XLSX from "xlsx";

// CSV/XLSX parsing and column mapping for bulk client import (PR4). This
// field list MUST match ALLOWED_CLIENT_FIELDS in
// supabase/functions/_shared/clientImportServer.ts exactly - that's the
// server-side allowlist a submitted row is sanitized against, so a field
// added here without a matching server-side entry would silently never be
// written, and vice versa.

export const IMPORT_FIELD_KEYS = [
  "client_type",
  "first_name",
  "last_name",
  "company_name",
  "company_registration_number",
  "id_number",
  "tax_number",
  "sars_reference_number",
  "vat_number",
  "email",
  "phone",
  "address_line_1",
  "address_line_2",
  "city",
  "province",
  "postal_code",
  "country",
  "notes",
  "client_code",
  "returns_filed",
  "sars_outstanding_debt",
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELD_KEYS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportFieldKey, string> = {
  client_type: "Client Type",
  first_name: "First Name",
  last_name: "Last Name",
  company_name: "Company Name",
  company_registration_number: "Company Registration Number",
  id_number: "ID Number",
  tax_number: "Income Tax Number",
  sars_reference_number: "SARS Reference Number",
  vat_number: "VAT Number",
  email: "Email",
  phone: "Phone",
  address_line_1: "Address Line 1",
  address_line_2: "Address Line 2",
  city: "City",
  province: "Province",
  postal_code: "Postal Code",
  country: "Country",
  notes: "Notes",
  client_code: "Client Code",
  returns_filed: "Returns Filed",
  sars_outstanding_debt: "SARS Outstanding / Debt",
};

// Alternate header spellings a source CSV/XLSX might use, for auto-mapping.
const HEADER_ALIASES: Record<ImportFieldKey, string[]> = {
  client_type: ["type", "client type"],
  first_name: ["first name", "firstname", "given name"],
  last_name: ["last name", "lastname", "surname"],
  company_name: ["company", "company name", "organisation", "organisation name", "trust name"],
  company_registration_number: ["registration number", "company reg", "reg number", "company registration"],
  id_number: ["id number", "sa id number", "identity number"],
  tax_number: ["tax number", "income tax number", "itn"],
  sars_reference_number: ["sars reference", "sars reference number", "sars ref"],
  vat_number: ["vat number", "vat"],
  email: ["email address", "e-mail"],
  phone: ["phone number", "mobile", "mobile number", "cell", "cellphone"],
  address_line_1: ["address 1", "address line 1", "street address"],
  address_line_2: ["address 2", "address line 2"],
  city: ["town"],
  province: ["state"],
  postal_code: ["postcode", "zip", "zip code"],
  country: [],
  notes: ["internal notes", "comments"],
  client_code: ["code", "client id"],
  returns_filed: ["returns", "returns filed?"],
  sars_outstanding_debt: ["outstanding debt", "sars debt", "debt"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export type ParsedImportFile = {
  headers: string[];
  rows: Record<string, string>[];
};

function parseCsvText(text: string): ParsedImportFile {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // ignore, \n handles the line break
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmptyRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headerRow, ...dataRows] = nonEmptyRows;
  const headers = headerRow.map((h) => h.trim());

  return {
    headers,
    rows: dataRows.map((cells) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = (cells[index] ?? "").trim();
      });
      return record;
    }),
  };
}

function parseXlsxBuffer(buffer: ArrayBuffer): ParsedImportFile {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false });
  const nonEmptyRows = grid.filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""));
  if (nonEmptyRows.length === 0) return { headers: [], rows: [] };

  const [headerRow, ...dataRows] = nonEmptyRows;
  const headers = headerRow.map((h) => String(h ?? "").trim());

  return {
    headers,
    rows: dataRows.map((cells) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = String(cells[index] ?? "").trim();
      });
      return record;
    }),
  };
}

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const isXlsx = /\.xlsx?$/i.test(file.name);
  if (isXlsx) {
    const buffer = await file.arrayBuffer();
    return parseXlsxBuffer(buffer);
  }
  const text = await file.text();
  return parseCsvText(text);
}

export type ColumnMapping = Partial<Record<ImportFieldKey, string>>;

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeHeader(header) }));

  for (const key of IMPORT_FIELD_KEYS) {
    const candidates = [normalizeHeader(IMPORT_FIELD_LABELS[key]), normalizeHeader(key), ...HEADER_ALIASES[key].map(normalizeHeader)];
    const match = normalizedHeaders.find(({ normalized }) => candidates.includes(normalized));
    if (match) {
      mapping[key] = match.header;
    }
  }

  return mapping;
}

export function applyColumnMapping(rawRow: Record<string, string>, mapping: ColumnMapping): Record<ImportFieldKey, string> {
  const mapped = {} as Record<ImportFieldKey, string>;
  for (const key of IMPORT_FIELD_KEYS) {
    const sourceHeader = mapping[key];
    mapped[key] = sourceHeader ? (rawRow[sourceHeader] ?? "") : "";
  }
  return mapped;
}

export function downloadImportTemplate() {
  const header = IMPORT_FIELD_KEYS.map((key) => IMPORT_FIELD_LABELS[key]);
  const exampleRow = [
    "individual",
    "Jane",
    "Doe",
    "",
    "",
    "8001015009087",
    "1234567890",
    "",
    "",
    "jane.doe@example.com",
    "+27821234567",
    "1 Example Street",
    "",
    "Cape Town",
    "Western Cape",
    "8001",
    "South Africa",
    "",
    "",
    "no",
    "0",
  ];
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const csv = [header.map(escape).join(","), exampleRow.map(escape).join(",")].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "client-import-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
