import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, Upload, Receipt, Bell, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function DashboardOverview() {
  const { user } = useAuth();

  const { data: cases } = useQuery({
    queryKey: ["cases", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: documents } = useQuery({
    queryKey: ["documents", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: invoices } = useQuery({
    queryKey: ["invoices", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: alerts } = useQuery({
    queryKey: ["alerts", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("deadline_alerts").select("*").eq("user_id", user!.id).eq("is_completed", false);
      return data ?? [];
    },
    enabled: !!user,
  });

  const stats = [
    { label: "Active Cases", value: cases?.filter(c => c.status !== "closed").length ?? 0, icon: FolderOpen, link: "/dashboard/cases", color: "text-primary" },
    { label: "Documents", value: documents?.length ?? 0, icon: Upload, link: "/dashboard/documents", color: "text-blue-500" },
    { label: "Pending Invoices", value: invoices?.filter(i => i.status === "pending").length ?? 0, icon: Receipt, link: "/dashboard/invoices", color: "text-gold" },
    { label: "Upcoming Deadlines", value: alerts?.length ?? 0, icon: Bell, link: "/dashboard/deadlines", color: "text-destructive" },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Welcome back</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Here's an overview of your tax matters</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.label} to={s.link} className="bg-card rounded-xl p-5 border border-border shadow-card hover:shadow-elevated transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="font-display text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-muted-foreground text-sm font-body">{s.label}</p>
          </Link>
        ))}
      </div>

      {cases && cases.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <h2 className="font-display text-lg font-semibold text-foreground mb-4">Recent Cases</h2>
          <div className="space-y-3">
            {cases.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div>
                  <p className="font-body font-medium text-foreground">{c.title}</p>
                  <p className="text-xs text-muted-foreground font-body">{c.case_number} · {c.type}</p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full font-body ${
                  c.status === "new" ? "bg-blue-100 text-blue-700" :
                  c.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                  c.status === "completed" ? "bg-green-100 text-green-700" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {c.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
