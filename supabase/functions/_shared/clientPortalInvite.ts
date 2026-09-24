// deno-lint-ignore-file no-explicit-any
// Shared portal-invite mechanics for a single client, used by both
// invite-client-to-portal (one client at a time) and
// bulk-invite-clients-to-portal (many, with bounded concurrency). One
// implementation, not two, so the eligibility rules and the actual
// auth.admin.inviteUserByEmail call can never drift between the two entry
// points.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidInviteEmail(email: string | null | undefined): boolean {
  const trimmed = (email ?? "").trim();
  return trimmed.length > 0 && EMAIL_PATTERN.test(trimmed);
}

export type InviteNameSource = {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};

export function deriveInviteFullName(client: InviteNameSource, email: string): string {
  const personName = [client.first_name, client.last_name].filter(Boolean).join(" ").trim();
  return personName || (client.company_name ?? "").trim() || email.split("@")[0];
}

export type PortalInviteResult =
  | { status: "invited"; clientId: string; profileId: string; email: string }
  | { status: "existing_account_found"; clientId: string; existingEmail: string; existingProfileId: string }
  | { status: "already_linked"; clientId: string }
  | { status: "invalid_email"; clientId: string }
  | { status: "not_found"; clientId: string }
  | { status: "invite_failed"; clientId: string; message: string }
  | { status: "link_verification_failed"; clientId: string };

// A caller (any subagent_type of "supabase-js client") narrow enough for
// what this module touches - kept loose (any) rather than importing the
// full SupabaseClient type, matching this repo's other _shared I/O helpers.
export type MinimalSupabaseClient = any;

/**
 * Invites exactly one client to the portal, or reports why it couldn't.
 *
 * `callerClient` (the caller's own JWT-scoped client) is used ONLY to check
 * that this client is visible to the caller under RLS - this is what stops
 * a consultant from inviting a client outside their assignment scope by
 * guessing/enumerating client_ids, the same way fetchVerifiedCaseFacts in
 * caseFacts.ts uses the caller's own client to enforce case isolation.
 * Everything after that visibility check runs on `adminClient` (service
 * role), because creating an auth user and linking it requires elevated
 * access that RLS would never grant a consultant directly.
 */
export async function inviteSingleClientToPortal(params: {
  adminClient: MinimalSupabaseClient;
  callerClient: MinimalSupabaseClient;
  clientId: string;
  portalUrl: string;
}): Promise<PortalInviteResult> {
  const { adminClient, callerClient, clientId, portalUrl } = params;

  const { data: visibleClient } = await callerClient
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (!visibleClient) {
    return { status: "not_found", clientId };
  }

  const { data: client, error: clientError } = await adminClient
    .from("clients")
    .select("id, profile_id, email, first_name, last_name, company_name, client_type")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client) {
    return { status: "not_found", clientId };
  }
  if (client.profile_id) {
    return { status: "already_linked", clientId };
  }

  const email = (client.email ?? "").trim().toLowerCase();
  if (!isValidInviteEmail(email)) {
    return { status: "invalid_email", clientId };
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("profiles")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  if (existingProfileError) {
    return { status: "invite_failed", clientId, message: existingProfileError.message };
  }

  if (existingProfile) {
    return {
      status: "existing_account_found",
      clientId,
      existingEmail: existingProfile.email ?? email,
      existingProfileId: existingProfile.id,
    };
  }

  const fullName = deriveInviteFullName(client, email);

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
    return { status: "invite_failed", clientId, message: inviteError?.message || "Unable to send the portal invitation." };
  }

  const { data: linkedClient, error: verifyError } = await adminClient
    .from("clients")
    .select("profile_id")
    .eq("id", clientId)
    .maybeSingle();

  if (verifyError || linkedClient?.profile_id !== inviteData.user.id) {
    return { status: "link_verification_failed", clientId };
  }

  return { status: "invited", clientId, profileId: inviteData.user.id, email };
}
