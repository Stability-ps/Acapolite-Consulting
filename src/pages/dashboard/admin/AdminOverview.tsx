import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Upload,
  Receipt,
  MessageSquare,
  Bell,
  ArrowRight,
  Clock3,
  FolderKanban,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ElevenLabsWidget } from "@/components/dashboard/ElevenLabsWidget";

type CaseStatusRow = {
  status: string;
};

type RecentClient = {
  id: string;
  client_code: string | null;
  company_name: string | null;
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
  status: string;
  balance_due: number;
  total_amount: number;
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
    | { company_name?: string | null; first_name?: string | null; last_name?: string | null; client_code?: string | null }
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
  const { data: stats } = useQuery({
    queryKey: ["staff-dashboard-summary"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_dashboard_summary").select("*").single();
      return data;
    },
  });

  const { data: caseRows } = useQuery({
    queryKey: ["staff-overview-case-statuses"],
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("status");
      return (data ?? []) as CaseStatusRow[];
    },
  });

  const { data: recentClients } = useQuery({
    queryKey: ["staff-overview-recent-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, client_code, company_name, first_name, last_name, created_at, profiles!clients_profile_id_fkey(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as RecentClient[];
    },
  });

  const { data: recentDocuments } = useQuery({
    queryKey: ["staff-overview-recent-documents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, title, category, uploaded_at, status, clients(company_name, first_name, last_name, client_code)")
        .order("uploaded_at", { ascending: false })
        .limit(5);
      return (data ?? []) as RecentDocument[];
    },
  });

  const { data: invoiceRows } = useQuery({
    queryKey: ["staff-overview-invoice-health"],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("id, status, balance_due, total_amount");
      return (data ?? []) as InvoiceSnapshot[];
    },
  });

  const { data: dueAlerts } = useQuery({
    queryKey: ["staff-overview-due-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("id, title, alert_at, alert_type, clients(company_name, first_name, last_name, client_code)")
        .eq("status", "active")
        .order("alert_at", { ascending: true })
        .limit(5);
      return (data ?? []) as DueAlert[];
    },
  });

  const cards = [
    { label: "Total Clients", value: stats?.total_clients ?? 0, icon: Users, link: "/dashboard/staff/clients" },
    { label: "Pending Reviews", value: stats?.pending_reviews ?? 0, icon: Upload, link: "/dashboard/staff/documents" },
    { label: "Unpaid Invoices", value: stats?.unpaid_invoices ?? 0, icon: Receipt, link: "/dashboard/staff/invoices" },
    { label: "Unread Messages", value: stats?.unread_messages ?? 0, icon: MessageSquare, link: "/dashboard/staff/messages" },
    { label: "Reminders Due", value: stats?.reminders_due ?? 0, icon: Bell, link: "/dashboard/staff" },
  ];

  const casePipeline = useMemo(() => {
    const counts = (caseRows ?? []).reduce<Record<string, number>>((accumulator, row) => {
      accumulator[row.status] = (accumulator[row.status] ?? 0) + 1;
      return accumulator;
    }, {});

    const orderedStatuses = [
      "new",
      "under_review",
      "in_progress",
      "awaiting_client_documents",
      "awaiting_sars_response",
      "resolved",
      "closed",
    ];

    const maxValue = Math.max(...orderedStatuses.map((status) => counts[status] ?? 0), 1);

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
          Monitor client growth, case movement, document intake, billing pressure, and follow-up workload from one admin view.
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
            <p className="font-display text-4xl font-bold leading-none text-foreground">{card.value}</p>
            <p className="mt-3 text-sm text-muted-foreground font-body">{card.label}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-5 flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">Case Pipeline Analysis</h2>
              <p className="text-sm text-muted-foreground font-body">See where the current workload is clustering.</p>
            </div>
          </div>

          <div className="space-y-4">
            {casePipeline.map((item) => (
              <div key={item.status}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium capitalize text-foreground font-body">
                    {formatLabel(item.status)}
                  </p>
                  <span className="text-sm text-muted-foreground font-body">{item.count}</span>
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

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-5 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">Finance Snapshot</h2>
              <p className="text-sm text-muted-foreground font-body">Track current billing pressure.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-accent/30 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Outstanding Balance</p>
              <p className="font-display text-2xl text-foreground">{formatCurrency(financeSnapshot.outstandingBalance)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-accent/30 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Overdue Exposure</p>
              <p className="font-display text-2xl text-foreground">{formatCurrency(financeSnapshot.overdueBalance)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-accent/30 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Paid Invoices</p>
              <p className="font-display text-2xl text-foreground">{financeSnapshot.paidInvoices}</p>
            </div>
          </div>
        </div>
      </section>

      <ElevenLabsWidget />

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground">Recent Clients</h2>
                <p className="text-sm text-muted-foreground font-body">Latest onboarding activity.</p>
              </div>
            </div>
            <Link to="/dashboard/staff/clients" className="text-sm font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {recentClients && recentClients.length > 0 ? recentClients.map((client) => (
              <div key={client.id} className="rounded-xl border border-border p-4">
                <p className="font-body font-medium text-foreground">{getClientName(client)}</p>
                <p className="mt-1 text-xs text-muted-foreground font-body">
                  {client.profiles?.email || "No email"}{client.client_code ? ` • ${client.client_code}` : ""}
                </p>
                <p className="mt-2 text-xs text-muted-foreground font-body">
                  Added {new Date(client.created_at).toLocaleDateString()}
                </p>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground font-body">No recent client activity yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Upload className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground">Latest Uploads</h2>
                <p className="text-sm text-muted-foreground font-body">Fresh document intake for review.</p>
              </div>
            </div>
            <Link to="/dashboard/staff/documents" className="text-sm font-semibold text-primary hover:underline">
              Review
            </Link>
          </div>

          <div className="space-y-3">
            {recentDocuments && recentDocuments.length > 0 ? recentDocuments.map((document) => (
              <div key={document.id} className="rounded-xl border border-border p-4">
                <p className="font-body font-medium text-foreground">{document.category || document.title}</p>
                <p className="mt-1 text-xs text-muted-foreground font-body">
                  {getClientName(document.clients)} • {formatLabel(document.status)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground font-body">
                  Uploaded {new Date(document.uploaded_at).toLocaleString()}
                </p>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground font-body">No uploads to review right now.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground">Upcoming Reminders</h2>
                <p className="text-sm text-muted-foreground font-body">Deadlines that need attention soon.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {dueAlerts && dueAlerts.length > 0 ? dueAlerts.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-border p-4">
                <p className="font-body font-medium text-foreground">{alert.title}</p>
                <p className="mt-1 text-xs text-muted-foreground font-body">
                  {getClientName(alert.clients)} • {formatLabel(alert.alert_type)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground font-body">
                  Due {new Date(alert.alert_at).toLocaleDateString()}
                </p>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground font-body">No active reminders are due soon.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
