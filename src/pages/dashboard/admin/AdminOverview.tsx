import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Users,
  Upload,
  Receipt,
  MessageSquare,
  Bell,
  ArrowRight,
  Clock3,
  FolderKanban,
  Wallet,
  TrendingUp,
  ClipboardCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccessibleClientIds } from "@/hooks/useAccessibleClientIds";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { Button } from "@/components/ui/button";
import { getClientTypeLabel, getClientWarningSummary } from "@/lib/clientRisk";

type CaseStatusRow = {
  status: string;
  created_at?: string | null;
  closed_at?: string | null;
};

type RecentClient = {
  id: string;
  client_code: string | null;
  client_type: string;
  company_name: string | null;
  sars_outstanding_debt: number;
  returns_filed: boolean;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type RecentDocument = {
  id: string;
  title: string;
  category: string | null;
  uploaded_at: string;
  status: string;
  clients?: {
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    client_code?: string | null;
  } | null;
};

type InvoiceSnapshot = {
  id: string;
  client_id: string;
  status: string;
  balance_due: number;
  total_amount: number;
  created_at?: string;
};

type SubscriptionRevenueRow = {
  id: string;
  plan_code: string;
  practitioner_profile_id: string;
  status: string;
  created_at: string;
  current_period_start: string;
  last_credited_at?: string | null;
};

type SubscriptionPlanRow = {
  code: string;
  price_zar: number;
};

type RevenueProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type SubscriptionRevenueTransactionRow = {
  id: string;
  subscription_id: string | null;
  practitioner_profile_id: string;
  created_at: string;
  description: string | null;
  metadata?: {
    plan_code?: string | null;
    plan_name?: string | null;
  } | null;
};

type RevenueHistoryItem = {
  id: string;
  type: "invoice" | "subscription";
  label: string;
  details: string;
  subdetails?: string[];
  amount: number;
  createdAt: string;
};

function getSubscriptionMetadataValue(
  metadata: SubscriptionRevenueTransactionRow["metadata"],
  key: "plan_code" | "plan_name" | "expires_at",
) {
  if (!metadata || typeof metadata !== "object" || !(key in metadata)) {
    return null;
  }

  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

type RiskDocumentRequest = {
  client_id: string;
  is_required: boolean;
  is_fulfilled: boolean;
};

type ClientGrowthRow = {
  id: string;
  created_at: string;
};

type DueAlert = {
  id: string;
  title: string;
  alert_at: string;
  alert_type: string;
  clients?: {
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    client_code?: string | null;
  } | null;
};

function getClientName(
  record:
    | {
        company_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        client_code?: string | null;
      }
    | null
    | undefined,
) {
  return (
    record?.company_name ||
    [record?.first_name, record?.last_name].filter(Boolean).join(" ") ||
    record?.client_code ||
    "Client"
  );
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatCurrency(value: number) {
  return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminOverview() {
  const { isAdmin, hasStaffPermission } = useAuth();
  const [isRevenueHistoryOpen, setIsRevenueHistoryOpen] = useState(false);
  const {
    accessibleClientIds,
    hasRestrictedClientScope,
    isLoadingAccessibleClientIds,
  } = useAccessibleClientIds();
  const accessibleClientIdsKey = accessibleClientIds?.join(",") ?? "all";

  const { data: stats } = useQuery({
    queryKey: ["staff-dashboard-summary", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope) {
        return null;
      }
      const { data } = await supabase
        .from("admin_dashboard_summary")
        .select("*")
        .single();
      return data;
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  useQuery({
    queryKey: ["staff-refresh-system-alerts"],
    queryFn: async () => {
      const { error } = await supabase.rpc("refresh_system_alerts");
      if (error) {
        console.error("Auto reminders refresh failed:", error.message);
      }
      return true;
    },
  });

  const { data: caseRows } = useQuery({
    queryKey: ["staff-overview-case-statuses", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }
      let query = supabase
        .from("cases")
        .select("status, created_at, closed_at");
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }
      const { data } = await query;
      return (data ?? []) as CaseStatusRow[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: recentClients } = useQuery({
    queryKey: ["staff-overview-recent-clients", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }
      let query = supabase
        .from("clients")
        .select(
          "id, client_code, client_type, company_name, sars_outstanding_debt, returns_filed, first_name, last_name, created_at, profiles!clients_profile_id_fkey(full_name, email)",
        )
        .order("created_at", { ascending: false })
        .limit(5);
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("id", accessibleClientIds);
      }
      const { data } = await query;
      return (data ?? []) as RecentClient[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: clientGrowthRows } = useQuery({
    queryKey: ["staff-overview-client-growth", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }
      let query = supabase.from("clients").select("id, created_at");
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("id", accessibleClientIds);
      }
      const { data } = await query;
      return (data ?? []) as ClientGrowthRow[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: recentDocuments } = useQuery({
    queryKey: ["staff-overview-recent-documents", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }
      let query = supabase
        .from("documents")
        .select(
          "id, title, category, uploaded_at, status, clients(company_name, first_name, last_name, client_code)",
        )
        .order("uploaded_at", { ascending: false })
        .limit(5);
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }
      const { data } = await query;
      return (data ?? []) as RecentDocument[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: documentRows } = useQuery({
    queryKey: ["staff-overview-document-statuses", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }
      let query = supabase.from("documents").select("client_id, status");
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }
      const { data } = await query;
      return data ?? [];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: invoiceRows } = useQuery({
    queryKey: ["staff-overview-invoice-health", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }
      let query = supabase
        .from("invoices")
        .select("id, client_id, status, balance_due, total_amount, created_at");
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }
      const { data } = await query;
      return (data ?? []) as InvoiceSnapshot[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: subscriptionRevenueRows } = useQuery({
    queryKey: ["staff-overview-subscription-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_subscriptions")
        .select("id, plan_code, practitioner_profile_id, status, created_at, current_period_start, last_credited_at");

      if (error) {
        throw error;
      }

      return (data ?? []) as SubscriptionRevenueRow[];
    },
  });

  const { data: subscriptionRevenueTransactions } = useQuery({
    queryKey: ["staff-overview-subscription-revenue-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_credit_transactions")
        .select("id, subscription_id, practitioner_profile_id, created_at, description, metadata")
        .eq("transaction_type", "subscription_credit")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as SubscriptionRevenueTransactionRow[];
    },
  });

  const { data: subscriptionRevenueProfiles } = useQuery({
    queryKey: ["staff-overview-subscription-revenue-profiles", subscriptionRevenueTransactions?.length ?? 0],
    queryFn: async () => {
      const practitionerIds = Array.from(new Set((subscriptionRevenueTransactions ?? []).map((row) => row.practitioner_profile_id).filter(Boolean)));

      if (!practitionerIds.length) {
        return [];
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", practitionerIds);

      if (error) {
        throw error;
      }

      return (data ?? []) as RevenueProfileRow[];
    },
    enabled: Boolean(subscriptionRevenueTransactions?.length),
  });

  const dedupedSubscriptionRevenueTransactions = useMemo(() => {
    const rows = subscriptionRevenueTransactions ?? [];
    const latestByRevenueEvent = new Map<string, SubscriptionRevenueTransactionRow>();

    for (const row of rows) {
      const expiresAt = getSubscriptionMetadataValue(row.metadata, "expires_at");
      const dedupeKey = row.subscription_id && expiresAt
        ? `${row.subscription_id}:${expiresAt}`
        : row.id;
      const existing = latestByRevenueEvent.get(dedupeKey);

      if (!existing || new Date(row.created_at).getTime() > new Date(existing.created_at).getTime()) {
        latestByRevenueEvent.set(dedupeKey, row);
      }
    }

    return Array.from(latestByRevenueEvent.values());
  }, [subscriptionRevenueTransactions]);

  const renewalSubscriptionRevenueTransactions = useMemo(
    () => dedupedSubscriptionRevenueTransactions.filter((row) =>
      (row.description ?? "").toLowerCase().includes("new billing cycle")),
    [dedupedSubscriptionRevenueTransactions],
  );

  const { data: subscriptionPlanRows } = useQuery({
    queryKey: ["staff-overview-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_subscription_plans")
        .select("code, price_zar");

      if (error) {
        throw error;
      }

      return (data ?? []) as SubscriptionPlanRow[];
    },
  });

  const { data: riskClients } = useQuery({
    queryKey: ["staff-overview-risk-clients", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }
      let query = supabase
        .from("clients")
        .select(
          "id, client_code, client_type, company_name, sars_outstanding_debt, returns_filed, first_name, last_name",
        );
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("id", accessibleClientIds);
      }
      const { data } = await query;
      return (data ?? []) as RecentClient[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: riskRequests } = useQuery({
    queryKey: ["staff-overview-risk-document-requests", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }
      let query = supabase
        .from("document_requests")
        .select("client_id, is_required, is_fulfilled");
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }
      const { data } = await query;
      return (data ?? []) as RiskDocumentRequest[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: dueAlerts } = useQuery({
    queryKey: ["staff-overview-due-alerts", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }
      let query = supabase
        .from("alerts")
        .select(
          "id, title, alert_at, alert_type, clients(company_name, first_name, last_name, client_code)",
        )
        .eq("status", "active")
        .order("alert_at", { ascending: true })
        .limit(5);
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }
      const { data } = await query;
      return (data ?? []) as DueAlert[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: reminderAlerts } = useQuery({
    queryKey: ["staff-overview-reminder-count", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }
      let query = supabase
        .from("alerts")
        .select("id")
        .eq("status", "active")
        .lte(
          "alert_at",
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        );
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }
      const { data } = await query;
      return data ?? [];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: unreadMessages } = useQuery({
    queryKey: ["staff-overview-unread-messages", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let conversationQuery = supabase.from("conversations").select("id");
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        conversationQuery = conversationQuery.in(
          "client_id",
          accessibleClientIds,
        );
      }
      const { data: conversationRows } = await conversationQuery;
      const conversationIds = (conversationRows ?? []).map(
        (conversation) => conversation.id,
      );
      if (!conversationIds.length) {
        return [];
      }
      const { data } = await supabase
        .from("messages")
        .select("id")
        .in("conversation_id", conversationIds)
        .eq("is_read", false)
        .eq("sender_type", "client");
      return data ?? [];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const cards = [
    {
      label: "Total Clients",
      value: hasRestrictedClientScope
        ? (riskClients?.length ?? 0)
        : (stats?.total_clients ?? 0),
      icon: Users,
      link: "/dashboard/staff/clients",
      permission: "can_view_clients" as const,
    },
    {
      label: "Pending Reviews",
      value: hasRestrictedClientScope
        ? (documentRows ?? []).filter((document) =>
            ["uploaded", "pending_review"].includes(document.status),
          ).length
        : (stats?.pending_reviews ?? 0),
      icon: Upload,
      link: "/dashboard/staff/documents",
      permission: "can_view_documents" as const,
    },
    {
      label: "Unpaid Invoices",
      value: hasRestrictedClientScope
        ? (invoiceRows ?? []).filter(
            (invoice) =>
              ["issued", "partially_paid", "overdue"].includes(
                invoice.status,
              ) && Number(invoice.balance_due || 0) > 0,
          ).length
        : (stats?.unpaid_invoices ?? 0),
      icon: Receipt,
      link: "/dashboard/staff/invoices",
      permission: "can_view_invoices" as const,
    },
    {
      label: "Unread Messages",
      value: hasRestrictedClientScope
        ? (unreadMessages?.length ?? 0)
        : (stats?.unread_messages ?? 0),
      icon: MessageSquare,
      link: "/dashboard/staff/messages",
      permission: "can_view_messages" as const,
    },
    {
      label: "Reminders Due",
      value: hasRestrictedClientScope
        ? (reminderAlerts?.length ?? 0)
        : (stats?.reminders_due ?? 0),
      icon: Bell,
      link: "/dashboard/staff/deadlines",
      permission: "can_view_overview" as const,
    },
  ].filter((card) => isAdmin || hasStaffPermission(card.permission));

  const casePipeline = useMemo(() => {
    const counts = (caseRows ?? []).reduce<Record<string, number>>(
      (accumulator, row) => {
        accumulator[row.status] = (accumulator[row.status] ?? 0) + 1;
        return accumulator;
      },
      {},
    );

    const orderedStatuses = [
      "new",
      "under_review",
      "in_progress",
      "awaiting_client_documents",
      "awaiting_sars_response",
      "resolved",
      "closed",
    ];

    const maxValue = Math.max(
      ...orderedStatuses.map((status) => counts[status] ?? 0),
      1,
    );

    return orderedStatuses.map((status) => ({
      status,
      count: counts[status] ?? 0,
      width: `${((counts[status] ?? 0) / maxValue) * 100}%`,
    }));
  }, [caseRows]);

  const financeSnapshot = useMemo(() => {
    const rows = invoiceRows ?? [];
    const unpaidStatuses = ["issued", "partially_paid", "overdue"];
    const outstandingBalance = rows
      .filter((row) => unpaidStatuses.includes(row.status))
      .reduce((sum, row) => sum + Number(row.balance_due || 0), 0);
    const overdueBalance = rows
      .filter((row) => row.status === "overdue")
      .reduce((sum, row) => sum + Number(row.balance_due || 0), 0);
    const paidInvoices = rows.filter((row) => row.status === "paid").length;

    return {
      outstandingBalance,
      overdueBalance,
      paidInvoices,
    };
  }, [invoiceRows]);

  const reportingSnapshot = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthStartIso = monthStart.toISOString();
    const subscriptionPlanPriceMap = new Map(
      (subscriptionPlanRows ?? []).map((plan) => [plan.code, Number(plan.price_zar || 0)]),
    );

    const paidInvoicesThisMonth = (invoiceRows ?? []).filter(
      (invoice) =>
        invoice.status === "paid" &&
        invoice.created_at &&
        invoice.created_at >= monthStartIso,
    );
    const invoiceRevenueThisMonth = paidInvoicesThisMonth.reduce(
      (sum, invoice) => sum + Number(invoice.total_amount || 0),
      0,
    );
    const subscriptionPlanCodeById = new Map(
      (subscriptionRevenueRows ?? []).map((subscription) => [subscription.id, subscription.plan_code]),
    );
    const initialSubscriptionRevenueThisMonth = (subscriptionRevenueRows ?? []).reduce((sum, subscription) => {
      if (!subscription.created_at || subscription.created_at < monthStartIso) {
        return sum;
      }

      return sum + (subscriptionPlanPriceMap.get(subscription.plan_code) ?? 0);
    }, 0);

    const renewalSubscriptionRevenueThisMonth = renewalSubscriptionRevenueTransactions.reduce((sum, transaction) => {
      if (!transaction.created_at || transaction.created_at < monthStartIso) {
        return sum;
      }

      const metadataPlanCode = getSubscriptionMetadataValue(transaction.metadata, "plan_code");
      const planCode = metadataPlanCode || (transaction.subscription_id ? subscriptionPlanCodeById.get(transaction.subscription_id) : null);
      return sum + (planCode ? (subscriptionPlanPriceMap.get(planCode) ?? 0) : 0);
    }, 0);
    const monthlyRevenue = invoiceRevenueThisMonth + initialSubscriptionRevenueThisMonth + renewalSubscriptionRevenueThisMonth;

    const completedCasesThisMonth = (caseRows ?? []).filter((caseRow) => {
      if (!["resolved", "closed"].includes(caseRow.status)) {
        return false;
      }
      const closedAt = caseRow.closed_at || caseRow.created_at;
      return Boolean(closedAt && closedAt >= monthStartIso);
    }).length;

    const clientGrowth = (clientGrowthRows ?? []).filter(
      (client) => client.created_at >= monthStartIso,
    ).length;
    const outstandingInvoices = (invoiceRows ?? []).filter(
      (invoice) =>
        ["issued", "partially_paid", "overdue"].includes(invoice.status) &&
        Number(invoice.balance_due || 0) > 0,
    ).length;

    return {
      monthlyRevenue,
      completedCasesThisMonth,
      clientGrowth,
      outstandingInvoices,
    };
  }, [caseRows, clientGrowthRows, invoiceRows, renewalSubscriptionRevenueTransactions, subscriptionPlanRows, subscriptionRevenueRows]);

  const revenueHistory = useMemo(() => {
    const subscriptionPlanPriceMap = new Map(
      (subscriptionPlanRows ?? []).map((plan) => [plan.code, Number(plan.price_zar || 0)]),
    );
    const subscriptionPlanCodeById = new Map(
      (subscriptionRevenueRows ?? []).map((subscription) => [subscription.id, subscription.plan_code]),
    );
    const subscriptionStatusById = new Map(
      (subscriptionRevenueRows ?? []).map((subscription) => [subscription.id, subscription.status]),
    );
    const profileById = new Map(
      (subscriptionRevenueProfiles ?? []).map((profile) => [profile.id, profile]),
    );

    const invoiceHistory: RevenueHistoryItem[] = (invoiceRows ?? [])
      .filter((invoice) => invoice.status === "paid" && invoice.created_at)
      .map((invoice) => ({
        id: `invoice-${invoice.id}`,
        type: "invoice",
        label: "Invoice payment",
        details: `Invoice ${invoice.id.slice(0, 8)}`,
        subdetails: ["Status: paid"],
        amount: Number(invoice.total_amount || 0),
        createdAt: invoice.created_at!,
      }));

    const initialSubscriptionHistory: RevenueHistoryItem[] = (subscriptionRevenueRows ?? []).map((subscription) => {
      const profile = profileById.get(subscription.practitioner_profile_id);
      const subscriberName = profile?.full_name || profile?.email || `Practitioner ${subscription.practitioner_profile_id.slice(0, 8)}`;

      return {
        id: `subscription-initial-${subscription.id}`,
        type: "subscription" as const,
        label: "Subscription payment",
        details: formatLabel(subscription.plan_code),
        subdetails: [
          `Subscriber: ${subscriberName}`,
          profile?.email ? `Email: ${profile.email}` : null,
          `Current status: ${formatLabel(subscription.status)}`,
          "Billing event: Initial subscription",
        ].filter(Boolean) as string[],
        amount: subscriptionPlanPriceMap.get(subscription.plan_code) ?? 0,
        createdAt: subscription.created_at,
      };
    }).filter((item) => item.amount > 0);

    const renewalSubscriptionHistory: RevenueHistoryItem[] = renewalSubscriptionRevenueTransactions
      .map((transaction) => {
        const metadataPlanCode = getSubscriptionMetadataValue(transaction.metadata, "plan_code");
        const metadataPlanName = getSubscriptionMetadataValue(transaction.metadata, "plan_name");
        const planCode = metadataPlanCode || (transaction.subscription_id ? subscriptionPlanCodeById.get(transaction.subscription_id) : null);
        const amount = planCode ? (subscriptionPlanPriceMap.get(planCode) ?? 0) : 0;
        const profile = profileById.get(transaction.practitioner_profile_id);
        const subscriptionStatus = transaction.subscription_id ? subscriptionStatusById.get(transaction.subscription_id) : null;
        const subscriberName = profile?.full_name || profile?.email || `Practitioner ${transaction.practitioner_profile_id.slice(0, 8)}`;

        return {
          id: `subscription-${transaction.id}`,
          type: "subscription" as const,
          label: "Subscription payment",
          details: metadataPlanName || (planCode ? formatLabel(planCode) : "Subscription"),
          subdetails: [
            `Subscriber: ${subscriberName}`,
            profile?.email ? `Email: ${profile.email}` : null,
            subscriptionStatus ? `Current status: ${formatLabel(subscriptionStatus)}` : null,
            "Billing event: Renewal",
          ].filter(Boolean) as string[],
          amount,
          createdAt: transaction.created_at,
        };
      })
      .filter((item) => item.amount > 0);

    return [...renewalSubscriptionHistory, ...initialSubscriptionHistory, ...invoiceHistory].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [invoiceRows, renewalSubscriptionRevenueTransactions, subscriptionPlanRows, subscriptionRevenueProfiles, subscriptionRevenueRows]);

  const attentionClients = useMemo(() => {
    const outstandingInvoicesByClient = new Map<string, number>();
    const outstandingRequestsByClient = new Map<string, number>();

    for (const invoice of invoiceRows ?? []) {
      const isOutstanding =
        ["issued", "partially_paid", "overdue"].includes(invoice.status) &&
        Number(invoice.balance_due || 0) > 0;
      if (!isOutstanding) continue;
      outstandingInvoicesByClient.set(
        invoice.client_id,
        (outstandingInvoicesByClient.get(invoice.client_id) ?? 0) + 1,
      );
    }

    for (const request of riskRequests ?? []) {
      const isOutstanding = request.is_required && !request.is_fulfilled;
      if (!isOutstanding) continue;
      outstandingRequestsByClient.set(
        request.client_id,
        (outstandingRequestsByClient.get(request.client_id) ?? 0) + 1,
      );
    }

    return (riskClients ?? [])
      .map((client) => {
        const warningSummary = getClientWarningSummary(client, {
          outstandingInvoices: outstandingInvoicesByClient.get(client.id) ?? 0,
          outstandingDocumentRequests:
            outstandingRequestsByClient.get(client.id) ?? 0,
        });

        return {
          ...client,
          warningSummary,
        };
      })
      .filter((client) => client.warningSummary.hasIssues)
      .sort((left, right) => {
        if (
          right.warningSummary.issueCount !== left.warningSummary.issueCount
        ) {
          return (
            right.warningSummary.issueCount - left.warningSummary.issueCount
          );
        }

        return right.warningSummary.debtAmount - left.warningSummary.debtAmount;
      })
      .slice(0, 5);
  }, [invoiceRows, riskClients, riskRequests]);

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <p className="mb-3 font-body text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">
          Staff Overview
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
          Acapolite operations at a glance
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground font-body sm:text-base">
          Monitor client growth, case movement, document intake, billing
          pressure, and follow-up workload from one admin view.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.link}
            className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated"
          >
            <div className="mb-5 flex items-center justify-between">
              <card.icon className="h-5 w-5 text-primary" />
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="font-display text-4xl font-bold leading-none text-foreground">
              {card.value}
            </p>
            <p className="mt-3 text-sm text-muted-foreground font-body">
              {card.label}
            </p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-5 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Reporting Overview
            </h2>
            <p className="text-sm text-muted-foreground font-body">
              Business performance metrics for scaling decisions.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            className="rounded-2xl border border-border bg-accent/30 p-5 text-left transition-shadow hover:shadow-card"
            onClick={() => setIsRevenueHistoryOpen(true)}
          >
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
              Monthly Revenue
            </p>
            <p className="font-display text-2xl text-foreground">
              {formatCurrency(reportingSnapshot.monthlyRevenue)}
            </p>
            <p className="mt-3 text-xs text-muted-foreground font-body">
              Click to view full revenue history
            </p>
          </button>
          <div className="rounded-2xl border border-border bg-accent/30 p-5">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
              Cases Completed
            </p>
            <p className="font-display text-2xl text-foreground">
              {reportingSnapshot.completedCasesThisMonth}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-accent/30 p-5">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
              Client Growth
            </p>
            <p className="font-display text-2xl text-foreground">
              {reportingSnapshot.clientGrowth}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-accent/30 p-5">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
              Outstanding Invoices
            </p>
            <p className="font-display text-2xl text-foreground">
              {reportingSnapshot.outstandingInvoices}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {isAdmin || hasStaffPermission("can_view_cases") ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="mb-5 flex items-center gap-3">
              <FolderKanban className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Case Pipeline Analysis
                </h2>
                <p className="text-sm text-muted-foreground font-body">
                  See where the current workload is clustering.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {casePipeline.map((item) => (
                <div key={item.status}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium capitalize text-foreground font-body">
                      {formatLabel(item.status)}
                    </p>
                    <span className="text-sm text-muted-foreground font-body">
                      {item.count}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-accent/60">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: item.width }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isAdmin || hasStaffPermission("can_view_invoices") ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="mb-5 flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Finance Snapshot
                </h2>
                <p className="text-sm text-muted-foreground font-body">
                  Track current billing pressure.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                  Outstanding Balance
                </p>
                <p className="font-display text-2xl text-foreground">
                  {formatCurrency(financeSnapshot.outstandingBalance)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                  Overdue Exposure
                </p>
                <p className="font-display text-2xl text-foreground">
                  {formatCurrency(financeSnapshot.overdueBalance)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                  Paid Invoices
                </p>
                <p className="font-display text-2xl text-foreground">
                  {financeSnapshot.paidInvoices}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {isAdmin ||
      hasStaffPermission("can_view_clients") ||
      hasStaffPermission("can_view_client_workspace") ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <h2 className="font-display text-xl font-semibold text-red-700">
                  Attention Needed
                </h2>
                <p className="text-sm text-red-700/80 font-body">
                  Problem accounts with debt, unfiled returns, or outstanding
                  billing and document issues.
                </p>
              </div>
            </div>
            <Link
              to="/dashboard/staff/clients"
              className="text-sm font-semibold text-red-700 hover:underline"
            >
              Open clients
            </Link>
          </div>

          {attentionClients.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {attentionClients.map((client) => (
                <Link
                  key={client.id}
                  to={`/dashboard/staff/client-workspace?clientId=${client.id}`}
                  className="rounded-2xl border border-red-200 bg-white p-4 transition-shadow hover:shadow-elevated"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-body font-semibold text-foreground">
                        {getClientName(client)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground font-body">
                        {getClientTypeLabel(client.client_type)}
                        {client.client_code ? ` • ${client.client_code}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                      {client.warningSummary.issueCount} issues
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {client.warningSummary.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-red-200 bg-white p-8 text-center">
              <p className="text-sm text-red-700/80 font-body">
                No client accounts are currently flagged for urgent attention.
              </p>
            </div>
          )}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-3">
        {isAdmin || hasStaffPermission("can_view_clients") ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    Recent Clients
                  </h2>
                  <p className="text-sm text-muted-foreground font-body">
                    Latest onboarding activity.
                  </p>
                </div>
              </div>
              <Link
                to="/dashboard/staff/clients"
                className="text-sm font-semibold text-primary hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="space-y-3">
              {recentClients && recentClients.length > 0 ? (
                recentClients.map((client) => (
                  <div
                    key={client.id}
                    className="rounded-xl border border-border p-4"
                  >
                    <p className="font-body font-medium text-foreground">
                      {getClientName(client)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground font-body">
                      {client.profiles?.email || "No email"}
                      {client.client_code ? ` • ${client.client_code}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground font-body">
                      {getClientTypeLabel(client.client_type)} •{" "}
                      {client.returns_filed
                        ? "Returns filed"
                        : "Returns not filed"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground font-body">
                      Added {new Date(client.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground font-body">
                    No recent client activity yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {isAdmin || hasStaffPermission("can_view_documents") ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Upload className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    Latest Uploads
                  </h2>
                  <p className="text-sm text-muted-foreground font-body">
                    Fresh document intake for review.
                  </p>
                </div>
              </div>
              <Link
                to="/dashboard/staff/documents"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Review
              </Link>
            </div>

            <div className="space-y-3">
              {recentDocuments && recentDocuments.length > 0 ? (
                recentDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="rounded-xl border border-border p-4"
                  >
                    <p className="font-body font-medium text-foreground">
                      {document.category || document.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground font-body">
                      {getClientName(document.clients)} •{" "}
                      {formatLabel(document.status)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground font-body">
                      Uploaded {new Date(document.uploaded_at).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground font-body">
                    No uploads to review right now.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Upcoming Reminders
                </h2>
                <p className="text-sm text-muted-foreground font-body">
                  Deadlines that need attention soon.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {dueAlerts && dueAlerts.length > 0 ? (
              dueAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl border border-border p-4"
                >
                  <p className="font-body font-medium text-foreground">
                    {alert.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground font-body">
                    {getClientName(alert.clients)} •{" "}
                    {formatLabel(alert.alert_type)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground font-body">
                    Due {new Date(alert.alert_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground font-body">
                  No active reminders are due soon.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <DashboardItemDialog
        open={isRevenueHistoryOpen}
        onOpenChange={setIsRevenueHistoryOpen}
        title="Revenue History"
        description="Paid invoices and successful subscription billings are kept in history. Later cancellation does not remove already recorded revenue."
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-accent/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
              Total Recorded Revenue
            </p>
            <p className="mt-2 font-display text-2xl text-foreground">
              {formatCurrency(revenueHistory.reduce((sum, item) => sum + item.amount, 0))}
            </p>
          </div>

          {revenueHistory.length ? (
            <div className="space-y-3">
              {revenueHistory.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground font-body">{item.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground font-body">{item.details}</p>
                      {item.subdetails?.length ? (
                        <div className="mt-2 space-y-1">
                          {item.subdetails.map((detail) => (
                            <p key={detail} className="text-xs text-muted-foreground font-body">
                              {detail}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-xs text-muted-foreground font-body">
                        {new Date(item.createdAt).toLocaleString("en-ZA", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-display text-xl text-foreground">{formatCurrency(item.amount)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">
                        {item.type === "subscription" ? "Subscription" : "Invoice"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground font-body">
              No revenue history found.
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" className="rounded-xl" onClick={() => setIsRevenueHistoryOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </DashboardItemDialog>
    </div>
  );
}
