import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type StaffRole = "admin" | "consultant";
type StaffPermissions = {
  assigned_clients_only: boolean;
  can_view_overview: boolean;
  can_view_clients: boolean;
  can_manage_clients: boolean;
  can_view_client_workspace: boolean;
  can_view_cases: boolean;
  can_manage_cases: boolean;
  can_view_documents: boolean;
  can_review_documents: boolean;
  can_view_invoices: boolean;
  can_manage_invoices: boolean;
  can_view_messages: boolean;
  can_reply_messages: boolean;
};

type CreateStaffUserPayload = {
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
  role?: StaffRole;
  permissions?: Partial<StaffPermissions>;
};

const fullStaffPermissions: StaffPermissions = {
  assigned_clients_only: false,
  can_view_overview: true,
  can_view_clients: true,
  can_manage_clients: true,
  can_view_client_workspace: true,
  can_view_cases: true,
  can_manage_cases: true,
  can_view_documents: true,
  can_review_documents: true,
  can_view_invoices: true,
  can_manage_invoices: true,
  can_view_messages: true,
  can_reply_messages: true,
};

const defaultConsultantPermissions: StaffPermissions = {
  assigned_clients_only: true,
  can_view_overview: true,
  can_view_clients: true,
  can_manage_clients: false,
  can_view_client_workspace: true,
  can_view_cases: true,
  can_manage_cases: true,
  can_view_documents: true,
  can_review_documents: true,
  can_view_invoices: true,
  can_manage_invoices: false,
  can_view_messages: true,
  can_reply_messages: true,
};

function sanitizePermissions(role: StaffRole, permissions?: Partial<StaffPermissions>) {
  const base = role === "admin" ? fullStaffPermissions : defaultConsultantPermissions;
  const next = { ...base, ...(permissions ?? {}) };

  if (!next.can_view_clients) next.can_manage_clients = false;
  if (!next.can_view_cases) next.can_manage_cases = false;
  if (!next.can_view_documents) next.can_review_documents = false;
  if (!next.can_view_invoices) next.can_manage_invoices = false;
  if (!next.can_view_messages) next.can_reply_messages = false;

  if (next.can_manage_clients) next.can_view_clients = true;
  if (next.can_manage_cases) next.can_view_cases = true;
  if (next.can_review_documents) next.can_view_documents = true;
  if (next.can_manage_invoices) next.can_view_invoices = true;
  if (next.can_reply_messages) next.can_view_messages = true;

  return next;
}

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
  return new Response(JSON.stringify(body), {
    status,
    headers: buildCorsHeaders(request),
  });
}

function getClientEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getCreateUserErrorMessage(message?: string | null) {
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (
    normalizedMessage.includes("already registered")
    || normalizedMessage.includes("already exists")
    || normalizedMessage.includes("duplicate")
    || normalizedMessage.includes("email address is already")
  ) {
    return "An account with this email already exists.";
  }

  return message || "Unable to create the staff user.";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(request) });
  }

  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse(request, { error: "Missing authorization header." }, 401);
    }

    const supabaseUrl = getClientEnv("SUPABASE_URL");
    const supabaseAnonKey = getClientEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = getClientEnv("SUPABASE_SERVICE_ROLE_KEY");

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user: callerUser },
      error: callerAuthError,
    } = await callerClient.auth.getUser();

    if (callerAuthError || !callerUser) {
      return jsonResponse(request, { error: "You must be signed in to create staff users." }, 401);
    }

    const { data: callerProfile, error: callerProfileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (callerProfileError) {
      return jsonResponse(request, { error: callerProfileError.message }, 400);
    }

    if (callerProfile?.role !== "admin") {
      return jsonResponse(request, { error: "Only Acapolite admins can create staff users." }, 403);
    }

    const payload = (await request.json()) as CreateStaffUserPayload;
    const email = payload.email?.trim().toLowerCase() ?? "";
    const password = payload.password?.trim() ?? "";
    const fullName = payload.fullName?.trim() ?? "";
    const phone = payload.phone?.trim() ?? "";
    const role = payload.role;
    const permissions = sanitizePermissions(role ?? "consultant", payload.permissions);

    if (!email || !password || !fullName || !role) {
      return jsonResponse(request, { error: "Email, password, full name, and role are required." }, 400);
    }

    if (!["admin", "consultant"].includes(role)) {
      return jsonResponse(request, { error: "Role must be admin or consultant." }, 400);
    }

    if (password.length < 8) {
      return jsonResponse(request, { error: "Password must be at least 8 characters long." }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check profiles table for any orphaned profiles
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      // Delete orphaned profile to allow re-creation
      await adminClient
        .from("profiles")
        .delete()
        .eq("id", existingProfile.id);
    }

    const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
        phone,
        role,
      },
    });

    if (createUserError || !createdUserData.user) {
      return jsonResponse(request, { error: getCreateUserErrorMessage(createUserError?.message) }, 400);
    }

    const createdUser = createdUserData.user;

    const { error: profileUpsertError } = await adminClient.from("profiles").upsert({
      id: createdUser.id,
      email,
      full_name: fullName,
      phone: phone || null,
      role,
      is_active: true,
    });

    if (profileUpsertError) {
      await adminClient.auth.admin.deleteUser(createdUser.id);
      return jsonResponse(request, { error: profileUpsertError.message }, 400);
    }

    const { error: permissionsUpsertError } = await adminClient.from("staff_permissions").upsert({
      profile_id: createdUser.id,
      ...permissions,
    });

    if (permissionsUpsertError) {
      await adminClient.auth.admin.deleteUser(createdUser.id);
      return jsonResponse(request, { error: permissionsUpsertError.message }, 400);
    }

    return jsonResponse(request, {
      user: {
        id: createdUser.id,
        email,
        full_name: fullName,
        phone: phone || null,
        role,
        is_active: true,
        permissions,
      },
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while creating the staff user.";
    return jsonResponse(request, { error: message }, 500);
  }
});
