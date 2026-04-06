import { useQuery } from "@tanstack/react-query";
import { FolderOpen, FileText, MessageSquare, Bell, Upload, Send, Receipt, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClientRecord } from "@/hooks/useClientRecord";

function getFirstName(fullName?: string | null, fallback?: string | null) {
  if (fallback?.trim()) return fallback.trim();
  if (!fullName?.trim()) return "there";
  return fullName.trim().split(/\s+/)[0];
}

function formatCaseType(caseType: string) {
  return caseType.replace(/_/g, " ");
}

export default function DashboardOverview() {
  const { profile, user } = useAuth();
  const { data: client } = useClientRecord();
  const firstName = getFirstName(profile?.full_name, client?.first_name);

  const { data: summary } = useQuery({
    queryKey: ["client-dashboard-summary", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_dashboard_summary")
        .select("*")
        .eq("profile_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: activeCases } = useQuery({
    queryKey: ["overview-active-cases", client?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select("*")
        .eq("client_id", client!.id)
        .not("status", "in", '("resolved","closed")')
        .order("last_activity_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!client,
  });

  const { data: activeAlerts } = useQuery({
    queryKey: ["overview-alerts", client?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .eq("client_id", client!.id)
        .eq("status", "active")
        .order("alert_at", { ascending: true })
        .limit(3);
      return data ?? [];
    },
    enabled: !!client,
  });

  const stats = [
    {
      title: "Active Cases",
      value: summary?.active_cases ?? 0,
      description: "Cases in progress",
      icon: FolderOpen,
      link: "/dashboard/client/cases",
      iconClassName: "text-primary",
    },
    {
      title: "Document Requests",
      value: summary?.outstanding_document_requests ?? 0,
      description: "Outstanding requests",
      icon: FileText,
      link: "/dashboard/client/documents",
      iconClassName: "text-sky-600",
    },
    {
      title: "Unread Messages",
      value: summary?.unread_messages ?? 0,
      description: "From your consultant",
      icon: MessageSquare,
      link: "/dashboard/client/messages",
      iconClassName: "text-emerald-600",
    },
    {
      title: "Active Alerts",
      value: summary?.active_alerts ?? 0,
      description: "Deadlines and reminders",
      icon: Bell,
      link: "/dashboard/client/deadlines",
      iconClassName: "text-amber-600",
    },
  ];

  const quickActions = [
    { label: "Upload a Document", link: "/dashboard/client/documents", icon: Upload },
    { label: "Send a Message", link: "/dashboard/client/messages", icon: Send },
    { label: "View Invoices", link: "/dashboard/client/invoices", icon: Receipt },
    { label: "My Cases", link: "/dashboard/client/cases", icon: FolderOpen },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border bg-card shadow-card p-6 sm:p-8">
        <p className="font-body text-sm font-semibold uppercase tracking-[0.18em] text-primary/80 mb-3">
          Client Overview
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
          Hi, {firstName}. Welcome back
        </h1>
        <p className="text-muted-foreground font-body text-sm sm:text-base mt-3 max-w-2xl">
          Here&apos;s an overview of your tax matters with Acapolite Consulting.
        </p>
      </section>

      {!client && user ? (
        <div className="bg-card rounded-xl border border-border p-6">
          <p className="text-muted-foreground font-body">
            Your client record is still missing in the database, so overview data cannot load yet. Once the
            `clients` row is created for this user, your dashboard will show normally.
          </p>
        </div>
      ) : null}

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.title}
            to={stat.link}
            className="bg-card rounded-2xl p-5 border border-border shadow-card hover:shadow-elevated transition-shadow group"
          >
            <div className="flex items-center justify-between mb-5">
              <stat.icon className={`h-5 w-5 ${stat.iconClassName}`} />
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <h2 className="font-body text-sm font-medium text-foreground mb-3">{stat.title}</h2>
            <p className="font-display text-4xl font-bold text-foreground leading-none">{stat.value}</p>
            <p className="text-muted-foreground text-sm font-body mt-3">{stat.description}</p>
          </Link>
        ))}
      </section>

      <section className="grid xl:grid-cols-[1.4fr_1fr] gap-6">
        <div className="bg-card rounded-2xl border border-border shadow-card p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">Active Cases</h2>
              <p className="text-sm text-muted-foreground font-body">Track the latest progress on your matters.</p>
            </div>
            <Link to="/dashboard/client/cases" className="text-sm font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>

          {activeCases && activeCases.length > 0 ? (
            <div className="space-y-3">
              {activeCases.slice(0, 4).map((caseItem) => (
                <div key={caseItem.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-body font-medium text-foreground">{caseItem.case_title}</p>
                      <p className="text-xs text-muted-foreground font-body mt-1 capitalize">
                        {formatCaseType(caseItem.case_type)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full font-body bg-blue-100 text-blue-700">
                      {caseItem.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground font-body">No active cases yet.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border shadow-card p-6">
            <h2 className="font-display text-xl font-semibold text-foreground mb-5">Alerts and Deadlines</h2>

            {activeAlerts && activeAlerts.length > 0 ? (
              <div className="space-y-3">
                {activeAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-xl border border-border p-4">
                    <p className="font-body font-medium text-foreground">{alert.title}</p>
                    <p className="text-xs text-muted-foreground font-body mt-1">
                      Due: {new Date(alert.alert_at).toLocaleDateString()}
                    </p>
                    {alert.description ? (
                      <p className="text-xs text-muted-foreground font-body mt-2">{alert.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground font-body">No active alerts or deadlines right now.</p>
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-card p-6">
            <h2 className="font-display text-xl font-semibold text-foreground mb-5">Quick Actions</h2>
            <div className="grid gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  to={action.link}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <action.icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-body text-sm font-medium text-foreground">{action.label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
