import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DOCUMENTS_BUCKET = "documents";
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ORIGINS = new Set([
  "https://acapolite-consulting.vercel.app",
  "https://acapoliteconsulting.co.za",
  "https://www.acapoliteconsulting.co.za",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
]);
const ACAPOLITE_PREVIEW_ORIGIN = /^https:\/\/acapolite-consulting-[a-z0-9-]+-acapolite\.vercel\.app$/;

type JsonRecord = Record<string, unknown>;
type MainClient = ReturnType<typeof createClient>;

type StaffProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
};

type LeadAttachment = {
  source_path: string;
  signed_url: string;
  file_name: string;
  title: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
};

type AttachmentStats = {
  synced: number;
  skipped: number;
  warnings: string[];
};

const SERVICE_REQUEST_FIELDS = [
  "full_name",
  "email",
  "phone",
  "client_type",
  "company_name",
  "company_registration_number",
  "service_category",
  "service_categories",
  "service_needed",
  "service_needed_list",
  "description",
  "province",
  "city",
  "priority_level",
  "risk_indicator",
  "sars_debt_amount",
  "has_debt_flag",
  "returns_filed",
  "missing_returns_flag",
  "missing_documents_flag",
  "has_sars_audit",
  "has_adr",
  "has_vat_investigation",
  "has_payroll_dispute",
  "has_multiple_tax_types",
  "has_legal_complexity",
  "status",
  "lifecycle_stage",
  "contact_preference",
  "marketing_consent",
  "submitted_with_account",
  "client_profile_id",
  "intake_payload",
];
const QUALITY_GATE_STATUSES = new Set(["new", "pending_client_confirmation", "dead_lead"]);
const QUALITY_GATE_LIFECYCLE_STAGES = new Set(["open_marketplace", "pending_client_confirmation", "expired"]);
const PROTECTED_EXISTING_STATUSES = new Set(["assigned", "in_progress", "closed", "converted_to_client"]);

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) || ACAPOLITE_PREVIEW_ORIGIN.test(origin);
  return {
    "Access-Control-Allow-Origin": allowedOrigin ? origin : "https://acapolite-consulting.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function bearerToken(req: Request) {
  return (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isPlaceholderEmail(value: unknown) {
  return typeof value === "string" && value.trim().toLowerCase().endsWith("@acapolite.local");
}

function looksGenericName(value: unknown) {
  const text = stringValue(value).toLowerCase();
  return !text || text.startsWith("whatsapp ") || text === "whatsapp client";
}

function normalizePayload(value: unknown) {
  const source = asRecord(value);
  const payload: JsonRecord = {};
  for (const field of SERVICE_REQUEST_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field) && source[field] !== undefined) {
      payload[field] = source[field];
    }
  }
  for (const field of ["full_name", "email", "phone", "company_name", "company_registration_number", "description", "province", "city", "contact_preference"]) {
    if (typeof payload[field] === "string") payload[field] = stringValue(payload[field]);
  }
  return payload;
}

function validateInsertPayload(payload: JsonRecord) {
  const missing = ["full_name", "email", "phone", "client_type", "service_category", "service_needed", "description"]
    .filter((field) => !stringValue(payload[field]));
  if (missing.length) {
    throw new HttpError(400, `WhatsApp intake is missing: ${missing.join(", ")}`);
  }
}

function mergeUpdatePayload(payload: JsonRecord, existing: JsonRecord) {
  const next = { ...payload };
  const whatsapp = asRecord(asRecord(payload.intake_payload).whatsapp);
  const leadQuality = asRecord(whatsapp.leadQuality);
  const hasQualityGate = Boolean(stringValue(leadQuality.status));
  const requestedStatus = stringValue(payload.status);
  const requestedLifecycleStage = stringValue(payload.lifecycle_stage);
  const existingStatus = stringValue(existing.status);
  const canApplyQualityGate = hasQualityGate
    && QUALITY_GATE_STATUSES.has(requestedStatus)
    && QUALITY_GATE_LIFECYCLE_STAGES.has(requestedLifecycleStage)
    && !PROTECTED_EXISTING_STATUSES.has(existingStatus);

  if (!canApplyQualityGate) {
    delete next.status;
    delete next.lifecycle_stage;
  }

  if (isPlaceholderEmail(next.email) && stringValue(existing.email) && !isPlaceholderEmail(existing.email)) {
    next.email = existing.email;
  }
  if (looksGenericName(next.full_name) && stringValue(existing.full_name) && !looksGenericName(existing.full_name)) {
    next.full_name = existing.full_name;
  }
  if (!stringValue(next.phone) && stringValue(existing.phone)) next.phone = existing.phone;
  if (!stringValue(next.company_name) && stringValue(existing.company_name)) next.company_name = existing.company_name;
  return next;
}

function normalizeAttachment(value: unknown): LeadAttachment | null {
  const record = asRecord(value);
  const sourcePath = stringValue(record.source_path);
  const signedUrl = stringValue(record.signed_url);
  if (!sourcePath || !signedUrl) return null;
  const fileName = stringValue(record.file_name) || sourcePath.split("/").pop() || "whatsapp-document";
  return {
    source_path: sourcePath,
    signed_url: signedUrl,
    file_name: fileName,
    title: stringValue(record.title) || fileName,
    mime_type: stringValue(record.mime_type) || null,
    file_size: typeof record.file_size === "number" && Number.isFinite(record.file_size) ? record.file_size : null,
    uploaded_at: stringValue(record.uploaded_at) || null,
  };
}

function safePathSegment(value: string, fallback: string) {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return (safe || fallback).slice(-180);
}

function documentPath(requestId: string, attachment: LeadAttachment, index: number) {
  const sourceBase = attachment.source_path.split("/").pop() || attachment.file_name || `whatsapp-${index + 1}`;
  const fileName = safePathSegment(sourceBase, `whatsapp-${index + 1}`);
  return `service-requests/${requestId}/whatsapp/${fileName}`;
}

function duplicateError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "23505" || /already exists|duplicate/i.test(error?.message || "");
}

async function authenticateAdmin(sb: MainClient, token: string): Promise<StaffProfile | null> {
  if (!token) return null;
  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await sb
    .from("profiles")
    .select("id,full_name,email,role,is_active")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || !profile) return null;
  const staff = profile as StaffProfile;
  return staff.role === "admin" && staff.is_active === true ? staff : null;
}

async function upsertLead(sb: MainClient, requestedId: string | null, payload: JsonRecord) {
  const existingId = requestedId && isUuid(requestedId) ? requestedId : null;
  const existingResult = existingId
    ? await sb
      .from("service_requests")
      .select("id,full_name,email,phone,company_name,status,lifecycle_stage")
      .eq("id", existingId)
      .maybeSingle()
    : { data: null, error: null };
  if (existingResult.error) {
    console.error("WhatsApp lead lookup failed", existingResult.error);
    throw new HttpError(500, "Unable to check the linked lead");
  }

  if (existingResult.data?.id) {
    const updatePayload = mergeUpdatePayload(payload, existingResult.data as JsonRecord);
    const { data, error } = await sb
      .from("service_requests")
      .update(updatePayload)
      .eq("id", existingResult.data.id)
      .select("id")
      .single();
    if (error || !data?.id) {
      console.error("WhatsApp lead update failed", error);
      throw new HttpError(500, "Unable to update the linked lead");
    }
    return { id: String(data.id), created: false, updated: true };
  }

  validateInsertPayload(payload);
  const { data, error } = await sb
    .from("service_requests")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data?.id) {
    console.error("WhatsApp lead creation failed", error);
    throw new HttpError(500, "Unable to create the lead");
  }
  return { id: String(data.id), created: true, updated: false };
}

async function copyAttachments(sb: MainClient, requestId: string, attachments: LeadAttachment[]): Promise<AttachmentStats> {
  const stats: AttachmentStats = { synced: 0, skipped: 0, warnings: [] };
  for (const [index, attachment] of attachments.slice(0, 10).entries()) {
    const filePath = documentPath(requestId, attachment, index);
    try {
      const { data: existing } = await sb
        .from("service_request_documents")
        .select("id")
        .eq("file_path", filePath)
        .maybeSingle();
      if (existing) {
        stats.skipped += 1;
        continue;
      }

      if (attachment.file_size && attachment.file_size > MAX_DOCUMENT_BYTES) {
        stats.skipped += 1;
        stats.warnings.push(`${attachment.file_name} is larger than 10 MB`);
        continue;
      }

      const download = await fetch(attachment.signed_url);
      if (!download.ok) {
        stats.skipped += 1;
        stats.warnings.push(`${attachment.file_name} could not be downloaded`);
        continue;
      }

      const bytes = await download.arrayBuffer();
      if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
        stats.skipped += 1;
        stats.warnings.push(`${attachment.file_name} is larger than 10 MB`);
        continue;
      }

      const contentType = attachment.mime_type || download.headers.get("content-type") || "application/octet-stream";
      const { error: uploadError } = await sb.storage.from(DOCUMENTS_BUCKET).upload(
        filePath,
        new Blob([bytes], { type: contentType }),
        { contentType, upsert: false },
      );
      if (uploadError && !duplicateError(uploadError)) {
        stats.skipped += 1;
        stats.warnings.push(`${attachment.file_name} could not be copied`);
        continue;
      }

      const { error: documentError } = await sb.from("service_request_documents").insert({
        service_request_id: requestId,
        title: attachment.title || attachment.file_name,
        file_name: attachment.file_name,
        file_path: filePath,
        file_size: attachment.file_size || bytes.byteLength,
        mime_type: contentType,
        uploaded_at: attachment.uploaded_at || new Date().toISOString(),
      });
      if (documentError && !duplicateError(documentError)) {
        stats.skipped += 1;
        stats.warnings.push(`${attachment.file_name} copied, but could not be linked`);
        continue;
      }
      stats.synced += 1;
    } catch (error) {
      console.error("WhatsApp document sync failed", error instanceof Error ? error.message : error);
      stats.skipped += 1;
      stats.warnings.push(`${attachment.file_name} could not be synced`);
    }
  }
  return stats;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const actor = await authenticateAdmin(sb, bearerToken(req));
  if (!actor) return json(req, { error: "Forbidden" }, 403);

  try {
    const body = asRecord(await req.json().catch(() => ({})));
    if (body.action !== "upsert_lead") return json(req, { error: "Unsupported action" }, 400);

    const payload = normalizePayload(body.payload);
    const requestedId = stringValue(body.service_request_id) || null;
    const lead = await upsertLead(sb, requestedId, payload);
    const attachments = (Array.isArray(body.attachments) ? body.attachments : [])
      .map(normalizeAttachment)
      .filter((attachment): attachment is LeadAttachment => Boolean(attachment));
    const documentStats = await copyAttachments(sb, lead.id, attachments);

    return json(req, {
      ok: true,
      id: lead.id,
      service_request_id: lead.id,
      created: lead.created,
      updated: lead.updated,
      synced_documents: documentStats.synced,
      skipped_documents: documentStats.skipped,
      warnings: documentStats.warnings.slice(0, 5),
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to sync the WhatsApp lead";
    if (status >= 500) console.error("WhatsApp lead sync failed", message);
    return json(req, { error: message }, status);
  }
});
