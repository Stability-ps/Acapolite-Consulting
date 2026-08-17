import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAIN_URL = "https://frormnagythfpiuzgfkz.supabase.co";
const MAIN_PUBLISHABLE_KEY = "sb_publishable_MxFecwRlAUn7Z1Pa7-it6A_QDYO9rW8";
const MEDIA_BUCKET = "service-request-attachments";
const SIGNED_URL_SECONDS = 300;
const MAX_REPLY_LENGTH = 1000;
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

type PreviewClient = ReturnType<typeof createClient>;
type StoredMessage = {
  media_storage_path: string | null;
  [key: string]: unknown;
};

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) || ACAPOLITE_PREVIEW_ORIGIN.test(origin);
  return {
    "Access-Control-Allow-Origin": allowedOrigin ? origin : "https://acapolite-consulting.vercel.app",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
  return (await profileResponse.json())?.[0] || null;
}

async function loadStaff(token: string, current: StaffProfile) {
  const response = await fetch(
    `${MAIN_URL}/rest/v1/profiles?select=id,full_name,email,role,is_active&role=in.(admin,consultant)&is_active=eq.true&order=full_name.asc`,
    { headers: mainHeaders(token) },
  );
  if (!response.ok) return [current];
  const rows = (await response.json()) as StaffProfile[];
  return rows.length ? rows : [current];
}

async function sendWhatsAppText(to: string, body: string) {
  const version = Deno.env.get("WHATSAPP_GRAPH_API_VERSION")?.trim();
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")?.trim();
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")?.trim();
  if (!version || !phoneNumberId || !accessToken) throw new Error("WhatsApp delivery is not configured");

  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`WhatsApp rejected the reply (${response.status})`);
  return String(payload?.messages?.[0]?.id || "") || null;
}

function withinCustomerCareWindow(lastInboundAt: string | null) {
  if (!lastInboundAt) return false;
  const elapsed = Date.now() - new Date(lastInboundAt).getTime();
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000;
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
  if (req.method !== "GET" && req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const token = bearerToken(req);
  const actor = await authenticateAdmin(token);
  if (!actor) return json(req, { error: "Forbidden" }, 403);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "delete_conversations") {
      const conversationIds = Array.from(new Set(
        (Array.isArray(body?.conversation_ids) ? body.conversation_ids : [])
          .map((value: unknown) => String(value || ""))
          .filter(Boolean),
      )).slice(0, 50);
      if (!conversationIds.length) return json(req, { error: "Select at least one client record" }, 400);

      const [{ data: conversations, error: conversationsError }, { data: messages, error: messagesError }] = await Promise.all([
        sb.from("whatsapp_conversations").select("id,service_request_id").in("id", conversationIds),
        sb.from("whatsapp_messages").select("id,conversation_id,media_storage_path").in("conversation_id", conversationIds),
      ]);
      if (conversationsError || messagesError || !conversations?.length) return json(req, { error: "Unable to load the selected client records" }, 500);

      const auditRows = conversations.map((conversation) => {
        const related = (messages || []).filter((message) => message.conversation_id === conversation.id);
        return {
          conversation_id: conversation.id,
          actor_id: actor.id,
          actor_name: displayName(actor),
          preserved_service_request_id: conversation.service_request_id,
          message_count: related.length,
          attachment_count: related.filter((message) => message.media_storage_path).length,
        };
      });
      const { data: createdAudits, error: auditError } = await sb.from("whatsapp_deletion_audit").insert(auditRows).select("id");
      if (auditError) return json(req, { error: "Unable to create the deletion audit" }, 500);

      const existingIds = conversations.map((conversation) => conversation.id);
      const { error: deleteError } = await sb.from("whatsapp_conversations").delete().in("id", existingIds);
      if (deleteError) {
        const auditIds = (createdAudits || []).map((row) => row.id);
        if (auditIds.length) await sb.from("whatsapp_deletion_audit").delete().in("id", auditIds);
        return json(req, { error: "Unable to delete the selected client records" }, 500);
      }

      const storagePaths = (messages || []).map((message) => message.media_storage_path).filter((path): path is string => Boolean(path));
      const storageResult = storagePaths.length ? await sb.storage.from(MEDIA_BUCKET).remove(storagePaths) : { error: null };
      return json(req, {
        ok: true,
        deleted: existingIds.length,
        preserved_service_requests: conversations.filter((conversation) => conversation.service_request_id).length,
        attachment_cleanup_warning: storageResult.error ? "Some private attachment files could not be removed automatically." : null,
      });
    }

    const conversationId = String(body?.conversation_id || "");
    if (!conversationId) return json(req, { error: "Conversation is required" }, 400);

    const { data: conversation, error: conversationError } = await sb
      .from("whatsapp_conversations")
      .select("id,wa_id,status,inbox_status,ai_enabled,human_handoff_requested_at,last_inbound_at,assigned_staff_id,assigned_staff_name,first_staff_reply_at")
      .eq("id", conversationId)
      .maybeSingle();
    if (conversationError || !conversation) return json(req, { error: "Conversation not found" }, 404);

    if (action === "assign") {
      const staff = await loadStaff(token, actor);
      const assignee = staff.find((item) => item.id === String(body?.staff_id || ""));
      if (!assignee) return json(req, { error: "Select an active staff member" }, 400);
      const assignedAt = new Date().toISOString();
      const nextAction = conversation.assigned_staff_id ? "reassigned" : "assigned";
      const { error } = await sb.from("whatsapp_conversations").update({
        assigned_staff_id: assignee.id,
        assigned_staff_name: displayName(assignee),
        assigned_at: assignedAt,
        assigned_by: actor.id,
        status: "human_handoff",
        inbox_status: "assigned",
        ai_enabled: false,
        human_handoff_requested_at: conversation.human_handoff_requested_at || assignedAt,
        updated_at: assignedAt,
      }).eq("id", conversationId);
      if (error) return json(req, { error: "Unable to assign this chat" }, 500);
      await recordAction(sb, conversationId, actor, nextAction, { staff_id: assignee.id, staff_name: displayName(assignee) });
      return json(req, { ok: true });
    }

    if (action === "mark_read") {
      const readAt = new Date().toISOString();
      const { error } = await sb.from("whatsapp_conversation_reads").upsert({
        conversation_id: conversationId,
        staff_id: actor.id,
        last_read_at: readAt,
      }, { onConflict: "conversation_id,staff_id" });
      if (error) return json(req, { error: "Unable to mark this chat as read" }, 500);
      await sb.from("whatsapp_alerts").update({ is_resolved: true, resolved_at: readAt, resolved_by: actor.id })
        .eq("conversation_id", conversationId).eq("alert_type", "customer_reply").eq("is_resolved", false);
      return json(req, { ok: true });
    }

    if (action === "resolve") {
      const resolvedAt = new Date().toISOString();
      const { error } = await sb.from("whatsapp_conversations").update({
        inbox_status: "resolved",
        resolved_at: resolvedAt,
        resolved_by: actor.id,
        ai_enabled: false,
        updated_at: resolvedAt,
      }).eq("id", conversationId);
      if (error) return json(req, { error: "Unable to resolve this chat" }, 500);
      await sb.from("whatsapp_alerts").update({ is_resolved: true, resolved_at: resolvedAt, resolved_by: actor.id })
        .eq("conversation_id", conversationId).eq("is_resolved", false);
      await recordAction(sb, conversationId, actor, "resolved");
      return json(req, { ok: true });
    }

    if (action === "reopen") {
      const changedAt = new Date().toISOString();
      const { error } = await sb.from("whatsapp_conversations").update({
        inbox_status: conversation.assigned_staff_id ? "assigned" : "unassigned",
        status: "human_handoff",
        ai_enabled: false,
        resolved_at: null,
        resolved_by: null,
        updated_at: changedAt,
      }).eq("id", conversationId);
      if (error) return json(req, { error: "Unable to reopen this chat" }, 500);
      await recordAction(sb, conversationId, actor, "reopened");
      return json(req, { ok: true });
    }

    if (action === "reply") {
      const message = String(body?.message || "").replace(/\s+/g, " ").trim();
      if (!message) return json(req, { error: "Write a reply first" }, 400);
      if (message.length > MAX_REPLY_LENGTH) return json(req, { error: `Keep replies under ${MAX_REPLY_LENGTH} characters` }, 400);
      if (!withinCustomerCareWindow(conversation.last_inbound_at)) {
        return json(req, { error: "The 24-hour WhatsApp reply window has closed. Use an approved template before sending another free-form message." }, 409);
      }

      const sentAt = new Date().toISOString();
      const staffName = displayName(actor);
      const { data: pendingMessage, error: pendingMessageError } = await sb.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        direction: "outbound",
        sender_type: "staff",
        message_type: "text",
        content: message,
        delivery_status: "sending",
        staff_sender_id: actor.id,
        staff_sender_name: staffName,
      }).select("id").single();
      if (pendingMessageError || !pendingMessage) {
        console.error("Unable to create pending WhatsApp transcript row", pendingMessageError);
        return json(req, { error: "The reply was not sent because the transcript could not be created" }, 500);
      }

      let metaMessageId: string | null = null;
      try {
        metaMessageId = await sendWhatsAppText(conversation.wa_id, message);
      } catch (error) {
        await sb.from("whatsapp_messages").update({ delivery_status: "failed" }).eq("id", pendingMessage.id);
        return json(req, { error: error instanceof Error ? error.message : "WhatsApp delivery failed" }, 502);
      }

      const { error: messageError } = await sb.from("whatsapp_messages").update({
        meta_message_id: metaMessageId,
        delivery_status: "submitted",
      }).eq("id", pendingMessage.id);
      if (messageError) console.error("WhatsApp reply delivered; transcript status update failed", messageError);

      const assignmentPatch = conversation.assigned_staff_id ? {} : {
        assigned_staff_id: actor.id,
        assigned_staff_name: staffName,
        assigned_at: sentAt,
        assigned_by: actor.id,
      };
      await sb.from("whatsapp_conversations").update({
        ...assignmentPatch,
        status: "human_handoff",
        inbox_status: "waiting_client",
        ai_enabled: false,
        first_staff_reply_at: conversation.first_staff_reply_at || sentAt,
        last_outbound_at: sentAt,
        last_staff_reply_at: sentAt,
        updated_at: sentAt,
      }).eq("id", conversationId);
      await recordAction(sb, conversationId, actor, "staff_reply", { meta_message_id: metaMessageId });
      return json(req, { ok: true });
    }

    if (action === "return_to_ai") {
      const changedAt = new Date().toISOString();
      const { error } = await sb.from("whatsapp_conversations").update({
        status: "active",
        inbox_status: "resolved",
        ai_enabled: true,
        assigned_staff_id: null,
        assigned_staff_name: null,
        assigned_at: null,
        assigned_by: null,
        updated_at: changedAt,
      }).eq("id", conversationId);
      if (error) return json(req, { error: "Unable to return this chat to AI" }, 500);
      await recordAction(sb, conversationId, actor, "returned_to_ai", { previous_staff_id: conversation.assigned_staff_id, previous_staff_name: conversation.assigned_staff_name });
      return json(req, { ok: true });
    }

    return json(req, { error: "Unsupported action" }, 400);
  }

  const overdueCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: overdueConversations } = await sb.from("whatsapp_conversations")
    .select("id,display_name,wa_id")
    .eq("status", "human_handoff")
    .is("assigned_staff_id", null)
    .neq("inbox_status", "resolved")
    .lte("human_handoff_requested_at", overdueCutoff);
  if (overdueConversations?.length) {
    await sb.from("whatsapp_conversations").update({ inbox_status: "unassigned" })
      .in("id", overdueConversations.map((conversation) => conversation.id)).eq("inbox_status", "new");
    await Promise.all(overdueConversations.map((conversation) => sb.from("whatsapp_alerts").insert({
        conversation_id: conversation.id,
        alert_type: "unassigned_overdue",
        severity: "warning",
        title: "Unassigned WhatsApp chat is overdue",
        body: `${conversation.display_name || conversation.wa_id} has waited more than 10 minutes.`,
      })));
  }

  const [{ data: conversations, error: conversationsError }, { data: messages, error: messagesError }, { data: reads }, { data: alerts }, staff] = await Promise.all([
    sb.from("whatsapp_conversations").select("id,wa_id,display_name,status,inbox_status,priority_level,ai_enabled,human_handoff_requested_at,service_request_id,ai_summary,intake_payload,intake_missing_fields,intake_ready,submission_state,last_inbound_at,last_outbound_at,assigned_staff_id,assigned_staff_name,assigned_at,last_staff_reply_at,first_staff_reply_at,resolved_at,resolved_by,created_at,updated_at").order("updated_at", { ascending: false }).limit(100),
    sb.from("whatsapp_messages").select("id,conversation_id,direction,sender_type,message_type,content,delivery_status,media_mime_type,media_filename,media_size_bytes,media_storage_path,staff_sender_id,staff_sender_name,created_at").order("created_at", { ascending: true }),
    sb.from("whatsapp_conversation_reads").select("conversation_id,last_read_at").eq("staff_id", actor.id),
    sb.from("whatsapp_alerts").select("id,conversation_id,alert_type,severity,title,body,assigned_staff_id,is_resolved,created_at").eq("is_resolved", false).order("created_at", { ascending: false }).limit(100),
    loadStaff(token, actor),
  ]);
  if (conversationsError || messagesError) return json(req, { error: "Unable to load WhatsApp data" }, 500);

  const messagesWithAttachments = await Promise.all(((messages || []) as StoredMessage[]).map(async (message) => {
    if (!message.media_storage_path) return { ...message, attachment_url: null };
    const { data, error } = await sb.storage.from(MEDIA_BUCKET).createSignedUrl(message.media_storage_path, SIGNED_URL_SECONDS);
    return { ...message, attachment_url: error ? null : data?.signedUrl || null };
  }));

  return json(req, {
    features: { inbox_v2: true },
    conversations: conversations || [],
    messages: messagesWithAttachments,
    reads: reads || [],
    alerts: alerts || [],
    staff,
    current_staff: actor,
    attachment_url_ttl_seconds: SIGNED_URL_SECONDS,
    environment: "whatsapp-admin-ai-test",
  });
});
