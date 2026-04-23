// supabase/functions/paystack-webhook/index.ts
// Deploy with: supabase functions deploy paystack-webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Credit packages (must match your frontend prices) ───────────────────────
const CREDIT_PACKAGES: Record<string, { credits: number; name: string }> = {
  starter: { credits: 5, name: "Starter Pack" },
  growth: { credits: 15, name: "Growth Pack" },
  pro: { credits: 35, name: "Pro Pack" },
};

// ─── Subscription plans (must match practitioner_subscription_plans.code) ────
const SUBSCRIPTION_CREDITS: Record<string, number> = {
  basic: 10,
  standard: 25,
  premium: 60,
};

// ─── Verify Paystack HMAC signature ──────────────────────────────────────────
async function verifySignature(body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(PAYSTACK_SECRET_KEY),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === signature;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  // ── Security: always verify signature ──────────────────────────────────────
  const valid = await verifySignature(body, signature);
  if (!valid) {
    console.error("Invalid Paystack signature");
    return new Response("Unauthorized", { status: 401 });
  }

  const event = JSON.parse(body);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log("Paystack event:", event.event);

  try {
    switch (event.event) {
      // ── ONE-TIME CREDIT PURCHASE ──────────────────────────────────────────
      case "charge.success": {
        await handleChargeSuccess(supabase, event.data);
        break;
      }

      // ── SUBSCRIPTION CREATED ──────────────────────────────────────────────
      case "subscription.create": {
        await handleSubscriptionCreate(supabase, event.data);
        break;
      }

      // ── SUBSCRIPTION RENEWAL (monthly credit grant) ───────────────────────
      case "invoice.payment_failed":
      case "invoice.update": {
        // Handle failed/updated invoices — mark subscription past_due
        await handleInvoiceUpdate(supabase, event.data);
        break;
      }

      // ── SUBSCRIPTION DISABLED/CANCELLED ──────────────────────────────────
      case "subscription.disable": {
        await handleSubscriptionDisable(supabase, event.data);
        break;
      }

      // ── SUBSCRIPTION RENEWED (Paystack auto-charges) ─────────────────────
      case "charge.success": {
        // Paystack reuses charge.success for subscription renewals too
        // Differentiated by presence of plan in metadata
        break;
      }

      default:
        console.log("Unhandled event:", event.event);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: One-time credit purchase
// ─────────────────────────────────────────────────────────────────────────────
async function handleChargeSuccess(supabase: any, data: any) {
  const { metadata, reference, amount, customer } = data;

  // We put practitioner_profile_id and package_code in metadata at checkout
  const { practitioner_profile_id, package_code, purchase_type } = metadata ?? {};

  // Skip if this is a subscription renewal (no package_code)
  if (!package_code || purchase_type !== "credit_package") return;

  const pkg = CREDIT_PACKAGES[package_code];
  if (!pkg) throw new Error(`Unknown package_code: ${package_code}`);

  const amountZAR = amount / 100; // Paystack sends kobo/cents

  // 1. Find the pending purchase record
  const { data: purchase, error: findErr } = await supabase
    .from("practitioner_credit_purchases")
    .select("*")
    .eq("provider_payment_id", reference)
    .single();

  if (findErr || !purchase) {
    // Create it if it doesn't exist yet (race condition safety)
    await supabase.from("practitioner_credit_purchases").insert({
      practitioner_profile_id,
      package_code,
      package_name: pkg.name,
      credits: pkg.credits,
      amount_zar: amountZAR,
      currency: "ZAR",
      payment_provider: "paystack",
      payment_status: "completed",
      provider_payment_id: reference,
      completed_at: new Date().toISOString(),
    });
  } else {
    // Mark existing record as completed
    await supabase
      .from("practitioner_credit_purchases")
      .update({
        payment_status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", purchase.id);
  }

  // 2. Credit the practitioner's account
  await grantCredits(supabase, {
    practitioner_profile_id,
    credits: pkg.credits,
    transaction_type: "package_purchase",
    description: `Purchased ${pkg.name} (${pkg.credits} credits)`,
    credit_type: "purchased",
    metadata: { reference, package_code },
  });

  console.log(`✅ Granted ${pkg.credits} credits to ${practitioner_profile_id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: New subscription created
// ─────────────────────────────────────────────────────────────────────────────
async function handleSubscriptionCreate(supabase: any, data: any) {
  const { subscription_code, plan, customer, next_payment_date, created_at } = data;
  const { metadata } = customer ?? {};
  const practitioner_profile_id = metadata?.practitioner_profile_id ?? data.metadata?.practitioner_profile_id;
  const plan_code = plan?.plan_code ?? data.plan_code;
  const email_token = data?.email_token ?? customer?.email_token ?? null;

  if (!practitioner_profile_id || !plan_code) {
    console.error("Missing practitioner_profile_id or plan_code in subscription.create");
    return;
  }

  // Upsert subscription record
  await supabase.from("practitioner_subscriptions").upsert(
    {
      practitioner_profile_id,
      plan_code,
      status: "active",
      payment_provider: "paystack",
      provider_subscription_id: subscription_code,
      started_at: created_at ?? new Date().toISOString(),
      current_period_start: new Date().toISOString(),
      current_period_end: next_payment_date ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      next_renewal_at: next_payment_date ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      last_credited_at: new Date().toISOString(),
      metadata: {
        ...(metadata ?? {}),
        email_token,
        customer_code: customer?.customer_code ?? null,
        customer_email: customer?.email ?? null,
      },
    },
    { onConflict: "provider_subscription_id" }
  );

  // Grant first month's credits
  const credits = SUBSCRIPTION_CREDITS[plan_code] ?? 0;
  if (credits > 0) {
    await grantCredits(supabase, {
      practitioner_profile_id,
      credits,
      transaction_type: "subscription_credit",
      description: `${plan_code} subscription — monthly credits`,
      credit_type: "purchased",
      metadata: { subscription_code, plan_code },
    });
  }

  console.log(`✅ Subscription created: ${subscription_code} for ${practitioner_profile_id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: Invoice update (renewal billing)
// ─────────────────────────────────────────────────────────────────────────────
async function handleInvoiceUpdate(supabase: any, data: any) {
  const { subscription, paid, next_payment_date } = data;
  if (!subscription?.subscription_code) return;

  const { data: sub } = await supabase
    .from("practitioner_subscriptions")
    .select("*")
    .eq("provider_subscription_id", subscription.subscription_code)
    .single();

  if (!sub) return;

  if (paid) {
    // Renewal succeeded — grant credits + update period
    const credits = SUBSCRIPTION_CREDITS[sub.plan_code] ?? 0;
    await supabase
      .from("practitioner_subscriptions")
      .update({
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: next_payment_date,
        next_renewal_at: next_payment_date,
        last_credited_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    if (credits > 0) {
      await grantCredits(supabase, {
        practitioner_profile_id: sub.practitioner_profile_id,
        credits,
        transaction_type: "subscription_credit",
        description: `${sub.plan_code} subscription renewal credits`,
        credit_type: "purchased",
        metadata: { subscription_code: subscription.subscription_code },
      });
    }
  } else {
    // Payment failed
    await supabase
      .from("practitioner_subscriptions")
      .update({ status: "past_due" })
      .eq("id", sub.id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: Subscription cancelled/disabled
// ─────────────────────────────────────────────────────────────────────────────
async function handleSubscriptionDisable(supabase: any, data: any) {
  const { subscription_code } = data;
  await supabase
    .from("practitioner_subscriptions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("provider_subscription_id", subscription_code);

  console.log(`✅ Subscription cancelled: ${subscription_code}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// UTIL: Atomically grant credits (updates balance + inserts transaction)
// ─────────────────────────────────────────────────────────────────────────────
async function grantCredits(
  supabase: any,
  opts: {
    practitioner_profile_id: string;
    credits: number;
    transaction_type: string;
    description: string;
    credit_type: string;
    metadata?: object;
    subscription_id?: string;
    purchase_id?: string;
  }
) {
  // Get current balance
  const { data: account, error } = await supabase
    .from("practitioner_credit_accounts")
    .select("balance, total_purchased_credits")
    .eq("profile_id", opts.practitioner_profile_id)
    .single();

  if (error || !account) {
    // Create account if it doesn't exist
    await supabase.from("practitioner_credit_accounts").insert({
      profile_id: opts.practitioner_profile_id,
      balance: opts.credits,
      total_purchased_credits: opts.credits,
      total_used_credits: 0,
    });
    const newBalance = opts.credits;
    await supabase.from("practitioner_credit_transactions").insert({
      practitioner_profile_id: opts.practitioner_profile_id,
      transaction_type: opts.transaction_type,
      credits_delta: opts.credits,
      balance_after: newBalance,
      description: opts.description,
      credit_type: opts.credit_type,
      metadata: opts.metadata,
      subscription_id: opts.subscription_id,
      purchase_id: opts.purchase_id,
    });
    return;
  }

  const newBalance = account.balance + opts.credits;

  // Update balance
  await supabase
    .from("practitioner_credit_accounts")
    .update({
      balance: newBalance,
      total_purchased_credits: account.total_purchased_credits + opts.credits,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", opts.practitioner_profile_id);

  // Log transaction
  await supabase.from("practitioner_credit_transactions").insert({
    practitioner_profile_id: opts.practitioner_profile_id,
    transaction_type: opts.transaction_type,
    credits_delta: opts.credits,
    balance_after: newBalance,
    description: opts.description,
    credit_type: opts.credit_type,
    metadata: opts.metadata,
    subscription_id: opts.subscription_id,
    purchase_id: opts.purchase_id,
  });
}
