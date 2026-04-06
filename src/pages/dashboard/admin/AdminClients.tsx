import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function AdminClients() {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["staff-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("*, profiles!clients_profile_id_fkey(full_name, email, phone)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">All Clients</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Manage client profiles and assignments</p>

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
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Client Code</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Joined</th>
              </tr>
            </thead>
            <tbody>
              {clients?.map((client: { id: string; tax_number: string | null; client_code: string | null; created_at: string; profiles?: { full_name?: string | null; email?: string | null; phone?: string | null } | null }) => (
                <tr key={client.id} className="border-b border-border last:border-0">
                  <td className="p-4 text-sm font-medium text-foreground font-body">{client.profiles?.full_name || "-"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{client.profiles?.email || "-"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{client.profiles?.phone || "-"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{client.tax_number || "-"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{client.client_code || "-"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{new Date(client.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

