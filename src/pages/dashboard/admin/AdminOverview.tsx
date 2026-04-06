import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Users, FolderOpen, Receipt, TrendingUp } from "lucide-react";

export default function AdminOverview() {
  const { isAdmin, loading } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [cases, profiles, invoices] = await Promise.all([
        supabase.from("cases").select("id, status", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("invoices").select("id, status, total_amount"),
      ]);
      const pendingRevenue = invoices.data?.filter(i => i.status === "pending").reduce((sum, i) => sum + Number(i.total_amount), 0) ?? 0;
      return {
        totalCases: cases.count ?? 0,
        totalClients: profiles.count ?? 0,
        totalInvoices: invoices.data?.length ?? 0,
        pendingRevenue,
      };
    },
    enabled: isAdmin,
  });

  if (!loading && !isAdmin) return <Navigate to="/dashboard" replace />;

  const cards = [
    { label: "Total Clients", value: stats?.totalClients ?? 0, icon: Users },
    { label: "Total Cases", value: stats?.totalCases ?? 0, icon: FolderOpen },
    { label: "Total Invoices", value: stats?.totalInvoices ?? 0, icon: Receipt },
    { label: "Pending Revenue", value: `R ${(stats?.pendingRevenue ?? 0).toLocaleString("en-ZA")}`, icon: TrendingUp },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Admin Dashboard</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Manage all clients, cases, and invoices</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-xl p-5 border border-border shadow-card">
            <c.icon className="h-5 w-5 text-primary mb-3" />
            <p className="font-display text-2xl font-bold text-foreground">{c.value}</p>
            <p className="text-muted-foreground text-sm font-body">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
