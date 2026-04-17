import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Coins,
  Gift,
  Loader2,
  Minus,
  Plus,
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

type PractitionerCreditAccount = Tables<"practitioner_credit_accounts">;

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
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  if (!isAdmin || !practitionerId) {
    return null;
  }

  const currentBalance = creditAccount?.balance ?? 0;
  const creditsToProcess = parseInt(credits) || 0;

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
      toast.error(
        `Insufficient balance. Current: ${currentBalance}, Requested: ${creditsToProcess}`,
      );
      return;
    }

    setIsProcessing(true);

    try {
      let expiryDate = null;
      if (hasExpiry && expiryDays) {
        const date = new Date();
        date.setDate(date.getDate() + parseInt(expiryDays));
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

        toast.success(
          `Granted ${creditsToProcess} credits to practitioner${hasExpiry ? ` (expires in ${expiryDays} days)` : ""}`,
        );
      } else {
        const { error } = await supabase.rpc("admin_deduct_credits", {
          p_practitioner_profile_id: practitionerId,
          p_credits: creditsToProcess,
          p_reason: reason,
        });

        if (error) throw error;

        toast.success(`Deducted ${creditsToProcess} credits from practitioner`);
      }

      // Reset form
      setCredits("");
      setReason("");
      setCreditType("bonus");
      setHasExpiry(false);
      setExpiryDays("30");

      // Refresh credit data
      await queryClient.invalidateQueries({
        queryKey: ["practitioner-credit-account", practitionerId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["practitioner-credit-transactions", practitionerId],
      });

      onCreditsChanged?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to process credit action";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
            <Coins className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Credit Management
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Current balance: {currentBalance} credits
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Action Type */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Action
          </label>
          <Select
            value={action}
            onValueChange={(val) => setAction(val as CreditAction)}
          >
            <SelectTrigger className="rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grant">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-emerald-600" />
                  Grant Credits
                </div>
              </SelectItem>
              <SelectItem value="deduct">
                <div className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-red-600" />
                  Deduct Credits
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Number of Credits */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Number of Credits
          </label>
          <Input
            type="number"
            min="1"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="Enter number of credits"
            className="rounded-lg"
          />
        </div>

        {/* Credit Type (only for grant) */}
        {action === "grant" && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
              Credit Type
            </label>
            <Select
              value={creditType}
              onValueChange={(val) => setCreditType(val as CreditType)}
            >
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
        )}

        {/* Expiry (only for grant) */}
        {action === "grant" && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={hasExpiry}
                onChange={(e) => setHasExpiry(e.target.checked)}
                className="mr-2"
              />
              Add Expiry Date
            </label>
            {hasExpiry && (
              <Input
                type="number"
                min="1"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                placeholder="Days until expiry"
                className="rounded-lg"
              />
            )}
          </div>
        )}
      </div>

      {/* Reason */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground">
          Reason for {action === "grant" ? "Credit Grant" : "Credit Deduction"}
        </label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            action === "grant"
              ? "e.g., Campaign Bonus, Referral Reward, Promotion Special"
              : "e.g., Manual Correction, Service Issue, Refund"
          }
          rows={3}
          className="resize-none rounded-lg"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          This reason will appear in the practitioner's credit history
        </p>
      </div>

      {/* Summary */}
      {credits && creditsToProcess > 0 && (
        <div
          className={`rounded-lg border px-4 py-3 ${
            action === "grant"
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className={`h-5 w-5 shrink-0 ${
                action === "grant" ? "text-emerald-600" : "text-red-600"
              }`}
            />
            <div className="text-sm">
              <p
                className={`font-semibold ${
                  action === "grant" ? "text-emerald-900" : "text-red-900"
                }`}
              >
                {action === "grant" ? "Granting" : "Deducting"}{" "}
                {creditsToProcess} credits
              </p>
              <p
                className={`mt-1 ${
                  action === "grant" ? "text-emerald-800" : "text-red-800"
                }`}
              >
                New balance will be:{" "}
                <span className="font-semibold">
                  {action === "grant"
                    ? currentBalance + creditsToProcess
                    : currentBalance - creditsToProcess}{" "}
                  credits
                </span>
              </p>
              {hasExpiry && action === "grant" && (
                <p
                  className={`mt-1 ${
                    action === "grant" ? "text-emerald-800" : "text-red-800"
                  }`}
                >
                  Credits expire in {expiryDays} days
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={validateAndProcess}
        disabled={isProcessing || !credits.trim() || !reason.trim()}
        className={`w-full rounded-lg ${
          action === "grant"
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-red-600 hover:bg-red-700"
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            {action === "grant" ? (
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
          </>
        )}
      </Button>
    </div>
  );
}
