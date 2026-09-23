import { IMPORT_FIELD_KEYS, type ImportFieldKey } from "@/lib/clientImport";

// Dry-run validation/duplicate-detection for bulk client import (PR5), plus
// the per-row action bookkeeping added for the real-write step (PR6).
//
// This is deliberately NOT literally shared with
// supabase/functions/_shared/clientImportServer.ts - different runtimes
// (Vite/`@/`-aliased vs. a relative-import Deno module) - but the rules
// below MUST stay behaviourally in sync with that file. The server never
// trusts this preview's verdict: it re-runs the same checks fresh, against
// the current database, immediately before writing each row.

export type MappedClientData = Record<ImportFieldKey, string>;

const VALID_CLIENT_TYPES = new Set(["individual", "company", "trust", "npo"]);
const SA_ID_NUMBER_LENGTH = 13;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const STRONG_IDENTIFIER_FIELDS: { key: ImportFieldKey; label: string; normalize: (v: string) => string; unique?: boolean }[] = [
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

export function clientDisplayName(data: MappedClientData): string {
  return data.company_name.trim()
    || [data.first_name.trim(), data.last_name.trim()].filter(Boolean).join(" ")
    || data.client_code.trim()
    || "Client";
}

// ---------------------------------------------------------------------------
// Preview row status (dry-run, no user action chosen yet)
// ---------------------------------------------------------------------------

export type PreviewRowStatus = "valid" | "review_duplicate" | "existing_portal" | "invalid";

export type PreviewRow = {
  rowNumber: number;
  mapped: MappedClientData;
  displayName: string;
  status: PreviewRowStatus;
  validation: RowValidation;
  duplicates: DuplicateMatch[];
  hasPortalCollision: boolean;
};

function resolvePreviewStatus(params: {
  validation: RowValidation;
  duplicates: DuplicateMatch[];
  hasPortalCollision: boolean;
}): PreviewRowStatus {
  const { validation, duplicates, hasPortalCollision } = params;

  if (validation.errors.length > 0) return "invalid";
  if (hasPortalCollision) return "existing_portal";

  const strongDuplicate = duplicates.find((match) => match.severity === "exact" || match.severity === "likely");
  if (strongDuplicate) {
    return strongDuplicate.isUniqueConstraint ? "invalid" : "review_duplicate";
  }

  return "valid";
}

export function buildPreviewRows(
  mappedRows: MappedClientData[],
  existingClients: ExistingClientRecord[],
  existingProfileEmails: Set<string>,
): PreviewRow[] {
  const withinBatchMatches = matchWithinBatch(mappedRows);

  return mappedRows.map((mapped, index) => {
    const validation = validateRow(mapped);
    const duplicates = [...matchAgainstExistingClients(mapped, existingClients), ...withinBatchMatches[index]];
    const hasPortalCollision = matchPortalAccount(mapped, existingProfileEmails);

    return {
      rowNumber: index + 1,
      mapped,
      displayName: clientDisplayName(mapped),
      status: resolvePreviewStatus({ validation, duplicates, hasPortalCollision }),
      validation,
      duplicates,
      hasPortalCollision,
    };
  });
}

// ---------------------------------------------------------------------------
// Per-row action (PR6): what should happen to this row when the batch is
// actually submitted for writing.
// ---------------------------------------------------------------------------

export type UserAction = "import" | "skip" | "import_anyway";

export function defaultRowAction(status: PreviewRowStatus): UserAction {
  if (status === "review_duplicate" || status === "existing_portal" || status === "invalid") {
    return "skip";
  }
  return "import";
}

// Only a "review_duplicate" row can be pushed through anyway - a hard
// validation failure or an existing-portal-account collision is always
// forced to skip, never overridable from the UI.
export function canOverrideRowAction(status: PreviewRowStatus): boolean {
  return status === "review_duplicate";
}

export type ImportRowActionCounts = {
  toImport: number;
  toSkip: number;
  blocked: number;
  forcedImportAnyway: number;
};

export function summarizeRowActions(rows: PreviewRow[], actions: Record<number, UserAction>): ImportRowActionCounts {
  const counts: ImportRowActionCounts = { toImport: 0, toSkip: 0, blocked: 0, forcedImportAnyway: 0 };

  for (const row of rows) {
    if (row.status === "invalid" || row.status === "existing_portal") {
      counts.blocked += 1;
      continue;
    }

    const action = actions[row.rowNumber] ?? defaultRowAction(row.status);
    if (action === "skip") {
      counts.toSkip += 1;
    } else {
      counts.toImport += 1;
      if (action === "import_anyway") {
        counts.forcedImportAnyway += 1;
      }
    }
  }

  return counts;
}
