import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const invoiceStatuses = ["pending", "paid", "overdue", "cancelled"];

export default function AdminInvoices() {
  const { isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "paid") updates.paid_date = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("invoices").update(updates).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Invoice updated");
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
    }
  };

  if (!loading && !isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">All Invoices</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Manage client billing</p>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Invoice #</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Client</th>
                <th className="text-right p-4 text-sm font-semibold text-foreground font-body">Total</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Due</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground font-body">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices?.map((inv: any) => (
                <tr key={inv.id} className="border-b border-border last:border-0">
                  <td className="p-4 text-sm font-medium text-foreground font-body">{inv.invoice_number}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{inv.profiles?.full_name || inv.profiles?.email || "—"}</td>
                  <td className="p-4 text-sm font-semibold text-foreground font-body text-right">R {Number(inv.total_amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
                  <td className="p-4">
                    <Select value={inv.status} onValueChange={(val) => updateStatus(inv.id, val)}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {invoiceStatuses.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
