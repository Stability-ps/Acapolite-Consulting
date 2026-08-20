import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAIN_URL = "https://frormnagythfpiuzgfkz.supabase.co";
const MAIN_PUBLISHABLE_KEY = "sb_publishable_MxFecwRlAUn7Z1Pa7-it6A_QDYO9rW8";
const ALLOWED_ORIGINS = new Set([
  "https://acapolite-consulting.vercel.app",
  "https://acapoliteconsulting.co.za",
  "https://www.acapoliteconsulting.co.za",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
]);
const ACAPOLITE_PREVIEW_ORIGIN = /^https:\/\/acapolite-consulting-[a-z0-9-]+-acapolite\.vercel\.app$/;

type StaffProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
};

type JsonRecord = Record<string, unknown>;
type PreviewClient = ReturnType<typeof createClient>;

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

function mainHeaders(token: string) {
  return { apikey: MAIN_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
}

function displayName(profile: Pick<StaffProfile, "full_name" | "email">) {
  return profile.full_name?.trim() || profile.email?.trim() || "Acapolite staff";
}

async function authenticateAdmin(token: string): Promise<StaffProfile | null> {
  if (!token) return null;
  const headers = mainHeaders(token);
  const userResponse = await fetch(`${MAIN_URL}/auth/v1/user`, { headers });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();

  const roleResponse = await fetch(`${MAIN_URL}/rest/v1/rpc/get_my_role`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!roleResponse.ok || (await roleResponse.json()) !== "admin") return null;

  const profileResponse = await fetch(
    `${MAIN_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,email,role,is_active&limit=1`,
    { headers },
  );
  if (!profileResponse.ok) return null;
  const profile = (await profileResponse.json())?.[0] as StaffProfile | undefined;
  return profile?.is_active === true ? profile : null;
}

async function recordAction(sb: PreviewClient, conversationId: string, actor: StaffProfile, action: string, details: Record<string, unknown> = {}) {
  const { error } = await sb.from("whatsapp_staff_actions").insert({
    conversation_id: conversationId,
    actor_id: actor.id,
    actor_name: displayName(actor),
    action,
    details,
  });
  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const token = bearerToken(req);
  const actor = await authenticateAdmin(token);
  if (!actor) return json(req, { error: "Forbidden" }, 403);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = asRecord(await req.json().catch(() => ({})));
  const conversationId = stringValue(body.conversation_id);
  const serviceRequestId = stringValue(body.service_request_id);
  if (!conversationId || !serviceRequestId) return json(req, { error: "Conversation and lead are required" }, 400);

  const { data: conversation, error: conversationError } = await sb
    .from("whatsapp_conversations")
    .select("id,assigned_staff_id,human_handoff_requested_at,intake_missing_fields")
    .eq("id", conversationId)
    .maybeSingle();
  if (conversationError || !conversation) return json(req, { error: "Conversation not found" }, 404);

  const changedAt = new Date().toISOString();
  const { error: linkError } = await sb.from("whatsapp_conversations").update({
    service_request_id: serviceRequestId,
    submission_state: "submitted",
    status: "human_handoff",
    inbox_status: conversation.assigned_staff_id ? "assigned" : "unassigned",
    ai_enabled: false,
    human_handoff_requested_at: conversation.human_handoff_requested_at || changedAt,
    updated_at: changedAt,
  }).eq("id", conversationId);
  if (linkError) return json(req, { error: "Lead synced, but the WhatsApp chat link could not be saved automatically" }, 500);

  try {
    await recordAction(sb, conversationId, actor, body.created === true ? "service_request_created" : "service_request_synced", {
      service_request_id: serviceRequestId,
      lead_url: `/dashboard/staff/service-requests?leadId=${serviceRequestId}`,
      missing_fields: Array.isArray(conversation.intake_missing_fields) ? conversation.intake_missing_fields : [],
      synced_documents: typeof body.synced_documents === "number" ? body.synced_documents : 0,
      skipped_documents: typeof body.skipped_documents === "number" ? body.skipped_documents : 0,
      warnings: Array.isArray(body.warnings) ? body.warnings.filter((warning) => typeof warning === "string") : [],
    });
  } catch (auditError) {
    console.error("Lead link audit failed", auditError instanceof Error ? auditError.message : auditError);
  }

  return json(req, {
    ok: true,
    service_request_id: serviceRequestId,
    lead_url: `/dashboard/staff/service-requests?leadId=${serviceRequestId}`,
  });
});
