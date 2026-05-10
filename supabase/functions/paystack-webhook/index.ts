import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PAYSTACK_PLAN_CODE_MAP: Record<string, string> = {
  PLN_itawkcig6c30q77: "starter",
  PLN_9deli5oghu3lt2h: "professional",
  PLN_6qfph5xvmtzgpag: "business",
};

// ─────────────────────────────────────────────
// Signature verification
// ─────────────────────────────────────────────
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


function verifyChargeIntegrity(
  data: any,
  expectedAmountZar: number,
  expectedCurrency = "ZAR",
): { ok: boolean; reason?: string } {
  const status = String(data?.status ?? "").toLowerCase();
  if (status !== "success") {
    return { ok: false, reason: `status mismatch: got "${status}", expected "success"` };
  }

  const currency = String(data?.currency ?? "").toUpperCase();
  if (currency !== expectedCurrency.toUpperCase()) {
    return {
      ok: false,
      reason: `currency mismatch: got "${currency}", expected "${expectedCurrency}"`,
    };
  }

  const actualAmount = Number(data?.amount ?? 0);
  const expectedAmount = Math.round(Number(expectedAmountZar) * 100);
  if (!Number.isFinite(actualAmount) || actualAmount !== expectedAmount) {
    return {
      ok: false,
      reason: `amount mismatch: got ${actualAmount} (minor unit), expected ${expectedAmount} (${expectedAmountZar} ZAR)`,
    };
  }

  return { ok: true };
}

// ─────────────────────────────────────────────
// Period date helpers
// ─────────────────────────────────────────────
function buildPeriodDates(nextPaymentDate?: string | null, anchorDate?: string | null) {
  const now = anchorDate ? new Date(anchorDate) : new Date();
  const nextRenewal = nextPaymentDate
    ? new Date(nextPaymentDate)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: nextRenewal.toISOString(),
    nextRenewalAt: nextRenewal.toISOString(),
  };
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

// ─────────────────────────────────────────────
// Metadata extraction helper
// Paystack can put practitioner_profile_id in several places
// depending on how the transaction was initialised.
// We check every known location so nothing is missed.
// ─────────────────────────────────────────────
function extractPractitionerProfileId(data: any): string | null {
  return (
    normalizeString(data?.metadata?.practitioner_profile_id) ??         // transaction-level metadata
    normalizeString(data?.customer?.metadata?.practitioner_profile_id) ?? // customer-level metadata
    normalizeString(data?.plan?.metadata?.practitioner_profile_id) ??   // plan-level metadata (rare)
    null
  );
}

function extractPlanCode(data: any): string | null {
  const rawPlanCode = normalizeString(data?.metadata?.plan_code)
    ?? normalizeString(data?.plan_code)
    ?? normalizeString(data?.plan?.plan_code);

  if (!rawPlanCode) {
    return null;
  }

  return PAYSTACK_PLAN_CODE_MAP[rawPlanCode] ?? rawPlanCode.toLowerCase();
}

function extractSubscriptionCode(data: any): string | null {
  return normalizeString(data?.subscription_code)
    ?? normalizeString(data?.subscription?.subscription_code)
    ?? null;
}

async function resolvePractitionerProfileId(
  supabase: ReturnType<typeof createClient>,
  data: any,
  existingPractitionerProfileId?: string | null,
) {
  if (existingPractitionerProfileId) {
    return existingPractitionerProfileId;
  }

  const directPractitionerProfileId = extractPractitionerProfileId(data);
  if (directPractitionerProfileId) {
    return directPractitionerProfileId;
  }

  const customerEmail = normalizeString(data?.customer?.email) ?? normalizeString(data?.email);
  if (!customerEmail) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", customerEmail)
    .eq("role", "consultant")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return profile?.id ?? null;
}

async function ensureSubscriptionRecord(
  supabase: ReturnType<typeof createClient>,
  data: any,
  options?: {
    allowCreateWithoutSubscriptionCode?: boolean;
  },
) {
  const subscriptionCode = extractSubscriptionCode(data);

  let existingSubscription:
    | {
      id: string;
      practitioner_profile_id: string;
      plan_code: string;
      provider_subscription_id: string | null;
      started_at: string;
      metadata: Record<string, unknown> | null;
      last_credited_at: string | null;
    }
    | null = null;

  if (subscriptionCode) {
    const { data: byProviderCode, error } = await supabase
      .from("practitioner_subscriptions")
      .select("id, practitioner_profile_id, plan_code, provider_subscription_id, started_at, metadata, last_credited_at")
      .eq("provider_subscription_id", subscriptionCode)
      .maybeSingle();

    if (error) {
      throw error;
    }

    existingSubscription = byProviderCode;
  }

  const practitionerProfileId = await resolvePractitionerProfileId(
    supabase,
    data,
    existingSubscription?.practitioner_profile_id ?? null,
  );
  const planCode = existingSubscription?.plan_code ?? extractPlanCode(data);

  if (!practitionerProfileId || !planCode) {
    console.error(
      "subscription webhook missing practitionerProfileId or planCode",
      JSON.stringify({
        practitionerProfileId,
        planCode,
        subscriptionCode,
        customerEmail: data?.customer?.email ?? null,
        rawPlanCode: data?.plan?.plan_code ?? data?.plan_code ?? data?.metadata?.plan_code ?? null,
      }),
    );
    return null;
  }

  if (!existingSubscription) {
    const { data: activeSubscription, error } = await supabase
      .from("practitioner_subscriptions")
      .select("id, practitioner_profile_id, plan_code, provider_subscription_id, started_at, metadata, last_credited_at")
      .eq("practitioner_profile_id", practitionerProfileId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw error;
    }

    existingSubscription = activeSubscription;
  }

  if (!subscriptionCode && !existingSubscription && !options?.allowCreateWithoutSubscriptionCode) {
    console.error(
      "subscription webhook missing subscriptionCode and no active subscription exists",
      JSON.stringify({ practitionerProfileId, planCode }),
    );
    return null;
  }

  const { data: planRow, error: planError } = await supabase
    .from("practitioner_subscription_plans")
    .select("code, credits_per_month, storage_limit_mb")
    .eq("code", planCode)
    .maybeSingle();

  if (planError || !planRow) {
    throw planError ?? new Error(`Subscription plan not found: ${planCode}`);
  }

  const periodDates = buildPeriodDates(
    data?.next_payment_date ?? data?.subscription?.next_payment_date ?? null,
    data?.paid_at ?? data?.paidAt ?? data?.created_at ?? data?.createdAt ?? null,
  );

  const mergedMetadata = {
    ...((existingSubscription?.metadata as Record<string, unknown> | null) ?? {}),
    customer_code: data?.customer?.customer_code ?? null,
    customer_email: data?.customer?.email ?? null,
    email_token: data?.email_token ?? data?.customer?.email_token ?? null,
    raw_plan_code: data?.plan?.plan_code ?? data?.plan_code ?? null,
    purchase_type: data?.metadata?.purchase_type ?? null,
    paystack_reference: data?.reference ?? null,
    practitioner_profile_id: practitionerProfileId,
    plan_code: planCode,
  };

  const startedAt = existingSubscription?.started_at
    ?? data?.created_at
    ?? data?.createdAt
    ?? data?.paid_at
    ?? data?.paidAt
    ?? new Date().toISOString();

  const writePayload = {
    practitioner_profile_id: practitionerProfileId,
    plan_code: planCode,
    status: "active",
    payment_provider: "paystack",
    provider_subscription_id: subscriptionCode ?? existingSubscription?.provider_subscription_id ?? null,
    started_at: startedAt,
    current_period_start: periodDates.currentPeriodStart,
    current_period_end: periodDates.currentPeriodEnd,
    next_renewal_at: periodDates.nextRenewalAt,
    metadata: mergedMetadata,
  };

  let subscriptionRow:
    | {
      id: string;
      practitioner_profile_id: string;
      plan_code: string;
      provider_subscription_id: string | null;
      last_credited_at: string | null;
    }
    | null = null;

  if (existingSubscription) {
    const { data: updatedSubscription, error: updateError } = await supabase
      .from("practitioner_subscriptions")
      .update(writePayload)
      .eq("id", existingSubscription.id)
      .select("id, practitioner_profile_id, plan_code, provider_subscription_id, last_credited_at")
      .single();

    if (updateError) {
      throw updateError;
    }

    subscriptionRow = updatedSubscription;
  } else {
    const { data: insertedSubscription, error: insertError } = await supabase
      .from("practitioner_subscriptions")
      .insert(writePayload)
      .select("id, practitioner_profile_id, plan_code, provider_subscription_id, last_credited_at")
      .single();

    if (insertError) {
      throw insertError;
    }

    subscriptionRow = insertedSubscription;
  }

  return {
    subscription: subscriptionRow,
    plan: planRow,
    periodDates,
    wasCreated: !existingSubscription,
  };
}

// ─────────────────────────────────────────────
// Main server
// ─────────────────────────────────────────────
serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";

  if (!(await verifySignature(rawBody, signature))) {
    console.error("Paystack webhook: signature verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Always log every incoming event for debugging
  console.log(`Paystack webhook received: ${event.event}`, JSON.stringify(event.data, null, 2));

  try {
    switch (event.event) {
      case "charge.success":
        await handleChargeSuccess(supabase, event.data);
        break;

      case "subscription.create":
        await handleSubscriptionCreate(supabase, event.data);
        break;

      // invoice.update fires after EVERY subscription billing attempt
      // (both successful and failed). This is the correct official event name.
      case "invoice.update":
        await handleInvoiceUpdate(supabase, event.data);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(supabase, event.data);
        break;

      case "subscription.disable":
        await handleSubscriptionDisable(supabase, event.data);
        break;

      case "subscription.not_renew":
        // Subscription flagged to not renew — log it but no DB action needed
        console.log("Subscription set to not renew:", event.data?.subscription_code);
        break;

      default:
        console.log("Unhandled Paystack event:", event.event);
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

  console.log(`charge.success — purchase_type: ${purchaseType}, reference: ${reference}`);

  if (purchaseType === "credit_package") {
    const purchaseId = metadata.purchase_id ?? reference;
    if (!purchaseId) {
      console.error("charge.success credit_package: missing purchase_id");
      return;
    }

    const { data: purchase, error: fetchError } = await supabase
      .from("practitioner_credit_purchases")
      .select("id, amount_zar, currency, payment_status")
      .eq("id", purchaseId)
      .maybeSingle();

    if (fetchError) {
      console.error("charge.success credit_package: failed to fetch purchase", fetchError);
      throw fetchError;
    }
    if (!purchase) {
      console.error(`charge.success credit_package: purchase ${purchaseId} not found`);
      return;
    }

    const verification = verifyChargeIntegrity(
      data,
      Number(purchase.amount_zar),
      String(purchase.currency ?? "ZAR"),
    );
    if (!verification.ok) {
      console.error(
        `charge.success credit_package: integrity check failed for purchase ${purchaseId}: ${verification.reason}`,
      );
      await supabase
        .from("practitioner_credit_purchases")
        .update({
          payment_status: "failed",
          metadata: {
            paystack_reference: reference,
            paystack_event: "charge.success",
            failure_reason: verification.reason,
            paystack_amount: data?.amount ?? null,
            paystack_currency: data?.currency ?? null,
            paystack_status: data?.status ?? null,
          },
        })
        .eq("id", purchaseId)
        .eq("payment_status", "pending");
      return;
    }

    const { error } = await supabase.rpc("complete_practitioner_credit_purchase", {
      p_purchase_id: purchaseId,
      p_provider_payment_id: reference,
      p_payment_status: "completed",
      p_metadata: {
        paystack_reference: reference,
        paystack_event: "charge.success",
        verified_amount: data.amount,
        verified_currency: data.currency,
      },
    });
    if (error) throw error;
    return;
  }

  if (purchaseType === "storage_addon") {
    const purchaseId = metadata.purchase_id ?? reference;
    if (!purchaseId) {
      console.error("charge.success storage_addon: missing purchase_id");
      return;
    }

    const { data: purchase, error: fetchError } = await supabase
      .from("practitioner_storage_addon_purchases")
      .select("id, amount_zar, currency, payment_status")
      .eq("id", purchaseId)
      .maybeSingle();

    if (fetchError) {
      console.error("charge.success storage_addon: failed to fetch purchase", fetchError);
      throw fetchError;
    }
    if (!purchase) {
      console.error(`charge.success storage_addon: purchase ${purchaseId} not found`);
      return;
    }

    const verification = verifyChargeIntegrity(
      data,
      Number(purchase.amount_zar),
      String(purchase.currency ?? "ZAR"),
    );
    if (!verification.ok) {
      console.error(
        `charge.success storage_addon: integrity check failed for purchase ${purchaseId}: ${verification.reason}`,
      );
      await supabase
        .from("practitioner_storage_addon_purchases")
        .update({
          payment_status: "failed",
          metadata: {
            paystack_reference: reference,
            paystack_event: "charge.success",
            failure_reason: verification.reason,
            paystack_amount: data?.amount ?? null,
            paystack_currency: data?.currency ?? null,
            paystack_status: data?.status ?? null,
          },
        })
        .eq("id", purchaseId)
        .eq("payment_status", "pending");
      return;
    }

    const { error } = await supabase.rpc("complete_practitioner_storage_addon_purchase", {
      p_purchase_id: purchaseId,
      p_provider_payment_id: reference,
      p_payment_status: "completed",
      p_metadata: {
        paystack_reference: reference,
        paystack_event: "charge.success",
        verified_amount: data.amount,
        verified_currency: data.currency,
      },
    });
    if (error) throw error;
    return;
  }

  // For subscription charges (initial + renewals) Paystack fires charge.success
  // alongside subscription.create / invoice.update. In practice, some Paystack
  // deliveries arrive without the later events or without enough metadata, so
  // we provision the first successful subscription charge here as a fallback.
  // We still skip if an active subscription already exists to avoid duplicate
  // monthly credits for renewals.
  if (purchaseType === "subscription" || data?.plan || metadata.plan_code) {
    const resolved = await ensureSubscriptionRecord(supabase, data, {
      allowCreateWithoutSubscriptionCode: true,
    });

    if (!resolved) {
      return;
    }

    if (!resolved.wasCreated) {
      console.log("charge.success: active subscription already exists, waiting for subscription.create / invoice.update.");
      return;
    }

    await grantMonthlyCredits(supabase, {
      practitionerProfileId: resolved.subscription.practitioner_profile_id,
      subscriptionId: resolved.subscription.id,
      planCode: resolved.subscription.plan_code,
      creditsPerMonth: resolved.plan.credits_per_month,
      expiresAt: resolved.periodDates.nextRenewalAt,
      description: `${resolved.subscription.plan_code} initial subscription credits`,
      paymentReference: reference,
      providerSubscriptionId: resolved.subscription.provider_subscription_id,
      billingEvent: "charge.success",
    });

    const { error: storageError } = await supabase
      .from("practitioner_credit_accounts")
      .update({ storage_base_limit_mb: resolved.plan.storage_limit_mb })
      .eq("profile_id", resolved.subscription.practitioner_profile_id);

    if (storageError) {
      throw storageError;
    }

    console.log(`charge.success: provisioned initial subscription credits for ${resolved.subscription.practitioner_profile_id}`);
    return;
  }

  // Unknown purchase type — log so you can investigate in Supabase logs
  console.warn("charge.success: unrecognised purchase_type:", purchaseType, "Full metadata:", JSON.stringify(metadata));
}

// ─────────────────────────────────────────────
// subscription.create
//
// Fires once when a customer is first subscribed to a plan.
// practitioner_profile_id MUST be in metadata when you initialise
// the Paystack transaction, e.g.:
//   metadata: { practitioner_profile_id: "uuid-here", plan_code: "starter" }
// ─────────────────────────────────────────────
async function handleSubscriptionCreate(supabase: ReturnType<typeof createClient>, data: any) {
  const resolved = await ensureSubscriptionRecord(supabase, data);
  if (!resolved) {
    return;
  }

  await grantMonthlyCredits(supabase, {
    practitionerProfileId: resolved.subscription.practitioner_profile_id,
    subscriptionId: resolved.subscription.id,
    planCode: resolved.subscription.plan_code,
    creditsPerMonth: resolved.plan.credits_per_month,
    expiresAt: resolved.periodDates.nextRenewalAt,
    description: `${resolved.subscription.plan_code} initial subscription credits`,
    paymentReference: normalizeString(data?.reference),
    providerSubscriptionId: resolved.subscription.provider_subscription_id,
    billingEvent: "subscription.create",
  });

  const { error: storageError } = await supabase
    .from("practitioner_credit_accounts")
    .update({ storage_base_limit_mb: resolved.plan.storage_limit_mb })
    .eq("profile_id", resolved.subscription.practitioner_profile_id);

  if (storageError) throw storageError;

  console.log(`subscription.create: processed for ${resolved.subscription.practitioner_profile_id}, plan ${resolved.subscription.plan_code}`);
}

// ─────────────────────────────────────────────
// invoice.update
//
// Fires after EVERY subscription billing attempt (success or failure).
// data.paid === true  → charge succeeded → renew subscription + grant credits
// data.paid === false → charge failed    → mark as past_due
// ─────────────────────────────────────────────
async function handleInvoiceUpdate(supabase: ReturnType<typeof createClient>, data: any) {
  const resolved = await ensureSubscriptionRecord(supabase, data);
  if (!resolved) {
    return;
  }

  // Payment failed
  if (!data?.paid) {
    const { error } = await supabase
      .from("practitioner_subscriptions")
      .update({ status: "past_due" })
      .eq("id", resolved.subscription.id);

    if (error) throw error;
    console.log(`invoice.update: marked past_due for subscription ${resolved.subscription.id}`);
    return;
  }

  await grantMonthlyCredits(supabase, {
    practitionerProfileId: resolved.subscription.practitioner_profile_id,
    subscriptionId: resolved.subscription.id,
    planCode: resolved.subscription.plan_code,
    creditsPerMonth: resolved.plan.credits_per_month,
    expiresAt: resolved.periodDates.nextRenewalAt,
    description: `${resolved.subscription.plan_code} monthly renewal credits`,
    paymentReference: normalizeString(data?.reference),
    providerSubscriptionId: resolved.subscription.provider_subscription_id,
    billingEvent: "invoice.update",
  });

  const { error: storageError } = await supabase
    .from("practitioner_credit_accounts")
    .update({ storage_base_limit_mb: resolved.plan.storage_limit_mb })
    .eq("profile_id", resolved.subscription.practitioner_profile_id);

  if (storageError) throw storageError;

  console.log(`invoice.update: renewed subscription ${resolved.subscription.id} for plan ${resolved.subscription.plan_code}`);
}

// ─────────────────────────────────────────────
// invoice.payment_failed
//
// Explicit failure event (belt-and-suspenders alongside invoice.update paid=false).
// ─────────────────────────────────────────────
async function handleInvoicePaymentFailed(supabase: ReturnType<typeof createClient>, data: any) {
  const subscriptionCode =
    data?.subscription?.subscription_code ??
    data?.subscription_code ??
    null;

  if (!subscriptionCode) {
    console.error("invoice.payment_failed: missing subscription_code");
    return;
  }

  const { error } = await supabase
    .from("practitioner_subscriptions")
    .update({ status: "past_due" })
    .eq("provider_subscription_id", subscriptionCode);

  if (error) throw error;
  console.log(`invoice.payment_failed: marked past_due for ${subscriptionCode}`);
}

// ─────────────────────────────────────────────
// subscription.disable
//
// Fires when a subscription is cancelled or expires.
// ─────────────────────────────────────────────
async function handleSubscriptionDisable(supabase: ReturnType<typeof createClient>, data: any) {
  const subscriptionCode = data?.subscription_code ?? null;
  if (!subscriptionCode) {
    console.error("subscription.disable: missing subscription_code");
    return;
  }

  const { error } = await supabase
    .from("practitioner_subscriptions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("provider_subscription_id", subscriptionCode);

  if (error) throw error;
  console.log(`subscription.disable: cancelled subscription ${subscriptionCode}`);
}

// ─────────────────────────────────────────────
// Grant monthly credits via RPC + record transaction
// ─────────────────────────────────────────────
async function grantMonthlyCredits(
  supabase: ReturnType<typeof createClient>,
  params: {
    practitionerProfileId: string;
    subscriptionId: string;
    planCode: string;
    creditsPerMonth: number;
    expiresAt: string;
    description: string;
    paymentReference?: string | null;
    providerSubscriptionId?: string | null;
    billingEvent: string;
  },
) {
  const periodEndDate = params.expiresAt.slice(0, 10);

  const { data: existingTransactions, error: existingTransactionsError } = await supabase
    .from("practitioner_credit_transactions")
    .select("id, metadata")
    .eq("practitioner_profile_id", params.practitionerProfileId)
    .eq("subscription_id", params.subscriptionId)
    .eq("transaction_type", "subscription_credit")
    .order("created_at", { ascending: false })
    .limit(20);

  if (existingTransactionsError) {
    throw existingTransactionsError;
  }

  const duplicateTransaction = (existingTransactions ?? []).find((transaction) => {
    const metadata = (transaction.metadata as Record<string, unknown> | null) ?? {};
    const sameReference = params.paymentReference
      && metadata.paystack_reference === params.paymentReference;
    const sameCycle = metadata.plan_code === params.planCode
      && metadata.period_end_date === periodEndDate;

    return sameReference || sameCycle;
  });

  if (duplicateTransaction) {
    console.log(
      `subscription credits already granted for subscription ${params.subscriptionId} (${params.billingEvent})`,
    );
    return;
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc("grant_practitioner_monthly_credits", {
    p_profile_id: params.practitionerProfileId,
    p_credits: params.creditsPerMonth,
    p_expires_at: params.expiresAt,
  });

  if (rpcError) throw rpcError;

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
        period_end_date: periodEndDate,
        billing_event: params.billingEvent,
        paystack_reference: params.paymentReference ?? null,
        provider_subscription_id: params.providerSubscriptionId ?? null,
      },
    });

  if (transactionError) throw transactionError;

  const { error: subscriptionUpdateError } = await supabase
    .from("practitioner_subscriptions")
    .update({ last_credited_at: new Date().toISOString() })
    .eq("id", params.subscriptionId);

  if (subscriptionUpdateError) throw subscriptionUpdateError;
}
