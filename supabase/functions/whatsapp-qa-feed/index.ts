import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAIN_URL = "https://frormnagythfpiuzgfkz.supabase.co";
const MAIN_PUBLISHABLE_KEY = "sb_publishable_MxFecwRlAUn7Z1Pa7-it6A_QDYO9rW8";
const ALLOWED_ORIGINS = new Set([
  "https://acapolite-consulting.vercel.app",
  "http://localhost:5173",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://acapolite-consulting.vercel.app",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function isProductionAdmin(token: string) {
  const headers = { apikey: MAIN_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
  const userResponse = await fetch(`${MAIN_URL}/auth/v1/user`, { headers });
  if (!userResponse.ok) return false;

  const roleResponse = await fetch(`${MAIN_URL}/rest/v1/rpc/get_my_role`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!roleResponse.ok) return false;
  return (await roleResponse.json()) === "admin";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "GET") return json(req, { error: "Method not allowed" }, 405);

  const authorization = req.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!token || !(await isProductionAdmin(token))) return json(req, { error: "Forbidden" }, 403);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: conversations, error: conversationsError }, { data: messages, error: messagesError }] = await Promise.all([
    sb.from("whatsapp_conversations").select("id,wa_id,display_name,status,ai_enabled,human_handoff_requested_at,service_request_id,ai_summary,intake_payload,intake_missing_fields,intake_ready,submission_state,created_at,updated_at").order("updated_at", { ascending: false }).limit(100),
    sb.from("whatsapp_messages").select("id,conversation_id,direction,sender_type,content,created_at").order("created_at", { ascending: true }),
  ]);
  if (conversationsError || messagesError) return json(req, { error: "Unable to load QA data" }, 500);
  return json(req, { conversations: conversations || [], messages: messages || [], environment: "whatsapp-admin-ai-test" });
});
