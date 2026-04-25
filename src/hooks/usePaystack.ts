import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BILLING_CREDIT_PACKAGES,
  BILLING_STORAGE_ADDONS,
  BILLING_SUBSCRIPTION_PLANS,
  type BillingCreditPackage,
  type BillingStorageAddon,
  type BillingSubscriptionPlan,
} from "@/lib/practitionerBilling";

type CreditPackage = BillingCreditPackage;
type SubscriptionPlan = BillingSubscriptionPlan;
type StorageAddon = BillingStorageAddon;

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

export const CREDIT_PACKAGES: CreditPackage[] = BILLING_CREDIT_PACKAGES;
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = BILLING_SUBSCRIPTION_PLANS;
export const STORAGE_ADDONS: StorageAddon[] = BILLING_STORAGE_ADDONS;

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
    queryClient.invalidateQueries({ queryKey: ["practitioner-storage-addon-purchases", userId] }),
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

async function getAuthenticatedProfile() {
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

  return { user, profile };
}

export function usePaystack() {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const buyCredits = async (pkg: CreditPackage) => {
    setLoading(true);

    try {
      ensurePaystack();
      const { user, profile } = await getAuthenticatedProfile();

      const { data: purchase, error: insertError } = await supabase
        .from("practitioner_credit_purchases")
        .insert({
          practitioner_profile_id: user.id,
          package_code: pkg.code,
          package_name: pkg.name,
          credits: pkg.credits,
          amount_zar: pkg.priceZar,
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
        amount: pkg.priceZar * 100,
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
              .update({
                provider_payment_id: response.reference,
                metadata: {
                  purchase_type: "credit_package",
                  paystack_reference: response.reference,
                },
              })
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
      const { user, profile } = await getAuthenticatedProfile();

      const handler = window.PaystackPop!.setup({
        key: getPaystackPublicKey(),
        email: profile.email,
        amount: plan.priceZar * 100,
        currency: "ZAR",
        plan: plan.paystackPlanCode,
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
            toast.success(`Subscribed to ${plan.name}. Your monthly credits will refresh shortly.`);
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

  const buyStorageUpgrade = async (addon: StorageAddon) => {
    setLoading(true);

    try {
      ensurePaystack();
      const { user, profile } = await getAuthenticatedProfile();

      const { data: purchase, error: insertError } = await supabase
        .from("practitioner_storage_addon_purchases")
        .insert({
          practitioner_profile_id: user.id,
          addon_code: addon.code,
          addon_name: addon.name,
          storage_mb: addon.storageMb,
          amount_zar: addon.priceZar,
          currency: "ZAR",
          payment_provider: "paystack",
          payment_status: "pending",
          metadata: {
            purchase_type: "storage_addon",
          },
        })
        .select()
        .single();

      if (insertError || !purchase) {
        throw insertError ?? new Error("Unable to create the storage upgrade purchase record.");
      }

      const handler = window.PaystackPop!.setup({
        key: getPaystackPublicKey(),
        email: profile.email,
        amount: addon.priceZar * 100,
        currency: "ZAR",
        ref: purchase.id,
        metadata: {
          practitioner_profile_id: user.id,
          addon_code: addon.code,
          purchase_type: "storage_addon",
          purchase_id: purchase.id,
          custom_fields: [
            { display_name: "Storage Add-on", variable_name: "storage_addon", value: addon.name },
          ],
        },
        callback: (response) => {
          void (async () => {
            await supabase
              .from("practitioner_storage_addon_purchases")
              .update({
                provider_payment_id: response.reference,
                metadata: {
                  purchase_type: "storage_addon",
                  paystack_reference: response.reference,
                },
              })
              .eq("id", purchase.id);

            toast.success("Payment successful. Your storage upgrade will be applied shortly.");
            await invalidateBillingQueries(queryClient, user.id);
            scheduleBillingRefresh(queryClient, user.id);
          })();
        },
        onClose: () => {
          void (async () => {
            await supabase
              .from("practitioner_storage_addon_purchases")
              .update({ payment_status: "cancelled" })
              .eq("id", purchase.id)
              .eq("payment_status", "pending");

            await queryClient.invalidateQueries({ queryKey: ["practitioner-storage-addon-purchases", user.id] });
          })();
        },
      });

      handler.openIframe();
    } catch (error) {
      console.error("buyStorageUpgrade error:", error);
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

  return { buyCredits, subscribe, buyStorageUpgrade, cancelSubscription, loading };
}
