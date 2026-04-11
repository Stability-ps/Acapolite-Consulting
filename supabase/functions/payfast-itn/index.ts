import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { corsHeaders } from "../_shared/cors.ts";

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

function buildSignature(data: Record<string, string>, passphrase?: string) {
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
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const merchantId = requireEnv("PAYFAST_MERCHANT_ID");
    const passphrase = trimString(Deno.env.get("PAYFAST_PASSPHRASE"));
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const body = await request.text();
    const params = new URLSearchParams(body);
    const data = Object.fromEntries(params.entries());

    if (data.merchant_id !== merchantId) {
      return new Response("Invalid merchant", { status: 400 });
    }

    const receivedSignature = trimString(data.signature);
    const { signature: _ignored, ...signaturePayload } = data;
    const expectedSignature = buildSignature(signaturePayload, passphrase || undefined);

    if (!receivedSignature || receivedSignature !== expectedSignature) {
      return new Response("Invalid signature", { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const purchaseId = trimString(data.m_payment_id);

    if (!purchaseId) {
      return new Response("Missing purchase id", { status: 400 });
    }

    const paymentStatus = trimString(data.payment_status).toUpperCase();

    if (paymentStatus === "COMPLETE") {
      const { error } = await adminClient.rpc("complete_practitioner_credit_purchase", {
        p_purchase_id: purchaseId,
        p_provider_payment_id: trimString(data.pf_payment_id) || null,
        p_payment_status: "completed",
        p_metadata: {
          payfast_payload: data,
        },
      });

      if (error) {
        console.error("Unable to complete practitioner credit purchase.", error);
        return new Response("DB error", { status: 500 });
      }
    } else {
      const mappedStatus = paymentStatus === "CANCELLED" ? "cancelled" : "failed";

      const { error } = await adminClient
        .from("practitioner_credit_purchases")
        .update({
          payment_status: mappedStatus,
          provider_payment_id: trimString(data.pf_payment_id) || null,
          metadata: {
            payfast_payload: data,
          },
        })
        .eq("id", purchaseId);

      if (error) {
        console.error("Unable to update failed PayFast purchase.", error);
        return new Response("DB error", { status: 500 });
      }
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("PayFast ITN error", error);
    return new Response("Server error", { status: 500, headers: corsHeaders });
  }
});
