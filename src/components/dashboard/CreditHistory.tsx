import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Coins,
  Gift,
  Minus,
  Plus,
  TrendingUp,
  Zap,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

type PractitionerCreditTransaction = Tables<"practitioner_credit_transactions">;

interface CreditHistoryProps {
  practitionerId: string | null;
}

function getTransactionIcon(transactionType: string, creditsDelta: number) {
  switch (transactionType) {
    case "admin_grant":
      return <Gift className="h-5 w-5 text-blue-600" />;
    case "admin_deduction":
      return <Minus className="h-5 w-5 text-red-600" />;
    case "package_purchase":
      return <Coins className="h-5 w-5 text-amber-600" />;
    case "lead_response":
      return <Zap className="h-5 w-5 text-purple-600" />;
    case "signup_bonus":
      return <Gift className="h-5 w-5 text-emerald-600" />;
    case "refund":
      return <Plus className="h-5 w-5 text-teal-600" />;
    default:
      return creditsDelta > 0 ? (
        <Plus className="h-5 w-5 text-emerald-600" />
      ) : (
        <Minus className="h-5 w-5 text-red-600" />
      );
  }
}

function getTransactionLabel(transactionType: string): string {
  switch (transactionType) {
    case "admin_grant":
      return "Admin Grant";
    case "admin_deduction":
      return "Admin Deduction";
    case "package_purchase":
      return "Package Purchase";
    case "lead_response":
      return "Lead Response";
    case "signup_bonus":
      return "Signup Bonus";
    case "refund":
      return "Refund";
    default:
      return transactionType;
  }
}

function getTransactionBadgeClass(transactionType: string): string {
  switch (transactionType) {
    case "admin_grant":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "admin_deduction":
      return "border-red-200 bg-red-50 text-red-700";
    case "package_purchase":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "lead_response":
      return "border-purple-200 bg-purple-50 text-purple-700";
    case "signup_bonus":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "refund":
      return "border-teal-200 bg-teal-50 text-teal-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

export function CreditHistory({ practitionerId }: CreditHistoryProps) {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["practitioner-credit-transactions", practitionerId],
    queryFn: async () => {
      if (!practitionerId) return [];

      const { data, error } = await supabase
        .from("practitioner_credit_transactions")
        .select(
          `
          *,
          issued_by:issued_by (
            id,
            full_name,
            email
          )
        `,
        )
        .eq("practitioner_profile_id", practitionerId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Failed to load credit transactions:", error);
        return [];
      }

      return (data ?? []) as PractitionerCreditTransaction[];
    },
    enabled: !!practitionerId,
  });

  if (!practitionerId) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 p-6">
        <p className="text-sm text-muted-foreground">
          Select a practitioner to view their credit history.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Loading credit history...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <h3 className="font-display text-lg font-semibold text-foreground">
        Credit Transaction History
      </h3>

      {!transactions?.length ? (
        <div className="rounded-lg border border-border bg-background p-6 text-center">
          <Coins className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            No transactions yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-start gap-4 rounded-lg border border-border bg-background/50 p-4"
            >
              {/* Icon */}
              <div className="mt-1 shrink-0">
                {getTransactionIcon(
                  transaction.transaction_type,
                  transaction.credits_delta,
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {/* Transaction Type Badge */}
                    <Badge
                      className={`rounded-md border ${getTransactionBadgeClass(
                        transaction.transaction_type,
                      )}`}
                    >
                      {getTransactionLabel(transaction.transaction_type)}
                    </Badge>

                    {/* Description */}
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {transaction.description ||
                        transaction.reason ||
                        "Credit transaction"}
                    </p>

                    {/* Transaction Details */}
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p>
                        Date:{" "}
                        {new Date(transaction.created_at).toLocaleString()}
                      </p>

                      {transaction.reason &&
                        transaction.reason !== transaction.description && (
                          <p>Reason: {transaction.reason}</p>
                        )}

                      {transaction.issued_by && (
                        <p>
                          Issued by:{" "}
                          <span className="font-medium">
                            {(transaction.issued_by as any)?.full_name ||
                              (transaction.issued_by as any)?.email ||
                              "Admin"}
                          </span>
                        </p>
                      )}

                      {transaction.expiry_date && (
                        <p className="text-amber-600">
                          ⏱ Expires:{" "}
                          {new Date(
                            transaction.expiry_date,
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Credit Delta and Balance */}
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-semibold ${
                        transaction.credits_delta >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.credits_delta >= 0 ? "+" : ""}
                      {transaction.credits_delta}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Balance: {transaction.balance_after}
                    </p>
                  </div>
                </div>

                {/* Expiry Warning for Bonus Credits */}
                {transaction.transaction_type === "admin_grant" &&
                  transaction.expiry_date &&
                  new Date(transaction.expiry_date) > new Date() && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        This bonus credit expires on{" "}
                        <span className="font-medium">
                          {new Date(
                            transaction.expiry_date,
                          ).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                  )}

                {/* Expired Credit Warning */}
                {transaction.transaction_type === "admin_grant" &&
                  transaction.expiry_date &&
                  new Date(transaction.expiry_date) <= new Date() && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                      <p className="text-xs text-red-700">
                        This bonus credit expired on{" "}
                        <span className="font-medium">
                          {new Date(
                            transaction.expiry_date,
                          ).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
