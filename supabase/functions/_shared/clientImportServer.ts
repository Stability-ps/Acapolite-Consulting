// Server-side (Deno) re-implementation of the validation/duplicate rules in
// src/lib/clientImportPreview.ts. Deliberately not literally shared with the
// frontend module (different runtimes/module resolution - the frontend
// module is Vite/`@/`-aliased, this one is a plain relative-import Deno
// module) but MUST stay behaviourally in sync; if one changes, check the
// other. The server never trusts the browser's preview verdict - every rule
// here re-runs fresh, against the current DB, at import time.

export const ALLOWED_CLIENT_FIELDS = [
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

export type ClientField = (typeof ALLOWED_CLIENT_FIELDS)[number];

const ALLOWED_FIELD_SET = new Set<string>(ALLOWED_CLIENT_FIELDS);
const VALID_CLIENT_TYPES = new Set(["individual", "company", "trust", "npo"]);
const SA_ID_NUMBER_LENGTH = 13;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MappedClientData = Record<ClientField, string>;

// Strips any key that isn't an explicitly supported client field - this is
// the security boundary (spec: "never rely on the frontend mapper for
// security"). A submitted row containing password/role/profile_id/
// created_by/anything else simply never reaches this object.
export function sanitizeMappedRow(raw: Record<string, unknown>): MappedClientData {
  const clean = {} as MappedClientData;
  for (const field of ALLOWED_CLIENT_FIELDS) {
    const value = raw[field];
    clean[field] = typeof value === "string" ? value.trim() : "";
  }
  return clean;
}

export function hasDisallowedFields(raw: Record<string, unknown>): string[] {
  return Object.keys(raw).filter((key) => !ALLOWED_FIELD_SET.has(key));
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export function normalizeIdentifier(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export type FieldIssue = { field: string; message: string };
export type RowValidation = { errors: FieldIssue[]; warnings: FieldIssue[] };

export function validateRow(data: MappedClientData): RowValidation {
  const errors: FieldIssue[] = [];
  const warnings: FieldIssue[] = [];

  const rawType = data.client_type.trim();
  const resolvedType = rawType ? rawType.toLowerCase() : "individual";
  if (rawType && !VALID_CLIENT_TYPES.has(resolvedType)) {
    errors.push({ field: "client_type", message: `"${rawType}" is not a valid client type.` });
  }

  const isOrganisation = resolvedType === "company" || resolvedType === "trust" || resolvedType === "npo";
  const hasPersonName = Boolean(data.first_name.trim() || data.last_name.trim());
  const hasCompanyName = Boolean(data.company_name.trim());
  if (isOrganisation && !hasCompanyName) {
    warnings.push({ field: "company_name", message: "No company/organisation name provided." });
  } else if (!isOrganisation && !hasPersonName) {
    warnings.push({ field: "first_name", message: "No first or last name provided." });
  }

  const email = data.email.trim();
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.push({ field: "email", message: `"${email}" is not a valid email address.` });
  }

  const idNumber = data.id_number.trim();
  if (!isOrganisation && idNumber && digitsOnly(idNumber).length !== SA_ID_NUMBER_LENGTH) {
    errors.push({ field: "id_number", message: "ID number must be exactly 13 digits." });
  }

  const debt = data.sars_outstanding_debt.trim();
  if (debt && Number.isNaN(Number(debt))) {
    errors.push({ field: "sars_outstanding_debt", message: `"${debt}" is not a number.` });
  }

  return { errors, warnings };
}

export function resolvedClientType(data: MappedClientData): string {
  const raw = data.client_type.trim().toLowerCase();
  return VALID_CLIENT_TYPES.has(raw) ? raw : "individual";
}

// ---------------------------------------------------------------------------
// Duplicate detection - identical field hierarchy/severity to the frontend
// preview, plus the one server-only addition: client_code is flagged as
// "unique" (a real DB constraint, not just a business signal) so the caller
// can refuse to let Import Anyway override it.
// ---------------------------------------------------------------------------

const STRONG_IDENTIFIER_FIELDS: { key: ClientField; label: string; normalize: (v: string) => string; unique?: boolean }[] = [
  { key: "email", label: "Email", normalize: normalizeEmail },
  { key: "vat_number", label: "VAT Number", normalize: normalizeIdentifier },
  { key: "tax_number", label: "Income Tax Number", normalize: normalizeIdentifier },
  { key: "sars_reference_number", label: "SARS Reference Number", normalize: normalizeIdentifier },
  { key: "company_registration_number", label: "Company Registration Number", normalize: normalizeIdentifier },
  { key: "client_code", label: "Client Code", normalize: normalizeIdentifier, unique: true },
];

export type DuplicateSeverity = "exact" | "likely" | "possible";

export type DuplicateMatch = {
  severity: DuplicateSeverity;
  field: string;
  fieldLabel: string;
  value: string;
  reason: string;
  matchedClientId: string;
  isUniqueConstraint: boolean;
};

export type ExistingClientRecord = {
  id: string;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
  tax_number: string | null;
  sars_reference_number: string | null;
  company_registration_number: string | null;
  client_code: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};

function candidateName(data: { first_name: string | null; last_name: string | null; company_name: string | null }): string {
  return normalizeName(data.company_name || [data.first_name, data.last_name].filter(Boolean).join(" "));
}

export function matchAgainstExistingClients(data: MappedClientData, existingClients: ExistingClientRecord[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const field of STRONG_IDENTIFIER_FIELDS) {
    const rawValue = data[field.key].trim();
    if (!rawValue) continue;
    const normalized = field.normalize(rawValue);
    const existing = existingClients.find((client) => {
      const existingValue = (client[field.key as keyof ExistingClientRecord] as string | null) ?? "";
      return existingValue && field.normalize(existingValue) === normalized;
    });
    if (existing) {
      matches.push({
        severity: "exact",
        field: field.key,
        fieldLabel: field.label,
        value: rawValue,
        reason: `Existing client matched by ${field.label}: ${rawValue}`,
        matchedClientId: existing.id,
        isUniqueConstraint: Boolean(field.unique),
      });
    }
  }

  const normalizedPhone = normalizePhone(data.phone);
  if (normalizedPhone) {
    const existing = existingClients.find((client) => client.phone && normalizePhone(client.phone) === normalizedPhone);
    if (existing) {
      matches.push({
        severity: "likely",
        field: "phone",
        fieldLabel: "Mobile Number",
        value: data.phone.trim(),
        reason: `Likely existing client: matching phone number ${data.phone.trim()}`,
        matchedClientId: existing.id,
        isUniqueConstraint: false,
      });
    }
  }

  const name = candidateName(data);
  if (name && !matches.length) {
    const existing = existingClients.find((client) => candidateName(client) === name);
    if (existing) {
      matches.push({
        severity: "possible",
        field: data.company_name.trim() ? "company_name" : "first_name",
        fieldLabel: data.company_name.trim() ? "Company Name" : "Name",
        value: name,
        reason: `Possible duplicate: same name as an existing client (${name})`,
        matchedClientId: existing.id,
        isUniqueConstraint: false,
      });
    }
  }

  return matches;
}

// Duplicates within the same submitted batch (mirrors PR5's in-file check,
// re-run here against the rows actually submitted for import, not the
// original upload - a row skipped by the user should not "claim" an
// identifier for the purposes of this check).
export function matchWithinBatch(rows: MappedClientData[]): DuplicateMatch[][] {
  const matchesByRow: DuplicateMatch[][] = rows.map(() => []);

  for (const field of STRONG_IDENTIFIER_FIELDS) {
    const seenAt = new Map<string, number>();
    rows.forEach((row, index) => {
      const rawValue = row[field.key].trim();
      if (!rawValue) return;
      const normalized = field.normalize(rawValue);
      const firstSeenIndex = seenAt.get(normalized);
      if (firstSeenIndex === undefined) {
        seenAt.set(normalized, index);
        return;
      }
      matchesByRow[index].push({
        severity: "exact",
        field: field.key,
        fieldLabel: field.label,
        value: rawValue,
        reason: `Duplicates another row in this same import by ${field.label}`,
        matchedClientId: "",
        isUniqueConstraint: Boolean(field.unique),
      });
    });
  }

  return matchesByRow;
}

export function matchPortalAccount(data: MappedClientData, existingProfileEmails: Set<string>): boolean {
  const email = normalizeEmail(data.email);
  return Boolean(email) && existingProfileEmails.has(email);
}

// ---------------------------------------------------------------------------
// Final per-row outcome
// ---------------------------------------------------------------------------

export type UserAction = "import" | "skip" | "import_anyway";

export type RowOutcomeStatus =
  | "proceed_import"
  | "skipped_user"
  | "blocked_validation"
  | "blocked_duplicate_changed"
  | "blocked_portal_collision";

export type RowOutcome = {
  status: RowOutcomeStatus;
  reason: string | null;
  duplicateReason: string | null;
  matchedClientIds: string[];
};

export function resolveRowOutcome(params: {
  userAction: UserAction;
  validation: RowValidation;
  duplicates: DuplicateMatch[];
  hasPortalCollision: boolean;
}): RowOutcome {
  const { userAction, validation, duplicates, hasPortalCollision } = params;

  if (userAction === "skip") {
    return { status: "skipped_user", reason: "Skipped by staff.", duplicateReason: null, matchedClientIds: [] };
  }

  if (validation.errors.length > 0) {
    return {
      status: "blocked_validation",
      reason: validation.errors.map((e) => e.message).join(" "),
      duplicateReason: null,
      matchedClientIds: [],
    };
  }

  if (hasPortalCollision) {
    return {
      status: "blocked_portal_collision",
      reason: "Portal account already exists for this email — review required.",
      duplicateReason: null,
      matchedClientIds: [],
    };
  }

  const strongDuplicate = duplicates.find((match) => match.severity === "exact" || match.severity === "likely");

  if (strongDuplicate) {
    if (strongDuplicate.isUniqueConstraint) {
      return {
        status: "blocked_validation",
        reason: `${strongDuplicate.fieldLabel} "${strongDuplicate.value}" already exists and cannot be overridden (this field must be unique).`,
        duplicateReason: strongDuplicate.reason,
        matchedClientIds: strongDuplicate.matchedClientId ? [strongDuplicate.matchedClientId] : [],
      };
    }

    if (userAction === "import_anyway") {
      return {
        status: "proceed_import",
        reason: null,
        duplicateReason: duplicates.map((d) => d.reason).join(" | "),
        matchedClientIds: [...new Set(duplicates.map((d) => d.matchedClientId).filter(Boolean))],
      };
    }

    return {
      status: "blocked_duplicate_changed",
      reason: strongDuplicate.reason,
      duplicateReason: strongDuplicate.reason,
      matchedClientIds: strongDuplicate.matchedClientId ? [strongDuplicate.matchedClientId] : [],
    };
  }

  return { status: "proceed_import", reason: null, duplicateReason: null, matchedClientIds: [] };
}

export function clientDisplayName(data: MappedClientData): string {
  return data.company_name.trim()
    || [data.first_name.trim(), data.last_name.trim()].filter(Boolean).join(" ")
    || data.client_code.trim()
    || "Client";
}

export function parseReturnsFiled(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1";
}

function textOrNull(value: string): string | null {
  return value.trim() || null;
}

// The only place profile_id/created_by are set - never taken from the
// submitted row (sanitizeMappedRow already strips them if present, this is
// the second, independent guarantee that they can never leak through).
export function buildClientInsertPayload(mapped: MappedClientData, actorProfileId: string) {
  const email = textOrNull(mapped.email);
  return {
    profile_id: null,
    created_by: actorProfileId,
    client_type: resolvedClientType(mapped),
    first_name: textOrNull(mapped.first_name),
    last_name: textOrNull(mapped.last_name),
    company_name: textOrNull(mapped.company_name),
    company_registration_number: textOrNull(mapped.company_registration_number),
    id_number: textOrNull(mapped.id_number),
    tax_number: textOrNull(mapped.tax_number),
    sars_reference_number: textOrNull(mapped.sars_reference_number),
    vat_number: textOrNull(mapped.vat_number),
    email: email ? normalizeEmail(email) : null,
    phone: textOrNull(mapped.phone),
    address_line_1: textOrNull(mapped.address_line_1),
    address_line_2: textOrNull(mapped.address_line_2),
    city: textOrNull(mapped.city),
    province: textOrNull(mapped.province),
    postal_code: textOrNull(mapped.postal_code),
    country: textOrNull(mapped.country) || "South Africa",
    notes: textOrNull(mapped.notes),
    client_code: textOrNull(mapped.client_code),
    returns_filed: parseReturnsFiled(mapped.returns_filed),
    sars_outstanding_debt: Number(mapped.sars_outstanding_debt || 0),
  };
}
