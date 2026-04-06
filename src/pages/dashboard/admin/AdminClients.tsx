import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";

export default function AdminClients() {
  const { isAdmin, loading } = useAuth();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin,
  });

  if (!loading && !isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">All Clients</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Manage client profiles</p>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Name</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Email</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Phone</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Tax Number</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Joined</th>
              </tr>
            </thead>
            <tbody>
              {clients?.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="p-4 text-sm font-medium text-foreground font-body">{c.full_name || "—"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{c.email || "—"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{c.phone || "—"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{c.tax_number || "—"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
