import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CheckCircle } from "lucide-react";

export default function Deadlines() {
  const { user } = useAuth();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("deadline_alerts").select("*").eq("user_id", user!.id).order("due_date", { ascending: true });
      return data ?? [];
    },
    enabled: !!user,
  });

  const isOverdue = (date: string) => new Date(date) < new Date();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Deadlines</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Stay on top of SARS due dates</p>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : alerts && alerts.length > 0 ? (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className={`bg-card rounded-xl border shadow-card p-5 flex items-center gap-4 ${
              alert.is_completed ? "border-border opacity-60" : isOverdue(alert.due_date) ? "border-destructive/30" : "border-border"
            }`}>
              {alert.is_completed ? (
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
              ) : (
                <Bell className={`h-5 w-5 shrink-0 ${isOverdue(alert.due_date) ? "text-destructive" : "text-primary"}`} />
              )}
              <div className="flex-1">
                <p className="font-body font-medium text-foreground">{alert.title}</p>
                {alert.description && <p className="text-xs text-muted-foreground font-body">{alert.description}</p>}
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full font-body ${
                alert.is_completed ? "bg-green-100 text-green-700" :
                isOverdue(alert.due_date) ? "bg-red-100 text-red-700" :
                "bg-yellow-100 text-yellow-700"
              }`}>
                {alert.is_completed ? "Done" : isOverdue(alert.due_date) ? "Overdue" : new Date(alert.due_date).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">No deadlines set yet.</p>
        </div>
      )}
    </div>
  );
}
