import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deriveInviteFullName, isValidInviteEmail } from "../_shared/clientPortalInvite.ts";

// Grants portal access to an existing, already-created clients row. Never
// generates or accepts a password: uses Supabase's admin invite flow
// (auth.admin.inviteUserByEmail), which lets the client set their own
// credentials when they accept. Only callable by staff, only via the
// service-role key held here - never exposed to the browser.
//
// A no-portal client (profile_id = null) can be invited from clients.email
// even though no profiles row exists yet for them. If a profiles row
// already exists for that email, this refuses to create a second account
// and reports it back as a match to review instead (never silently
// duplicates or auto-merges).

type InvitePayload = {
  client_id?: string;
};

function buildCorsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function jsonResponse(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: buildCorsHeaders(request) });
}

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(request) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed" }, 405);
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return jsonResponse(request, { error: "Missing authorization header." }, 401);
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser }, error: callerAuthError } = await callerClient.auth.getUser();
    if (callerAuthError || !callerUser) {
      return jsonResponse(request, { error: "You must be signed in to invite clients to the portal." }, 401);
    }

    const { data: callerProfile, error: callerProfileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (callerProfileError) {
      return jsonResponse(request, { error: callerProfileError.message }, 400);
    }
    if (callerProfile?.role !== "admin" && callerProfile?.role !== "consultant") {
      return jsonResponse(request, { error: "Only Acapolite staff can invite clients to the portal." }, 403);
    }

    const payload = (await request.json()) as InvitePayload;
    const clientId = payload.client_id?.trim() ?? "";
    if (!clientId) {
      return jsonResponse(request, { error: "client_id is required." }, 400);
    }

    const { data: client, error: clientError } = await adminClient
      .from("clients")
      .select("id, profile_id, email, first_name, last_name, company_name, client_type")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) {
      return jsonResponse(request, { error: clientError.message }, 400);
    }
    if (!client) {
      return jsonResponse(request, { error: "Client not found." }, 404);
    }
    if (client.profile_id) {
      return jsonResponse(request, { error: "This client already has a linked portal account." }, 400);
    }

    const email = (client.email ?? "").trim().toLowerCase();
    if (!isValidInviteEmail(email)) {
      return jsonResponse(request, { error: "This client doesn't have a valid email address to invite." }, 400);
    }

    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from("profiles")
      .select("id, email, full_name")
      .ilike("email", email)
      .maybeSingle();

    if (existingProfileError) {
      return jsonResponse(request, { error: existingProfileError.message }, 400);
    }

    if (existingProfile) {
      return jsonResponse(request, {
        status: "existing_account_found",
        existing_email: existingProfile.email,
        existing_profile_id: existingProfile.id,
      }, 200);
    }

    const fullName = deriveInviteFullName(client, email);

    const portalUrl = (Deno.env.get("PORTAL_URL") || "https://acapoliteconsulting.co.za").replace(/\/+$/, "");

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${portalUrl}/reset-password`,
      data: {
        role: "client",
        account_type: "client",
        full_name: fullName,
        client_type: client.client_type,
        linking_client_id: client.id,
      },
    });

    if (inviteError || !inviteData?.user) {
      return jsonResponse(request, { error: inviteError?.message || "Unable to send the portal invitation." }, 400);
    }

    const { data: linkedClient, error: verifyError } = await adminClient
      .from("clients")
      .select("profile_id")
      .eq("id", clientId)
      .maybeSingle();

    if (verifyError || linkedClient?.profile_id !== inviteData.user.id) {
      return jsonResponse(request, { error: "The invitation was sent, but linking it to this client's record failed. Check the client manually before retrying." }, 500);
    }

    await adminClient.from("system_activity_log").insert({
      actor_profile_id: callerUser.id,
      actor_role: callerProfile.role,
      action: "client_portal_invited",
      target_type: "client",
      target_id: clientId,
      metadata: { email },
    });

    return jsonResponse(request, { status: "invited", profile_id: inviteData.user.id }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while inviting this client to the portal.";
    return jsonResponse(request, { error: message }, 500);
  }
});
