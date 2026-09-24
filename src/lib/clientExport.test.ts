import { describe, expect, it } from "vitest";
import { buildRows, escapeCsvCell, sanitizeCellText, type ClientExportRecord } from "./clientExport";

describe("sanitizeCellText (CSV/XLSX formula-injection protection)", () => {
  it("prefixes a value starting with =, +, -, @, tab, or CR with an apostrophe", () => {
    expect(sanitizeCellText("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeCellText("+1+1")).toBe("'+1+1");
    expect(sanitizeCellText("-1+1")).toBe("'-1+1");
    expect(sanitizeCellText("@SUM(1,2)")).toBe("'@SUM(1,2)");
    expect(sanitizeCellText("\tindented")).toBe("'\tindented");
    expect(sanitizeCellText("\rcarriage")).toBe("'\rcarriage");
  });

  it("leaves ordinary text, including a mid-string special character, untouched", () => {
    expect(sanitizeCellText("Jane Doe")).toBe("Jane Doe");
    expect(sanitizeCellText("")).toBe("");
    expect(sanitizeCellText("client+tag@example.com")).toBe("client+tag@example.com");
    expect(sanitizeCellText("R100 - deposit")).toBe("R100 - deposit");
  });

  it("neutralizes a classic DDE/command-execution payload", () => {
    const payload = '=cmd|\' /C calc\'!A1';
    expect(sanitizeCellText(payload)).toBe(`'${payload}`);
  });
});

describe("escapeCsvCell composed with sanitizeCellText", () => {
  it("both the formula guard and the comma/quote escaping apply, in either order the field stays safe", () => {
    const sanitized = sanitizeCellText('=HYPERLINK("http://evil.test","click"),extra');
    expect(sanitized.startsWith("'=")).toBe(true);
    const escaped = escapeCsvCell(sanitized);
    expect(escaped.startsWith('"')).toBe(true);
    expect(escaped).toContain("'=HYPERLINK");
  });
});

function baseRecord(overrides: Partial<ClientExportRecord> = {}): ClientExportRecord {
  return {
    client_code: "CL-1",
    client_type: "individual",
    first_name: "Jane",
    last_name: "Doe",
    company_name: null,
    company_registration_number: null,
    id_number: null,
    tax_number: null,
    sars_reference_number: null,
    vat_number: null,
    email: "jane@example.test",
    phone: null,
    address_line_1: null,
    address_line_2: null,
    city: null,
    province: null,
    postal_code: null,
    country: null,
    notes: null,
    returns_filed: true,
    sars_outstanding_debt: 0,
    is_archived: false,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildRows (shared by both exportClientsToCsv and exportClientsToXlsx)", () => {
  it("prefixes a malicious notes/company_name field in the built row", () => {
    const [row] = buildRows([baseRecord({ notes: "=cmd|'/c calc'!A1", company_name: "+1+1" })]);
    expect(row.Notes).toBe("'=cmd|'/c calc'!A1");
    expect(row["Company Name"]).toBe("'+1+1");
  });

  it("keeps sars_outstanding_debt a real number, not a sanitized string, so XLSX still writes it numeric", () => {
    const [row] = buildRows([baseRecord({ sars_outstanding_debt: -500 })]);
    expect(row["SARS Outstanding / Debt"]).toBe(-500);
    expect(typeof row["SARS Outstanding / Debt"]).toBe("number");
  });

  it("still renders booleans and nulls as before (Yes/No, empty string) alongside the new sanitization", () => {
    const [row] = buildRows([baseRecord({ returns_filed: false, is_archived: true, phone: null })]);
    expect(row["Returns Filed"]).toBe("No");
    expect(row.Archived).toBe("Yes");
    expect(row.Phone).toBe("");
  });

  it("a client whose real name happens to start with a hyphen (e.g. a double-barrelled surname) still round-trips, just prefixed", () => {
    const [row] = buildRows([baseRecord({ first_name: "-Anne", last_name: "Smith" })]);
    expect(row["First Name"]).toBe("'-Anne");
  });
});
