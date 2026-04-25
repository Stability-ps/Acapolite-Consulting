import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Coins,
  Database,
  Gift,
  HardDrive,
  Loader2,
  Minus,
  Plus,
  Settings2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/integrations/supabase/types";
import { BILLING_SUBSCRIPTION_PLANS, formatStorageLimitFromMb, formatStorageValue, formatZarCurrency } from "@/lib/practitionerBilling";

type PractitionerCreditAccount = Tables<"practitioner_credit_accounts">;
type PractitionerSubscriptionPlan = Tables<"practitioner_subscription_plans">;
type PractitionerSubscription = Tables<"practitioner_subscriptions">;

interface AdminCreditControlsProps {
  practitionerId: string | null;
  creditAccount?: PractitionerCreditAccount | null;
  isAdmin?: boolean;
  onCreditsChanged?: () => void;
}

type CreditAction = "grant" | "deduct";
type CreditType = "bonus" | "referral";

export function AdminCreditControls({
  practitionerId,
  creditAccount,
  isAdmin = false,
  onCreditsChanged,
}: AdminCreditControlsProps) {
  const [action, setAction] = useState<CreditAction>("grant");
  const [credits, setCredits] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [creditType, setCreditType] = useState<CreditType>("bonus");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDays, setExpiryDays] = useState<string>("30");
  const [storageOverrideMb, setStorageOverrideMb] = useState<string>("");
  const [storageAddonDeltaMb, setStorageAddonDeltaMb] = useState<string>("0");
  const [storageReason, setStorageReason] = useState<string>("");
  const [editingPlanCode, setEditingPlanCode] = useState<string>("starter");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUpdatingStorage, setIsUpdatingStorage] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const queryClient = useQueryClient();

  const { data: subscriptionPlans } = useQuery({
    queryKey: ["admin-practitioner-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_subscription_plans")
        .select("*")
        .order("price_zar", { ascending: true });

      if (error) throw error;
      return (data ?? []) as PractitionerSubscriptionPlan[];
    },
    enabled: isAdmin,
  });

  const normalizedSubscriptionPlans = useMemo(() => {
    const fetchedPlans = subscriptionPlans ?? [];

    return fetchedPlans.map((plan) => {
      const defaultPlan = BILLING_SUBSCRIPTION_PLANS.find((item) => item.code === plan.code);
      if (!defaultPlan) {
        return plan;
      }

      return {
        ...plan,
        name: defaultPlan.name,
        price_zar: defaultPlan.priceZar,
        credits_per_month: defaultPlan.creditsPerMonth,
        storage_limit_mb: defaultPlan.storageLimitMb,
        listing_priority_level: defaultPlan.listingPriorityLevel,
      };
    });
  }, [subscriptionPlans]);

  const { data: activeSubscription } = useQuery({
    queryKey: ["admin-practitioner-active-subscription", practitionerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_subscriptions")
        .select("*")
        .eq("practitioner_profile_id", practitionerId!)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as PractitionerSubscription | null;
    },
    enabled: isAdmin && !!practitionerId,
  });

  const [planForm, setPlanForm] = useState({
    name: "",
    price_zar: "",
    credits_per_month: "",
    storage_limit_mb: "",
    listing_priority_level: "",
  });

  const activePlan = useMemo(
    () => normalizedSubscriptionPlans.find((plan) => plan.code === editingPlanCode) ?? null,
    [editingPlanCode, normalizedSubscriptionPlans],
  );
  const activePractitionerPlan = useMemo(
    () => normalizedSubscriptionPlans.find((plan) => plan.code === activeSubscription?.plan_code) ?? null,
    [activeSubscription?.plan_code, normalizedSubscriptionPlans],
  );

  useEffect(() => {
    if (!activePlan) {
      return;
    }

    setPlanForm({
      name: activePlan.name,
      price_zar: String(activePlan.price_zar),
      credits_per_month: String(activePlan.credits_per_month),
      storage_limit_mb: String(activePlan.storage_limit_mb),
      listing_priority_level: String(activePlan.listing_priority_level),
    });
  }, [activePlan]);

  if (!isAdmin || !practitionerId) {
    return null;
  }

  const currentBalance = creditAccount?.balance ?? 0;
  const creditsToProcess = parseInt(credits, 10) || 0;
  const currentStorageLimitMb = (creditAccount?.storage_base_limit_mb ?? 0)
    + (creditAccount?.storage_addon_limit_mb ?? 0)
    + (creditAccount?.storage_override_limit_mb ?? 0);
  const monthlyCreditsRemaining = creditAccount?.monthly_credits_remaining ?? 0;
  const purchasedCreditsBalance = creditAccount?.purchased_credits_balance ?? 0;
  const monthlyExpiryDate = creditAccount?.monthly_credits_expires_at ?? activeSubscription?.next_renewal_at ?? null;
  const storageAddonLimitMb = creditAccount?.storage_addon_limit_mb ?? 0;
  const storageOverrideLimitMb = creditAccount?.storage_override_limit_mb ?? 0;

  const formatDate = (value?: string | null) => {
    if (!value) return "Not scheduled";
    return new Date(value).toLocaleDateString();
  };

  const refreshBillingQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["practitioner-credit-account", practitionerId] });
    await queryClient.invalidateQueries({ queryKey: ["practitioner-credit-transactions", practitionerId] });
    await queryClient.invalidateQueries({ queryKey: ["admin-practitioner-subscription-plans"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-practitioner-active-subscription", practitionerId] });
    onCreditsChanged?.();
  };

  const validateAndProcess = async () => {
    if (!credits.trim() || creditsToProcess <= 0) {
      toast.error("Please enter a valid number of credits");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason for this credit action");
      return;
    }

    if (action === "deduct" && creditsToProcess > currentBalance) {
      toast.error(`Insufficient balance. Current: ${currentBalance}, requested: ${creditsToProcess}.`);
      return;
    }

    setIsProcessing(true);

    try {
      let expiryDate = null;
      if (hasExpiry && expiryDays) {
        const date = new Date();
        date.setDate(date.getDate() + parseInt(expiryDays, 10));
        expiryDate = date.toISOString();
      }

      if (action === "grant") {
        const { error } = await supabase.rpc("admin_grant_credits", {
          p_practitioner_profile_id: practitionerId,
          p_credits: creditsToProcess,
          p_reason: reason,
          p_credit_type: creditType,
          p_expiry_date: expiryDate,
        });

        if (error) throw error;
        toast.success(`Granted ${creditsToProcess} credits to practitioner.`);
      } else {
        const { error } = await supabase.rpc("admin_deduct_credits", {
          p_practitioner_profile_id: practitionerId,
          p_credits: creditsToProcess,
          p_reason: reason,
        });

        if (error) throw error;
        toast.success(`Deducted ${creditsToProcess} credits from practitioner.`);
      }

      setCredits("");
      setReason("");
      setCreditType("bonus");
      setHasExpiry(false);
      setExpiryDays("30");
      await refreshBillingQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process credit action");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateStorageLimits = async () => {
    if (!storageReason.trim()) {
      toast.error("Please add a reason for the storage update.");
      return;
    }

    setIsUpdatingStorage(true);

    try {
      const overrideValue = storageOverrideMb.trim() ? parseInt(storageOverrideMb, 10) : null;
      const addonDelta = storageAddonDeltaMb.trim() ? parseInt(storageAddonDeltaMb, 10) : 0;

      const { error } = await supabase.rpc("admin_update_practitioner_storage_limits", {
        p_practitioner_profile_id: practitionerId,
        p_storage_override_limit_mb: overrideValue,
        p_storage_addon_delta_mb: addonDelta,
        p_reason: storageReason,
      });

      if (error) throw error;

      toast.success("Storage allocation updated.");
      setStorageReason("");
      setStorageAddonDeltaMb("0");
      await refreshBillingQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update storage.");
    } finally {
      setIsUpdatingStorage(false);
    }
  };

  const savePlan = async () => {
    if (!activePlan) {
      toast.error("Select a plan first.");
      return;
    }

    setIsSavingPlan(true);

    try {
      const { error } = await supabase.rpc("admin_update_practitioner_subscription_plan", {
        p_plan_code: activePlan.code,
        p_name: planForm.name,
        p_price_zar: Number(planForm.price_zar),
        p_credits_per_month: Number(planForm.credits_per_month),
        p_storage_limit_mb: Number(planForm.storage_limit_mb),
        p_listing_priority_level: Number(planForm.listing_priority_level),
        p_includes_verified_badge: activePlan.includes_verified_badge,
        p_includes_standard_listing: activePlan.includes_standard_listing,
        p_includes_priority_listing: activePlan.includes_priority_listing,
        p_includes_featured_profile: activePlan.includes_featured_profile,
        p_includes_highlighted_profile: activePlan.includes_highlighted_profile,
        p_includes_upgrade_support: activePlan.includes_upgrade_support,
      });

      if (error) throw error;

      toast.success("Subscription plan updated.");
      await refreshBillingQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save the plan.");
    } finally {
      setIsSavingPlan(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Current Credits & Billing Snapshot</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Live plan pricing, limits, and wallet balances for this practitioner.
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Active Plan</p>
            <p className="mt-2 font-display text-2xl text-foreground">
              {activePractitionerPlan?.name ?? "No active subscription"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activePractitionerPlan
                ? `${formatZarCurrency(activePractitionerPlan.price_zar)} / month`
                : "Using purchased credits only."}
            </p>
            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
              <p>Monthly credits: {activePractitionerPlan?.credits_per_month ?? 0}</p>
              <p>Plan storage: {formatStorageLimitFromMb(activePractitionerPlan?.storage_limit_mb ?? creditAccount?.storage_base_limit_mb ?? 0)}</p>
              <p>Listing priority: {activePractitionerPlan?.listing_priority_level ?? 0}</p>
              <p>Next reset: {formatDate(activeSubscription?.next_renewal_at)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Wallet Overview</p>
            <p className="mt-2 font-display text-2xl text-foreground">{currentBalance} total credits</p>
            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
              <p>Monthly credits remaining: {monthlyCreditsRemaining}</p>
              <p>Monthly credit expiry: {formatDate(monthlyExpiryDate)}</p>
              <p>Purchased credits balance: {purchasedCreditsBalance}</p>
              <p>Purchased credits do not expire.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Storage Used</p>
            <p className="mt-2 font-display text-2xl text-foreground">{formatStorageValue(creditAccount?.storage_used_bytes ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Effective Storage Limit</p>
            <p className="mt-2 font-display text-2xl text-foreground">{formatStorageLimitFromMb(currentStorageLimitMb)}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Storage Add-ons</p>
            <p className="mt-2 font-display text-2xl text-foreground">{formatStorageLimitFromMb(storageAddonLimitMb)}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Admin Override</p>
            <p className="mt-2 font-display text-2xl text-foreground">{formatStorageLimitFromMb(storageOverrideLimitMb)}</p>
          </div>
        </div>

        {activePractitionerPlan ? (
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Included Plan Features</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
              <p>{activePractitionerPlan.includes_verified_badge ? "Verified badge included" : "No verified badge"}</p>
              <p>{activePractitionerPlan.includes_standard_listing ? "Standard listing included" : "No standard listing"}</p>
              <p>{activePractitionerPlan.includes_priority_listing ? "Priority listing included" : "No priority listing"}</p>
              <p>{activePractitionerPlan.includes_featured_profile ? "Featured profile included" : "No featured profile"}</p>
              <p>{activePractitionerPlan.includes_highlighted_profile ? "Highlighted profile included" : "No highlighted profile"}</p>
              <p>{activePractitionerPlan.includes_upgrade_support ? "Upgrade support included" : "No upgrade support"}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Coins className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">Credit Management</h3>
              <p className="mt-1 text-sm text-muted-foreground">Current balance: {currentBalance} credits</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Action</label>
            <Select value={action} onValueChange={(val) => setAction(val as CreditAction)}>
              <SelectTrigger className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grant">Grant Credits</SelectItem>
                <SelectItem value="deduct">Deduct Credits</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Number of Credits</label>
            <Input
              type="number"
              min="1"
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
              placeholder="Enter number of credits"
              className="rounded-lg"
            />
          </div>

          {action === "grant" ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">Credit Type</label>
              <Select value={creditType} onValueChange={(val) => setCreditType(val as CreditType)}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-blue-600" />
                      Bonus Credits
                    </div>
                  </SelectItem>
                  <SelectItem value="referral">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      Referral Credits
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {action === "grant" ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={hasExpiry}
                  onChange={(event) => setHasExpiry(event.target.checked)}
                  className="mr-2"
                />
                Add Expiry Date
              </label>
              {hasExpiry ? (
                <Input
                  type="number"
                  min="1"
                  value={expiryDays}
                  onChange={(event) => setExpiryDays(event.target.value)}
                  placeholder="Days until expiry"
                  className="rounded-lg"
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Reason for {action === "grant" ? "Credit Grant" : "Credit Deduction"}
          </label>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={action === "grant" ? "e.g. campaign bonus or recovery action" : "e.g. correction or reversal"}
            rows={3}
            className="resize-none rounded-lg"
          />
        </div>

        {credits && creditsToProcess > 0 ? (
          <div className={`rounded-lg border px-4 py-3 ${action === "grant" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex items-start gap-3">
              <AlertCircle className={`h-5 w-5 shrink-0 ${action === "grant" ? "text-emerald-600" : "text-red-600"}`} />
              <div className="text-sm">
                <p className={`font-semibold ${action === "grant" ? "text-emerald-900" : "text-red-900"}`}>
                  {action === "grant" ? "Granting" : "Deducting"} {creditsToProcess} credits
                </p>
                <p className={`mt-1 ${action === "grant" ? "text-emerald-800" : "text-red-800"}`}>
                  New balance will be {action === "grant" ? currentBalance + creditsToProcess : currentBalance - creditsToProcess} credits
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <Button
          onClick={() => void validateAndProcess()}
          disabled={isProcessing || !credits.trim() || !reason.trim()}
          className={`w-full rounded-lg ${action === "grant" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : action === "grant" ? (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Grant {creditsToProcess || 0} Credits
            </>
          ) : (
            <>
              <Minus className="mr-2 h-4 w-4" />
              Deduct {creditsToProcess || 0} Credits
            </>
          )}
        </Button>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
            <HardDrive className="h-6 w-6 text-sky-700" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Storage & Usage Overrides</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Current storage: {formatStorageValue(creditAccount?.storage_used_bytes ?? 0)} / {formatStorageLimitFromMb(currentStorageLimitMb)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Absolute Override (MB)</label>
            <Input
              type="number"
              min="0"
              value={storageOverrideMb}
              onChange={(event) => setStorageOverrideMb(event.target.value)}
              placeholder={String(creditAccount?.storage_override_limit_mb ?? 0)}
              className="rounded-lg"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Increase Add-on Allocation (MB)</label>
            <Input
              type="number"
              value={storageAddonDeltaMb}
              onChange={(event) => setStorageAddonDeltaMb(event.target.value)}
              placeholder="0"
              className="rounded-lg"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current upload usage</p>
            <p className="mt-2 font-display text-2xl text-foreground">{formatStorageValue(creditAccount?.storage_used_bytes ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tracked clients</p>
            <p className="mt-2 font-display text-2xl text-foreground">{creditAccount?.tracked_client_count ?? 0}</p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">Reason</label>
          <Textarea
            value={storageReason}
            onChange={(event) => setStorageReason(event.target.value)}
            placeholder="Explain why the storage allocation is being changed"
            rows={3}
            className="resize-none rounded-lg"
          />
        </div>

        <Button onClick={() => void updateStorageLimits()} disabled={isUpdatingStorage || !storageReason.trim()} className="w-full rounded-lg">
          {isUpdatingStorage ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating Storage...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Save Storage Allocation
            </>
          )}
        </Button>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
            <Settings2 className="h-6 w-6 text-violet-700" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Plan Limits</h3>
            <p className="mt-1 text-sm text-muted-foreground">Update global plan limits, credits, and storage allowances.</p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">Subscription Plan</label>
          <Select value={editingPlanCode} onValueChange={setEditingPlanCode}>
            <SelectTrigger className="rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {normalizedSubscriptionPlans.map((plan) => (
                <SelectItem key={plan.code} value={plan.code}>
                  {plan.name} · {formatZarCurrency(plan.price_zar)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Plan Name</label>
            <Input value={planForm.name} onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))} className="rounded-lg" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Monthly Price (ZAR)</label>
            <Input value={planForm.price_zar} onChange={(event) => setPlanForm((current) => ({ ...current, price_zar: event.target.value }))} className="rounded-lg" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Credits Per Month</label>
            <Input value={planForm.credits_per_month} onChange={(event) => setPlanForm((current) => ({ ...current, credits_per_month: event.target.value }))} className="rounded-lg" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Storage Limit (MB)</label>
            <Input value={planForm.storage_limit_mb} onChange={(event) => setPlanForm((current) => ({ ...current, storage_limit_mb: event.target.value }))} className="rounded-lg" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Listing Priority</label>
            <Input value={planForm.listing_priority_level} onChange={(event) => setPlanForm((current) => ({ ...current, listing_priority_level: event.target.value }))} className="rounded-lg" />
          </div>
        </div>

        <Button onClick={() => void savePlan()} disabled={isSavingPlan || !activePlan} className="w-full rounded-lg">
          {isSavingPlan ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Plan...
            </>
          ) : (
            <>
              <HardDrive className="mr-2 h-4 w-4" />
              Save Plan Limits
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
