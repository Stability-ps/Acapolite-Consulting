import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatZarCurrency,
  practitionerCreditPackages,
  practitionerSubscriptionPlans,
  purchasePractitionerCredits,
  startPractitionerSubscription,
  submitHostedPayment,
} from "@/lib/practitionerCredits";

type PractitionerCreditAccount = Tables<"practitioner_credit_accounts">;
type PractitionerCreditTransaction = Tables<"practitioner_credit_transactions">;
type PractitionerCreditPurchase = Tables<"practitioner_credit_purchases">;
type PractitionerSubscriptionPlan = Tables<"practitioner_subscription_plans">;
type PractitionerSubscription = Tables<"practitioner_subscriptions">;

export default function PractitionerCredits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [buyingPackageCode, setBuyingPackageCode] = useState<string | null>(null);
  const [startingSubscriptionCode, setStartingSubscriptionCode] = useState<string | null>(null);
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

  const { data: subscriptionPlans } = useQuery({
    queryKey: ["practitioner-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_subscription_plans")
        .select("*")
        .order("price_zar", { ascending: true });

      if (error) throw error;
      return (data ?? []) as PractitionerSubscriptionPlan[];
    },
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

  const creditBalance = creditAccount?.balance ?? 0;

  const summary = useMemo(() => ({
    purchased: creditAccount?.total_purchased_credits ?? 0,
    used: creditAccount?.total_used_credits ?? 0,
  }), [creditAccount?.total_purchased_credits, creditAccount?.total_used_credits]);

  const buyCredits = async (packageCode: string) => {
    setBuyingPackageCode(packageCode);

    try {
      const result = await purchasePractitionerCredits(packageCode);

      if (result.mode === "fake") {
        toast.success(`Added ${result.credits ?? 0} credits. New balance: ${result.balance ?? creditBalance}.`);
      } else if (result.paymentUrl && result.fields) {
        submitHostedPayment(result.paymentUrl, result.fields);
        return;
      } else {
        toast.error("Unable to start the credit checkout.");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["practitioner-credit-account", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["practitioner-credit-transactions", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["practitioner-credit-purchases", user?.id] }),
      ]);
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
      const result = await startPractitionerSubscription(planCode);

      if (result.mode === "fake") {
        toast.success("Subscription activated. Monthly credits have been added.");
      } else if (result.paymentUrl && result.fields) {
        submitHostedPayment(result.paymentUrl, result.fields);
        return;
      } else {
        toast.error("Unable to start the subscription checkout.");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["practitioner-credit-account", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["practitioner-credit-transactions", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["practitioner-credit-purchases", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["practitioner-active-subscription", user?.id] }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start the subscription.";
      toast.error(message);
    } finally {
      setStartingSubscriptionCode(null);
    }
  };

  const cancelSubscription = async () => {
    if (!activeSubscription) {
      toast.error("No active subscription to cancel.");
      return;
    }

    setCancellingSubscription(true);

    try {
      const { error } = await supabase.rpc("cancel_practitioner_subscription", {
        p_subscription_id: activeSubscription.id,
      });

      if (error) {
        throw error;
      }

      toast.success("Subscription cancelled.");
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
        <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-body">Credit Wallet</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Marketplace Credits</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground font-body">
          Track your credit balance, review recent activity, and purchase additional credits to respond to new leads.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <Coins className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Credit Balance</p>
          <p className="mt-2 font-display text-3xl text-foreground">{creditBalance} Credits</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <CreditCard className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Purchased Credits</p>
          <p className="mt-2 font-display text-3xl text-foreground">{summary.purchased}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <CreditCard className="h-5 w-5 text-primary" />
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Credits Used</p>
          <p className="mt-2 font-display text-3xl text-foreground">{summary.used}</p>
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-foreground">Buy Credits</h2>
            <p className="mt-2 text-sm text-muted-foreground font-body">
              Packages are priced in ZAR and can be purchased as often as you need.
            </p>
          </div>
          <Badge className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            ZAR only
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {practitionerCreditPackages.map((pkg) => (
            <div key={pkg.code} className="rounded-2xl border border-border p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">{pkg.name}</p>
              <p className="mt-3 font-display text-3xl text-foreground">{pkg.credits} credits</p>
              <p className="mt-2 text-sm font-semibold text-primary font-body">{formatZarCurrency(pkg.amountZar)}</p>
              <p className="mt-3 text-sm text-muted-foreground font-body">{pkg.description}</p>
              <Button
                type="button"
                className="mt-5 w-full rounded-xl"
                onClick={() => void buyCredits(pkg.code)}
                disabled={buyingPackageCode === pkg.code}
              >
                {buyingPackageCode === pkg.code ? "Processing..." : "Buy Package"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-foreground">Monthly Subscription Plans</h2>
            <p className="mt-2 text-sm text-muted-foreground font-body">
              Subscriptions renew monthly and add credits automatically on each renewal.
            </p>
          </div>
          <Badge className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            ZAR / month
          </Badge>
        </div>

        {activeSubscription ? (
          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-primary/80 font-body">Active Subscription</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground font-body">
                  Current plan: {activeSubscription.plan_code.toUpperCase()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground font-body">
                  Next renewal {new Date(activeSubscription.next_renewal_at).toLocaleDateString()}
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
          {(subscriptionPlans?.length ? subscriptionPlans : practitionerSubscriptionPlans).map((plan) => {
            const features = "features" in plan ? plan.features : [];
            const creditsPerMonth = "credits_per_month" in plan ? plan.credits_per_month : plan.creditsPerMonth;
            const priceZar = "price_zar" in plan ? Number(plan.price_zar) : plan.priceZar;
            const hasPriorityListing = "includes_priority_listing" in plan ? plan.includes_priority_listing : plan.features?.includes("Priority Listing");
            const hasFeaturedProfile = "includes_featured_profile" in plan ? plan.includes_featured_profile : plan.features?.includes("Featured Profile");
            const hasHighlightedProfile = "includes_highlighted_profile" in plan ? plan.includes_highlighted_profile : plan.features?.includes("Highlighted Profile");
            const isCurrentPlan = activeSubscription?.plan_code === plan.code;

            return (
            <div key={plan.code} className="rounded-2xl border border-border p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">{plan.name}</p>
              <p className="mt-3 font-display text-3xl text-foreground">{creditsPerMonth} credits</p>
              <p className="mt-2 text-sm font-semibold text-primary font-body">
                {formatZarCurrency(priceZar)}
              </p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground font-body">
                {features.length
                  ? features.map((feature) => (
                    <p key={feature}>{feature}</p>
                  ))
                  : (
                    <>
                      <p>Verified Badge</p>
                      <p>{hasPriorityListing ? "Priority Listing" : "Standard Listing"}</p>
                      {hasFeaturedProfile ? <p>Featured Profile</p> : null}
                      {hasHighlightedProfile ? <p>Highlighted Profile</p> : null}
                    </>
                  )}
              </div>
              <Button
                type="button"
                className="mt-5 w-full rounded-xl"
                onClick={() => void subscribeToPlan(plan.code)}
                disabled={startingSubscriptionCode === plan.code || isCurrentPlan}
              >
                {isCurrentPlan
                  ? "Current Plan"
                  : startingSubscriptionCode === plan.code
                    ? "Processing..."
                    : activeSubscription
                      ? "Switch Plan"
                      : "Subscribe"}
              </Button>
            </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
        <h2 className="font-display text-2xl text-foreground">Recent Credit Activity</h2>
        <div className="mt-4 space-y-3">
          {creditTransactions?.length ? (
            creditTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/60 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground font-body">{transaction.description || transaction.transaction_type}</p>
                  <p className="mt-1 text-xs text-muted-foreground font-body">
                    {new Date(transaction.created_at).toLocaleString()}
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
      </section>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
        <h2 className="font-display text-2xl text-foreground">Recent Purchases</h2>
        <div className="mt-4 space-y-3">
          {creditPurchases?.length ? (
            creditPurchases.map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/60 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground font-body">{purchase.package_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground font-body">
                    {formatZarCurrency(Number(purchase.amount_zar))} • {purchase.credits} credits
                  </p>
                </div>
                <Badge className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {purchase.payment_status}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground font-body">No purchases yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
