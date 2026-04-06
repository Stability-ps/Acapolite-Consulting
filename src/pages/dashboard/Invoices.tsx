import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Invoices() {
  const { user } = useAuth();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-700";
      case "paid": return "bg-green-100 text-green-700";
      case "overdue": return "bg-red-100 text-red-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Invoices</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">View and manage your billing</p>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : invoices && invoices.length > 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Invoice #</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Description</th>
                <th className="text-right p-4 text-sm font-semibold text-foreground font-body">Amount</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Due Date</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0">
                  <td className="p-4 text-sm font-medium text-foreground font-body">{inv.invoice_number}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{inv.description || "—"}</td>
                  <td className="p-4 text-sm font-semibold text-foreground font-body text-right">R {Number(inv.total_amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
                  <td className="p-4">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full font-body ${statusColor(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">No invoices yet.</p>
        </div>
      )}
    </div>
  );
}
