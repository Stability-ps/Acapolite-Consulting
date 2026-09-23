import { assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildClientInsertPayload,
  clientDisplayName,
  hasDisallowedFields,
  matchAgainstExistingClients,
  matchPortalAccount,
  matchWithinBatch,
  parseReturnsFiled,
  resolveRowOutcome,
  sanitizeMappedRow,
  validateRow,
  type ExistingClientRecord,
  type MappedClientData,
} from "./clientImportServer.ts";

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

Deno.test("sanitizeMappedRow drops every field not on the allowlist", () => {
  const raw = {
    first_name: "Jane",
    email: "jane@example.com",
    password: "s3cret",
    password_hash: "x",
    encrypted_password: "x",
    auth_token: "x",
    role: "admin",
    permissions: { can_manage_clients: true },
    profile_id: "some-uuid",
    created_by: "some-uuid",
    id: "some-uuid",
  };

  const clean = sanitizeMappedRow(raw);

  assertEquals(clean.first_name, "Jane");
  assertEquals(clean.email, "jane@example.com");
  assertFalse("password" in clean);
  assertFalse("password_hash" in clean);
  assertFalse("encrypted_password" in clean);
  assertFalse("auth_token" in clean);
  assertFalse("role" in clean);
  assertFalse("permissions" in clean);
  assertFalse("profile_id" in clean);
  assertFalse("created_by" in clean);
  assertFalse("id" in clean);
});

Deno.test("sanitizeMappedRow coerces non-string values on allowlisted keys to empty string", () => {
  const clean = sanitizeMappedRow({ first_name: 123, returns_filed: true });
  assertEquals(clean.first_name, "");
  assertEquals(clean.returns_filed, "");
});

Deno.test("hasDisallowedFields reports exactly the non-allowlisted keys", () => {
  const disallowed = hasDisallowedFields({ first_name: "Jane", password: "x", role: "admin" });
  assertEquals(disallowed.sort(), ["password", "role"]);
});

Deno.test("validateRow accepts a clean minimal row", () => {
  const result = validateRow(baseRow({ first_name: "Jane", last_name: "Doe" }));
  assertEquals(result.errors.length, 0);
});

for (const type of ["individual", "company", "trust", "npo"]) {
  Deno.test(`validateRow accepts client_type "${type}"`, () => {
    const result = validateRow(baseRow({ client_type: type, first_name: "Jane", company_name: "Acme" }));
    assertEquals(result.errors.length, 0);
  });
}

Deno.test("validateRow rejects an unrecognised client_type", () => {
  const result = validateRow(baseRow({ client_type: "not-a-type" }));
  assertEquals(result.errors.length, 1);
  assertEquals(result.errors[0].field, "client_type");
});

Deno.test("validateRow treats email as optional but validates format when supplied", () => {
  assertEquals(validateRow(baseRow()).errors.length, 0);
  const invalid = validateRow(baseRow({ email: "not-an-email" }));
  assertEquals(invalid.errors.length, 1);
  assertEquals(invalid.errors[0].field, "email");
});

Deno.test("validateRow enforces 13-digit SA ID numbers for individuals only", () => {
  const badIndividual = validateRow(baseRow({ client_type: "individual", id_number: "12345" }));
  assertEquals(badIndividual.errors.length, 1);

  const orgWithShortId = validateRow(baseRow({ client_type: "company", company_name: "Acme", id_number: "12345" }));
  assertEquals(orgWithShortId.errors.length, 0);

  const goodIndividual = validateRow(baseRow({ client_type: "individual", id_number: "8001015009087" }));
  assertEquals(goodIndividual.errors.length, 0);
});

Deno.test("matchAgainstExistingClients: exact email match", () => {
  const existing = [existingClient({ id: "c1", email: "jane@example.com" })];
  const matches = matchAgainstExistingClients(baseRow({ email: "Jane@Example.com" }), existing);
  assertEquals(matches.length, 1);
  assertEquals(matches[0].severity, "exact");
  assertEquals(matches[0].matchedClientId, "c1");
});

Deno.test("matchAgainstExistingClients: client_code duplicate is flagged as a unique constraint", () => {
  const existing = [existingClient({ id: "c1", client_code: "CL-001" })];
  const matches = matchAgainstExistingClients(baseRow({ client_code: "cl-001" }), existing);
  assertEquals(matches.length, 1);
  assertEquals(matches[0].isUniqueConstraint, true);
});

Deno.test("matchAgainstExistingClients: VAT and email duplicates are NOT flagged as unique constraints", () => {
  const existing = [existingClient({ id: "c1", vat_number: "4123456789", email: "jane@example.com" })];
  const vatMatch = matchAgainstExistingClients(baseRow({ vat_number: "4123456789" }), existing);
  const emailMatch = matchAgainstExistingClients(baseRow({ email: "jane@example.com" }), existing);
  assertEquals(vatMatch[0].isUniqueConstraint, false);
  assertEquals(emailMatch[0].isUniqueConstraint, false);
});

Deno.test("matchAgainstExistingClients: name-only match is possible, never exact", () => {
  const existing = [existingClient({ id: "c1", first_name: "Jane", last_name: "Doe" })];
  const matches = matchAgainstExistingClients(baseRow({ first_name: "Jane", last_name: "Doe" }), existing);
  assertEquals(matches.length, 1);
  assertEquals(matches[0].severity, "possible");
});

Deno.test("matchWithinBatch flags the second occurrence of a repeated identifier", () => {
  const rows = [baseRow({ email: "a@example.com" }), baseRow({ email: "b@example.com" }), baseRow({ email: "a@example.com" })];
  const matches = matchWithinBatch(rows);
  assertEquals(matches[0].length, 0);
  assertEquals(matches[1].length, 0);
  assertEquals(matches[2].length, 1);
  assertEquals(matches[2][0].field, "email");
});

Deno.test("matchPortalAccount: true only for a matching, non-empty email", () => {
  const emails = new Set(["jane@example.com"]);
  assertEquals(matchPortalAccount(baseRow({ email: "Jane@Example.com" }), emails), true);
  assertEquals(matchPortalAccount(baseRow({ email: "other@example.com" }), emails), false);
  assertEquals(matchPortalAccount(baseRow(), emails), false);
});

Deno.test("resolveRowOutcome: clean row proceeds to import", () => {
  const outcome = resolveRowOutcome({
    userAction: "import",
    validation: { errors: [], warnings: [] },
    duplicates: [],
    hasPortalCollision: false,
  });
  assertEquals(outcome.status, "proceed_import");
});

Deno.test("resolveRowOutcome: explicit skip is always respected", () => {
  const outcome = resolveRowOutcome({
    userAction: "skip",
    validation: { errors: [{ field: "email", message: "bad" }], warnings: [] },
    duplicates: [],
    hasPortalCollision: true,
  });
  assertEquals(outcome.status, "skipped_user");
});

Deno.test("resolveRowOutcome: validation errors block even on import_anyway", () => {
  const outcome = resolveRowOutcome({
    userAction: "import_anyway",
    validation: { errors: [{ field: "email", message: "bad" }], warnings: [] },
    duplicates: [],
    hasPortalCollision: false,
  });
  assertEquals(outcome.status, "blocked_validation");
});

Deno.test("resolveRowOutcome: portal collision blocks even on import_anyway", () => {
  const outcome = resolveRowOutcome({
    userAction: "import_anyway",
    validation: { errors: [], warnings: [] },
    duplicates: [],
    hasPortalCollision: true,
  });
  assertEquals(outcome.status, "blocked_portal_collision");
});

Deno.test("resolveRowOutcome: plain import on a fresh duplicate is blocked as changed-since-preview", () => {
  const outcome = resolveRowOutcome({
    userAction: "import",
    validation: { errors: [], warnings: [] },
    duplicates: [{ severity: "exact", field: "email", fieldLabel: "Email", value: "jane@example.com", reason: "dup", matchedClientId: "c1", isUniqueConstraint: false }],
    hasPortalCollision: false,
  });
  assertEquals(outcome.status, "blocked_duplicate_changed");
});

Deno.test("resolveRowOutcome: import_anyway proceeds for a non-unique duplicate", () => {
  const outcome = resolveRowOutcome({
    userAction: "import_anyway",
    validation: { errors: [], warnings: [] },
    duplicates: [{ severity: "exact", field: "email", fieldLabel: "Email", value: "jane@example.com", reason: "dup", matchedClientId: "c1", isUniqueConstraint: false }],
    hasPortalCollision: false,
  });
  assertEquals(outcome.status, "proceed_import");
  assertEquals(outcome.matchedClientIds, ["c1"]);
});

Deno.test("resolveRowOutcome: import_anyway on a client_code duplicate is still blocked (cannot override a real UNIQUE constraint)", () => {
  const outcome = resolveRowOutcome({
    userAction: "import_anyway",
    validation: { errors: [], warnings: [] },
    duplicates: [{ severity: "exact", field: "client_code", fieldLabel: "Client Code", value: "CL-001", reason: "dup", matchedClientId: "c1", isUniqueConstraint: true }],
    hasPortalCollision: false,
  });
  assertEquals(outcome.status, "blocked_validation");
  assertEquals(outcome.reason?.includes("cannot be overridden"), true);
});

Deno.test("resolveRowOutcome: a possible (name-only) duplicate does not block a plain import", () => {
  const outcome = resolveRowOutcome({
    userAction: "import",
    validation: { errors: [], warnings: [] },
    duplicates: [{ severity: "possible", field: "first_name", fieldLabel: "Name", value: "Jane Doe", reason: "dup", matchedClientId: "c1", isUniqueConstraint: false }],
    hasPortalCollision: false,
  });
  assertEquals(outcome.status, "proceed_import");
});

Deno.test("clientDisplayName: falls back company -> person -> client_code -> Client", () => {
  assertEquals(clientDisplayName(baseRow({ company_name: "Acme" })), "Acme");
  assertEquals(clientDisplayName(baseRow({ first_name: "Jane", last_name: "Doe" })), "Jane Doe");
  assertEquals(clientDisplayName(baseRow({ client_code: "CL-001" })), "CL-001");
  assertEquals(clientDisplayName(baseRow()), "Client");
});

Deno.test("parseReturnsFiled recognises yes/true/1 case-insensitively, else false", () => {
  assertEquals(parseReturnsFiled("Yes"), true);
  assertEquals(parseReturnsFiled("true"), true);
  assertEquals(parseReturnsFiled("1"), true);
  assertEquals(parseReturnsFiled("no"), false);
  assertEquals(parseReturnsFiled(""), false);
});

Deno.test("buildClientInsertPayload: profile_id is always null, created_by is always the actor", () => {
  const payload = buildClientInsertPayload(baseRow({ first_name: "Jane" }), "actor-1");
  assertEquals(payload.profile_id, null);
  assertEquals(payload.created_by, "actor-1");
});

Deno.test("buildClientInsertPayload: email is trimmed/lowercased, blank fields become null", () => {
  const payload = buildClientInsertPayload(baseRow({ email: "  Jane@Example.com  ", notes: "" }), "actor-1");
  assertEquals(payload.email, "jane@example.com");
  assertEquals(payload.notes, null);
});

Deno.test("buildClientInsertPayload: client_type defaults to individual, country defaults to South Africa", () => {
  const payload = buildClientInsertPayload(baseRow(), "actor-1");
  assertEquals(payload.client_type, "individual");
  assertEquals(payload.country, "South Africa");
});
