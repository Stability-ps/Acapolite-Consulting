import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums, TablesUpdate } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";

const invoiceStatuses: Enums<"invoice_status">[] = ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"];

type StaffInvoice = {
  id: string;
  invoice_number: string;
  title: string | null;
  description: string | null;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  due_date: string | null;
  issue_date: string;
  status: Enums<"invoice_status">;
  payment_reference: string | null;
  clients?: {
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    client_code?: string | null;
  } | null;
};

function getClientName(invoice: StaffInvoice) {
  return (
    invoice.clients?.company_name ||
    [invoice.clients?.first_name, invoice.clients?.last_name].filter(Boolean).join(" ") ||
    invoice.clients?.client_code ||
    "Client"
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "issued": return "bg-yellow-100 text-yellow-700";
    case "partially_paid": return "bg-orange-100 text-orange-700";
    case "paid": return "bg-green-100 text-green-700";
    case "overdue": return "bg-red-100 text-red-700";
    case "draft": return "bg-slate-100 text-slate-700";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function AdminInvoices() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<Enums<"invoice_status">>("draft");
  const [savingStatus, setSavingStatus] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["staff-invoices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*, clients(company_name, first_name, last_name, client_code)")
        .order("created_at", { ascending: false });
      return (data ?? []) as StaffInvoice[];
    },
  });

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return invoices ?? [];
    }

    return (invoices ?? []).filter((invoice) => {
      const invoiceNumber = invoice.invoice_number.toLowerCase();
      const title = (invoice.title || invoice.description || "").toLowerCase();
      const clientName = getClientName(invoice).toLowerCase();
      const clientCode = (invoice.clients?.client_code || "").toLowerCase();

      return (
        invoiceNumber.includes(normalizedSearch) ||
        title.includes(normalizedSearch) ||
        clientName.includes(normalizedSearch) ||
        clientCode.includes(normalizedSearch)
      );
    });
  }, [invoices, searchQuery]);

  const selectedInvoice = filteredInvoices.find((invoice) => invoice.id === selectedInvoiceId)
    || invoices?.find((invoice) => invoice.id === selectedInvoiceId)
    || null;

  useEffect(() => {
    if (selectedInvoice) {
      setSelectedStatus(selectedInvoice.status);
    }
  }, [selectedInvoice]);

  const updateStatus = async () => {
    if (!selectedInvoice) return;

    setSavingStatus(true);
    const updates: TablesUpdate<"invoices"> = { status: selectedStatus };
    const { error } = await supabase.from("invoices").update(updates).eq("id", selectedInvoice.id);

    if (error) {
      toast.error(error.message);
      setSavingStatus(false);
      return;
    }

    toast.success("Invoice updated");
    setSavingStatus(false);
    await queryClient.invalidateQueries({ queryKey: ["staff-invoices"] });
  };

  const overdueCount = (invoices ?? []).filter((invoice) => invoice.status === "overdue").length;
  const unpaidCount = (invoices ?? []).filter((invoice) => !["paid", "cancelled"].includes(invoice.status)).length;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">All Invoices</h1>
          <p className="text-muted-foreground font-body text-sm">Review client billing, open invoice details, and update payment status.</p>
        </div>
        <div className="flex gap-3 text-sm font-body">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-muted-foreground">Unpaid</p>
            <p className="font-display text-xl text-foreground">{unpaidCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-muted-foreground">Overdue</p>
            <p className="font-display text-xl text-foreground">{overdueCount}</p>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search invoice, client, or code..."
          className="rounded-xl pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : filteredInvoices.length > 0 ? (
        <div className="space-y-3">
          {filteredInvoices.map((invoice) => (
            <button
              key={invoice.id}
              type="button"
              onClick={() => setSelectedInvoiceId(invoice.id)}
              className="w-full text-left bg-card rounded-xl border border-border shadow-card p-5 hover:shadow-elevated hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">{invoice.invoice_number}</p>
                  <p className="text-sm text-muted-foreground font-body">
                    {getClientName(invoice)}{invoice.clients?.client_code ? ` (${invoice.clients.client_code})` : ""}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full font-body ${getStatusColor(invoice.status)}`}>
                  {invoice.status.replace(/_/g, " ")}
                </span>
              </div>

              <p className="text-sm text-foreground font-body mb-4">{invoice.title || invoice.description || "Service invoice"}</p>

              <div className="grid sm:grid-cols-4 gap-3 text-sm font-body">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-semibold text-foreground">R {Number(invoice.total_amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Paid</p>
                  <p className="font-semibold text-foreground">R {Number(invoice.amount_paid).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Balance</p>
                  <p className="font-semibold text-foreground">R {Number(invoice.balance_due).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due</p>
                  <p className="font-semibold text-foreground">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "-"}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">
            {searchQuery.trim() ? "No invoices matched your search." : "No invoices found."}
          </p>
        </div>
      )}

      <DashboardItemDialog
        open={!!selectedInvoice}
        onOpenChange={(open) => {
          if (!open) setSelectedInvoiceId(null);
        }}
        title={selectedInvoice?.invoice_number ?? "Invoice Details"}
        description="Review the full billing summary and update invoice status from this popup."
      >
        {selectedInvoice ? (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Client</p>
                <p className="font-body text-foreground">{getClientName(selectedInvoice)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Invoice Title</p>
                <p className="font-body text-foreground">{selectedInvoice.title || selectedInvoice.description || "Service invoice"}</p>
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

            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Invoice Status</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as Enums<"invoice_status">)}>
                  <SelectTrigger className="w-full sm:w-64 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceStatuses.map((status) => (
                      <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" className="rounded-xl" onClick={updateStatus} disabled={savingStatus}>
                  {savingStatus ? "Saving..." : "Save Status"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}
