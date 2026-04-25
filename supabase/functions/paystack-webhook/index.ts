import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CREDIT_PACKAGES: Record<string, { credits: number; name: string }> = {
  trial: { credits: 5, name: "Trial Pack" },
  starter: { credits: 10, name: "Starter Pack" },
  growth: { credits: 25, name: "Growth Pack" },
  pro: { credits: 50, name: "Pro Pack" },
};

const STORAGE_ADDONS: Record<string, { storage_mb: number; name: string }> = {
  plus_5gb: { storage_mb: 5 * 1024, name: "+5 GB Storage" },
  plus_10gb: { storage_mb: 10 * 1024, name: "+10 GB Storage" },
  plus_25gb: { storage_mb: 25 * 1024, name: "+25 GB Storage" },
};

async function verifySignature(body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(PAYSTACK_SECRET_KEY),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return hex === signature;
}

function getJsonHeaders() {
  return { "Content-Type": "application/json" };
}

function buildPeriodDates(nextPaymentDate?: string | null) {
  const now = new Date();
  const nextRenewal = nextPaymentDate
    ? new Date(nextPaymentDate)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: nextRenewal.toISOString(),
    nextRenewalAt: nextRenewal.toISOString(),
  };
}

serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";

  if (!(await verifySignature(rawBody, signature))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (event.event) {
      case "charge.success":
        await handleChargeSuccess(supabase, event.data);
        break;
      case "subscription.create":
        await handleSubscriptionCreate(supabase, event.data);
        break;
      case "invoice.update":
      case "invoice.payment_failed":
        await handleInvoiceUpdate(supabase, event.data);
        break;
      case "subscription.disable":
        await handleSubscriptionDisable(supabase, event.data);
        break;
      default:
        console.log("Unhandled Paystack event", event.event);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: getJsonHeaders(),
    });
  } catch (error) {
    console.error("Paystack webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: getJsonHeaders(),
    });
  }
});

async function handleChargeSuccess(supabase: ReturnType<typeof createClient>, data: any) {
  const metadata = data?.metadata ?? {};
  const purchaseType = metadata.purchase_type;
  const reference = data?.reference ?? null;

  if (purchaseType === "credit_package") {
    const purchaseId = metadata.purchase_id ?? reference;
    if (!purchaseId) return;

    await supabase.rpc("complete_practitioner_credit_purchase", {
      p_purchase_id: purchaseId,
      p_provider_payment_id: reference,
      p_payment_status: "completed",
      p_metadata: {
        paystack_reference: reference,
        paystack_event: "charge.success",
      },
    });

    return;
  }

  if (purchaseType === "storage_addon") {
    const purchaseId = metadata.purchase_id ?? reference;
    if (!purchaseId) return;

    await supabase.rpc("complete_practitioner_storage_addon_purchase", {
      p_purchase_id: purchaseId,
      p_provider_payment_id: reference,
      p_payment_status: "completed",
      p_metadata: {
        paystack_reference: reference,
        paystack_event: "charge.success",
      },
    });
  }
}

async function handleSubscriptionCreate(supabase: ReturnType<typeof createClient>, data: any) {
  const customerMetadata = data?.customer?.metadata ?? {};
  const practitionerProfileId = customerMetadata.practitioner_profile_id ?? data?.metadata?.practitioner_profile_id ?? null;
  const planCode = data?.plan?.plan_code ?? data?.plan_code ?? data?.metadata?.plan_code ?? null;
  const subscriptionCode = data?.subscription_code ?? null;

  if (!practitionerProfileId || !planCode || !subscriptionCode) {
    console.error("subscription.create missing practitionerProfileId, planCode, or subscriptionCode");
    return;
  }

  const { data: planRow, error: planError } = await supabase
    .from("practitioner_subscription_plans")
    .select("credits_per_month, storage_limit_mb")
    .eq("code", planCode)
    .maybeSingle();

  if (planError || !planRow) {
    throw planError ?? new Error(`Subscription plan ${planCode} not found.`);
  }

  const periodDates = buildPeriodDates(data?.next_payment_date);

  const { error: upsertError } = await supabase
    .from("practitioner_subscriptions")
    .upsert({
      practitioner_profile_id: practitionerProfileId,
      plan_code: planCode,
      status: "active",
      payment_provider: "paystack",
      provider_subscription_id: subscriptionCode,
      started_at: data?.created_at ?? new Date().toISOString(),
      current_period_start: periodDates.currentPeriodStart,
      current_period_end: periodDates.currentPeriodEnd,
      next_renewal_at: periodDates.nextRenewalAt,
      last_credited_at: new Date().toISOString(),
      metadata: {
        ...(customerMetadata ?? {}),
        customer_code: data?.customer?.customer_code ?? null,
        customer_email: data?.customer?.email ?? null,
        email_token: data?.email_token ?? data?.customer?.email_token ?? null,
      },
    }, { onConflict: "provider_subscription_id" });

  if (upsertError) {
    throw upsertError;
  }

  const { data: subscriptionRow, error: subscriptionError } = await supabase
    .from("practitioner_subscriptions")
    .select("id")
    .eq("provider_subscription_id", subscriptionCode)
    .maybeSingle();

  if (subscriptionError || !subscriptionRow) {
    throw subscriptionError ?? new Error("Subscription row was not created.");
  }

  await grantMonthlyCredits(supabase, {
    practitionerProfileId,
    subscriptionId: subscriptionRow.id,
    planCode,
    creditsPerMonth: planRow.credits_per_month,
    expiresAt: periodDates.nextRenewalAt,
    description: `${planCode} monthly credits reset`,
  });

  await supabase
    .from("practitioner_credit_accounts")
    .update({
      storage_base_limit_mb: planRow.storage_limit_mb,
    })
    .eq("profile_id", practitionerProfileId);
}

async function handleInvoiceUpdate(supabase: ReturnType<typeof createClient>, data: any) {
  const subscriptionCode = data?.subscription?.subscription_code ?? data?.subscription_code ?? null;
  if (!subscriptionCode) {
    return;
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("practitioner_subscriptions")
    .select("id, practitioner_profile_id, plan_code")
    .eq("provider_subscription_id", subscriptionCode)
    .maybeSingle();

  if (subscriptionError || !subscription) {
    throw subscriptionError ?? new Error("Subscription not found for invoice update.");
  }

  if (!data?.paid) {
    const { error } = await supabase
      .from("practitioner_subscriptions")
      .update({ status: "past_due" })
      .eq("id", subscription.id);

    if (error) {
      throw error;
    }
    return;
  }

  const { data: planRow, error: planError } = await supabase
    .from("practitioner_subscription_plans")
    .select("credits_per_month, storage_limit_mb")
    .eq("code", subscription.plan_code)
    .maybeSingle();

  if (planError || !planRow) {
    throw planError ?? new Error(`Subscription plan ${subscription.plan_code} not found.`);
  }

  const periodDates = buildPeriodDates(data?.next_payment_date);

  const { error: updateError } = await supabase
    .from("practitioner_subscriptions")
    .update({
      status: "active",
      current_period_start: periodDates.currentPeriodStart,
      current_period_end: periodDates.currentPeriodEnd,
      next_renewal_at: periodDates.nextRenewalAt,
      last_credited_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  if (updateError) {
    throw updateError;
  }

  await grantMonthlyCredits(supabase, {
    practitionerProfileId: subscription.practitioner_profile_id,
    subscriptionId: subscription.id,
    planCode: subscription.plan_code,
    creditsPerMonth: planRow.credits_per_month,
    expiresAt: periodDates.nextRenewalAt,
    description: `${subscription.plan_code} monthly credits reset`,
  });

  await supabase
    .from("practitioner_credit_accounts")
    .update({
      storage_base_limit_mb: planRow.storage_limit_mb,
    })
    .eq("profile_id", subscription.practitioner_profile_id);
}

async function handleSubscriptionDisable(supabase: ReturnType<typeof createClient>, data: any) {
  const subscriptionCode = data?.subscription_code ?? null;
  if (!subscriptionCode) {
    return;
  }

  const { error } = await supabase
    .from("practitioner_subscriptions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("provider_subscription_id", subscriptionCode);

  if (error) {
    throw error;
  }
}

async function grantMonthlyCredits(
  supabase: ReturnType<typeof createClient>,
  params: {
    practitionerProfileId: string;
    subscriptionId: string;
    planCode: string;
    creditsPerMonth: number;
    expiresAt: string;
    description: string;
  },
) {
  const { data: rpcResult, error: rpcError } = await supabase.rpc("grant_practitioner_monthly_credits", {
    p_profile_id: params.practitionerProfileId,
    p_credits: params.creditsPerMonth,
    p_expires_at: params.expiresAt,
  });

  if (rpcError) {
    throw rpcError;
  }

  const { error: transactionError } = await supabase
    .from("practitioner_credit_transactions")
    .insert({
      practitioner_profile_id: params.practitionerProfileId,
      subscription_id: params.subscriptionId,
      transaction_type: "subscription_credit",
      credits_delta: params.creditsPerMonth,
      balance_after: rpcResult ?? 0,
      description: params.description,
      credit_bucket: "monthly",
      metadata: {
        plan_code: params.planCode,
        expires_at: params.expiresAt,
      },
    });

  if (transactionError) {
    throw transactionError;
  }
}
