// supabase/functions/cancel-subscription/index.ts
// Deploy with: supabase functions deploy cancel-subscription

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function buildCorsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function jsonResponse(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildCorsHeaders(request),
  });
}

async function getSubscriptionEmailToken(subscriptionCode: string) {
  const response = await fetch(
    `https://api.paystack.co/subscription/${subscriptionCode}`,
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  const data = await response.json();

  if (!data?.status || !data?.data) {
    throw new Error(data?.message ?? "Unable to fetch Paystack subscription details.");
  }

  const emailToken =
    typeof data.data.email_token === "string"
      ? data.data.email_token
      : "";

  if (!emailToken) {
    throw new Error("Paystack did not return an email token for this subscription.");
  }

  return {
    emailToken,
    customerCode:
      typeof data.data.customer?.customer_code === "string"
        ? data.data.customer.customer_code
        : null,
    customerEmail:
      typeof data.data.customer?.email === "string"
        ? data.data.customer.email
        : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the calling user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const { subscription_id } = await req.json();

    if (!subscription_id) {
      return jsonResponse(req, { error: "Subscription ID is required" }, 400);
    }

    // Get subscription from DB and verify ownership
    const { data: sub, error: subErr } = await supabase
      .from("practitioner_subscriptions")
      .select("*")
      .eq("id", subscription_id)
      .eq("practitioner_profile_id", user.id)
      .single();

    if (subErr || !sub) {
      return jsonResponse(req, { error: "Subscription not found" }, 404);
    }

    if (!sub.provider_subscription_id) {
      return jsonResponse(req, { error: "No Paystack subscription ID" }, 400);
    }

    let emailToken =
      sub.metadata
      && typeof sub.metadata === "object"
      && "email_token" in sub.metadata
      && typeof sub.metadata.email_token === "string"
        ? sub.metadata.email_token
        : "";

    if (!emailToken) {
      const paystackSubscription = await getSubscriptionEmailToken(sub.provider_subscription_id);
      emailToken = paystackSubscription.emailToken;

      await supabase
        .from("practitioner_subscriptions")
        .update({
          metadata: {
            ...(sub.metadata && typeof sub.metadata === "object" ? sub.metadata : {}),
            email_token: paystackSubscription.emailToken,
            customer_code: paystackSubscription.customerCode,
            customer_email: paystackSubscription.customerEmail,
          },
        })
        .eq("id", subscription_id);
    }

    // Call Paystack disable endpoint
    const paystackRes = await fetch(
      "https://api.paystack.co/subscription/disable",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: sub.provider_subscription_id,
          token: emailToken,
        }),
      },
    );

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      console.error("Paystack disable failed:", paystackData);
      return jsonResponse(req, { error: paystackData.message ?? "Paystack disable failed." }, 500);
    }

    await supabase
      .from("practitioner_subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", subscription_id);

    return jsonResponse(req, { success: true }, 200);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while cancelling subscription.";

    return jsonResponse(req, { error: message }, 500);
  }
});
