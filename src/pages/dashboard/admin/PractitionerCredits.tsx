import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Coins, CreditCard, Database, HardDrive, Layers3, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { CREDIT_PACKAGES, STORAGE_ADDONS, SUBSCRIPTION_PLANS, usePaystack } from "@/hooks/usePaystack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BILLING_UPGRADE_REASONS,
  BILLING_UPGRADE_REASSURANCE,
  formatStorageLimitFromMb,
  formatStorageValue,
  formatZarCurrency,
} from "@/lib/practitionerBilling";

type PractitionerCreditAccount = Tables<"practitioner_credit_accounts">;
type PractitionerCreditTransaction = Tables<"practitioner_credit_transactions">;
type PractitionerCreditPurchase = Tables<"practitioner_credit_purchases">;
type PractitionerStorageAddonPurchase = Tables<"practitioner_storage_addon_purchases">;
type PractitionerSubscription = Tables<"practitioner_subscriptions">;

const subscriptionPlanStyles = {
  starter: {
    cardClassName: "border-emerald-200 bg-[linear-gradient(180deg,rgba(240,253,244,0.98),rgba(255,255,255,0.98))]",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    priceClassName: "text-emerald-700",
    buttonClassName: "bg-emerald-600 text-white hover:bg-emerald-700",
  },
  professional: {
    cardClassName: "border-sky-200 bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(255,255,255,0.98))]",
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    priceClassName: "text-sky-700",
    buttonClassName: "bg-sky-600 text-white hover:bg-sky-700",
  },
  business: {
    cardClassName: "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))]",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    priceClassName: "text-amber-700",
    buttonClassName: "bg-amber-500 text-slate-950 hover:bg-amber-400",
  },
} as const;

function getUnlockCreditCost(transaction: PractitionerCreditTransaction) {
  const metadata = transaction.metadata;

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return Math.abs(transaction.credits_delta);
  }

  const creditCost = metadata.credit_cost;
  return typeof creditCost === "number" ? creditCost : Math.abs(transaction.credits_delta);
}

function getCreditActivityLabel(transaction: PractitionerCreditTransaction) {
  if (transaction.transaction_type === "lead_unlock") {
    const creditCost = getUnlockCreditCost(transaction);
    return `Lead unlock - ${creditCost} credit${creditCost === 1 ? "" : "s"}`;
  }

  return transaction.description || transaction.transaction_type;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Date(value).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function PractitionerCredits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    buyCredits: startPaystackCreditPurchase,
    subscribe: startPaystackSubscription,
    buyStorageUpgrade: startStorageUpgradePurchase,
    cancelSubscription: cancelPaystackSubscription,
    loading: paystackLoading,
  } = usePaystack();
  const [buyingPackageCode, setBuyingPackageCode] = useState<string | null>(null);
  const [startingSubscriptionCode, setStartingSubscriptionCode] = useState<string | null>(null);
  const [buyingStorageCode, setBuyingStorageCode] = useState<string | null>(null);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);

  const { data: creditAccount } = useQuery({
    queryKey: ["practitioner-credit-account", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_credit_accounts")
        .select("*")
        .eq("profile_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as PractitionerCreditAccount | null;
    },
    enabled: !!user,
  });

  const { data: creditTransactions } = useQuery({
    queryKey: ["practitioner-credit-transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_credit_transactions")
        .select("*")
        .eq("practitioner_profile_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) throw error;
      return (data ?? []) as PractitionerCreditTransaction[];
    },
    enabled: !!user,
  });

  const { data: creditPurchases } = useQuery({
    queryKey: ["practitioner-credit-purchases", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_credit_purchases")
        .select("*")
        .eq("practitioner_profile_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      return (data ?? []) as PractitionerCreditPurchase[];
    },
    enabled: !!user,
  });

  const { data: storageAddonPurchases } = useQuery({
    queryKey: ["practitioner-storage-addon-purchases", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_storage_addon_purchases")
        .select("*")
        .eq("practitioner_profile_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      return (data ?? []) as PractitionerStorageAddonPurchase[];
    },
    enabled: !!user,
  });

  const { data: activeSubscription } = useQuery({
    queryKey: ["practitioner-active-subscription", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_subscriptions")
        .select("*")
        .eq("practitioner_profile_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (error) throw error;
      return data as PractitionerSubscription | null;
    },
    enabled: !!user,
  });

  const activeSubscriptionPlan = useMemo(
    () => SUBSCRIPTION_PLANS.find((plan) => plan.code === activeSubscription?.plan_code) ?? null,
    [activeSubscription?.plan_code],
  );

  const walletSummary = useMemo(() => {
    const monthlyRemaining = creditAccount?.monthly_credits_remaining ?? 0;
    const purchasedRemaining = creditAccount?.purchased_credits_balance ?? 0;
    const totalBalance = creditAccount?.balance ?? monthlyRemaining + purchasedRemaining;
    const storageLimitMb = (creditAccount?.storage_base_limit_mb ?? 0)
      + (creditAccount?.storage_addon_limit_mb ?? 0)
      + (creditAccount?.storage_override_limit_mb ?? 0);
    const storageLimitBytes = storageLimitMb * 1024 * 1024;
    const storageUsedBytes = creditAccount?.storage_used_bytes ?? 0;
    const usageRatio = storageLimitBytes > 0 ? storageUsedBytes / storageLimitBytes : 0;

    return {
      monthlyRemaining,
      purchasedRemaining,
      totalBalance,
      monthlyExpiry: creditAccount?.monthly_credits_expires_at ?? activeSubscription?.next_renewal_at ?? null,
      storageLimitMb,
      storageLimitBytes,
      storageUsedBytes,
      usageRatio,
      trackedClientCount: creditAccount?.tracked_client_count ?? 0,
    };
  }, [activeSubscription?.next_renewal_at, creditAccount]);

  const buyCredits = async (packageCode: string) => {
    setBuyingPackageCode(packageCode);

    try {
      const selectedPackage = CREDIT_PACKAGES.find((pkg) => pkg.code === packageCode);
      if (!selectedPackage) {
        throw new Error("Selected credit package was not found.");
      }

      await startPaystackCreditPurchase(selectedPackage);
      toast.success("Paystack checkout opened. Complete payment to add purchased credits.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to purchase credits.";
      toast.error(message);
    } finally {
      setBuyingPackageCode(null);
    }
  };

  const subscribeToPlan = async (planCode: string) => {
    setStartingSubscriptionCode(planCode);

    try {
      const selectedPlan = SUBSCRIPTION_PLANS.find((plan) => plan.code === planCode);
      if (!selectedPlan) {
        throw new Error("Selected subscription plan was not found.");
      }

      await startPaystackSubscription(selectedPlan);
      toast.success("Paystack subscription checkout opened.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start the subscription.";
      toast.error(message);
    } finally {
      setStartingSubscriptionCode(null);
    }
  };

  const buyStorageUpgrade = async (addonCode: string) => {
    setBuyingStorageCode(addonCode);

    try {
      const selectedAddon = STORAGE_ADDONS.find((addon) => addon.code === addonCode);
      if (!selectedAddon) {
        throw new Error("Selected storage upgrade was not found.");
      }

      await startStorageUpgradePurchase(selectedAddon);
      toast.success("Paystack checkout opened for the storage upgrade.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to purchase storage.";
      toast.error(message);
    } finally {
      setBuyingStorageCode(null);
    }
  };

  const cancelSubscription = async () => {
    if (!activeSubscription) {
      toast.error("No active subscription to cancel.");
      return;
    }

    setCancellingSubscription(true);

    try {
      await cancelPaystackSubscription(activeSubscription.id);
      await queryClient.invalidateQueries({ queryKey: ["practitioner-active-subscription", user?.id] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to cancel the subscription.";
      toast.error(message);
    } finally {
      setCancellingSubscription(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-body">Credits & Billing</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Practitioner Wallet and Usage</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground font-body">
          Monthly credits reset each billing cycle, purchased credits stay available until used, and storage usage is tracked
          against your current plan and upgrades.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <Coins className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Monthly Credits Remaining</p>
          <p className="mt-2 font-display text-3xl text-foreground">{walletSummary.monthlyRemaining}</p>
          <p className="mt-2 text-sm text-muted-foreground font-body">Expires {formatDate(walletSummary.monthlyExpiry)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <CreditCard className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Purchased Credits Balance</p>
          <p className="mt-2 font-display text-3xl text-foreground">{walletSummary.purchasedRemaining}</p>
          <p className="mt-2 text-sm text-muted-foreground font-body">Purchased credits do not expire.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <HardDrive className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Storage Usage</p>
          <p className="mt-2 font-display text-3xl text-foreground">
            {formatStorageValue(walletSummary.storageUsedBytes)} / {formatStorageLimitFromMb(walletSummary.storageLimitMb)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground font-body">{walletSummary.trackedClientCount} tracked clients</p>
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-foreground">Subscription Plan</h2>
            <p className="mt-2 text-sm text-muted-foreground font-body">
              Monthly credits reset every billing cycle. Any unused monthly credits expire on renewal.
            </p>
          </div>
          {activeSubscriptionPlan ? (
            <Badge className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Active Plan
            </Badge>
          ) : null}
        </div>

        {activeSubscription ? (
          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground font-body">
                  Current plan: {activeSubscriptionPlan?.name ?? activeSubscription.plan_code}
                </p>
                <p className="mt-1 text-xs text-muted-foreground font-body">
                  Next billing reset {formatDate(activeSubscription.next_renewal_at)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => void cancelSubscription()}
                disabled={cancellingSubscription}
              >
                {cancellingSubscription ? "Cancelling..." : "Cancel Plan"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrentPlan = activeSubscription?.plan_code === plan.code;
            const planStyle = subscriptionPlanStyles[plan.code];

            return (
              <div key={plan.code} className={`rounded-[28px] border p-6 shadow-card ${planStyle.cardClassName}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-2xl text-foreground">{plan.name}</p>
                  <Badge className={`rounded-full px-3 py-1 text-xs font-semibold ${planStyle.badgeClassName}`}>
                    Priority {plan.listingPriorityLevel}
                  </Badge>
                </div>
                <p className={`mt-3 font-display text-3xl ${planStyle.priceClassName}`}>
                  {formatZarCurrency(plan.priceZar)}
                  <span className="ml-2 text-sm font-body text-muted-foreground">/ month</span>
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground font-body">{plan.creditsPerMonth} monthly credits</p>
                <p className="mt-1 text-sm text-muted-foreground font-body">{formatStorageLimitFromMb(plan.storageLimitMb)} storage</p>
                <div className="mt-5 space-y-3 text-sm text-muted-foreground font-body">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <p>{feature}</p>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  className={`mt-6 w-full rounded-xl ${isCurrentPlan ? "" : planStyle.buttonClassName}`}
                  variant={isCurrentPlan ? "outline" : "default"}
                  onClick={() => void subscribeToPlan(plan.code)}
                  disabled={startingSubscriptionCode === plan.code || isCurrentPlan || paystackLoading}
                >
                  {isCurrentPlan
                    ? "Current Plan"
                    : startingSubscriptionCode === plan.code
                      ? "Opening Payment..."
                      : activeSubscription
                        ? "Switch Plan"
                        : "Subscribe"}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-[28px] border border-border bg-background/70 p-6">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary/70 font-body">Why upgrade?</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {BILLING_UPGRADE_REASONS.map((reason) => (
                  <div key={reason} className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-white/80 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    <p className="text-sm leading-6 text-muted-foreground font-body">{reason}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700 font-body">100% Secure</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-emerald-800/80 font-body">{BILLING_UPGRADE_REASSURANCE}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="font-display text-2xl text-foreground">Credit Wallet</h2>
            <p className="mt-2 text-sm text-muted-foreground font-body">
              Credits are spent from monthly credits first, then from purchased credits.
            </p>
          </div>
          <Badge className="shrink-0 whitespace-nowrap rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Total Balance {walletSummary.totalBalance}
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background/60 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Monthly Wallet</p>
            <p className="mt-2 font-display text-3xl text-foreground">{walletSummary.monthlyRemaining}</p>
            <p className="mt-2 text-sm text-muted-foreground font-body">Resets on {formatDate(walletSummary.monthlyExpiry)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/60 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Purchased Wallet</p>
            <p className="mt-2 font-display text-3xl text-foreground">{walletSummary.purchasedRemaining}</p>
            <p className="mt-2 text-sm text-muted-foreground font-body">Never expires</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/60 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Credits Used</p>
            <p className="mt-2 font-display text-3xl text-foreground">{creditAccount?.total_used_credits ?? 0}</p>
            <p className="mt-2 text-sm text-muted-foreground font-body">
              Monthly credits expire unused. Purchased credits stay available.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-foreground">Buy Credits</h2>
            <p className="mt-2 text-sm text-muted-foreground font-body">
              One-off credits never expire and are used after monthly plan credits are exhausted.
            </p>
          </div>
          <Badge className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Paystack
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          {CREDIT_PACKAGES.map((pkg) => (
            <div key={pkg.code} className="rounded-2xl border border-border p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">{pkg.name}</p>
              <p className="mt-3 font-display text-3xl text-foreground">{pkg.credits} credits</p>
              <p className="mt-2 text-sm font-semibold text-primary font-body">{formatZarCurrency(pkg.priceZar)}</p>
              <p className="mt-3 text-sm text-muted-foreground font-body">{pkg.description}</p>
              <Button
                type="button"
                className="mt-5 w-full rounded-xl"
                onClick={() => void buyCredits(pkg.code)}
                disabled={buyingPackageCode === pkg.code || paystackLoading}
              >
                {buyingPackageCode === pkg.code ? "Opening Payment..." : "Buy Credits"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-foreground">Billing & Usage</h2>
            <p className="mt-2 text-sm text-muted-foreground font-body">
              Storage usage is tracked per practitioner. Warnings are triggered at 80%, and uploads stop at the hard limit.
            </p>
          </div>
          {walletSummary.usageRatio >= 0.8 ? (
            <Badge className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Usage warning
            </Badge>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background/60 p-5">
            <Database className="h-5 w-5 text-primary" />
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Storage Usage</p>
            <p className="mt-2 font-display text-3xl text-foreground">
              {formatStorageValue(walletSummary.storageUsedBytes)} / {formatStorageLimitFromMb(walletSummary.storageLimitMb)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/60 p-5">
            <Layers3 className="h-5 w-5 text-primary" />
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Current Allocation</p>
            <p className="mt-2 font-display text-3xl text-foreground">{formatStorageLimitFromMb(walletSummary.storageLimitMb)}</p>
            <p className="mt-2 text-sm text-muted-foreground font-body">Includes plan storage, add-ons, and admin overrides.</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/60 p-5">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Tracked Clients</p>
            <p className="mt-2 font-display text-3xl text-foreground">{walletSummary.trackedClientCount}</p>
            <p className="mt-2 text-sm text-muted-foreground font-body">Client count is tracked for visibility, not capped.</p>
          </div>
        </div>

        {walletSummary.usageRatio >= 0.8 ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold font-body">Storage warning</p>
                <p className="mt-1 text-sm font-body">
                  You have used at least 80% of your current storage. Uploads will be blocked once you reach your full limit.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-foreground">Storage Upgrades</h2>
            <p className="mt-2 text-sm text-muted-foreground font-body">
              Add more storage whenever you need more room for documents, messages, and verification files.
            </p>
          </div>
          <Badge className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Add-ons
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {STORAGE_ADDONS.map((addon) => (
            <div key={addon.code} className="rounded-2xl border border-border p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">{addon.name}</p>
              <p className="mt-3 font-display text-3xl text-foreground">{formatStorageLimitFromMb(addon.storageMb)}</p>
              <p className="mt-2 text-sm font-semibold text-primary font-body">{formatZarCurrency(addon.priceZar)}</p>
              <p className="mt-3 text-sm text-muted-foreground font-body">{addon.description}</p>
              <Button
                type="button"
                className="mt-5 w-full rounded-xl"
                onClick={() => void buyStorageUpgrade(addon.code)}
                disabled={buyingStorageCode === addon.code || paystackLoading}
              >
                {buyingStorageCode === addon.code ? "Opening Payment..." : "Buy Storage"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-border bg-card p-6 shadow-card">
          <h2 className="font-display text-2xl text-foreground">Recent Credit Activity</h2>
          <div className="mt-4 space-y-3">
            {creditTransactions?.length ? (
              creditTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/60 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground font-body">{getCreditActivityLabel(transaction)}</p>
                    <p className="mt-1 text-xs text-muted-foreground font-body">
                      {new Date(transaction.created_at).toLocaleString()} · {transaction.credit_bucket}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold font-body ${transaction.credits_delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {transaction.credits_delta >= 0 ? "+" : ""}{transaction.credits_delta} credits
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground font-body">Balance {transaction.balance_after}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground font-body">No credit activity yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-border bg-card p-6 shadow-card">
          <h2 className="font-display text-2xl text-foreground">Recent Purchases & Upgrades</h2>
          <div className="mt-4 space-y-3">
            {[...(creditPurchases ?? []), ...(storageAddonPurchases ?? [])]
              .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
              .slice(0, 8)
              .map((purchase) => {
                const label = "package_name" in purchase ? purchase.package_name : purchase.addon_name;
                const amount = purchase.amount_zar;
                const meta = "credits" in purchase ? `${purchase.credits} credits` : `${formatStorageLimitFromMb(purchase.storage_mb)}`;

                return (
                  <div key={purchase.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/60 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground font-body">{label}</p>
                      <p className="mt-1 text-xs text-muted-foreground font-body">
                        {formatZarCurrency(Number(amount))} · {meta}
                      </p>
                    </div>
                    <Badge className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {purchase.payment_status}
                    </Badge>
                  </div>
                );
              })}
            {!creditPurchases?.length && !storageAddonPurchases?.length ? (
              <p className="text-sm text-muted-foreground font-body">No purchases or storage upgrades yet.</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
