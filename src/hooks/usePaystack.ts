import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type CreditPackage = {
  code: string;
  name: string;
  credits: number;
  price_zar: number;
  description: string;
};

type SubscriptionPlan = {
  code: string;
  name: string;
  price_zar: number;
  credits_per_month: number;
  paystack_plan_code: string;
  features: string[];
};

type PaystackResponse = {
  reference: string;
};

type PaystackHandler = {
  openIframe: () => void;
};

type PaystackSetupOptions = {
  key: string;
  email: string;
  amount: number;
  currency: string;
  ref?: string;
  plan?: string;
  metadata?: Record<string, unknown>;
  callback: (response: PaystackResponse) => void;
  onClose: () => void;
};

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: PaystackSetupOptions) => PaystackHandler;
    };
  }

  interface ImportMetaEnv {
    readonly VITE_PAYSTACK_PUBLIC_KEY?: string;
    readonly VITE_PUBLIC_PAYSTACK_PUBLIC_KEY?: string;
  }
}

const DEFAULT_PAYSTACK_PUBLIC_KEY = "pk_live_22d1de7dc3c5f3f2247e243c1aa26c9ae5e08da3";

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    code: "starter",
    name: "Starter Pack",
    credits: 5,
    price_zar: 149,
    description: "A lightweight top-up for unlocking and responding to new leads.",
  },
  {
    code: "growth",
    name: "Growth Pack",
    credits: 15,
    price_zar: 349,
    description: "A balanced package for practitioners actively responding each week.",
  },
  {
    code: "pro",
    name: "Pro Pack",
    credits: 35,
    price_zar: 699,
    description: "High-volume credits for practitioners working the marketplace consistently.",
  },
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    code: "basic",
    name: "Basic",
    price_zar: 299,
    credits_per_month: 10,
    paystack_plan_code: "PLN_itawkcig6c30q77",
    features: ["Verified Badge", "Standard Listing"],
  },
  {
    code: "standard",
    name: "Standard",
    price_zar: 599,
    credits_per_month: 25,
    paystack_plan_code: "PLN_9deli5oghu3lt2h",
    features: ["Verified Badge", "Priority Listing", "Featured Profile"],
  },
  {
    code: "premium",
    name: "Premium",
    price_zar: 999,
    credits_per_month: 60,
    paystack_plan_code: "PLN_6qfph5xvmtzgpag",
    features: ["Verified Badge", "Priority Listing", "Featured Profile", "Highlighted Profile"],
  },
];

function getPaystackPublicKey() {
  return import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
    || import.meta.env.VITE_PUBLIC_PAYSTACK_PUBLIC_KEY
    || DEFAULT_PAYSTACK_PUBLIC_KEY;
}

function formatPaystackError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Payment failed to initialize. Please try again.";
}

function ensurePaystack() {
  if (!window.PaystackPop?.setup) {
    throw new Error("Paystack is not available yet. Please refresh the page and try again.");
  }
}

async function invalidateBillingQueries(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["practitioner-credit-account", userId] }),
    queryClient.invalidateQueries({ queryKey: ["practitioner-credit-transactions", userId] }),
    queryClient.invalidateQueries({ queryKey: ["practitioner-credit-purchases", userId] }),
    queryClient.invalidateQueries({ queryKey: ["practitioner-active-subscription", userId] }),
  ]);
}

function scheduleBillingRefresh(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  window.setTimeout(() => {
    void invalidateBillingQueries(queryClient, userId);
  }, 2500);

  window.setTimeout(() => {
    void invalidateBillingQueries(queryClient, userId);
  }, 6000);
}

export function usePaystack() {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const buyCredits = async (pkg: CreditPackage) => {
    setLoading(true);

    try {
      ensurePaystack();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (!profile?.email) {
        throw new Error("No email found on your profile.");
      }

      const { data: purchase, error: insertError } = await supabase
        .from("practitioner_credit_purchases")
        .insert({
          practitioner_profile_id: user.id,
          package_code: pkg.code,
          package_name: pkg.name,
          credits: pkg.credits,
          amount_zar: pkg.price_zar,
          currency: "ZAR",
          payment_provider: "paystack",
          payment_status: "pending",
          metadata: {
            purchase_type: "credit_package",
          },
        })
        .select()
        .single();

      if (insertError || !purchase) {
        throw insertError ?? new Error("Unable to create the Paystack purchase record.");
      }

      const handler = window.PaystackPop!.setup({
        key: getPaystackPublicKey(),
        email: profile.email,
        amount: pkg.price_zar * 100,
        currency: "ZAR",
        ref: purchase.id,
        metadata: {
          practitioner_profile_id: user.id,
          package_code: pkg.code,
          purchase_type: "credit_package",
          purchase_id: purchase.id,
          custom_fields: [
            { display_name: "Package", variable_name: "package", value: pkg.name },
          ],
        },
        callback: (response) => {
          void (async () => {
            await supabase
              .from("practitioner_credit_purchases")
              .update({ provider_payment_id: response.reference })
              .eq("id", purchase.id);

            toast.success("Payment successful. Your credits will be added shortly.");
            await invalidateBillingQueries(queryClient, user.id);
            scheduleBillingRefresh(queryClient, user.id);
          })();
        },
        onClose: () => {
          void (async () => {
            await supabase
              .from("practitioner_credit_purchases")
              .update({ payment_status: "cancelled" })
              .eq("id", purchase.id)
              .eq("payment_status", "pending");

            await queryClient.invalidateQueries({ queryKey: ["practitioner-credit-purchases", user.id] });
          })();
        },
      });

      handler.openIframe();
    } catch (error) {
      console.error("buyCredits error:", error);
      toast.error(formatPaystackError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async (plan: SubscriptionPlan) => {
    setLoading(true);

    try {
      ensurePaystack();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (!profile?.email) {
        throw new Error("No email found on your profile.");
      }

      const handler = window.PaystackPop!.setup({
        key: getPaystackPublicKey(),
        email: profile.email,
        amount: plan.price_zar * 100,
        currency: "ZAR",
        plan: plan.paystack_plan_code,
        metadata: {
          practitioner_profile_id: user.id,
          plan_code: plan.code,
          purchase_type: "subscription",
          custom_fields: [
            { display_name: "Plan", variable_name: "plan", value: plan.name },
          ],
        },
        callback: () => {
          void (async () => {
            toast.success(`Subscribed to ${plan.name}. Your credits will be added shortly.`);
            await invalidateBillingQueries(queryClient, user.id);
            scheduleBillingRefresh(queryClient, user.id);
          })();
        },
        onClose: () => {
          toast.message("Subscription popup closed.");
        },
      });

      handler.openIframe();
    } catch (error) {
      console.error("subscribe error:", error);
      toast.error(formatPaystackError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async (subscriptionId: string) => {
    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke("cancel-subscription", {
        body: { subscription_id: subscriptionId },
      });

      if (error) {
        throw error;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await invalidateBillingQueries(queryClient, user.id);
      }

      toast.success("Subscription cancelled successfully.");
    } catch (error) {
      console.error("cancelSubscription error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cancel subscription.");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { buyCredits, subscribe, cancelSubscription, loading };
}
