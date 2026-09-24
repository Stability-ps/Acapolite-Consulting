import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deriveInviteFullName, inviteSingleClientToPortal, isValidInviteEmail } from "./clientPortalInvite.ts";

// --- isValidInviteEmail / deriveInviteFullName ------------------------------

Deno.test("isValidInviteEmail accepts a well-formed address", () => {
  assertEquals(isValidInviteEmail("jane@example.com"), true);
});

Deno.test("isValidInviteEmail rejects missing/blank/malformed addresses", () => {
  assertEquals(isValidInviteEmail(null), false);
  assertEquals(isValidInviteEmail(undefined), false);
  assertEquals(isValidInviteEmail(""), false);
  assertEquals(isValidInviteEmail("   "), false);
  assertEquals(isValidInviteEmail("not-an-email"), false);
  assertEquals(isValidInviteEmail("missing-domain@"), false);
});

Deno.test("deriveInviteFullName prefers person name, then company, then email local-part", () => {
  assertEquals(deriveInviteFullName({ first_name: "Jane", last_name: "Doe", company_name: null }, "jane@x.com"), "Jane Doe");
  assertEquals(deriveInviteFullName({ first_name: null, last_name: null, company_name: "Acme Co" }, "info@acme.com"), "Acme Co");
  assertEquals(deriveInviteFullName({ first_name: null, last_name: null, company_name: null }, "solo@x.com"), "solo");
});

// --- inviteSingleClientToPortal ---------------------------------------------

type FakeClientRow = {
  id: string;
  profile_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  client_type: string | null;
};

function makeFakeEnv(options: {
  clients: FakeClientRow[];
  profiles?: { id: string; email: string }[];
  visibleClientIds?: string[] | "all";
  inviteBehavior?: "succeed" | "error" | "no-user" | "succeed-no-link";
}) {
  const clients = new Map(options.clients.map((c) => [c.id, { ...c }]));
  const profiles = options.profiles ?? [];
  const visibleClientIds = options.visibleClientIds ?? "all";
  const inviteBehavior = options.inviteBehavior ?? "succeed";
  const invitedEmails: string[] = [];

  function isVisible(id: string) {
    return visibleClientIds === "all" || visibleClientIds.includes(id);
  }

  const callerClient = {
    from(table: string) {
      if (table !== "clients") throw new Error(`unexpected table on callerClient: ${table}`);
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: async () => ({ data: isVisible(id) && clients.has(id) ? { id } : null, error: null }),
          }),
        }),
      };
    },
  };

  const adminClient = {
    from(table: string) {
      if (table === "clients") {
        return {
          select: (cols: string) => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => {
                const row = clients.get(id);
                if (!row) return { data: null, error: null };
                if (cols === "profile_id") return { data: { profile_id: row.profile_id }, error: null };
                return { data: row, error: null };
              },
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            ilike: (_col: string, email: string) => ({
              maybeSingle: async () => {
                const match = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
                return { data: match ?? null, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table on adminClient: ${table}`);
    },
    auth: {
      admin: {
        inviteUserByEmail: async (email: string, opts: { data: { linking_client_id: string } }) => {
          invitedEmails.push(email);
          if (inviteBehavior === "error") return { data: null, error: { message: "auth provider rejected the invite" } };
          if (inviteBehavior === "no-user") return { data: { user: null }, error: null };
          const newProfileId = `profile-for-${opts.data.linking_client_id}`;
          if (inviteBehavior !== "succeed-no-link") {
            const row = clients.get(opts.data.linking_client_id);
            if (row) row.profile_id = newProfileId;
          }
          return { data: { user: { id: newProfileId } }, error: null };
        },
      },
    },
  };

  return { callerClient, adminClient, invitedEmails };
}

Deno.test("inviteSingleClientToPortal: not_found when RLS hides the client from the caller", async () => {
  const { callerClient, adminClient } = makeFakeEnv({
    clients: [{ id: "c1", profile_id: null, email: "a@x.com", first_name: "A", last_name: "B", company_name: null, client_type: "individual" }],
    visibleClientIds: [], // caller's RLS-scoped client sees nothing
  });

  const result = await inviteSingleClientToPortal({ adminClient, callerClient, clientId: "c1", portalUrl: "https://portal.test" });
  assertEquals(result, { status: "not_found", clientId: "c1" });
});

Deno.test("inviteSingleClientToPortal: not_found when the client genuinely does not exist", async () => {
  const { callerClient, adminClient } = makeFakeEnv({ clients: [] });
  const result = await inviteSingleClientToPortal({ adminClient, callerClient, clientId: "missing", portalUrl: "https://portal.test" });
  assertEquals(result, { status: "not_found", clientId: "missing" });
});

Deno.test("inviteSingleClientToPortal: already_linked when profile_id is already set", async () => {
  const { callerClient, adminClient } = makeFakeEnv({
    clients: [{ id: "c1", profile_id: "existing-profile", email: "a@x.com", first_name: "A", last_name: "B", company_name: null, client_type: "individual" }],
  });
  const result = await inviteSingleClientToPortal({ adminClient, callerClient, clientId: "c1", portalUrl: "https://portal.test" });
  assertEquals(result, { status: "already_linked", clientId: "c1" });
});

Deno.test("inviteSingleClientToPortal: invalid_email when the client has no usable email", async () => {
  const { callerClient, adminClient } = makeFakeEnv({
    clients: [{ id: "c1", profile_id: null, email: null, first_name: "A", last_name: "B", company_name: null, client_type: "individual" }],
  });
  const result = await inviteSingleClientToPortal({ adminClient, callerClient, clientId: "c1", portalUrl: "https://portal.test" });
  assertEquals(result, { status: "invalid_email", clientId: "c1" });
});

Deno.test("inviteSingleClientToPortal: existing_account_found when a profile already owns that email", async () => {
  const { callerClient, adminClient } = makeFakeEnv({
    clients: [{ id: "c1", profile_id: null, email: "taken@x.com", first_name: "A", last_name: "B", company_name: null, client_type: "individual" }],
    profiles: [{ id: "profile-1", email: "taken@x.com" }],
  });
  const result = await inviteSingleClientToPortal({ adminClient, callerClient, clientId: "c1", portalUrl: "https://portal.test" });
  assertEquals(result, { status: "existing_account_found", clientId: "c1", existingEmail: "taken@x.com", existingProfileId: "profile-1" });
});

Deno.test("inviteSingleClientToPortal: invite_failed when the auth provider errors", async () => {
  const { callerClient, adminClient } = makeFakeEnv({
    clients: [{ id: "c1", profile_id: null, email: "a@x.com", first_name: "A", last_name: "B", company_name: null, client_type: "individual" }],
    inviteBehavior: "error",
  });
  const result = await inviteSingleClientToPortal({ adminClient, callerClient, clientId: "c1", portalUrl: "https://portal.test" });
  assertEquals(result, { status: "invite_failed", clientId: "c1", message: "auth provider rejected the invite" });
});

Deno.test("inviteSingleClientToPortal: invited on the happy path, and sends the linking metadata", async () => {
  const { callerClient, adminClient, invitedEmails } = makeFakeEnv({
    clients: [{ id: "c1", profile_id: null, email: "a@x.com", first_name: "Jane", last_name: "Doe", company_name: null, client_type: "individual" }],
  });
  const result = await inviteSingleClientToPortal({ adminClient, callerClient, clientId: "c1", portalUrl: "https://portal.test" });
  assertEquals(result, { status: "invited", clientId: "c1", profileId: "profile-for-c1", email: "a@x.com" });
  assertEquals(invitedEmails, ["a@x.com"]);
});

Deno.test("inviteSingleClientToPortal: invite_failed when the auth call returns no user", async () => {
  const { callerClient, adminClient } = makeFakeEnv({
    clients: [{ id: "c1", profile_id: null, email: "a@x.com", first_name: "A", last_name: "B", company_name: null, client_type: "individual" }],
    inviteBehavior: "no-user",
  });
  const result = await inviteSingleClientToPortal({ adminClient, callerClient, clientId: "c1", portalUrl: "https://portal.test" });
  assertEquals(result.status, "invite_failed");
});

Deno.test("inviteSingleClientToPortal: link_verification_failed when the trigger never linked profile_id", async () => {
  const { callerClient, adminClient } = makeFakeEnv({
    clients: [{ id: "c1", profile_id: null, email: "a@x.com", first_name: "A", last_name: "B", company_name: null, client_type: "individual" }],
    inviteBehavior: "succeed-no-link",
  });
  const result = await inviteSingleClientToPortal({ adminClient, callerClient, clientId: "c1", portalUrl: "https://portal.test" });
  assertEquals(result, { status: "link_verification_failed", clientId: "c1" });
});
