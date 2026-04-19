import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccessibleClientIds } from "@/hooks/useAccessibleClientIds";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";

type DueAlert = {
  id: string;
  title: string;
  description: string | null;
  alert_at: string;
  alert_type: string | null;
  status: string;
  clients: {
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
    client_code: string | null;
  } | null;
};

const isPast = (date: string) => new Date(date) < new Date();

export default function AdminDeadlines() {
  const {
    accessibleClientIds,
    hasRestrictedClientScope,
    isLoadingAccessibleClientIds,
  } = useAccessibleClientIds();
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  const { data: alerts, isLoading } = useQuery({
    queryKey: [
      "staff-deadlines-alerts",
      accessibleClientIds?.join(",") ?? "all",
    ],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [] as DueAlert[];
      }

      let query = supabase
        .from("alerts")
        .select(
          "id, title, description, alert_at, alert_type, status, clients(company_name, first_name, last_name, client_code)",
        )
        .eq("status", "active")
        .lte(
          "alert_at",
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        )
        .order("alert_at", { ascending: true });

      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }

      const { data } = await query;
      return (data ?? []) as DueAlert[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const selectedAlert =
    alerts?.find((alert) => alert.id === selectedAlertId) ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Reminders Due
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground font-body">
          Review active alerts and deadlines assigned to your clients over the
          next 7 days.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-5 flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Upcoming Reminders
            </h2>
            <p className="text-sm text-muted-foreground font-body">
              Alerts due soon with client context and next action.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground font-body">
            Loading reminders...
          </div>
        ) : alerts && alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const clientName =
                alert.clients?.company_name ||
                [alert.clients?.first_name, alert.clients?.last_name]
                  .filter(Boolean)
                  .join(" ") ||
                alert.clients?.client_code ||
                "Unknown client";

              return (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => setSelectedAlertId(alert.id)}
                  className={`w-full text-left bg-card rounded-2xl border shadow-card p-5 flex items-center gap-4 hover:shadow-elevated transition-all ${
                    isPast(alert.alert_at)
                      ? "border-destructive/30"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <Bell
                    className={`h-5 w-5 shrink-0 ${isPast(alert.alert_at) ? "text-destructive" : "text-primary"}`}
                  />
                  <div className="flex-1">
                    <p className="font-body font-medium text-foreground">
                      {alert.title}
                    </p>
                    <p className="text-xs text-muted-foreground font-body">
                      {clientName}
                    </p>
                    {alert.description ? (
                      <p className="text-xs text-muted-foreground font-body mt-1">
                        {alert.description}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full font-body ${
                      isPast(alert.alert_at)
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {isPast(alert.alert_at)
                      ? "Due"
                      : new Date(alert.alert_at).toLocaleDateString()}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <p className="text-muted-foreground font-body">
              No due reminders found for your accessible clients.
            </p>
          </div>
        )}
      </div>

      <DashboardItemDialog
        open={!!selectedAlert}
        onOpenChange={(open) => {
          if (!open) setSelectedAlertId(null);
        }}
        title={selectedAlert?.title ?? "Reminder details"}
        description="Review this alert, reminder, or deadline information."
      >
        {selectedAlert ? (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  Status
                </p>
                <p className="font-body text-foreground">
                  {selectedAlert.status.replace(/_/g, " ")}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  Alert Date
                </p>
                <p className="font-body text-foreground">
                  {new Date(selectedAlert.alert_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                Client
              </p>
              <div className="rounded-2xl border border-border p-4">
                <p className="font-body text-foreground">
                  {selectedAlert.clients?.company_name ||
                    [
                      selectedAlert.clients?.first_name,
                      selectedAlert.clients?.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ") ||
                    selectedAlert.clients?.client_code ||
                    "Unknown client"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                Description
              </p>
              <div className="rounded-2xl border border-border p-4">
                <p className="font-body text-foreground">
                  {selectedAlert.description ||
                    "No extra description added for this reminder."}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}
