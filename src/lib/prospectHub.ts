import { escapeCsvCell, sanitizeCellText, triggerDownload } from "@/lib/clientExport";
import * as XLSX from "xlsx";

// Shared Prospect Hub constants, filter building and import/export helpers.
// "Fit score" = how relevant a business is as a potential Acapolite
// customer. It never describes a business's SARS compliance status.

export const PROSPECT_STAGES = [
  { value: "new", label: "New prospect", tone: "bg-slate-100 text-slate-700" },
  { value: "contacted", label: "Contacted", tone: "bg-sky-100 text-sky-800" },
  { value: "follow_up", label: "Follow-up", tone: "bg-amber-100 text-amber-800" },
  { value: "interested", label: "Interested", tone: "bg-violet-100 text-violet-800" },
  { value: "qualified", label: "Qualified lead", tone: "bg-emerald-100 text-emerald-800" },
  { value: "consultation", label: "Consultation", tone: "bg-teal-100 text-teal-800" },
  { value: "converted", label: "Client", tone: "bg-green-600 text-white" },
  { value: "disqualified", label: "Disqualified", tone: "bg-rose-100 text-rose-700" },
] as const;
export type ProspectStage = (typeof PROSPECT_STAGES)[number]["value"];
export const LEAD_STAGES: ProspectStage[] = ["qualified", "consultation"];

export function stageLabel(value: string | null | undefined) {
  return PROSPECT_STAGES.find((s) => s.value === value)?.label ?? (value ?? "—").replace(/_/g, " ");
}
export function stageTone(value: string | null | undefined) {
  return PROSPECT_STAGES.find((s) => s.value === value)?.tone ?? "bg-muted text-foreground";
}

export const ENRICHMENT_STATUSES = [
  { value: "pending", label: "Not checked yet" },
  { value: "processing", label: "Checking" },
  { value: "completed", label: "Email + phone found" },
  { value: "partial", label: "Partly found" },
  { value: "no_contacts", label: "Website, no contacts" },
  { value: "no_website", label: "No website found" },
  { value: "needs_review", label: "Needs review" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
] as const;
export function enrichmentLabel(value: string | null | undefined) {
  return ENRICHMENT_STATUSES.find((s) => s.value === value)?.label ?? value ?? "—";
}

export const SECTORS = ["Construction", "Security", "Cleaning", "Transport", "Logistics", "Engineering", "Maintenance", "Catering", "IT"];
export const PROVINCES = ["Gauteng", "Western Cape", "Eastern Cape", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Free State", "Northern Cape"];

export const CALL_OUTCOMES = [
  { value: "no_answer", label: "No answer" },
  { value: "voicemail", label: "Left voicemail" },
  { value: "call_back", label: "Asked us to call back" },
  { value: "interested", label: "Interested" },
  { value: "requested_quote", label: "Requested quotation" },
  { value: "meeting_booked", label: "Meeting booked" },
  { value: "has_accountant", label: "Already has an accountant" },
  { value: "not_interested", label: "Not interested" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "other", label: "Other" },
] as const;

export const FOLLOW_UP_TYPES = ["call", "email", "whatsapp", "meeting", "quote", "other"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const SKIP_REASON_LABELS: Record<string, string> = {
  no_email: "No email address",
  invalid_email: "Invalid email",
  do_not_contact: "Do not contact",
  unsubscribed: "Unsubscribed",
  hard_bounce: "Previously bounced",
  complaint: "Spam complaint",
  manually_blocked: "Manually blocked",
  converted_client: "Already a client",
  existing_client_email: "Email belongs to an existing client",
  disqualified: "Disqualified",
  recently_contacted: "Contacted recently",
  duplicate_email_in_campaign: "Same email already in campaign",
  campaign_cancelled: "Campaign cancelled",
  prospect_missing: "Prospect deleted",
};
export function skipReasonLabel(reason: string | null | undefined) {
  if (!reason) return "—";
  if (reason.startsWith("missing_template_variable:")) return `Missing template value (${reason.split(":")[1]})`;
  return SKIP_REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

export type ProspectFilters = {
  search?: string;
  stage?: string;
  province?: string;
  city?: string;
  sector?: string;
  source?: string;
  assignedTo?: string;
  enrichment?: string;
  minScore?: number | null;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasWebsite?: boolean;
  doNotContact?: "exclude" | "only" | "any";
  contacted?: "any" | "not_contacted" | "contacted";
  procurement?: boolean;
  discoveredFrom?: string;
  discoveredTo?: string;
  leadsOnly?: boolean;
};

/** Removes characters that have meaning inside a PostgREST or() filter. */
export function sanitizeSearchTerm(term: string) {
  return term.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

type FilterableQuery = {
  eq: (column: string, value: unknown) => FilterableQuery;
  neq: (column: string, value: unknown) => FilterableQuery;
  gte: (column: string, value: unknown) => FilterableQuery;
  lte: (column: string, value: unknown) => FilterableQuery;
  gt: (column: string, value: unknown) => FilterableQuery;
  in: (column: string, values: unknown[]) => FilterableQuery;
  is: (column: string, value: null) => FilterableQuery;
  not: (column: string, operator: string, value: unknown) => FilterableQuery;
  ilike: (column: string, pattern: string) => FilterableQuery;
  or: (filters: string) => FilterableQuery;
};

/** Applies Prospect Hub filters server-side (PostgREST) to a prospects query. */
export function applyProspectFilters<Q>(query: Q, f: ProspectFilters): Q {
  let q = query as unknown as FilterableQuery;
  const term = f.search ? sanitizeSearchTerm(f.search) : "";
  if (term) {
    const like = `*${term}*`;
    q = q.or(
      [`company_name.ilike.${like}`, `registration_number.ilike.${like}`, `email.ilike.${like}`,
        `phone.ilike.${like}`, `city.ilike.${like}`, `sector.ilike.${like}`].join(","),
    );
  }
  if (f.stage && f.stage !== "all") q = q.eq("status", f.stage);
  if (f.leadsOnly) q = q.in("status", LEAD_STAGES);
  if (f.province && f.province !== "all") q = q.eq("province", f.province);
  if (f.city?.trim()) q = q.ilike("city", `%${sanitizeSearchTerm(f.city)}%`);
  if (f.sector && f.sector !== "all") q = q.eq("sector", f.sector);
  if (f.source && f.source !== "all") q = q.eq("source_name", f.source);
  if (f.assignedTo === "unassigned") q = q.is("assigned_to", null);
  else if (f.assignedTo && f.assignedTo !== "all") q = q.eq("assigned_to", f.assignedTo);
  if (f.enrichment && f.enrichment !== "all") q = q.eq("enrichment_status", f.enrichment);
  if (typeof f.minScore === "number" && f.minScore > 0) q = q.gte("score", f.minScore);
  if (f.hasEmail) q = q.not("email", "is", null);
  if (f.hasPhone) q = q.not("phone", "is", null);
  if (f.hasWebsite) q = q.not("website", "is", null);
  if (f.doNotContact === "exclude") q = q.eq("do_not_contact", false);
  if (f.doNotContact === "only") q = q.eq("do_not_contact", true);
  if (f.contacted === "not_contacted") q = q.is("last_contacted_at", null).eq("status", "new");
  if (f.contacted === "contacted") q = q.not("last_contacted_at", "is", null);
  if (f.procurement) q = q.gt("procurement_record_count", 0);
  if (f.discoveredFrom) q = q.gte("discovered_at", f.discoveredFrom);
  if (f.discoveredTo) q = q.lte("discovered_at", `${f.discoveredTo}T23:59:59`);
  return q as unknown as Q;
}

export const PROSPECT_LIST_COLUMNS =
  "id,company_name,registration_number,sector,city,province,email,phone,website,contact_name,status,score,score_reasons," +
  "assigned_to,source_name,discovered_at,last_contacted_at,next_follow_up_at,do_not_contact,enrichment_status," +
  "procurement_record_count,lead_at,converted_client_id";

export type ProspectListRow = {
  id: string;
  company_name: string;
  registration_number: string | null;
  sector: string | null;
  city: string | null;
  province: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  contact_name: string | null;
  status: string;
  score: number;
  score_reasons: Array<{ label: string; points: number }>;
  assigned_to: string | null;
  source_name: string | null;
  discovered_at: string;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  do_not_contact: boolean;
  enrichment_status: string;
  procurement_record_count: number;
  lead_at: string | null;
  converted_client_id: string | null;
};

// ---------------------------------------------------------------- export

const EXPORT_COLUMNS: Array<{ key: keyof ProspectListRow; label: string }> = [
  { key: "company_name", label: "Company" },
  { key: "registration_number", label: "Registration Number" },
  { key: "sector", label: "Sector" },
  { key: "city", label: "City" },
  { key: "province", label: "Province" },
  { key: "email", label: "Public Email" },
  { key: "phone", label: "Public Phone" },
  { key: "website", label: "Website" },
  { key: "status", label: "Stage" },
  { key: "score", label: "Fit Score" },
  { key: "source_name", label: "Source" },
  { key: "procurement_record_count", label: "Procurement Records" },
  { key: "discovered_at", label: "Discovered" },
  { key: "last_contacted_at", label: "Last Contacted" },
  { key: "do_not_contact", label: "Do Not Contact" },
];

export function buildProspectExportRows(rows: ProspectListRow[]) {
  return rows.map((row) => {
    const out: Record<string, string | number> = {};
    for (const c of EXPORT_COLUMNS) {
      const v = row[c.key];
      if (v === null || v === undefined) out[c.label] = "";
      else if (typeof v === "boolean") out[c.label] = v ? "Yes" : "No";
      else if (typeof v === "number") out[c.label] = v;
      else if (c.key === "status") out[c.label] = stageLabel(String(v));
      else out[c.label] = sanitizeCellText(String(v));
    }
    return out;
  });
}

export function exportProspects(rows: ProspectListRow[], format: "csv" | "xlsx") {
  const data = buildProspectExportRows(rows);
  const filename = `prospects-${new Date().toISOString().slice(0, 10)}.${format}`;
  if (format === "csv") {
    const header = EXPORT_COLUMNS.map((c) => escapeCsvCell(c.label)).join(",");
    const lines = data.map((r) => EXPORT_COLUMNS.map((c) => escapeCsvCell(r[c.label])).join(","));
    triggerDownload(new Blob([[header, ...lines].join("\r\n")], { type: "text/csv;charset=utf-8;" }), filename);
  } else {
    const ws = XLSX.utils.json_to_sheet(data, { header: EXPORT_COLUMNS.map((c) => c.label) });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prospects");
    XLSX.writeFile(wb, filename);
  }
}

// ---------------------------------------------------------------- import

export const PROSPECT_IMPORT_FIELDS = [
  { key: "company_name", label: "Company name", aliases: ["company", "company name", "business", "business name", "name", "supplier"] },
  { key: "registration_number", label: "Registration number", aliases: ["registration", "reg no", "registration number", "company registration", "cipc"] },
  { key: "sector", label: "Sector", aliases: ["sector", "industry"] },
  { key: "city", label: "City", aliases: ["city", "town"] },
  { key: "province", label: "Province", aliases: ["province", "region"] },
  { key: "email", label: "Public email", aliases: ["email", "e-mail", "email address"] },
  { key: "phone", label: "Public phone", aliases: ["phone", "telephone", "tel", "contact number", "cell"] },
  { key: "website", label: "Website", aliases: ["website", "web", "url", "site"] },
  { key: "contact_name", label: "Public contact person", aliases: ["contact", "contact person", "contact name"] },
  { key: "source_url", label: "Source URL", aliases: ["source", "source url", "link"] },
] as const;
export type ProspectImportKey = (typeof PROSPECT_IMPORT_FIELDS)[number]["key"];
export type ProspectImportRow = Partial<Record<ProspectImportKey, string>>;

export function guessProspectMapping(headers: string[]) {
  const mapping: Partial<Record<ProspectImportKey, string>> = {};
  for (const field of PROSPECT_IMPORT_FIELDS) {
    const hit = headers.find((h) => (field.aliases as readonly string[]).includes(h.trim().toLowerCase()));
    if (hit) mapping[field.key] = hit;
  }
  return mapping;
}

/** Strips spreadsheet formula prefixes from imported text so it can never be re-exported as a formula. */
export function sanitizeImportedText(value: string | undefined) {
  if (!value) return "";
  return value.replace(/^[=+\-@\t\r]+/, "").trim().slice(0, 500);
}

export function mapImportRows(rows: Record<string, string>[], mapping: Partial<Record<ProspectImportKey, string>>) {
  return rows.map((raw, index) => {
    const row: ProspectImportRow = {};
    for (const field of PROSPECT_IMPORT_FIELDS) {
      const header = mapping[field.key];
      const value = header ? sanitizeImportedText(raw[header]) : "";
      if (value) row[field.key] = value;
    }
    const errors: string[] = [];
    if (!row.company_name) errors.push("Company name is required");
    if (row.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) errors.push("Invalid email");
    if (row.province && !PROVINCES.includes(row.province)) errors.push(`Unknown province "${row.province}"`);
    if (row.website && !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}/i.test(row.website)) errors.push("Invalid website");
    return { rowNumber: index + 2, row, errors };
  });
}

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  return withTime
    ? d.toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

export function whatsappLink(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!/^27\d{9}$/.test(digits)) return null;
  return `https://wa.me/${digits}`;
}
