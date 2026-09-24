import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { inviteSingleClientToPortal } from "../_shared/clientPortalInvite.ts";

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
//
// Authorization (PR8 hardening): role admin/consultant alone used to be
// enough to invite ANY client in the system, regardless of
// staff_permissions.can_manage_clients or whether this consultant is even
// assigned to that client. Both gaps are closed here:
//   - can_manage_clients is now checked server-side, mirroring the button's
//     own client-side gating in AdminClients.tsx instead of trusting it.
//   - the target client's visibility is re-checked through the CALLER's own
//     RLS-scoped client (see inviteSingleClientToPortal) before any
//     service-role access, so a restricted-scope consultant can't invite a
//     client outside their assignment by guessing/enumerating client_id.
// The actual invite mechanics live in _shared/clientPortalInvite.ts, shared
// verbatim with bulk-invite-clients-to-portal.

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

    const [{ data: callerProfile, error: callerProfileError }, { data: callerPermissions, error: callerPermissionsError }] = await Promise.all([
      callerClient.from("profiles").select("role").eq("id", callerUser.id).maybeSingle(),
      callerClient.from("staff_permissions").select("can_manage_clients").eq("profile_id", callerUser.id).maybeSingle(),
    ]);

    if (callerProfileError) {
      return jsonResponse(request, { error: callerProfileError.message }, 400);
    }
    if (callerPermissionsError) {
      return jsonResponse(request, { error: callerPermissionsError.message }, 400);
    }
    if (callerProfile?.role !== "admin" && callerProfile?.role !== "consultant") {
      return jsonResponse(request, { error: "Only Acapolite staff can invite clients to the portal." }, 403);
    }
    const isAuthorised = callerProfile.role === "admin" || callerPermissions?.can_manage_clients === true;
    if (!isAuthorised) {
      return jsonResponse(request, { error: "Inviting clients to the portal is not enabled for this account." }, 403);
    }

    const payload = (await request.json()) as InvitePayload;
    const clientId = payload.client_id?.trim() ?? "";
    if (!clientId) {
      return jsonResponse(request, { error: "client_id is required." }, 400);
    }

    const portalUrl = (Deno.env.get("PORTAL_URL") || "https://acapoliteconsulting.co.za").replace(/\/+$/, "");
    const result = await inviteSingleClientToPortal({ adminClient, callerClient, clientId, portalUrl });

    switch (result.status) {
      case "not_found":
        return jsonResponse(request, { error: "Client not found or not accessible." }, 404);
      case "already_linked":
        return jsonResponse(request, { error: "This client already has a linked portal account." }, 400);
      case "invalid_email":
        return jsonResponse(request, { error: "This client doesn't have a valid email address to invite." }, 400);
      case "existing_account_found":
        return jsonResponse(request, {
          status: "existing_account_found",
          existing_email: result.existingEmail,
          existing_profile_id: result.existingProfileId,
        }, 200);
      case "invite_failed":
        return jsonResponse(request, { error: result.message }, 400);
      case "link_verification_failed":
        return jsonResponse(request, { error: "The invitation was sent, but linking it to this client's record failed. Check the client manually before retrying." }, 500);
      case "invited": {
        await adminClient.from("system_activity_log").insert({
          actor_profile_id: callerUser.id,
          actor_role: callerProfile.role,
          action: "client_portal_invited",
          target_type: "client",
          target_id: clientId,
          metadata: { email: result.email },
        });
        return jsonResponse(request, { status: "invited", profile_id: result.profileId }, 200);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while inviting this client to the portal.";
    return jsonResponse(request, { error: message }, 500);
  }
});
