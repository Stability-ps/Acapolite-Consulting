import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { useAuth } from "@/hooks/useAuth";
import { useAccessibleClientIds } from "@/hooks/useAccessibleClientIds";
import { sendInvoiceCreatedNotification } from "@/lib/invoiceNotifications";

const invoiceStatuses: Enums<"invoice_status">[] = ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"];

type StaffInvoice = {
  id: string;
  invoice_number: string;
  case_id?: string | null;
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
    profile_id?: string | null;
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    client_code?: string | null;
    profiles?: {
      full_name?: string | null;
      email?: string | null;
    } | null;
  } | null;
};

function getClientName(invoice: StaffInvoice) {
  return (
    invoice.clients?.company_name ||
    invoice.clients?.profiles?.full_name ||
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
  const { user, hasStaffPermission } = useAuth();
  const { accessibleClientIds, hasRestrictedClientScope, isLoadingAccessibleClientIds } = useAccessibleClientIds();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<Enums<"invoice_status">>("draft");
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [invoiceDescription, setInvoiceDescription] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceTotalAmount, setInvoiceTotalAmount] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [resendingInvoice, setResendingInvoice] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [clientsFormValue, setClientsFormValue] = useState("");

  const accessibleClientIdsKey = accessibleClientIds?.join(",") ?? "all";
  const canManageInvoices = hasStaffPermission("can_manage_invoices");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["staff-invoices", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase
        .from("invoices")
        .select("*, clients(profile_id, company_name, first_name, last_name, client_code, profiles!clients_profile_id_fkey(full_name, email))")
        .order("created_at", { ascending: false });

      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }

      const { data } = await query;
      return (data ?? []) as StaffInvoice[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: clients } = useQuery({
    queryKey: ["staff-invoice-clients", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase
        .from("clients")
        .select("id, profile_id, company_name, first_name, last_name, client_code, profiles!clients_profile_id_fkey(full_name, email)")
        .order("created_at", { ascending: false });

      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("id", accessibleClientIds);
      }

      const { data } = await query;
      return data ?? [];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
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
      setInvoiceTitle(selectedInvoice.title || "");
      setInvoiceDescription(selectedInvoice.description || "");
      setInvoiceDueDate(selectedInvoice.due_date || "");
      setInvoiceTotalAmount(String(selectedInvoice.total_amount ?? ""));
    }
  }, [selectedInvoice]);

  const resetCreateForm = () => {
    setClientsFormValue("");
    setInvoiceTitle("");
    setInvoiceDescription("");
    setInvoiceDueDate("");
    setInvoiceTotalAmount("");
    setSelectedStatus("draft");
  };

  const updateInvoice = async () => {
    if (!selectedInvoice) return;
    if (!canManageInvoices) {
      toast.error("This consultant profile cannot update invoices.");
      return;
    }

    setSavingStatus(true);
    const totalAmount = Number(invoiceTotalAmount);
    const updates: TablesUpdate<"invoices"> = {
      status: selectedStatus,
      title: invoiceTitle.trim() || null,
      description: invoiceDescription.trim() || null,
      total_amount: Number.isNaN(totalAmount) ? selectedInvoice.total_amount : totalAmount,
      subtotal: Number.isNaN(totalAmount) ? selectedInvoice.total_amount : totalAmount,
      due_date: invoiceDueDate || null,
    };
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

  const resendInvoice = async () => {
    if (!selectedInvoice) return;
    if (!canManageInvoices) {
      toast.error("This consultant profile cannot resend invoices.");
      return;
    }

    const clientProfileId = selectedInvoice.clients?.profile_id;
    const clientEmail = selectedInvoice.clients?.profiles?.email;

    if (!clientProfileId || !clientEmail) {
      toast.error("This invoice cannot be emailed because the client does not have a valid portal profile and email.");
      return;
    }

    setResendingInvoice(true);

    const notification = await sendInvoiceCreatedNotification({
      invoiceId: selectedInvoice.id,
      invoiceNumber: selectedInvoice.invoice_number,
      clientProfileId,
      clientEmail,
      clientName: getClientName(selectedInvoice),
      serviceDescription: invoiceTitle.trim() || invoiceDescription.trim() || selectedInvoice.title || selectedInvoice.description || "Professional tax services",
      amount: Number(invoiceTotalAmount || selectedInvoice.total_amount || 0),
      dueDate: invoiceDueDate || selectedInvoice.due_date,
      caseNumber: selectedInvoice.case_id?.trim() || undefined,
      status: selectedStatus || selectedInvoice.status,
    });

    setResendingInvoice(false);

    if (notification.error) {
      console.error("Resend invoice email failed:", notification.error);
      toast.error(notification.error.message || "Unable to resend the invoice email.");
      return;
    }

    toast.success(notification.skipped ? "Invoice email was already logged for this invoice." : "Invoice email sent to the client.");
  };

  const createInvoice = async () => {
    if (!canManageInvoices) {
      toast.error("This consultant profile cannot create invoices.");
      return;
    }

    if (!clientsFormValue) {
      toast.error("Select a client first.");
      return;
    }

    const totalAmount = Number(invoiceTotalAmount);

    if (Number.isNaN(totalAmount) || totalAmount < 0) {
      toast.error("Enter a valid invoice amount.");
      return;
    }

    setCreatingInvoice(true);

    const payload: TablesInsert<"invoices"> = {
      client_id: clientsFormValue,
      invoice_number: `TEMP-${Date.now()}`,
      title: invoiceTitle.trim() || null,
      description: invoiceDescription.trim() || null,
      subtotal: totalAmount,
      tax_amount: 0,
      total_amount: totalAmount,
      amount_paid: 0,
      due_date: invoiceDueDate || null,
      status: selectedStatus,
      created_by: user?.id ?? null,
    };

    const { data, error } = await supabase.from("invoices").insert(payload).select("id, invoice_number, due_date, status").single();

    if (error) {
      toast.error(error.message);
      setCreatingInvoice(false);
      return;
    }

    const selectedClient = (clients ?? []).find((client: { id: string }) => client.id === clientsFormValue) as {
      id: string;
      profile_id: string | null;
      company_name: string | null;
      first_name: string | null;
      last_name: string | null;
      client_code: string | null;
      profiles?: { full_name?: string | null; email?: string | null } | null;
    } | undefined;

    let notified = false;

    if (selectedClient?.profile_id && data?.id) {
      const notification = await sendInvoiceCreatedNotification({
        invoiceId: data.id,
        invoiceNumber: data.invoice_number,
        clientProfileId: selectedClient.profile_id,
        clientEmail: selectedClient.profiles?.email,
        clientName:
          selectedClient.company_name
          || selectedClient.profiles?.full_name
          || [selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(" ")
          || selectedClient.client_code
          || "Client",
        serviceDescription: invoiceTitle.trim() || invoiceDescription.trim() || "Professional tax services",
        amount: totalAmount,
        dueDate: data.due_date,
        status: data.status,
      });

      if (notification.error) {
        console.error("Invoice email failed:", notification.error);
        toast.error("Invoice created, but the client email notification could not be delivered.");
      } else {
        notified = !notification.skipped;
      }
    }

    if (!selectedClient?.profile_id) {
      toast.success("Invoice created");
    } else if (notified) {
      toast.success("Invoice created and client notified");
    } else {
      toast.success("Invoice created");
    }
    setCreatingInvoice(false);
    setIsCreateOpen(false);
    resetCreateForm();
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
        <div className="flex items-center gap-3 text-sm font-body">
          {canManageInvoices ? (
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => {
                resetCreateForm();
                setIsCreateOpen(true);
              }}
            >
              Create Invoice
            </Button>
          ) : null}
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

      {isLoading || isLoadingAccessibleClientIds ? (
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
        description="Review the full billing summary and edit invoice details from this popup."
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
                {canManageInvoices ? (
                  <Input
                    value={invoiceTitle}
                    onChange={(event) => setInvoiceTitle(event.target.value)}
                    placeholder="Service invoice"
                    className="rounded-xl"
                  />
                ) : (
                  <p className="font-body text-foreground">{invoiceTitle || "Service invoice"}</p>
                )}
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Issue Date</p>
                <p className="font-body text-foreground">{new Date(selectedInvoice.issue_date).toLocaleDateString()}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Due Date</p>
                {canManageInvoices ? (
                  <Input
                    type="date"
                    value={invoiceDueDate}
                    onChange={(event) => setInvoiceDueDate(event.target.value)}
                    className="rounded-xl"
                  />
                ) : (
                  <p className="font-body text-foreground">{invoiceDueDate ? new Date(invoiceDueDate).toLocaleDateString() : "Not set"}</p>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Total Amount</p>
                {canManageInvoices ? (
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoiceTotalAmount}
                    onChange={(event) => setInvoiceTotalAmount(event.target.value)}
                    className="rounded-xl"
                  />
                ) : (
                  <p className="font-display text-2xl text-foreground">R {Number(invoiceTotalAmount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
                )}
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

            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Description</label>
              {canManageInvoices ? (
                <Textarea
                  value={invoiceDescription}
                  onChange={(event) => setInvoiceDescription(event.target.value)}
                  placeholder="Optional billing description."
                  className="rounded-xl"
                />
              ) : (
                <div className="rounded-2xl border border-border p-4">
                  <p className="font-body text-foreground">{invoiceDescription || "No description added."}</p>
                </div>
              )}
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
              {canManageInvoices ? (
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
                  <Button type="button" className="rounded-xl" onClick={updateInvoice} disabled={savingStatus}>
                    {savingStatus ? "Saving..." : "Save Invoice"}
                  </Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={resendInvoice} disabled={resendingInvoice}>
                    {resendingInvoice ? "Sending..." : "Resend Invoice"}
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-accent/30 p-4">
                  <p className="text-sm text-muted-foreground font-body">This consultant profile can view invoices but cannot change billing records.</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>

      <DashboardItemDialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetCreateForm();
        }}
        title="Create Invoice"
        description="Create a new invoice from the main admin billing tab."
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Client</label>
            <Select value={clientsFormValue} onValueChange={setClientsFormValue}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((client: { id: string; company_name: string | null; first_name: string | null; last_name: string | null; client_code: string | null }) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || "Client"}
                    {client.client_code ? ` (${client.client_code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Invoice Title</label>
            <Input
              value={invoiceTitle}
              onChange={(event) => setInvoiceTitle(event.target.value)}
              placeholder="Example: Tax Return Filing"
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Description</label>
            <Textarea
              value={invoiceDescription}
              onChange={(event) => setInvoiceDescription(event.target.value)}
              placeholder="Optional billing description."
              className="rounded-xl"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Total Amount</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={invoiceTotalAmount}
                onChange={(event) => setInvoiceTotalAmount(event.target.value)}
                placeholder="0.00"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Status</label>
              <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as Enums<"invoice_status">)}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {invoiceStatuses.map((status) => (
                    <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Due Date</label>
            <Input
              type="date"
              value={invoiceDueDate}
              onChange={(event) => setInvoiceDueDate(event.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsCreateOpen(false)} disabled={creatingInvoice}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={createInvoice} disabled={creatingInvoice}>
              {creatingInvoice ? "Creating..." : "Create Invoice"}
            </Button>
          </div>
        </div>
      </DashboardItemDialog>
    </div>
  );
}
