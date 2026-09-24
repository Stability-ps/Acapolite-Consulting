import { describe, expect, it } from "vitest";
import {
  ImportFileError,
  MAX_IMPORT_FILE_SIZE_BYTES,
  MAX_IMPORT_ROWS,
  applyColumnMapping,
  guessColumnMapping,
  parseImportFile,
} from "./clientImport";

function csvFile(text: string, name = "clients.csv") {
  return new File([text], name, { type: "text/csv" });
}

describe("parseImportFile: upload hardening (PR8)", () => {
  it("rejects a file whose extension isn't .csv/.xlsx/.xls before reading it", async () => {
    const file = new File(["whatever"], "clients.exe", { type: "application/octet-stream" });
    await expect(parseImportFile(file)).rejects.toThrow(ImportFileError);
    await expect(parseImportFile(file)).rejects.toThrow(/unsupported file type/i);
  });

  it("rejects a file over the size limit without reading its contents", async () => {
    const oversized = new File([new Uint8Array(MAX_IMPORT_FILE_SIZE_BYTES + 1)], "clients.csv", { type: "text/csv" });
    await expect(parseImportFile(oversized)).rejects.toThrow(ImportFileError);
    await expect(parseImportFile(oversized)).rejects.toThrow(/too large/i);
  });

  it("accepts a file exactly at the size limit", async () => {
    const header = "Email\n";
    const padding = "a".repeat(MAX_IMPORT_FILE_SIZE_BYTES - header.length);
    const file = csvFile(header + padding);
    expect(file.size).toBe(MAX_IMPORT_FILE_SIZE_BYTES);
    // No header/data row split here (the padding is one giant field with no
    // newline), so this just proves the size gate itself doesn't reject a
    // file sitting exactly on the boundary. jsdom's FileReader-backed
    // Blob.text() polyfill (see src/test/setup.ts) is slow on a real 10MB
    // payload, hence the longer per-test timeout - real browsers read this
    // near-instantly.
    await expect(parseImportFile(file)).resolves.toBeDefined();
  }, 30000);

  it("rejects a parsed file with more rows than MAX_IMPORT_ROWS", async () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `person${i}@example.test`);
    const file = csvFile(["Email", ...rows].join("\n"));
    await expect(parseImportFile(file)).rejects.toThrow(ImportFileError);
    await expect(parseImportFile(file)).rejects.toThrow(/row limit|5,000|5000/i);
  });

  it("accepts a normal, well-formed small CSV and parses it correctly", async () => {
    const file = csvFile("Email,First Name\njane@example.test,Jane\njohn@example.test,John");
    const parsed = await parseImportFile(file);
    expect(parsed.headers).toEqual(["Email", "First Name"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual({ Email: "jane@example.test", "First Name": "Jane" });
  });
});

describe("guessColumnMapping / applyColumnMapping (unchanged behaviour, sanity check after the refactor)", () => {
  it("still auto-maps common header aliases", () => {
    const mapping = guessColumnMapping(["Email Address", "First Name", "Mobile Number"]);
    expect(mapping.email).toBe("Email Address");
    expect(mapping.first_name).toBe("First Name");
    expect(mapping.phone).toBe("Mobile Number");
  });

  it("still applies a mapping to a raw row, leaving unmapped fields blank", () => {
    const mapped = applyColumnMapping({ "Email Address": "a@x.com" }, { email: "Email Address" });
    expect(mapped.email).toBe("a@x.com");
    expect(mapped.first_name).toBe("");
  });
});
