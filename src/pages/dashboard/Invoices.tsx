import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientRecord } from "@/hooks/useClientRecord";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";

export default function Invoices() {
  const { data: client } = useClientRecord();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", client?.id],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("*").eq("client_id", client!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!client,
  });

  const selectedInvoice = invoices?.find((invoice) => invoice.id === selectedInvoiceId) ?? null;

  const statusColor = (status: string) => {
    switch (status) {
      case "issued": return "bg-yellow-100 text-yellow-700";
      case "partially_paid": return "bg-orange-100 text-orange-700";
      case "paid": return "bg-green-100 text-green-700";
      case "overdue": return "bg-red-100 text-red-700";
      case "draft": return "bg-slate-100 text-slate-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Invoices</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">View and manage your billing</p>

      {!client ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">Your client record is not ready yet. Acapolite staff can complete it for you.</p>
        </div>
      ) : isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : invoices && invoices.length > 0 ? (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <button
              key={invoice.id}
              type="button"
              onClick={() => setSelectedInvoiceId(invoice.id)}
              className="w-full text-left bg-card rounded-xl border border-border shadow-card p-5 hover:shadow-elevated hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">{invoice.invoice_number}</p>
                  <p className="text-sm text-muted-foreground font-body">{invoice.title || invoice.description || "Service invoice"}</p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full font-body ${statusColor(invoice.status)}`}>
                  {invoice.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 text-sm font-body">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-semibold text-foreground">R {Number(invoice.total_amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Balance Due</p>
                  <p className="font-semibold text-foreground">R {Number(invoice.balance_due).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-semibold text-foreground">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "-"}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">No invoices yet.</p>
        </div>
      )}

      <DashboardItemDialog
        open={!!selectedInvoice}
        onOpenChange={(open) => {
          if (!open) setSelectedInvoiceId(null);
        }}
        title={selectedInvoice?.invoice_number ?? "Invoice Details"}
        description="Review invoice amounts, due date, and current payment status."
      >
        {selectedInvoice ? (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Title</p>
                <p className="font-body text-foreground">{selectedInvoice.title || selectedInvoice.description || "Service invoice"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Status</p>
                <p className="font-body text-foreground">{selectedInvoice.status.replace(/_/g, " ")}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Issue Date</p>
                <p className="font-body text-foreground">{new Date(selectedInvoice.issue_date).toLocaleDateString()}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Due Date</p>
                <p className="font-body text-foreground">{selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : "Not set"}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Total Amount</p>
                <p className="font-display text-2xl text-foreground">R {Number(selectedInvoice.total_amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Amount Paid</p>
                <p className="font-display text-2xl text-foreground">R {Number(selectedInvoice.amount_paid).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Balance Due</p>
                <p className="font-display text-2xl text-foreground">R {Number(selectedInvoice.balance_due).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {selectedInvoice.payment_reference ? (
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Payment Reference</p>
                <div className="rounded-2xl border border-border p-4">
                  <p className="font-body text-foreground">{selectedInvoice.payment_reference}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}
