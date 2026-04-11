import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { corsHeaders } from "../_shared/cors.ts";

type CheckoutMode = "fake" | "payfast_sandbox" | "payfast_live";

type CheckoutPayload = {
  planCode?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function trimString(value?: string | null) {
  return value?.trim() ?? "";
}

function requireEnv(name: string, fallback?: string) {
  const value = Deno.env.get(name) ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getCheckoutMode() {
  const raw = trimString(Deno.env.get("PRACTITIONER_SUBSCRIPTION_CHECKOUT_MODE")).toLowerCase();

  if (raw === "payfast_sandbox" || raw === "payfast_live") {
    return raw satisfies CheckoutMode;
  }

  return "fake" satisfies CheckoutMode;
}

function buildPayFastSignature(data: Record<string, string>, passphrase?: string) {
  const sorted = Object.keys(data)
    .sort()
    .filter((key) => key !== "signature" && data[key] !== "")
    .map((key) => `${key}=${encodeURIComponent(data[key]).replace(/%20/g, "+")}`)
    .join("&");

  const withPassphrase = passphrase
    ? `${sorted}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`
    : sorted;

  return createHash("md5").update(withPassphrase).digest("hex");
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
    const portalUrl = requireEnv("PORTAL_URL", "https://acapoliteconsulting.co.za");

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
      data: { user },
      error: authError,
    } = await callerClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "You must be signed in to start a subscription." }, 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "consultant") {
      return jsonResponse({ error: "Only practitioners can subscribe to monthly plans." }, 403);
    }

    const payload = (await request.json()) as CheckoutPayload;
    const planCode = trimString(payload.planCode).toLowerCase();

    const { data: plan, error: planError } = await adminClient
      .from("practitioner_subscription_plans")
      .select("*")
      .eq("code", planCode)
      .maybeSingle();

    if (planError || !plan) {
      return jsonResponse({ error: "Invalid subscription plan selected." }, 400);
    }

    const checkoutMode = getCheckoutMode();

    if (checkoutMode === "fake") {
      const { data: subscriptionId, error: subscriptionError } = await adminClient.rpc("activate_practitioner_subscription", {
        p_profile_id: user.id,
        p_plan_code: plan.code,
        p_payment_provider: "test",
        p_provider_subscription_id: `FAKE-${user.id}-${plan.code}`,
      });

      if (subscriptionError) {
        return jsonResponse({ error: subscriptionError.message }, 400);
      }

      return jsonResponse({
        success: true,
        mode: checkoutMode,
        subscriptionId,
      });
    }

    const merchantId = requireEnv("PAYFAST_MERCHANT_ID");
    const merchantKey = requireEnv("PAYFAST_MERCHANT_KEY");
    const passphrase = trimString(Deno.env.get("PAYFAST_PASSPHRASE"));
    const paymentUrl = checkoutMode === "payfast_sandbox"
      ? "https://sandbox.payfast.co.za/eng/process"
      : "https://www.payfast.co.za/eng/process";
    const projectRef = new URL(supabaseUrl).host.split(".")[0];
    const notifyUrl = `https://${projectRef}.supabase.co/functions/v1/payfast-itn`;
    const returnUrl = `${portalUrl.replace(/\/$/, "")}/dashboard/staff/credits?subscription=success`;
    const cancelUrl = `${portalUrl.replace(/\/$/, "")}/dashboard/staff/credits?subscription=cancelled`;

    const payFastFields: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      name_first: trimString(profile.full_name).split(/\s+/)[0] || "Practitioner",
      email_address: trimString(profile.email) || trimString(user.email),
      m_payment_id: `SUB-${user.id}-${plan.code}-${Date.now()}`,
      amount: Number(plan.price_zar).toFixed(2),
      item_name: plan.name,
      item_description: `${plan.credits_per_month} credits per month`,
      custom_str1: user.id,
      custom_str2: plan.code,
      custom_str3: "subscription",
      currency: "ZAR",
      subscription_type: "1",
      frequency: "3",
      cycles: "0",
    };

    payFastFields.signature = buildPayFastSignature(payFastFields, passphrase || undefined);

    return jsonResponse({
      success: true,
      mode: checkoutMode,
      paymentUrl,
      fields: payFastFields,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while starting the subscription.";
    return jsonResponse({ error: message }, 500);
  }
});
