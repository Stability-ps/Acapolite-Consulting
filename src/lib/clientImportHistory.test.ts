import { describe, expect, it } from "vitest";
import {
  canViewImportHistory,
  isIssueRow,
  outcomeBucket,
  reconcileBatchCounts,
  resolveRowClientLink,
  rowStatusLabel,
  sortBatchesNewestFirst,
  type ImportBatchSummary,
} from "./clientImportHistory";

function batch(overrides: Partial<ImportBatchSummary> = {}): ImportBatchSummary {
  return {
    id: "batch-1",
    status: "completed",
    source_filename: "clients.csv",
    total_rows: 3,
    imported_count: 1,
    skipped_count: 1,
    blocked_count: 1,
    failed_count: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    completed_at: "2026-01-01T00:01:00.000Z",
    actor_profile_id: "actor-1",
    actor_name: "Jane Staff",
    actor_email: "jane@example.test",
    ...overrides,
  };
}

describe("outcomeBucket", () => {
  it("maps every known edge-function status to the right bucket", () => {
    expect(outcomeBucket("imported")).toBe("imported");
    expect(outcomeBucket("skipped_user")).toBe("skipped");
    expect(outcomeBucket("blocked_validation")).toBe("blocked");
    expect(outcomeBucket("blocked_duplicate_changed")).toBe("blocked");
    expect(outcomeBucket("blocked_portal_collision")).toBe("blocked");
    expect(outcomeBucket("failed")).toBe("failed");
  });

  it("degrades unrecognised/malformed status values to 'unknown' instead of throwing", () => {
    expect(outcomeBucket("something_new_from_a_future_pr")).toBe("unknown");
    expect(outcomeBucket("")).toBe("unknown");
  });
});

describe("isIssueRow", () => {
  it("is false only for imported, true for everything else including unknown", () => {
    expect(isIssueRow("imported")).toBe(false);
    expect(isIssueRow("skipped_user")).toBe(true);
    expect(isIssueRow("failed")).toBe(true);
    expect(isIssueRow("garbage")).toBe(true);
  });
});

describe("rowStatusLabel", () => {
  it("labels known statuses and flags unknown ones instead of showing a raw code", () => {
    expect(rowStatusLabel("imported")).toBe("Imported");
    expect(rowStatusLabel("mystery_status")).toContain("Unrecognised status");
  });
});

describe("sortBatchesNewestFirst", () => {
  it("sorts by created_at descending without mutating the input array", () => {
    const older = batch({ id: "b-old", created_at: "2026-01-01T00:00:00.000Z" });
    const newer = batch({ id: "b-new", created_at: "2026-02-01T00:00:00.000Z" });
    const input = [older, newer];
    const sorted = sortBatchesNewestFirst(input);

    expect(sorted.map((b) => b.id)).toEqual(["b-new", "b-old"]);
    expect(input.map((b) => b.id)).toEqual(["b-old", "b-new"]);
  });
});

describe("reconcileBatchCounts", () => {
  it("is consistent when stored counts exactly match row-level statuses", () => {
    const rows = [{ status: "imported" }, { status: "skipped_user" }, { status: "blocked_validation" }];
    const result = reconcileBatchCounts(batch(), rows);
    expect(result.consistent).toBe(true);
    expect(result.mismatches).toHaveLength(0);
    expect(result.actual).toEqual({ imported: 1, skipped: 1, blocked: 1, failed: 0, unknown: 0 });
  });

  it("flags a mismatch instead of silently trusting the stored summary", () => {
    const rows = [{ status: "imported" }, { status: "imported" }, { status: "blocked_validation" }];
    const result = reconcileBatchCounts(batch({ imported_count: 1, skipped_count: 1, blocked_count: 1 }), rows);
    expect(result.consistent).toBe(false);
    expect(result.mismatches.some((m) => m.includes("Imported count mismatch"))).toBe(true);
    expect(result.mismatches.some((m) => m.includes("Skipped count mismatch"))).toBe(true);
  });

  it("flags an unrecognised row status rather than fabricating a bucket for it", () => {
    const rows = [{ status: "imported" }, { status: "some_new_status" }];
    const result = reconcileBatchCounts(batch({ total_rows: 2, imported_count: 1, skipped_count: 0, blocked_count: 1, failed_count: 0 }), rows);
    expect(result.actual.unknown).toBe(1);
    expect(result.mismatches.some((m) => m.includes("doesn't recognise"))).toBe(true);
  });
});

describe("resolveRowClientLink", () => {
  it("links a row that has a live client_id", () => {
    expect(resolveRowClientLink({ status: "imported", client_id: "c1", client_name: "Jane" })).toEqual({ hasLink: true, label: "Open" });
  });

  it("shows 'client no longer exists' for an imported row whose client was since deleted (client_id nulled by ON DELETE SET NULL)", () => {
    expect(resolveRowClientLink({ status: "imported", client_id: null, client_name: "Jane" })).toEqual({
      hasLink: false,
      label: "Client no longer exists",
    });
  });

  it("shows a plain dash for a non-imported row with no client_id", () => {
    expect(resolveRowClientLink({ status: "skipped_user", client_id: null, client_name: "Jane" })).toEqual({ hasLink: false, label: "—" });
  });
});

describe("canViewImportHistory", () => {
  it("always allows admin", () => {
    expect(canViewImportHistory("admin", false)).toBe(true);
    expect(canViewImportHistory("admin", true)).toBe(true);
  });

  it("gates consultant on can_import_clients", () => {
    expect(canViewImportHistory("consultant", true)).toBe(true);
    expect(canViewImportHistory("consultant", false)).toBe(false);
  });

  it("never allows a client/portal role", () => {
    expect(canViewImportHistory("client", true)).toBe(false);
    expect(canViewImportHistory(null, true)).toBe(false);
    expect(canViewImportHistory(undefined, true)).toBe(false);
  });
});
