import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { corsHeaders } from "../_shared/cors.ts";

type CheckoutMode = "fake" | "payfast_sandbox" | "payfast_live";

type CreditPackage = {
  code: string;
  name: string;
  credits: number;
  amountZar: number;
};

type CheckoutPayload = {
  packageCode?: string;
};

const CREDIT_PACKAGES: CreditPackage[] = [
  { code: "starter", name: "Starter Package", credits: 5, amountZar: 100 },
  { code: "professional", name: "Professional Package", credits: 15, amountZar: 250 },
  { code: "business", name: "Business Package", credits: 40, amountZar: 500 },
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

function requireEnv(name: string, fallback?: string) {
  const value = Deno.env.get(name) ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getCheckoutMode() {
  const raw = trimString(Deno.env.get("PRACTITIONER_CREDIT_CHECKOUT_MODE")).toLowerCase();

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
      return jsonResponse({ error: "You must be signed in to purchase credits." }, 401);
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
      return jsonResponse({ error: "Only practitioners can purchase marketplace credits." }, 403);
    }

    const payload = (await request.json()) as CheckoutPayload;
    const selectedPackage = CREDIT_PACKAGES.find((item) => item.code === trimString(payload.packageCode).toLowerCase());

    if (!selectedPackage) {
      return jsonResponse({ error: "Invalid credit package selected." }, 400);
    }

    const checkoutMode = getCheckoutMode();
    const paymentProvider = checkoutMode === "fake" ? "test" : "payfast";

    const { data: purchase, error: purchaseError } = await adminClient
      .from("practitioner_credit_purchases")
      .insert({
        practitioner_profile_id: user.id,
        package_code: selectedPackage.code,
        package_name: selectedPackage.name,
        credits: selectedPackage.credits,
        amount_zar: selectedPackage.amountZar,
        currency: "ZAR",
        payment_provider: paymentProvider,
        payment_status: checkoutMode === "fake" ? "completed" : "pending",
        metadata: {
          checkout_mode: checkoutMode,
        },
      })
      .select("*")
      .single();

    if (purchaseError || !purchase) {
      return jsonResponse({ error: purchaseError?.message || "Unable to create the credit purchase." }, 400);
    }

    if (checkoutMode === "fake") {
      const { data: balance, error: completeError } = await adminClient.rpc("complete_practitioner_credit_purchase", {
        p_purchase_id: purchase.id,
        p_provider_payment_id: `FAKE-${purchase.id}`,
        p_payment_status: "completed",
        p_metadata: {
          checkout_mode: checkoutMode,
          completed_via: "fake_checkout",
        },
      });

      if (completeError) {
        return jsonResponse({ error: completeError.message }, 400);
      }

      return jsonResponse({
        success: true,
        mode: checkoutMode,
        purchaseId: purchase.id,
        credits: selectedPackage.credits,
        balance,
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
    const returnUrl = `${portalUrl.replace(/\/$/, "")}/dashboard/staff/profile?credits=success`;
    const cancelUrl = `${portalUrl.replace(/\/$/, "")}/dashboard/staff/profile?credits=cancelled`;

    const payFastFields: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      name_first: trimString(profile.full_name).split(/\s+/)[0] || "Practitioner",
      email_address: trimString(profile.email) || trimString(user.email),
      m_payment_id: purchase.id,
      amount: selectedPackage.amountZar.toFixed(2),
      item_name: selectedPackage.name,
      item_description: `${selectedPackage.credits} marketplace credits`,
      custom_str1: user.id,
      custom_str2: selectedPackage.code,
      currency: "ZAR",
    };

    payFastFields.signature = buildPayFastSignature(payFastFields, passphrase || undefined);

    return jsonResponse({
      success: true,
      mode: checkoutMode,
      purchaseId: purchase.id,
      paymentUrl,
      fields: payFastFields,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while creating the credit checkout.";
    return jsonResponse({ error: message }, 500);
  }
});
