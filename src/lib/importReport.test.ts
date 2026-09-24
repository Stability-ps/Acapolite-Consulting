import { describe, expect, it } from "vitest";
import { buildImportReportRows, type ClientEnrichmentMap, type ImportReportRowSource } from "./importReport";

function rows(): ImportReportRowSource[] {
  return [
    { row_number: 1, status: "imported", client_id: "c1", client_name: "Jane Doe", reason: null, duplicate_reason: null },
    { row_number: 2, status: "skipped_user", client_id: null, client_name: "Skipped Person", reason: "Skipped by staff.", duplicate_reason: null },
    {
      row_number: 3,
      status: "blocked_duplicate_changed",
      client_id: null,
      client_name: "Dup Person",
      reason: "Existing client matched by Email: dup@example.test",
      duplicate_reason: "Existing client matched by Email: dup@example.test",
    },
    { row_number: 4, status: "failed", client_id: null, client_name: "Failed Person", reason: "duplicate key value violates unique constraint", duplicate_reason: null },
  ];
}

function enrichment(): ClientEnrichmentMap {
  return { c1: { client_type: "individual", email: "jane@example.test", phone: "0821234567" } };
}

describe("buildImportReportRows", () => {
  it("includes every row, in order, with all report columns present", () => {
    const built = buildImportReportRows(rows(), enrichment());
    expect(built).toHaveLength(4);
    expect(built[0]["Source Row"]).toBe("1");
    expect(Object.keys(built[0])).toEqual([
      "Source Row",
      "Client Name",
      "Client Type",
      "Email",
      "Phone",
      "Outcome",
      "Reason",
      "Created Client ID",
      "Duplicate/Review Information",
    ]);
  });

  it("enriches only successful (client_id-bearing) rows from the live clients table - never fabricates it for others", () => {
    const built = buildImportReportRows(rows(), enrichment());
    expect(built[0].Email).toBe("jane@example.test");
    expect(built[0].Phone).toBe("0821234567");
    expect(built[0]["Client Type"]).toBe("individual");

    expect(built[1].Email).toBe("");
    expect(built[2].Email).toBe("");
    expect(built[3].Email).toBe("");
  });

  it("issuesOnly excludes imported rows and keeps everything else", () => {
    const built = buildImportReportRows(rows(), enrichment(), { issuesOnly: true });
    expect(built).toHaveLength(3);
    expect(built.map((r) => r["Source Row"])).toEqual(["2", "3", "4"]);
  });

  it("issuesOnly on an all-clean batch yields zero rows (empty issues report)", () => {
    const cleanRows = rows().filter((r) => r.status === "imported");
    const built = buildImportReportRows(cleanRows, enrichment(), { issuesOnly: true });
    expect(built).toHaveLength(0);
  });

  it("handles an empty rows array without throwing", () => {
    expect(buildImportReportRows([], {})).toEqual([]);
  });

  it("uses the human label for outcome, not the raw status code", () => {
    const built = buildImportReportRows(rows(), enrichment());
    expect(built[0].Outcome).toBe("Imported");
    expect(built[2].Outcome).toBe("Blocked — duplicate");
  });

  it("does not crash on an unrecognised status and labels it clearly instead", () => {
    const built = buildImportReportRows(
      [{ row_number: 9, status: "some_future_status", client_id: null, client_name: "X", reason: null, duplicate_reason: null }],
      {},
    );
    expect(built[0].Outcome).toContain("Unrecognised status");
  });

  // PR8: a blocked/skipped/failed row's client_name/reason/duplicate_reason
  // can echo raw text straight from an uploaded (attacker-controllable) CSV
  // row that was never inserted into the DB - this is the one place that
  // text can still reach an exported spreadsheet cell unvalidated.
  it("neutralizes formula-injection attempts in client_name/reason/duplicate_reason", () => {
    const built = buildImportReportRows(
      [{
        row_number: 5,
        status: "blocked_validation",
        client_id: null,
        client_name: "=cmd|'/c calc'!A1",
        reason: "+HYPERLINK(\"http://evil.test\")",
        duplicate_reason: "@SUM(1,2)",
      }],
      {},
    );
    expect(built[0]["Client Name"]).toBe("'=cmd|'/c calc'!A1");
    expect(built[0].Reason).toBe("'+HYPERLINK(\"http://evil.test\")");
    expect(built[0]["Duplicate/Review Information"]).toBe("'@SUM(1,2)");
  });
});
