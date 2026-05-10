
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type CreditPackage = {
  code: string;
  name: string;
  credits: number;
  priceZar: number;
};

type RequestPayload = {
  packageCode?: string;
};

// Canonical credit package definitions. Must stay in sync with
// src/lib/practitionerBilling.ts BILLING_CREDIT_PACKAGES.
// Once a practitioner_credit_packages DB table is introduced (audit C3
// follow-up), this constant should read from that table instead.
const CREDIT_PACKAGES: CreditPackage[] = [
  { code: "trial",   name: "Trial Pack",   credits: 5,  priceZar: 179 },
  { code: "starter", name: "Starter Pack", credits: 10, priceZar: 329 },
  { code: "growth",  name: "Growth Pack",  credits: 25, priceZar: 749 },
  { code: "pro",     name: "Pro Pack",     credits: 50, priceZar: 1399 },
];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function trimString(value?: string | null) {
  return value?.trim() ?? "";
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return jsonResponse({ error: "Missing authorization header." }, 401);
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    // Verify the caller's identity using their JWT
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await callerClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "You must be signed in to purchase credits." }, 401);
    }

    // Service-role client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Confirm the caller is a practitioner (consultant role)
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, email, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500);
    }
    if (!profile || profile.role !== "consultant") {
      return jsonResponse({ error: "Only practitioners can purchase credits." }, 403);
    }

    // Parse and validate the request body
    const payload = (await request.json().catch(() => ({}))) as RequestPayload;
    const requestedCode = trimString(payload.packageCode).toLowerCase();

    if (!requestedCode) {
      return jsonResponse({ error: "Package code is required." }, 400);
    }

    const selectedPackage = CREDIT_PACKAGES.find((item) => item.code === requestedCode);
    if (!selectedPackage) {
      return jsonResponse({ error: "Invalid credit package selected." }, 400);
    }

    // Insert the purchase row server-side with verified credits and amount
    const { data: purchase, error: purchaseError } = await adminClient
      .from("practitioner_credit_purchases")
      .insert({
        practitioner_profile_id: user.id,
        package_code: selectedPackage.code,
        package_name: selectedPackage.name,
        credits: selectedPackage.credits,
        amount_zar: selectedPackage.priceZar,
        currency: "ZAR",
        payment_provider: "paystack",
        payment_status: "pending",
        metadata: {
          purchase_type: "credit_package",
          server_created: true,
        },
      })
      .select("id, package_code, package_name, credits, amount_zar, currency")
      .single();

    if (purchaseError || !purchase) {
      return jsonResponse({ error: purchaseError?.message || "Unable to create credit purchase." }, 500);
    }

    return jsonResponse({
      success: true,
      purchaseId: purchase.id,
      packageCode: purchase.package_code,
      packageName: purchase.package_name,
      credits: purchase.credits,
      amountZar: Number(purchase.amount_zar),
      currency: purchase.currency,
      email: profile.email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    console.error("create-practitioner-credit-purchase error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
