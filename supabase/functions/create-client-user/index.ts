import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CreateClientUserPayload = {
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
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
  return new Response(JSON.stringify(body), {
    status,
    headers: buildCorsHeaders(request),
  });
}

function getEnv(name: string) {
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

  return message || "Unable to create the client user.";
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

    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

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
      return jsonResponse(request, { error: "You must be signed in to create client accounts." }, 401);
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
      return jsonResponse(request, { error: "Only Acapolite admins can create client accounts." }, 403);
    }

    const payload = (await request.json()) as CreateClientUserPayload;
    const email = payload.email?.trim().toLowerCase() ?? "";
    const password = payload.password?.trim() ?? "";
    const fullName = payload.fullName?.trim() ?? "";
    const phone = payload.phone?.trim() ?? "";

    if (!email || !password || !fullName) {
      return jsonResponse(request, { error: "Email, password, and full name are required." }, 400);
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

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return jsonResponse(request, { error: "An account with this email already exists." }, 400);
    }

    const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
        account_type: "client",
        role: "client",
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
      role: "client",
      is_active: true,
    });

    if (profileUpsertError) {
      await adminClient.auth.admin.deleteUser(createdUser.id);
      return jsonResponse(request, { error: profileUpsertError.message }, 400);
    }

    return jsonResponse(request, {
      user: {
        id: createdUser.id,
        email,
        full_name: fullName,
        phone: phone || null,
        role: "client",
        is_active: true,
      },
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while creating the client user.";
    return jsonResponse(request, { error: message }, 500);
  }
});
