import { useQuery } from "@tanstack/react-query";
import { Users, Upload, Receipt, MessageSquare, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AdminOverview() {
  const { data: stats } = useQuery({
    queryKey: ["staff-dashboard-summary"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_dashboard_summary").select("*").single();
      return data;
    },
  });

  const cards = [
    { label: "Total Clients", value: stats?.total_clients ?? 0, icon: Users },
    { label: "Pending Reviews", value: stats?.pending_reviews ?? 0, icon: Upload },
    { label: "Unpaid Invoices", value: stats?.unpaid_invoices ?? 0, icon: Receipt },
    { label: "Unread Messages", value: stats?.unread_messages ?? 0, icon: MessageSquare },
    { label: "Reminders Due", value: stats?.reminders_due ?? 0, icon: Bell },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Staff Dashboard</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Manage Acapolite clients, documents, cases, invoices, and communication</p>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl p-5 border border-border shadow-card">
            <card.icon className="h-5 w-5 text-primary mb-3" />
            <p className="font-display text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-muted-foreground text-sm font-body">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

