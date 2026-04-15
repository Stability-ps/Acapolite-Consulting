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
import { formatCaseReference } from "@/lib/practitionerAssignments";
import { openInvoicePdf } from "@/lib/invoicePdf";
import { logSystemActivity } from "@/lib/systemActivityLog";

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
  sent_at?: string | null;
  paid_at?: string | null;
  overdue_at?: string | null;
  cancelled_at?: string | null;
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
  created_by_profile?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  practitioner_bank_details?: string | null;
};

type PractitionerBankProfile = {
  profile_id: string;
  bank_account_holder_name: string | null;
  bank_name: string | null;
  bank_branch_name: string | null;
  bank_branch_code: string | null;
  bank_account_number: string | null;
  bank_account_type: string | null;
  vat_number: string | null;
  profiles?: { full_name?: string | null } | null;
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
  const { user, role, hasStaffPermission } = useAuth();
  const { accessibleClientIds, hasRestrictedClientScope, isLoadingAccessibleClientIds } = useAccessibleClientIds();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Enums<"invoice_status">>("all");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<Enums<"invoice_status">>("draft");
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [invoiceDescription, setInvoiceDescription] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceSubtotal, setInvoiceSubtotal] = useState("");
  const [invoiceVatAmount, setInvoiceVatAmount] = useState("");
  const [invoiceCaseId, setInvoiceCaseId] = useState<string | null>(null);
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
        .select("*, clients(profile_id, company_name, first_name, last_name, client_code, profiles!clients_profile_id_fkey(full_name, email)), created_by_profile:profiles!invoices_created_by_fkey(full_name, email)")
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
        .select("id, profile_id, company_name, first_name, last_name, client_code, assigned_consultant_id, profiles!clients_profile_id_fkey(full_name, email)")
        .order("created_at", { ascending: false });

      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("id", accessibleClientIds);
      }

      const { data } = await query;
      return data ?? [];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: cases } = useQuery({
    queryKey: ["staff-invoice-cases", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase
        .from("cases")
        .select("id, client_id, assigned_consultant_id, case_title, case_type, sars_case_reference, created_at")
        .order("created_at", { ascending: false });

      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }

      const { data } = await query;
      return data ?? [];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: practitionerProfiles } = useQuery({
    queryKey: ["staff-invoice-practitioners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select("profile_id, bank_account_holder_name, bank_name, bank_branch_name, bank_branch_code, bank_account_number, bank_account_type, vat_number, profiles!practitioner_profiles_profile_id_fkey(full_name)")
        .order("profile_id", { ascending: true });
      if (error) {
        throw error;
      }
      return (data ?? []) as PractitionerBankProfile[];
    },
  });

  const practitionerProfileMap = useMemo(() => {
    return new Map((practitionerProfiles ?? []).map((profile) => [profile.profile_id, profile]));
  }, [practitionerProfiles]);

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return (invoices ?? []).filter((invoice) => {
      if (statusFilter !== "all" && invoice.status !== statusFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
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
  }, [invoices, searchQuery, statusFilter]);

  const caseOptions = useMemo(() => {
    const filteredCases = clientsFormValue
      ? (cases ?? []).filter((caseItem: { client_id: string }) => caseItem.client_id === clientsFormValue)
      : cases ?? [];

    return filteredCases.map((caseItem: { id: string; case_title: string; case_type: string; sars_case_reference: string | null }) => ({
      id: caseItem.id,
      label: `${caseItem.case_title} • ${caseItem.sars_case_reference || formatCaseReference(caseItem.id)} • ${caseItem.case_type.replace(/_/g, " ")}`,
    }));
  }, [cases, clientsFormValue]);

  const selectedInvoice = filteredInvoices.find((invoice) => invoice.id === selectedInvoiceId)
    || invoices?.find((invoice) => invoice.id === selectedInvoiceId)
    || null;

  const selectedInvoiceCaseOptions = useMemo(() => {
    if (!selectedInvoice?.client_id) {
      return [];
    }

    return (cases ?? [])
      .filter((caseItem: { client_id: string }) => caseItem.client_id === selectedInvoice.client_id)
      .map((caseItem: { id: string; case_title: string; case_type: string; sars_case_reference: string | null }) => ({
        id: caseItem.id,
        label: `${caseItem.case_title} • ${caseItem.sars_case_reference || formatCaseReference(caseItem.id)} • ${caseItem.case_type.replace(/_/g, " ")}`,
      }));
  }, [cases, selectedInvoice?.client_id]);

  useEffect(() => {
    if (selectedInvoice) {
      setSelectedStatus(selectedInvoice.status);
      setInvoiceTitle(selectedInvoice.title || "");
      setInvoiceDescription(selectedInvoice.description || "");
      setInvoiceDueDate(selectedInvoice.due_date || "");
      setInvoiceSubtotal(String(selectedInvoice.subtotal ?? selectedInvoice.total_amount ?? ""));
      setInvoiceVatAmount(String(selectedInvoice.tax_amount ?? 0));
      setInvoiceCaseId(selectedInvoice.case_id ?? null);
    }
  }, [selectedInvoice]);

  const resetCreateForm = () => {
    setClientsFormValue("");
    setInvoiceTitle("");
    setInvoiceDescription("");
    setInvoiceDueDate("");
    setInvoiceSubtotal("");
    setInvoiceVatAmount("");
    setInvoiceCaseId(null);
    setSelectedStatus("draft");
  };

  const resolvePractitionerId = () => {
    if (role === "consultant" && user?.id) {
      return user.id;
    }

    const selectedCase = (cases ?? []).find((caseItem: { id: string }) => caseItem.id === invoiceCaseId);
    if (selectedCase?.assigned_consultant_id) {
      return selectedCase.assigned_consultant_id;
    }

    const selectedClient = (clients ?? []).find((client: { id: string }) => client.id === clientsFormValue) as
      | { assigned_consultant_id?: string | null }
      | undefined;

    return selectedClient?.assigned_consultant_id || null;
  };

  const resolveBankProfile = () => {
    const practitionerId = resolvePractitionerId();
    if (!practitionerId) return null;
    return practitionerProfileMap.get(practitionerId) ?? null;
  };

  const formatBankDetails = (profile: PractitionerBankProfile) => {
    const accountHolder = profile.bank_account_holder_name || profile.profiles?.full_name || "";
    const lines = [
      accountHolder && `Account Holder: ${accountHolder}`,
      profile.bank_name && `Bank: ${profile.bank_name}`,
      profile.bank_branch_name && `Branch: ${profile.bank_branch_name}`,
      profile.bank_branch_code && `Branch Code: ${profile.bank_branch_code}`,
      profile.bank_account_number && `Account Number: ${profile.bank_account_number}`,
      profile.bank_account_type && `Account Type: ${profile.bank_account_type}`,
      profile.vat_number && `VAT Number: ${profile.vat_number}`,
    ].filter(Boolean);
    return lines.join("\n");
  };

  const maskAccountNumber = (value?: string | null) => {
    const trimmed = value?.trim() || "";
    if (trimmed.length <= 4) return trimmed;
    return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
  };

  const updateInvoice = async () => {
    if (!selectedInvoice) return;
    if (!canManageInvoices) {
      toast.error("This consultant profile cannot update invoices.");
      return;
    }

    setSavingStatus(true);
    const subtotalAmount = Number(invoiceSubtotal);
    const vatAmount = Number(invoiceVatAmount || 0);
    const totalAmount = (Number.isNaN(subtotalAmount) ? selectedInvoice.subtotal : subtotalAmount) + (Number.isNaN(vatAmount) ? selectedInvoice.tax_amount : vatAmount);
    const nowIso = new Date().toISOString();
    const updates: TablesUpdate<"invoices"> = {
      status: selectedStatus,
      title: invoiceTitle.trim() || null,
      description: invoiceDescription.trim() || null,
      subtotal: Number.isNaN(subtotalAmount) ? selectedInvoice.subtotal : subtotalAmount,
      tax_amount: Number.isNaN(vatAmount) ? selectedInvoice.tax_amount : vatAmount,
      total_amount: totalAmount,
      due_date: invoiceDueDate || null,
      case_id: invoiceCaseId || null,
    };

    if (selectedStatus !== selectedInvoice.status) {
      if (selectedStatus === "issued") {
        updates.sent_at = nowIso;
      }
      if (selectedStatus === "paid") {
        updates.paid_at = nowIso;
      }
      if (selectedStatus === "overdue") {
        updates.overdue_at = nowIso;
      }
      if (selectedStatus === "cancelled") {
        updates.cancelled_at = nowIso;
      }
    }
    const { error } = await supabase.from("invoices").update(updates).eq("id", selectedInvoice.id);

    if (error) {
      toast.error(error.message);
      setSavingStatus(false);
      return;
    }

    toast.success("Invoice updated");
    setSavingStatus(false);
    if (user && role) {
      const previousStatus = selectedInvoice.status;
      if (selectedStatus === "issued" && previousStatus !== "issued") {
        await logSystemActivity({
          actorProfileId: user.id,
          actorRole: role,
          action: "invoice_sent",
          targetType: "invoice",
          targetId: selectedInvoice.id,
          metadata: {
            previousStatus,
            newStatus: selectedStatus,
          },
        });
      }
      if (selectedStatus === "paid" && previousStatus !== "paid") {
        await logSystemActivity({
          actorProfileId: user.id,
          actorRole: role,
          action: "invoice_marked_paid",
          targetType: "invoice",
          targetId: selectedInvoice.id,
          metadata: {
            previousStatus,
            newStatus: selectedStatus,
          },
        });
      }
    }
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
      amount: (Number(invoiceSubtotal || selectedInvoice.subtotal || 0) + Number(invoiceVatAmount || selectedInvoice.tax_amount || 0)),
      dueDate: invoiceDueDate || selectedInvoice.due_date,
      caseNumber: selectedInvoice.case_id ? formatCaseReference(selectedInvoice.case_id) : undefined,
      status: selectedStatus || selectedInvoice.status,
    });

    setResendingInvoice(false);

    if (notification.error) {
      console.error("Resend invoice email failed:", notification.error);
      toast.error(notification.error.message || "Unable to resend the invoice email.");
      return;
    }

    if (!notification.error) {
      const statusUpdate: TablesUpdate<"invoices"> = {
        sent_at: new Date().toISOString(),
      };
      if (selectedInvoice.status === "draft") {
        statusUpdate.status = "issued";
      }
      const { error } = await supabase.from("invoices").update(statusUpdate).eq("id", selectedInvoice.id);
      if (error) {
        console.error("Unable to update sent timestamp:", error.message);
      }
    }

    toast.success(notification.skipped ? "Invoice email was already logged for this invoice." : "Invoice email sent to the client.");
    if (user && role) {
      await logSystemActivity({
        actorProfileId: user.id,
        actorRole: role,
        action: "invoice_sent",
        targetType: "invoice",
        targetId: selectedInvoice.id,
        metadata: {
          status: selectedStatus || selectedInvoice.status,
        },
      });
    }
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

    const bankProfile = resolveBankProfile();
    const accountHolderName = bankProfile?.bank_account_holder_name || bankProfile?.profiles?.full_name || "";
    const hasCompleteBanking = Boolean(
      accountHolderName.trim()
      && bankProfile?.bank_name?.trim()
      && bankProfile?.bank_branch_name?.trim()
      && bankProfile?.bank_branch_code?.trim()
      && bankProfile?.bank_account_number?.trim()
      && bankProfile?.bank_account_type?.trim(),
    );

    if (!bankProfile || !hasCompleteBanking) {
      toast.error("Practitioner banking details are incomplete. Update the banking profile before creating an invoice.");
      return;
    }

    const subtotalAmount = Number(invoiceSubtotal);
    const vatAmount = Number(invoiceVatAmount || 0);
    const totalAmount = subtotalAmount + vatAmount;

    if (Number.isNaN(subtotalAmount) || subtotalAmount < 0) {
      toast.error("Enter a valid invoice amount.");
      return;
    }

    setCreatingInvoice(true);

    const nowIso = new Date().toISOString();
    const payload: TablesInsert<"invoices"> = {
      client_id: clientsFormValue,
      case_id: invoiceCaseId || null,
      invoice_number: `TEMP-${Date.now()}`,
      title: invoiceTitle.trim() || null,
      description: invoiceDescription.trim() || null,
      subtotal: subtotalAmount,
      tax_amount: Number.isNaN(vatAmount) ? 0 : vatAmount,
      total_amount: totalAmount,
      amount_paid: 0,
      due_date: invoiceDueDate || null,
      status: selectedStatus,
      created_by: user?.id ?? null,
      practitioner_bank_details: formatBankDetails(bankProfile),
    };

    if (selectedStatus === "issued") {
      payload.sent_at = nowIso;
    }
    if (selectedStatus === "paid") {
      payload.paid_at = nowIso;
    }
    if (selectedStatus === "overdue") {
      payload.overdue_at = nowIso;
    }
    if (selectedStatus === "cancelled") {
      payload.cancelled_at = nowIso;
    }

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
        caseNumber: invoiceCaseId ? formatCaseReference(invoiceCaseId) : undefined,
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
    if (user && role && data?.id) {
      await logSystemActivity({
        actorProfileId: user.id,
        actorRole: role,
        action: "invoice_created",
        targetType: "invoice",
        targetId: data.id,
        metadata: {
          status: data.status,
          amount: totalAmount,
        },
      });
      if (data.status === "issued") {
        await logSystemActivity({
          actorProfileId: user.id,
          actorRole: role,
          action: "invoice_sent",
          targetType: "invoice",
          targetId: data.id,
          metadata: {
            status: data.status,
          },
        });
      }
    }
    setCreatingInvoice(false);
    setIsCreateOpen(false);
    resetCreateForm();
    await queryClient.invalidateQueries({ queryKey: ["staff-invoices"] });
  };

  const overdueCount = (invoices ?? []).filter((invoice) => invoice.status === "overdue").length;
  const unpaidCount = (invoices ?? []).filter((invoice) => !["paid", "cancelled"].includes(invoice.status)).length;
  const disclaimerText = "Payment is made directly to the practitioner. Acapolite Consulting is not responsible for payment processing or payment disputes.";

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search invoice, client, or code..."
            className="rounded-xl pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { label: "All", value: "all" },
            { label: "Draft", value: "draft" },
            { label: "Sent", value: "issued" },
            { label: "Paid", value: "paid" },
            { label: "Overdue", value: "overdue" },
            { label: "Cancelled", value: "cancelled" },
          ] as const).map((item) => (
            <Button
              key={item.value}
              type="button"
              variant={statusFilter === item.value ? "default" : "outline"}
              className="rounded-full px-4"
              onClick={() => setStatusFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
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
                  <p className="text-xs text-muted-foreground font-body mt-1">
                    Issued by {invoice.created_by_profile?.full_name || invoice.created_by_profile?.email || "Acapolite Consulting"}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full font-body ${getStatusColor(invoice.status)}`}>
                  {invoice.status.replace(/_/g, " ")}
                </span>
              </div>

                <p className="text-sm text-foreground font-body mb-4">{invoice.title || invoice.description || "Service invoice"}</p>

                {canManageInvoices ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {invoice.status !== "issued" && invoice.status !== "paid" && invoice.status !== "cancelled" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full px-4"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedInvoiceId(invoice.id);
                          setSelectedStatus("issued");
                          void updateInvoice();
                        }}
                      >
                        Send Invoice
                      </Button>
                    ) : null}
                    {invoice.status !== "paid" && invoice.status !== "cancelled" ? (
                      <Button
                        type="button"
                        className="rounded-full px-4"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedInvoiceId(invoice.id);
                          setSelectedStatus("paid");
                          void updateInvoice();
                        }}
                      >
                        Mark as Paid
                      </Button>
                    ) : null}
                    {invoice.status === "issued" || invoice.status === "overdue" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full px-4"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedInvoiceId(invoice.id);
                          void resendInvoice();
                        }}
                      >
                        Send Reminder
                      </Button>
                    ) : null}
                  </div>
                ) : null}

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
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Case Reference</p>
                {canManageInvoices ? (
                  <Select value={invoiceCaseId ?? "general"} onValueChange={(value) => setInvoiceCaseId(value === "general" ? null : value)}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Support</SelectItem>
                      {selectedInvoiceCaseOptions.map((caseOption) => (
                        <SelectItem key={caseOption.id} value={caseOption.id}>
                          {caseOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-body text-foreground">{selectedInvoice.case_id ? formatCaseReference(selectedInvoice.case_id) : "General Support"}</p>
                )}
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
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Issued By</p>
                <p className="font-body text-foreground">
                  {selectedInvoice.created_by_profile?.full_name || selectedInvoice.created_by_profile?.email || "Acapolite Consulting"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Sent At</p>
                <p className="font-body text-foreground">{selectedInvoice.sent_at ? new Date(selectedInvoice.sent_at).toLocaleString() : "Not sent yet"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Paid At</p>
                <p className="font-body text-foreground">{selectedInvoice.paid_at ? new Date(selectedInvoice.paid_at).toLocaleString() : "Not paid yet"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Overdue At</p>
                <p className="font-body text-foreground">{selectedInvoice.overdue_at ? new Date(selectedInvoice.overdue_at).toLocaleString() : "Not overdue"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Cancelled At</p>
                <p className="font-body text-foreground">{selectedInvoice.cancelled_at ? new Date(selectedInvoice.cancelled_at).toLocaleString() : "Not cancelled"}</p>
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
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Amount</p>
                {canManageInvoices ? (
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoiceSubtotal}
                    onChange={(event) => setInvoiceSubtotal(event.target.value)}
                    className="rounded-xl"
                  />
                ) : (
                  <p className="font-display text-2xl text-foreground">R {Number(invoiceSubtotal || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
                )}
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">VAT (optional)</p>
                {canManageInvoices ? (
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoiceVatAmount}
                    onChange={(event) => setInvoiceVatAmount(event.target.value)}
                    className="rounded-xl"
                  />
                ) : (
                  <p className="font-display text-2xl text-foreground">R {Number(invoiceVatAmount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
                )}
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Total</p>
                <p className="font-display text-2xl text-foreground">
                  R {Number(Number(invoiceSubtotal || 0) + Number(invoiceVatAmount || 0)).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
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

            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Practitioner Banking Details</label>
              <div className="rounded-2xl border border-border p-4">
                <p className="font-body text-foreground whitespace-pre-wrap">
                  {selectedInvoice.practitioner_bank_details || "Banking details were not captured on this invoice."}
                </p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground font-body">
                Banking details are read-only on issued invoices.
              </p>
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

            <div className="rounded-2xl border border-border bg-accent/20 p-4">
              <p className="text-sm text-muted-foreground font-body">{disclaimerText}</p>
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
            <Select
              value={clientsFormValue}
              onValueChange={(value) => {
                setClientsFormValue(value);
                setInvoiceCaseId(null);
              }}
            >
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
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Case Reference</label>
            <Select value={invoiceCaseId ?? "general"} onValueChange={(value) => setInvoiceCaseId(value === "general" ? null : value)}>
              <SelectTrigger className="w-full rounded-xl" disabled={!clientsFormValue}>
                <SelectValue placeholder={clientsFormValue ? "Select a case" : "Select a client first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Support</SelectItem>
                {caseOptions.map((caseOption) => (
                  <SelectItem key={caseOption.id} value={caseOption.id}>
                    {caseOption.label}
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
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Amount</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={invoiceSubtotal}
                onChange={(event) => setInvoiceSubtotal(event.target.value)}
                placeholder="0.00"
                className="rounded-xl"
              />
              <p className="mt-2 text-xs text-muted-foreground font-body">
                Total: R {Number(Number(invoiceSubtotal || 0) + Number(invoiceVatAmount || 0)).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">VAT (optional)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={invoiceVatAmount}
                onChange={(event) => setInvoiceVatAmount(event.target.value)}
                placeholder="0.00"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Due Date</label>
              <Input
                type="date"
                value={invoiceDueDate}
                onChange={(event) => setInvoiceDueDate(event.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-accent/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Practitioner Banking Details</p>
            {(() => {
              const bankProfile = resolveBankProfile();
              if (!bankProfile) {
                return (
                  <p className="mt-2 text-sm text-muted-foreground font-body">
                    Assign a practitioner to the selected case or client to auto-fill banking details.
                  </p>
                );
              }
              return (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm font-body text-foreground">
                  <div>
                    <p className="text-xs text-muted-foreground">Account Holder</p>
                    <p className="font-semibold">{bankProfile.bank_account_holder_name || bankProfile.profiles?.full_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bank Name</p>
                    <p className="font-semibold">{bankProfile.bank_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Branch Name</p>
                    <p className="font-semibold">{bankProfile.bank_branch_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Branch Code</p>
                    <p className="font-semibold">{bankProfile.bank_branch_code || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Account Number</p>
                    <p className="font-semibold">{bankProfile.bank_account_number ? maskAccountNumber(bankProfile.bank_account_number) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Account Type</p>
                    <p className="font-semibold">{bankProfile.bank_account_type || "—"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">VAT Number (Optional)</p>
                    <p className="font-semibold">{bankProfile.vat_number || "—"}</p>
                  </div>
                </div>
              );
            })()}
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
