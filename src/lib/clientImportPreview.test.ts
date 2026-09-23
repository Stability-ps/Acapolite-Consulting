import { describe, expect, it } from "vitest";
import {
  buildPreviewRows,
  canOverrideRowAction,
  clientDisplayName,
  defaultRowAction,
  matchAgainstExistingClients,
  matchPortalAccount,
  matchWithinBatch,
  summarizeRowActions,
  validateRow,
  type ExistingClientRecord,
  type MappedClientData,
  type PreviewRow,
  type PreviewRowStatus,
  type UserAction,
} from "./clientImportPreview";

function baseRow(overrides: Partial<MappedClientData> = {}): MappedClientData {
  return {
    client_type: "",
    first_name: "",
    last_name: "",
    company_name: "",
    company_registration_number: "",
    id_number: "",
    tax_number: "",
    sars_reference_number: "",
    vat_number: "",
    email: "",
    phone: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    province: "",
    postal_code: "",
    country: "",
    notes: "",
    client_code: "",
    returns_filed: "",
    sars_outstanding_debt: "",
    ...overrides,
  };
}

function existingClient(overrides: Partial<ExistingClientRecord> = {}): ExistingClientRecord {
  return {
    id: "existing-1",
    email: null,
    phone: null,
    vat_number: null,
    tax_number: null,
    sars_reference_number: null,
    company_registration_number: null,
    client_code: null,
    first_name: null,
    last_name: null,
    company_name: null,
    ...overrides,
  };
}

function makePreviewRow(rowNumber: number, status: PreviewRowStatus): PreviewRow {
  return {
    rowNumber,
    mapped: baseRow(),
    displayName: `Row ${rowNumber}`,
    status,
    validation: { errors: status === "invalid" ? [{ field: "email", message: "bad" }] : [], warnings: [] },
    duplicates: [],
    hasPortalCollision: status === "existing_portal",
  };
}

describe("validateRow", () => {
  it("accepts a clean minimal row", () => {
    expect(validateRow(baseRow({ first_name: "Jane", last_name: "Doe" })).errors).toHaveLength(0);
  });

  it("rejects an unrecognised client_type", () => {
    const result = validateRow(baseRow({ client_type: "not-a-type" }));
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe("client_type");
  });

  it("treats email as optional but validates format when supplied", () => {
    expect(validateRow(baseRow()).errors).toHaveLength(0);
    expect(validateRow(baseRow({ email: "not-an-email" })).errors).toHaveLength(1);
  });

  it("enforces 13-digit SA ID numbers for individuals only", () => {
    expect(validateRow(baseRow({ client_type: "individual", id_number: "12345" })).errors).toHaveLength(1);
    expect(validateRow(baseRow({ client_type: "company", company_name: "Acme", id_number: "12345" })).errors).toHaveLength(0);
  });
});

describe("matchAgainstExistingClients", () => {
  it("finds an exact email match", () => {
    const matches = matchAgainstExistingClients(baseRow({ email: "Jane@Example.com" }), [existingClient({ id: "c1", email: "jane@example.com" })]);
    expect(matches).toHaveLength(1);
    expect(matches[0].severity).toBe("exact");
  });

  it("flags client_code as a unique-constraint duplicate", () => {
    const matches = matchAgainstExistingClients(baseRow({ client_code: "cl-001" }), [existingClient({ id: "c1", client_code: "CL-001" })]);
    expect(matches[0].isUniqueConstraint).toBe(true);
  });

  it("does not flag VAT or email duplicates as unique constraints", () => {
    const existing = [existingClient({ id: "c1", vat_number: "4123456789", email: "jane@example.com" })];
    expect(matchAgainstExistingClients(baseRow({ vat_number: "4123456789" }), existing)[0].isUniqueConstraint).toBe(false);
    expect(matchAgainstExistingClients(baseRow({ email: "jane@example.com" }), existing)[0].isUniqueConstraint).toBe(false);
  });

  it("treats a name-only match as possible, never exact", () => {
    const matches = matchAgainstExistingClients(
      baseRow({ first_name: "Jane", last_name: "Doe" }),
      [existingClient({ id: "c1", first_name: "Jane", last_name: "Doe" })],
    );
    expect(matches[0].severity).toBe("possible");
  });
});

describe("matchWithinBatch", () => {
  it("flags the second occurrence of a repeated identifier", () => {
    const matches = matchWithinBatch([baseRow({ email: "a@example.com" }), baseRow({ email: "b@example.com" }), baseRow({ email: "a@example.com" })]);
    expect(matches[0]).toHaveLength(0);
    expect(matches[2]).toHaveLength(1);
  });
});

describe("matchPortalAccount", () => {
  it("is true only for a matching, non-empty email", () => {
    const emails = new Set(["jane@example.com"]);
    expect(matchPortalAccount(baseRow({ email: "Jane@Example.com" }), emails)).toBe(true);
    expect(matchPortalAccount(baseRow({ email: "other@example.com" }), emails)).toBe(false);
    expect(matchPortalAccount(baseRow(), emails)).toBe(false);
  });
});

describe("clientDisplayName", () => {
  it("falls back company -> person -> client_code -> Client", () => {
    expect(clientDisplayName(baseRow({ company_name: "Acme" }))).toBe("Acme");
    expect(clientDisplayName(baseRow({ first_name: "Jane", last_name: "Doe" }))).toBe("Jane Doe");
    expect(clientDisplayName(baseRow({ client_code: "CL-001" }))).toBe("CL-001");
    expect(clientDisplayName(baseRow())).toBe("Client");
  });
});

describe("buildPreviewRows", () => {
  it("marks a clean row valid", () => {
    const rows = buildPreviewRows([baseRow({ first_name: "Jane", last_name: "Doe" })], [], new Set());
    expect(rows[0].status).toBe("valid");
  });

  it("marks a validation failure invalid", () => {
    const rows = buildPreviewRows([baseRow({ email: "not-an-email" })], [], new Set());
    expect(rows[0].status).toBe("invalid");
  });

  it("marks an existing-portal-account email as existing_portal", () => {
    const rows = buildPreviewRows([baseRow({ email: "jane@example.com" })], [], new Set(["jane@example.com"]));
    expect(rows[0].status).toBe("existing_portal");
  });

  it("marks a non-unique duplicate against an existing client as review_duplicate", () => {
    const rows = buildPreviewRows(
      [baseRow({ email: "jane@example.com" })],
      [existingClient({ id: "c1", email: "jane@example.com" })],
      new Set(),
    );
    expect(rows[0].status).toBe("review_duplicate");
  });

  it("marks a client_code duplicate as invalid (cannot be overridden)", () => {
    const rows = buildPreviewRows(
      [baseRow({ client_code: "CL-001" })],
      [existingClient({ id: "c1", client_code: "CL-001" })],
      new Set(),
    );
    expect(rows[0].status).toBe("invalid");
  });

  it("flags within-batch duplicates the same way as existing-client duplicates", () => {
    const rows = buildPreviewRows(
      [baseRow({ email: "a@example.com" }), baseRow({ email: "a@example.com" })],
      [],
      new Set(),
    );
    expect(rows[0].status).toBe("valid");
    expect(rows[1].status).toBe("review_duplicate");
  });

  it("numbers rows sequentially starting at 1", () => {
    const rows = buildPreviewRows([baseRow(), baseRow(), baseRow()], [], new Set());
    expect(rows.map((r) => r.rowNumber)).toEqual([1, 2, 3]);
  });
});

describe("defaultRowAction / canOverrideRowAction", () => {
  it("defaults review_duplicate, existing_portal, and invalid to skip", () => {
    expect(defaultRowAction("review_duplicate")).toBe("skip");
    expect(defaultRowAction("existing_portal")).toBe("skip");
    expect(defaultRowAction("invalid")).toBe("skip");
  });

  it("defaults valid to import", () => {
    expect(defaultRowAction("valid")).toBe("import");
  });

  it("only review_duplicate can be overridden", () => {
    expect(canOverrideRowAction("review_duplicate")).toBe(true);
    expect(canOverrideRowAction("existing_portal")).toBe(false);
    expect(canOverrideRowAction("invalid")).toBe(false);
    expect(canOverrideRowAction("valid")).toBe(false);
  });
});

describe("summarizeRowActions", () => {
  it("counts a mix of statuses and actions correctly", () => {
    const rows = [
      makePreviewRow(1, "valid"),
      makePreviewRow(2, "review_duplicate"),
      makePreviewRow(3, "review_duplicate"),
      makePreviewRow(4, "existing_portal"),
      makePreviewRow(5, "invalid"),
    ];
    const actions: Record<number, UserAction> = { 2: "import_anyway", 3: "skip" };

    const counts = summarizeRowActions(rows, actions);

    expect(counts.toImport).toBe(2); // row 1 (default import) + row 2 (import_anyway)
    expect(counts.toSkip).toBe(1); // row 3
    expect(counts.blocked).toBe(2); // rows 4 and 5, regardless of any action override
    expect(counts.forcedImportAnyway).toBe(1); // row 2
  });

  it("treats invalid/existing_portal as always blocked even if an action is present", () => {
    const rows = [makePreviewRow(1, "invalid")];
    const counts = summarizeRowActions(rows, { 1: "import_anyway" });
    expect(counts.blocked).toBe(1);
    expect(counts.toImport).toBe(0);
    expect(counts.forcedImportAnyway).toBe(0);
  });
});
