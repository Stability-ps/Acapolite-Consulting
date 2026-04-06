import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClientRecord } from "@/hooks/useClientRecord";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";

export default function Deadlines() {
  const { data: client } = useClientRecord();
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts", client?.id],
    queryFn: async () => {
      const { data } = await supabase.from("alerts").select("*").eq("client_id", client!.id).order("alert_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!client,
  });

  const selectedAlert = alerts?.find((alert) => alert.id === selectedAlertId) ?? null;
  const isPast = (date: string) => new Date(date) < new Date();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Deadlines</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Stay on top of upcoming alerts and due dates</p>

      {!client ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">Your client record is not ready yet. Acapolite staff can complete it for you.</p>
        </div>
      ) : isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : alerts && alerts.length > 0 ? (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => setSelectedAlertId(alert.id)}
              className={`w-full text-left bg-card rounded-xl border shadow-card p-5 flex items-center gap-4 hover:shadow-elevated transition-all ${
                alert.status !== "active" ? "border-border opacity-60" : isPast(alert.alert_at) ? "border-destructive/30" : "border-border hover:border-primary/30"
              }`}
            >
              {alert.status !== "active" ? (
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
              ) : (
                <Bell className={`h-5 w-5 shrink-0 ${isPast(alert.alert_at) ? "text-destructive" : "text-primary"}`} />
              )}
              <div className="flex-1">
                <p className="font-body font-medium text-foreground">{alert.title}</p>
                {alert.description && <p className="text-xs text-muted-foreground font-body">{alert.description}</p>}
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full font-body ${
                alert.status === "resolved" ? "bg-green-100 text-green-700" :
                isPast(alert.alert_at) && alert.status === "active" ? "bg-red-100 text-red-700" :
                "bg-yellow-100 text-yellow-700"
              }`}>
                {alert.status === "resolved" ? "Resolved" : isPast(alert.alert_at) && alert.status === "active" ? "Due" : new Date(alert.alert_at).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">No alerts set yet.</p>
        </div>
      )}

      <DashboardItemDialog
        open={!!selectedAlert}
        onOpenChange={(open) => {
          if (!open) setSelectedAlertId(null);
        }}
        title={selectedAlert?.title ?? "Alert Details"}
        description="Review this alert, reminder, or deadline information."
      >
        {selectedAlert ? (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Status</p>
                <p className="font-body text-foreground">{selectedAlert.status.replace(/_/g, " ")}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Alert Date</p>
                <p className="font-body text-foreground">{new Date(selectedAlert.alert_at).toLocaleString()}</p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Description</p>
              <div className="rounded-2xl border border-border p-4">
                <p className="font-body text-foreground">{selectedAlert.description || "No extra description added for this alert."}</p>
              </div>
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}
