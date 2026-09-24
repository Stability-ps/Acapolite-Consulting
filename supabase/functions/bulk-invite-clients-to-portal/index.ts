import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { inviteSingleClientToPortal, type PortalInviteResult } from "../_shared/clientPortalInvite.ts";
import { runWithConcurrency } from "../_shared/concurrency.ts";

// Bulk portal invitations for a staff-selected set of clients. Wraps the
// exact same per-client mechanics as invite-client-to-portal (shared via
// _shared/clientPortalInvite.ts, not reimplemented) so a bulk invite and a
// single invite can never behave differently for the same client - the only
// things this adds on top are: accepting many client_ids in one request,
// running them with bounded concurrency instead of sequentially (each
// invite is its own Supabase Auth admin API call, so unbounded parallelism
// would hammer that API), and returning one result per client instead of
// one result per request.
//
// Deliberately NOT a persisted/idempotent batch like client_import_batches:
// there's no "replay a completed batch" requirement here (unlike import,
// nothing about a repeated bulk-invite click would double-write anything -
// inviteSingleClientToPortal is naturally idempotent per client, since a
// client with profile_id already set just reports "already_linked" again),
// so this stays a plain synchronous request/response, no new table.

type BulkInvitePayload = {
  client_ids?: string[];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CLIENTS_PER_REQUEST = 200;
const INVITE_CONCURRENCY = 5;

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

function resultToResponseRow(result: PortalInviteResult) {
  switch (result.status) {
    case "invited":
      return { client_id: result.clientId, status: result.status, profile_id: result.profileId, message: null };
    case "existing_account_found":
      return {
        client_id: result.clientId,
        status: result.status,
        existing_email: result.existingEmail,
        existing_profile_id: result.existingProfileId,
        message: `A portal account already exists for ${result.existingEmail}. Link it manually before inviting.`,
      };
    case "already_linked":
      return { client_id: result.clientId, status: result.status, message: "This client already has a linked portal account." };
    case "invalid_email":
      return { client_id: result.clientId, status: result.status, message: "This client doesn't have a valid email address to invite." };
    case "not_found":
      return { client_id: result.clientId, status: result.status, message: "Client not found or not accessible." };
    case "invite_failed":
      return { client_id: result.clientId, status: result.status, message: result.message };
    case "link_verification_failed":
      return { client_id: result.clientId, status: result.status, message: "The invitation was sent, but linking it to this client's record failed. Check the client manually before retrying." };
  }
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

    const payload = (await request.json()) as BulkInvitePayload;
    const rawIds = Array.isArray(payload.client_ids) ? payload.client_ids : [];
    const clientIds = Array.from(new Set(rawIds.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)));

    if (clientIds.length === 0) {
      return jsonResponse(request, { error: "At least one client_id is required." }, 400);
    }
    if (clientIds.some((id) => !UUID_PATTERN.test(id))) {
      return jsonResponse(request, { error: "One or more client_ids are not valid." }, 400);
    }
    if (clientIds.length > MAX_CLIENTS_PER_REQUEST) {
      return jsonResponse(request, { error: `A single bulk invite is limited to ${MAX_CLIENTS_PER_REQUEST} clients.` }, 400);
    }

    const portalUrl = (Deno.env.get("PORTAL_URL") || "https://acapoliteconsulting.co.za").replace(/\/+$/, "");

    const outcomes = await runWithConcurrency(clientIds, INVITE_CONCURRENCY, (clientId) =>
      inviteSingleClientToPortal({ adminClient, callerClient, clientId, portalUrl }));

    const summary = {
      total: outcomes.length,
      invited: 0,
      existing_account_found: 0,
      already_linked: 0,
      invalid_email: 0,
      not_found: 0,
      failed: 0,
    };

    for (const outcome of outcomes) {
      if (outcome.status === "invited") summary.invited += 1;
      else if (outcome.status === "existing_account_found") summary.existing_account_found += 1;
      else if (outcome.status === "already_linked") summary.already_linked += 1;
      else if (outcome.status === "invalid_email") summary.invalid_email += 1;
      else if (outcome.status === "not_found") summary.not_found += 1;
      else summary.failed += 1;
    }

    if (summary.invited > 0) {
      await adminClient.from("system_activity_log").insert({
        actor_profile_id: callerUser.id,
        actor_role: callerProfile.role,
        action: "clients_bulk_portal_invited",
        target_type: "client_bulk_invite",
        target_id: null,
        metadata: summary,
      });
    }

    return jsonResponse(request, {
      summary,
      results: outcomes.map(resultToResponseRow),
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while bulk-inviting clients to the portal.";
    return jsonResponse(request, { error: message }, 500);
  }
});
