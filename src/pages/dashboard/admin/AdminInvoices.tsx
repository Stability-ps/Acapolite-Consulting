import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Download, Eye, Mail, Paperclip, Printer, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { useAuth } from "@/hooks/useAuth";
import { useAccessibleClientIds } from "@/hooks/useAccessibleClientIds";
import { sendInvoiceCreatedNotification } from "@/lib/invoiceNotifications";
import { formatCaseReference } from "@/lib/practitionerAssignments";
import { openInvoicePdf } from "@/lib/invoicePdf";
import { logSystemActivity } from "@/lib/systemActivityLog";
import { InvoiceLineItemsEditor } from "@/components/dashboard/InvoiceLineItemsEditor";
import {
  calculateInvoiceFinalTotal,
  calculateInvoiceVatAmount,
  calculateInvoiceSubtotal,
  createEmptyInvoiceLineItem,
  createInvoiceAttachmentLocalId,
  defaultInvoiceTerms,
  formatCurrency,
  invoiceAttachmentTypeOptions,
  type InvoiceAttachmentType,
  type InvoiceFileAttachmentDraft,
  type InvoiceLineItemDraft,
  sanitizeStorageFileName,
} from "@/lib/invoiceUtils";

const invoiceStatuses: Enums<"invoice_status">[] = ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"];

type StaffInvoice = {
  id: string;
  client_id: string;
  invoice_number: string;
  case_id?: string | null;
  title: string | null;
  description: string | null;
  subtotal: number;
  discount_amount?: number | null;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  due_date: string | null;
  issue_date: string;
  sent_at?: string | null;
  viewed_at?: string | null;
  paid_at?: string | null;
  overdue_at?: string | null;
  cancelled_at?: string | null;
  status: Enums<"invoice_status">;
  payment_reference: string | null;
  notes_to_client?: string | null;
  terms_and_conditions?: string | null;
  practitioner_name?: string | null;
  practice_name?: string | null;
  practitioner_number?: string | null;
  practitioner_email?: string | null;
  practitioner_phone?: string | null;
  practitioner_address?: string | null;
  practitioner_logo_path?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  clients?: {
    profile_id?: string | null;
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    client_code?: string | null;
    phone?: string | null;
    address_line_1?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
    country?: string | null;
    profiles?: {
      full_name?: string | null;
      email?: string | null;
      phone?: string | null;
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
  business_type: string;
  bank_account_holder_name: string | null;
  bank_name: string | null;
  bank_branch_name: string | null;
  bank_branch_code: string | null;
  bank_account_number: string | null;
  bank_account_type: string | null;
  vat_number: string | null;
  banking_verification_status: string;
  banking_verified_at: string | null;
  banking_verified_by: string | null;
  business_name?: string | null;
  tax_practitioner_number?: string | null;
  city?: string | null;
  province?: string | null;
  invoice_logo_path?: string | null;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

type InvoiceItemRecord = {
  id: string;
  invoice_id: string;
  service_item: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type InvoiceAttachmentRecord = {
  id: string;
  attachment_type: string;
  document: {
    id: string;
    title: string;
    file_name: string;
    file_path: string;
    mime_type: string | null;
    file_size: number | null;
  };
};

function getBankingVerificationLabel(status?: string | null) {
  switch (status) {
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    default:
      return "Pending Verification";
  }
}

function getBankingVerificationBadgeClass(status?: string | null) {
  switch (status) {
    case "verified":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function getClientName(invoice: StaffInvoice) {
  return (
    invoice.client_name ||
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

function getAddressLabel(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ");
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
  const [invoiceDiscountAmount, setInvoiceDiscountAmount] = useState("0");
  const [invoiceVatAmount, setInvoiceVatAmount] = useState("15");
  const [invoiceNotesToClient, setInvoiceNotesToClient] = useState("");
  const [invoiceTermsAndConditions, setInvoiceTermsAndConditions] = useState(defaultInvoiceTerms);
  const [invoiceCaseId, setInvoiceCaseId] = useState<string | null>(null);
  const [invoiceLineItems, setInvoiceLineItems] = useState<InvoiceLineItemDraft[]>([
    createEmptyInvoiceLineItem(),
  ]);
  const [pendingAttachments, setPendingAttachments] = useState<InvoiceFileAttachmentDraft[]>([]);
  const [selectedAttachmentType, setSelectedAttachmentType] =
    useState<InvoiceAttachmentType>("supporting_document");
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
        .select("*, clients(profile_id, client_type, company_name, first_name, last_name, client_code, address_line_1, address_line_2, city, province, postal_code, country, profiles!clients_profile_id_fkey(full_name, email, phone)), created_by_profile:profiles!invoices_created_by_fkey(full_name, email)")
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
        .select("id, profile_id, client_type, company_name, first_name, last_name, client_code, address_line_1, address_line_2, city, province, postal_code, country, assigned_consultant_id, profiles!clients_profile_id_fkey(full_name, email, phone)")
        .order("created_at", { ascending: false });

      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("id", accessibleClientIds);
      }

      const { data } = await query;
      return (data ?? []) as any[];
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
      return (data ?? []) as any[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: practitionerProfiles } = useQuery({
    queryKey: ["staff-invoice-practitioners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select("profile_id, business_type, bank_account_holder_name, bank_name, bank_branch_name, bank_branch_code, bank_account_number, bank_account_type, vat_number, banking_verification_status, banking_verified_at, banking_verified_by, business_name, tax_practitioner_number, city, province, invoice_logo_path, profiles!practitioner_profiles_profile_id_fkey(full_name, email, phone)")
        .order("profile_id", { ascending: true });
      if (error) {
        throw error;
      }
      return (data ?? []) as PractitionerBankProfile[];
    },
  });

  const { data: selectedInvoiceItems } = useQuery({
    queryKey: ["staff-invoice-items", selectedInvoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", selectedInvoiceId!)
        .order("created_at", { ascending: true });
      if (error) {
        throw error;
      }
      return (data ?? []) as InvoiceItemRecord[];
    },
    enabled: Boolean(selectedInvoiceId),
  });

  const { data: selectedInvoiceAttachments } = useQuery({
    queryKey: ["staff-invoice-attachments", selectedInvoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_attachments")
        .select("id, attachment_type, document:documents!invoice_attachments_document_id_fkey(id, title, file_name, file_path, mime_type, file_size)")
        .eq("invoice_id", selectedInvoiceId!);
      if (error) {
        throw error;
      }
      return (data ?? []) as unknown as InvoiceAttachmentRecord[];
    },
    enabled: Boolean(selectedInvoiceId),
  });

  const practitionerProfileMap = useMemo(() => {
    return new Map((practitionerProfiles ?? []).map((profile) => [profile.profile_id, profile]));
  }, [practitionerProfiles]);

  const computedSubtotal = useMemo(
    () => calculateInvoiceSubtotal(invoiceLineItems),
    [invoiceLineItems],
  );

  const computedFinalTotal = useMemo(
    () => calculateInvoiceFinalTotal(invoiceLineItems, invoiceVatAmount, invoiceDiscountAmount),
    [invoiceDiscountAmount, invoiceLineItems, invoiceVatAmount],
  );

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
      setInvoiceDiscountAmount(String(selectedInvoice.discount_amount ?? 0));
      
      // Convert stored currency tax_amount back to percentage rate for UI
      const subtotal = selectedInvoice.subtotal ?? selectedInvoice.total_amount ?? 0;
      const discount = selectedInvoice.discount_amount ?? 0;
      const amountAfterDiscount = subtotal - discount;
      const rate = amountAfterDiscount > 0 
        ? Math.round((Number(selectedInvoice.tax_amount || 0) / amountAfterDiscount) * 100) 
        : 15;
      
      setInvoiceVatAmount(String(rate));
      setInvoiceNotesToClient(selectedInvoice.notes_to_client || "");
      setInvoiceTermsAndConditions(selectedInvoice.terms_and_conditions || defaultInvoiceTerms);
      setInvoiceCaseId(selectedInvoice.case_id ?? null);
      setPendingAttachments([]);
    }
  }, [selectedInvoice]);

  useEffect(() => {
    if (!selectedInvoiceId) {
      setInvoiceLineItems([createEmptyInvoiceLineItem()]);
      return;
    }

    if (selectedInvoiceItems?.length) {
      setInvoiceLineItems(
        selectedInvoiceItems.map((item) => ({
          id: item.id,
          service_item: item.service_item,
          quantity: String(item.quantity),
          unit_price: String(item.unit_price),
        })),
      );
      return;
    }

    if (selectedInvoice) {
      setInvoiceLineItems([
        {
          service_item: selectedInvoice.title || selectedInvoice.description || "Service item",
          quantity: "1",
          unit_price: String(selectedInvoice.subtotal ?? selectedInvoice.total_amount ?? 0),
        },
      ]);
    }
  }, [selectedInvoice, selectedInvoiceId, selectedInvoiceItems]);

  const resetCreateForm = () => {
    setClientsFormValue("");
    setInvoiceTitle("");
    setInvoiceDescription("");
    setInvoiceDueDate("");
    setInvoiceSubtotal("");
    setInvoiceDiscountAmount("0");
    setInvoiceVatAmount("15");
    setInvoiceNotesToClient("");
    setInvoiceTermsAndConditions(defaultInvoiceTerms);
    setInvoiceCaseId(null);
    setSelectedStatus("draft");
    setInvoiceLineItems([createEmptyInvoiceLineItem()]);
    setPendingAttachments([]);
    setSelectedAttachmentType("supporting_document");
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

  const resolveInvoiceBankProfile = (invoice: StaffInvoice | null) => {
    if (!invoice) {
      return null;
    }

    const selectedCase = (cases ?? []).find((caseItem: { id: string; assigned_consultant_id?: string | null }) => caseItem.id === invoice.case_id);
    const selectedClient = (clients ?? []).find((client: { id: string; assigned_consultant_id?: string | null }) => client.id === invoice.client_id);
    const practitionerId = selectedCase?.assigned_consultant_id || selectedClient?.assigned_consultant_id || null;

    if (!practitionerId) {
      return null;
    }

    return practitionerProfileMap.get(practitionerId) ?? null;
  };

  const formatBankDetails = (profile: PractitionerBankProfile | null | undefined) => {
    if (!profile) return "";
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

  const getLogoUrl = (filePath?: string | null) => {
    if (!filePath) {
      return null;
    }

    const { data } = supabase.storage.from("branding").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const resolveCurrentClient = () => {
    return (clients ?? []).find((client: { id: string }) => client.id === clientsFormValue) as
      | {
        id: string;
        profile_id?: string | null;
        company_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        client_code?: string | null;
        address_line_1?: string | null;
        address_line_2?: string | null;
        city?: string | null;
        province?: string | null;
        postal_code?: string | null;
        country?: string | null;
        profiles?: { full_name?: string | null; email?: string | null; phone?: string | null } | null;
      }
      | undefined;
  };

  const buildInvoiceSnapshot = (
    clientId: string,
    caseId: string | null,
  ): Partial<TablesInsert<"invoices">> => {
    const selectedClient = (clients ?? []).find((client: { id: string }) => client.id === clientId) as
      | {
        id: string;
        assigned_consultant_id?: string | null;
        company_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        client_code?: string | null;
        address_line_1?: string | null;
        address_line_2?: string | null;
        city?: string | null;
        province?: string | null;
        postal_code?: string | null;
        country?: string | null;
        profiles?: { full_name?: string | null; email?: string | null; phone?: string | null } | null;
      }
      | undefined;

    const selectedCase = caseId
      ? (cases ?? []).find((caseItem: { id: string; assigned_consultant_id?: string | null }) => caseItem.id === caseId)
      : null;
    const practitionerId =
      selectedCase?.assigned_consultant_id
      || selectedClient?.assigned_consultant_id
      || (role === "consultant" ? user?.id ?? null : null);
    const practitionerProfile = practitionerId ? practitionerProfileMap.get(practitionerId) ?? null : null;

    const invoiceDetails = {
      client_name:
        selectedClient?.company_name
        || selectedClient?.profiles?.full_name
        || [selectedClient?.first_name, selectedClient?.last_name].filter(Boolean).join(" ")
        || selectedClient?.client_code
        || "Client",
      client_email: selectedClient?.profiles?.email || null,
      client_phone: selectedClient?.profiles?.phone || null,
      client_address:
        getAddressLabel([
          selectedClient?.address_line_1,
          selectedClient?.address_line_2,
          selectedClient?.city,
          selectedClient?.province,
          selectedClient?.postal_code,
          selectedClient?.country,
        ]) || null,
      practitioner_name: practitionerProfile?.business_name || practitionerProfile?.profiles?.full_name || null,
      practice_name: practitionerProfile?.business_name || null,
      practitioner_number: practitionerProfile?.tax_practitioner_number || null,
      practitioner_email: practitionerProfile?.profiles?.email || null,
      practitioner_phone: practitionerProfile?.profiles?.phone || null,
      practitioner_address:
        getAddressLabel([
          practitionerProfile?.city,
          practitionerProfile?.province,
        ]) || null,
      practitioner_logo_path: practitionerProfile?.invoice_logo_path || null,
    };

    return invoiceDetails;
  };

  const addPendingAttachmentFiles = (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const nextItems = Array.from(files).map((file) => ({
      local_id: createInvoiceAttachmentLocalId(),
      file,
      attachment_type: selectedAttachmentType,
    }));

    setPendingAttachments((current) => [...current, ...nextItems]);
  };

  const removePendingAttachment = (localId: string) => {
    setPendingAttachments((current) => current.filter((item) => item.local_id !== localId));
  };

  const openStoredDocument = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 60 * 10);

    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Unable to open the attachment.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const saveInvoiceItems = async (invoiceId: string) => {
    const cleanedItems = invoiceLineItems
      .filter((item) => item.service_item.trim() || Number(item.unit_price || 0) > 0)
      .map((item) => ({
        invoice_id: invoiceId,
        service_item: item.service_item.trim() || "Service item",
        quantity: Math.max(1, Number(item.quantity || 1)),
        unit_price: Math.max(0, Number(item.unit_price || 0)),
      }));

    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

    if (!cleanedItems.length) {
      return;
    }

    const { error } = await supabase.from("invoice_items").insert(cleanedItems as any);
    if (error) {
      throw new Error(error.message);
    }
  };

  const savePendingInvoiceAttachments = async (
    invoiceId: string,
    clientId: string,
    clientProfileId?: string | null,
    caseId?: string | null,
  ) => {
    if (!pendingAttachments.length || !user) {
      return;
    }

    for (const attachment of pendingAttachments) {
      const safeName = sanitizeStorageFileName(attachment.file.name);
      const filePath = `${user.id}/${clientId}/invoices/${invoiceId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, attachment.file, { upsert: false });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: documentRow, error: documentError } = await supabase
        .from("documents")
        .insert({
          client_id: clientId,
          case_id: caseId || null,
          uploaded_by: user.id,
          sender_profile_id: user.id,
          recipient_profile_id: clientProfileId || null,
          visibility: caseId ? "case" : "shared",
          title: attachment.file.name,
          file_name: attachment.file.name,
          file_path: filePath,
          file_size: attachment.file.size,
          mime_type: attachment.file.type,
          category:
            invoiceAttachmentTypeOptions.find((option) => option.value === attachment.attachment_type)?.label
            || "Supporting Document",
          status: "uploaded",
        } as any)
        .select("id")
        .single();

      if (documentError || !documentRow) {
        throw new Error(documentError?.message || "Unable to save the uploaded invoice attachment.");
      }

      const { error: attachmentError } = await supabase.from("invoice_attachments").insert({
        invoice_id: invoiceId,
        document_id: documentRow.id,
        attachment_type: attachment.attachment_type,
      } as any);

      if (attachmentError) {
        throw new Error(attachmentError.message);
      }
    }
  };

  const updateInvoice = async () => {
    if (!selectedInvoice) return;
    if (!canManageInvoices) {
      toast.error("This consultant profile cannot update invoices.");
      return;
    }

    setSavingStatus(true);
    const cleanedLineItems = invoiceLineItems.filter(
      (item) => item.service_item.trim() || Number(item.unit_price || 0) > 0,
    );

    if (!cleanedLineItems.length) {
      toast.error("Add at least one invoice line item.");
      setSavingStatus(false);
      return;
    }

    const subtotalAmount = computedSubtotal;
    const discountAmount = Number(invoiceDiscountAmount || 0);
    // Calculate actual currency value of tax from the percentage rate
    const vatCurrencyAmount = calculateInvoiceVatAmount(invoiceLineItems, invoiceVatAmount, invoiceDiscountAmount);
    const totalAmount = computedFinalTotal;
    const nowIso = new Date().toISOString();
    const snapshot = buildInvoiceSnapshot(selectedInvoice.client_id, invoiceCaseId || null);
    const updates: TablesUpdate<"invoices"> = {
      status: selectedStatus,
      title: invoiceTitle.trim() || null,
      description: invoiceDescription.trim() || null,
      subtotal: subtotalAmount,
      discount_amount: Number.isNaN(discountAmount) ? 0 : discountAmount,
      tax_amount: vatCurrencyAmount,
      total_amount: totalAmount,
      due_date: invoiceDueDate || null,
      case_id: invoiceCaseId || null,
      notes_to_client: invoiceNotesToClient.trim() || null,
      terms_and_conditions: invoiceTermsAndConditions.trim() || null,
      ...snapshot,
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
    const { error } = await supabase.from("invoices").update(updates as any).eq("id", selectedInvoice.id);

    if (error) {
      toast.error(error.message);
      setSavingStatus(false);
      return;
    }

    try {
      await saveInvoiceItems(selectedInvoice.id);
      await savePendingInvoiceAttachments(
        selectedInvoice.id,
        selectedInvoice.client_id,
        selectedInvoice.clients?.profile_id,
        invoiceCaseId || selectedInvoice.case_id || null,
      );
    } catch (attachmentError) {
      toast.error(attachmentError instanceof Error ? attachmentError.message : "Unable to save invoice attachments.");
      setSavingStatus(false);
      return;
    }

    toast.success("Invoice updated");
    setSavingStatus(false);
    setPendingAttachments([]);
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
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-invoice-items", selectedInvoice.id] }),
      queryClient.invalidateQueries({ queryKey: ["staff-invoice-attachments", selectedInvoice.id] }),
    ]);
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
      const { error } = await supabase.from("invoices").update(statusUpdate as any).eq("id", selectedInvoice.id);
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
      toast.warning("Incomplete banking details. Please update the practitioner's banking profile soon.");
    } else if (selectedStatus !== "draft" && bankProfile.banking_verification_status !== "verified") {
      toast.warning("Practitioner banking details are not verified yet.");
    }

    const cleanedLineItems = invoiceLineItems.filter(
      (item) => item.service_item.trim() || Number(item.unit_price || 0) > 0,
    );
    const subtotalAmount = computedSubtotal;
    const discountAmount = Number(invoiceDiscountAmount || 0);
    // Calculate actual currency value of tax from the percentage rate
    const vatCurrencyAmount = calculateInvoiceVatAmount(invoiceLineItems, invoiceVatAmount, invoiceDiscountAmount);
    const totalAmount = computedFinalTotal;

    if (!cleanedLineItems.length) {
      toast.error("Add at least one invoice line item.");
      return;
    }

    if (Number.isNaN(subtotalAmount) || subtotalAmount < 0) {
      toast.error("Enter a valid invoice amount.");
      return;
    }

    setCreatingInvoice(true);

    // Auto-generate sequential invoice number like INV-2026-0001
    const currentYear = new Date().getFullYear();
    let generatedInvoiceNumber = `INV-${currentYear}-0001`;

    try {
      const { data: latestInvoiceData } = await supabase
        .from("invoices")
        .select("invoice_number")
        .like("invoice_number", `INV-${currentYear}-%`)
        .order("created_at", { ascending: false })
        .limit(1);

      const latestInv = latestInvoiceData?.[0] as { invoice_number?: string } | undefined;
      if (latestInv?.invoice_number) {
        const parts = String(latestInv.invoice_number).split("-");
        const suffix = parts[parts.length - 1];
        if (suffix && !Number.isNaN(Number(suffix))) {
          const nextNumber = String(Number(suffix) + 1).padStart(4, "0");
          generatedInvoiceNumber = `INV-${currentYear}-${nextNumber}`;
        }
      }
    } catch (err) {
      console.warn("Failed to generate sequential invoice number.", err);
    }

    const nowIso = new Date().toISOString();
    const snapshot = buildInvoiceSnapshot(clientsFormValue, invoiceCaseId || null);
    const payload: any = {
      client_id: clientsFormValue,
      case_id: invoiceCaseId || null,
      invoice_number: generatedInvoiceNumber,
      title: invoiceTitle.trim() || null,
      description: invoiceDescription.trim() || null,
      subtotal: subtotalAmount,
      discount_amount: Number.isNaN(discountAmount) ? 0 : discountAmount,
      tax_amount: vatCurrencyAmount,
      total_amount: totalAmount,
      amount_paid: 0,
      due_date: invoiceDueDate || null,
      status: selectedStatus,
      created_by: user?.id ?? null,
      practitioner_bank_details: formatBankDetails(bankProfile),
      notes_to_client: invoiceNotesToClient.trim() || null,
      terms_and_conditions: invoiceTermsAndConditions.trim() || null,
      ...snapshot,
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

    const { data: rawData, error } = await supabase.from("invoices").insert(payload as any).select("id, invoice_number, due_date, status").single();
    const data = rawData as any;

    if (error) {
      toast.error(error.message);
      setCreatingInvoice(false);
      return;
    }

    const selectedClient = resolveCurrentClient();

    try {
      await saveInvoiceItems(data.id);
      await savePendingInvoiceAttachments(
        data.id,
        clientsFormValue,
        selectedClient?.profile_id || null,
        invoiceCaseId || null,
      );
    } catch (attachmentError) {
      toast.error(attachmentError instanceof Error ? attachmentError.message : "Invoice created, but attachments could not be saved.");
    }

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
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-invoice-items", data.id] }),
      queryClient.invalidateQueries({ queryKey: ["staff-invoice-attachments", data.id] }),
    ]);
  };

  const overdueCount = (invoices ?? []).filter((invoice) => invoice.status === "overdue").length;
  const unpaidCount = (invoices ?? []).filter((invoice) => !["paid", "cancelled"].includes(invoice.status)).length;
  const disclaimerText = "Payment is made directly to the practitioner. Acapolite Consulting is not responsible for payment processing or payment disputes.";
  const selectedInvoiceBankProfile = resolveInvoiceBankProfile(selectedInvoice);
  const selectedInvoiceLogoUrl = getLogoUrl(
    selectedInvoice?.practitioner_logo_path || selectedInvoiceBankProfile?.invoice_logo_path,
  );
  const selectedInvoiceClientAddress =
    selectedInvoice?.client_address
    || getAddressLabel([
      selectedInvoice?.clients?.address_line_1,
      selectedInvoice?.clients?.address_line_2,
      selectedInvoice?.clients?.city,
      selectedInvoice?.clients?.province,
      selectedInvoice?.clients?.postal_code,
      selectedInvoice?.clients?.country,
    ]);
  const currentCreateClient = resolveCurrentClient();

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
            <div
              key={invoice.id}
              onClick={() => setSelectedInvoiceId(invoice.id)}
              className="w-full text-left bg-card rounded-xl border border-border shadow-card p-5 hover:shadow-elevated hover:border-primary/30 transition-all cursor-pointer"
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
                      Mark as Sent
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
                      Email Client
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
            </div>
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
          <div className="space-y-6 pb-4">
            {/* Header Branding & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[20px] bg-accent/20 p-4 border border-border/60 shadow-sm">
              <div className="flex items-center gap-5">
                <div className="flex -space-x-4 items-center">
                  <img
                    src="/acapolite-logo.png"
                    alt="Acapolite"
                    className="h-14 w-14 rounded-2xl border border-border bg-white object-contain p-2 shadow-sm z-10"
                  />
                  {selectedInvoiceLogoUrl ? (
                    <img
                      src={selectedInvoiceLogoUrl}
                      alt="Practitioner logo"
                      className="h-12 w-12 rounded-xl border border-border bg-white object-contain p-2 shadow-sm relative left-2"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-body font-bold">
                    Invoice Number
                  </p>
                  <p className="font-display text-3xl font-bold text-foreground mt-1">
                    {selectedInvoice.invoice_number}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-2">
                <div className={`text-xs font-bold px-4 py-1.5 rounded-full font-body border shadow-sm ${getStatusColor(selectedInvoice.status)}`}>
                  {selectedInvoice.status.replace(/_/g, " ")}
                </div>
                <p className="text-xs text-muted-foreground font-body">
                  Issued: {new Date(selectedInvoice.issue_date).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                {/* Parties Details */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body font-bold">Client Details</p>
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-2">
                      <p className="font-bold text-foreground font-body text-base truncate">{selectedInvoice.client_name || getClientName(selectedInvoice)}</p>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground font-body flex items-center gap-2 break-all">
                          <span className="opacity-60 text-[10px] shrink-0">EMAIL</span> {selectedInvoice.client_email || selectedInvoice.clients?.profiles?.email || "No email"}
                        </p>
                        <p className="text-sm text-muted-foreground font-body flex items-center gap-2 break-all">
                          <span className="opacity-60 text-[10px] shrink-0">PHONE</span> {selectedInvoice.client_phone || selectedInvoice.clients?.profiles?.phone || "No phone"}
                        </p>
                      </div>
                      <p className="mt-3 pt-3 border-t border-border/50 text-sm text-muted-foreground font-body leading-relaxed break-words">
                        {selectedInvoiceClientAddress || "No address provided"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body font-bold">Practitioner Details</p>
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-2">
                      <p className="font-bold text-foreground font-body text-base truncate">{selectedInvoice.practitioner_name || selectedInvoiceBankProfile?.profiles?.full_name || "Practitioner"}</p>
                      <p className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block truncate max-w-full">
                        {selectedInvoice.practice_name || selectedInvoiceBankProfile?.business_name || "Independent practice"}
                      </p>
                      <div className="space-y-1 pt-2">
                        <p className="text-sm text-muted-foreground font-body flex items-center gap-2 break-all">
                          <span className="opacity-60 text-[10px] shrink-0">PRAC NO</span> {selectedInvoice.practitioner_number || selectedInvoiceBankProfile?.tax_practitioner_number || "Not added"}
                        </p>
                        <p className="text-sm text-muted-foreground font-body flex items-center gap-2 break-all">
                          <span className="opacity-60 text-[10px] shrink-0">EMAIL</span> {selectedInvoice.practitioner_email || selectedInvoiceBankProfile?.profiles?.email || "Not added"}
                        </p>
                      </div>
                      <p className="mt-3 pt-3 border-t border-border/50 text-sm text-muted-foreground font-body break-words">
                        {selectedInvoice.practitioner_address || getAddressLabel([selectedInvoiceBankProfile?.city, selectedInvoiceBankProfile?.province]) || "No address added"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Case & Date Meta */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body font-bold block ml-1">Case Reference</label>
                    {canManageInvoices ? (
                      <Select value={invoiceCaseId ?? "general"} onValueChange={(value) => setInvoiceCaseId(value === "general" ? null : value)}>
                        <SelectTrigger className="w-full rounded-xl border-border/80 bg-card shadow-sm h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="general">General Support</SelectItem>
                          {selectedInvoiceCaseOptions.map((caseOption) => (
                            <SelectItem key={caseOption.id} value={caseOption.id}>
                              {caseOption.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm">
                        <p className="font-body text-foreground text-sm font-semibold">{selectedInvoice.case_id ? formatCaseReference(selectedInvoice.case_id) : "General Support"}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body font-bold block ml-1">Due Date</label>
                    {canManageInvoices ? (
                      <Input
                        type="date"
                        value={invoiceDueDate}
                        onChange={(event) => setInvoiceDueDate(event.target.value)}
                        className="rounded-xl border-border/80 bg-card shadow-sm h-11"
                      />
                    ) : (
                      <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm">
                        <p className="font-body text-foreground text-sm font-semibold">{invoiceDueDate ? new Date(invoiceDueDate).toLocaleDateString() : "Not set"}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description & Title */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body font-bold block ml-1">Invoice Title</label>
                    {canManageInvoices ? (
                      <Input
                        value={invoiceTitle}
                        onChange={(event) => setInvoiceTitle(event.target.value)}
                        placeholder="Service invoice"
                        className="rounded-xl border-border/80 bg-card shadow-sm h-11 font-semibold"
                      />
                    ) : (
                      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                        <p className="font-body text-foreground font-semibold">{invoiceTitle || "Service invoice"}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body font-bold block ml-1">Work Summary / Description</label>
                    {canManageInvoices ? (
                      <Textarea
                        value={invoiceDescription}
                        onChange={(event) => setInvoiceDescription(event.target.value)}
                        placeholder="Optional billing description."
                        className="rounded-xl border-border/80 bg-card shadow-sm min-h-[100px] leading-relaxed"
                      />
                    ) : (
                      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm min-h-[80px]">
                        <p className="font-body text-sm text-muted-foreground leading-relaxed italic">{invoiceDescription || "No description added."}</p>
                      </div>
                    )}
                  </div>

                  {/* Notes to Client */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body font-bold block ml-1">Notes to Client</label>
                    {canManageInvoices ? (
                      <Textarea
                        value={invoiceNotesToClient}
                        onChange={(event) => setInvoiceNotesToClient(event.target.value)}
                        placeholder="E.g. Please use invoice number as reference when paying."
                        className="rounded-xl border-border/80 bg-card shadow-sm min-h-[90px] leading-relaxed"
                      />
                    ) : (
                      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm min-h-[60px]">
                        <p className="font-body text-sm text-muted-foreground leading-relaxed italic">{invoiceNotesToClient || "No notes added."}</p>
                      </div>
                    )}
                  </div>

                  {/* Terms & Conditions */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body font-bold block ml-1">Terms &amp; Conditions</label>
                    {canManageInvoices ? (
                      <Textarea
                        value={invoiceTermsAndConditions}
                        onChange={(event) => setInvoiceTermsAndConditions(event.target.value)}
                        placeholder="Payment terms, late payment penalties, etc."
                        className="rounded-xl border-border/80 bg-card shadow-sm min-h-[90px] leading-relaxed"
                      />
                    ) : (
                      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm min-h-[60px]">
                        <p className="font-body text-sm text-muted-foreground leading-relaxed italic">{invoiceTermsAndConditions || "No terms added."}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Line Items Editor */}
                <div className="pt-2">
                  <InvoiceLineItemsEditor
                    items={invoiceLineItems || []}
                    readOnly={!canManageInvoices}
                    onChange={canManageInvoices ? setInvoiceLineItems : undefined}
                  />
                </div>
              </div>

              <div className="space-y-6">
                {/* Financial Summary Card */}
                <div className="rounded-[32px] border border-border bg-card p-7 shadow-elevated relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-indigo-500 to-primary/80" />
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-body font-bold mb-6">Financial Summary</p>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-body">Subtotal</span>
                      <span className="font-semibold text-foreground font-display">{formatCurrency(computedSubtotal)}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-body">Discount</span>
                      {canManageInvoices ? (
                        <div className="w-32 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={invoiceDiscountAmount}
                            onChange={(event) => setInvoiceDiscountAmount(event.target.value)}
                            className="rounded-lg h-8 pl-7 text-right pr-3 font-semibold"
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-red-600 font-display">-{formatCurrency(Number(invoiceDiscountAmount || 0))}</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-sm pb-4 border-b border-border/50">
                      <span className="text-muted-foreground font-body">VAT (Tax)</span>
                      {canManageInvoices ? (
                        <div className="w-32 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={invoiceVatAmount}
                            onChange={(event) => setInvoiceVatAmount(event.target.value)}
                            className="rounded-lg h-8 pl-7 text-right pr-3 font-semibold"
                            placeholder="15"
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-foreground font-display">{invoiceVatAmount || 15}%</span>
                      )}
                    </div>

                    <div className="pt-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-bold text-foreground font-body">Final Total</span>
                        <span className="text-2xl font-bold text-primary font-display">{formatCurrency(computedFinalTotal)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Paid</p>
                          <p className="text-sm font-bold text-emerald-600 font-display">{formatCurrency(Number(selectedInvoice.amount_paid || 0))}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Balance</p>
                          <p className="text-sm font-bold text-foreground font-display">{formatCurrency(Number(selectedInvoice.balance_due || 0))}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tracking & Info */}
                <div className="space-y-6">
                  <div className="rounded-2xl border border-border/80 bg-accent/10 p-5 space-y-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body font-bold">Lifecycle Tracking</p>
                    <div className="space-y-3">
                      {[
                        { label: "Issue Date", val: selectedInvoice.issue_date, active: true },
                        { label: "Sent At", val: selectedInvoice.sent_at, active: !!selectedInvoice.sent_at },
                        { label: "Viewed At", val: selectedInvoice.viewed_at, active: !!selectedInvoice.viewed_at },
                        { label: "Paid At", val: selectedInvoice.paid_at, active: !!selectedInvoice.paid_at },
                        { label: "Overdue At", val: selectedInvoice.overdue_at, active: !!selectedInvoice.overdue_at },
                        { label: "Cancelled At", val: selectedInvoice.cancelled_at, active: !!selectedInvoice.cancelled_at },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-xs font-body">
                          <span className={item.active ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                          <span className={`font-semibold ${item.active ? "text-foreground" : "text-muted-foreground/50"}`}>
                            {item.val ? new Date(item.val).toLocaleDateString() : "Pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body font-bold block ml-1">Banking Details</label>
                    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-3">
                      {selectedInvoiceBankProfile ? (
                        <div className="flex items-center justify-between">
                          <Badge className={`rounded-full border px-3 py-0.5 text-[10px] font-bold ${getBankingVerificationBadgeClass(selectedInvoiceBankProfile.banking_verification_status)}`}>
                            {getBankingVerificationLabel(selectedInvoiceBankProfile.banking_verification_status)}
                          </Badge>
                        </div>
                      ) : null}
                      {selectedInvoiceBankProfile?.bank_name || selectedInvoiceBankProfile?.bank_account_number ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
                          {[
                            { label: "Bank", val: selectedInvoiceBankProfile?.bank_name },
                            { label: "Account Name", val: selectedInvoiceBankProfile?.bank_account_holder_name || selectedInvoiceBankProfile?.profiles?.full_name },
                            { label: "Account No.", val: selectedInvoiceBankProfile?.bank_account_number },
                            { label: "Branch Code", val: selectedInvoiceBankProfile?.bank_branch_code },
                            { label: "Reference", val: selectedInvoice.invoice_number },
                          ].map(({ label, val }) =>
                            val ? (
                              <div key={label} className="col-span-2 flex items-center justify-between text-xs font-body border-b border-border/40 pb-1 last:border-0">
                                <span className="text-muted-foreground opacity-70 uppercase tracking-wide text-[10px]">{label}</span>
                                <span className="font-semibold text-foreground">{val}</span>
                              </div>
                            ) : null
                          )}
                        </div>
                      ) : (
                        <p className="font-body text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {selectedInvoice.practitioner_bank_details || "No banking details captured."}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Attachments Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body font-bold block ml-1">Attachments</label>
                      <Badge className="rounded-full bg-primary/10 text-primary border-none h-5 px-2 text-[10px] font-bold">
                        {(selectedInvoiceAttachments?.length || 0) + pendingAttachments.length}
                      </Badge>
                    </div>

                    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
                      {canManageInvoices ? (
                        <div className="space-y-3">
                          <Select
                            value={selectedAttachmentType}
                            onValueChange={(value) => setSelectedAttachmentType(value as InvoiceAttachmentType)}
                          >
                            <SelectTrigger className="w-full rounded-xl h-9 text-xs border-border/60">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {invoiceAttachmentTypeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                              <Paperclip className="h-3 w-3" />
                              <span>Attach Files</span>
                            </div>
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(event) => {
                                addPendingAttachmentFiles(event.target.files);
                                event.currentTarget.value = "";
                              }}
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                            />
                          </label>
                        </div>
                      ) : null}

                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                        {(selectedInvoiceAttachments ?? []).map((attachment) => (
                          <button
                            key={attachment.id}
                            type="button"
                            onClick={() => void openStoredDocument(attachment.document.file_path)}
                            className="flex w-full items-center justify-between rounded-xl border border-border/60 px-3 py-2.5 text-left transition hover:border-primary/30 hover:bg-primary/5 group"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-foreground font-body truncate group-hover:text-primary transition-colors">{attachment.document.title}</p>
                              <p className="text-[10px] text-muted-foreground font-body">
                                {attachment.attachment_type.replace(/_/g, " ")}
                              </p>
                            </div>
                            <Download className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                          </button>
                        ))}
                        {pendingAttachments.map((attachment) => (
                          <div key={attachment.local_id} className="flex items-center justify-between rounded-xl border border-dashed border-border/60 px-3 py-2 text-xs bg-amber-50/30 border-amber-200">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-foreground truncate">{attachment.file.name}</p>
                              <p className="text-[9px] text-amber-600 font-bold uppercase tracking-tighter">Pending Upload</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-lg text-red-500 hover:bg-red-50" onClick={() => removePendingAttachment(attachment.local_id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {!selectedInvoiceAttachments?.length && !pendingAttachments.length ? (
                          <p className="text-[11px] text-muted-foreground text-center py-4 font-body italic opacity-60">No attachments found.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky/Bottom Action Bar */}
            <div className="pt-8 border-t border-border mt-8 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="max-w-md">
                <p className="text-[11px] text-muted-foreground leading-relaxed font-body italic">
                  {disclaimerText}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                {canManageInvoices ? (
                  <>
                    <div className="w-full sm:w-44">
                      <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as Enums<"invoice_status">)}>
                        <SelectTrigger className="rounded-xl h-11 border-border/80 shadow-sm">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {invoiceStatuses.map((status) => (
                            <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" className="rounded-xl px-8 h-11 font-bold shadow-lg shadow-primary/20" onClick={updateInvoice} disabled={savingStatus}>
                      {savingStatus ? "Saving..." : "Save Invoice"}
                    </Button>
                    <Button type="button" variant="outline" className="rounded-xl px-5 h-11 font-semibold border-border/80 shadow-sm" onClick={resendInvoice} disabled={resendingInvoice}>
                      <Mail className="mr-2 h-4 w-4" />
                      {resendingInvoice ? "Sending..." : "Email Client"}
                    </Button>
                  </>
                ) : (
                  <div className="rounded-xl border border-border bg-accent/5 px-4 py-2">
                    <p className="text-xs text-muted-foreground font-body">ReadOnly Mode</p>
                  </div>
                )}

                {/* PDF Action Buttons */}
                {(() => {
                  const pdfPayload = {
                    invoiceNumber: selectedInvoice.invoice_number,
                    issueDate: selectedInvoice.issue_date,
                    dueDate: invoiceDueDate || selectedInvoice.due_date,
                    status: selectedStatus || selectedInvoice.status,
                    caseReference: selectedInvoice.case_id ? formatCaseReference(selectedInvoice.case_id) : "General Support",
                    logoUrl: selectedInvoiceLogoUrl,
                    practitioner: {
                      name: selectedInvoice.practitioner_name || selectedInvoiceBankProfile?.profiles?.full_name || "Practitioner",
                      subtitle: selectedInvoice.practice_name || selectedInvoiceBankProfile?.business_name || null,
                      email: selectedInvoice.practitioner_email || selectedInvoiceBankProfile?.profiles?.email || null,
                      phone: selectedInvoice.practitioner_phone || selectedInvoiceBankProfile?.profiles?.phone || null,
                      address: selectedInvoice.practitioner_address || getAddressLabel([selectedInvoiceBankProfile?.city, selectedInvoiceBankProfile?.province]) || null,
                      registrationNumber: selectedInvoice.practitioner_number || selectedInvoiceBankProfile?.tax_practitioner_number || null,
                      vatNumber: selectedInvoiceBankProfile?.vat_number || null,
                    },
                    client: {
                      name: selectedInvoice.client_name || getClientName(selectedInvoice),
                      email: selectedInvoice.client_email || selectedInvoice.clients?.profiles?.email || null,
                      phone: selectedInvoice.client_phone || selectedInvoice.clients?.profiles?.phone || null,
                      address: selectedInvoiceClientAddress || null,
                      vatNumber: (selectedInvoice.clients as any)?.tax_number || null,
                    },
                    serviceDescription: invoiceTitle || selectedInvoice.title || selectedInvoice.description || "Service invoice",
                    lineItems: (invoiceLineItems || []).map((item) => ({
                      serviceItem: item.service_item || "Service item",
                      quantity: Number(item.quantity || 1),
                      unitPrice: Number(item.unit_price || 0),
                      total: Number(item.quantity || 1) * Number(item.unit_price || 0),
                    })),
                    subtotal: computedSubtotal,
                    discountAmount: Number(invoiceDiscountAmount || 0),
                    vatAmount: calculateInvoiceVatAmount(invoiceLineItems || [], invoiceVatAmount, invoiceDiscountAmount),
                    vatRate: Number(invoiceVatAmount || 0),
                    total: computedFinalTotal,
                    amountPaid: Number(selectedInvoice.amount_paid || 0),
                    balanceDue: Number(selectedInvoice.balance_due || 0),
                    notesToClient: invoiceNotesToClient,
                    termsAndConditions: invoiceTermsAndConditions,
                    bankDetails: selectedInvoice.practitioner_bank_details,
                    bankName: selectedInvoiceBankProfile?.bank_name,
                    accountName: selectedInvoiceBankProfile?.bank_account_holder_name || selectedInvoiceBankProfile?.profiles?.full_name,
                    accountNumber: selectedInvoiceBankProfile?.bank_account_number,
                    branchCode: selectedInvoiceBankProfile?.bank_branch_code,
                    paymentReference: selectedInvoice.invoice_number,
                    attachments: (selectedInvoiceAttachments ?? []).map((attachment) => ({
                      title: attachment.document.title,
                      type: attachment.attachment_type.replace(/_/g, " "),
                    })),
                  };
                  return (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl px-4 h-11 font-semibold border-border/80 bg-accent/5 hover:bg-accent/10 transition-colors shadow-sm"
                        onClick={() => openInvoicePdf(pdfPayload, { autoPrint: false })}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        PDF Preview
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl px-4 h-11 font-semibold border-border/80 bg-accent/5 hover:bg-accent/10 transition-colors shadow-sm"
                        onClick={() => openInvoicePdf(pdfPayload, { autoPrint: true })}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </>
                  );
                })()}
              </div>
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

          <InvoiceLineItemsEditor items={invoiceLineItems} onChange={setInvoiceLineItems} />

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Subtotal</p>
              <p className="font-display text-2xl text-foreground">{formatCurrency(computedSubtotal)}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Discount</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={invoiceDiscountAmount}
                onChange={(event) => setInvoiceDiscountAmount(event.target.value)}
                placeholder="0.00"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">VAT (%)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={invoiceVatAmount}
                  onChange={(event) => setInvoiceVatAmount(event.target.value)}
                  placeholder="15"
                  className="rounded-xl pl-8"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-accent/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Final Total</p>
            <p className="mt-2 font-display text-3xl text-foreground">{formatCurrency(computedFinalTotal)}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Notes to Client</label>
            <Textarea
              value={invoiceNotesToClient}
              onChange={(event) => setInvoiceNotesToClient(event.target.value)}
              placeholder="Optional notes to include on the invoice."
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Terms & Conditions</label>
            <Textarea
              value={invoiceTermsAndConditions}
              onChange={(event) => setInvoiceTermsAndConditions(event.target.value)}
              className="rounded-xl min-h-[110px]"
            />
          </div>

          <div className="rounded-2xl border border-border p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground font-body">Invoice Attachments</p>
                <p className="text-xs text-muted-foreground font-body">Attach tax calculations, supporting documents, or work summary files.</p>
              </div>
              <Badge className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {pendingAttachments.length}
              </Badge>
            </div>
            <Select
              value={selectedAttachmentType}
              onValueChange={(value) => setSelectedAttachmentType(value as InvoiceAttachmentType)}
            >
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {invoiceAttachmentTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="file"
              multiple
              className="block w-full rounded-xl border border-input/90 bg-white/92 px-3.5 py-2.5 text-sm text-foreground shadow-[0_6px_24px_-22px_rgba(15,23,42,0.28)]"
              onChange={(event) => {
                addPendingAttachmentFiles(event.target.files);
                event.currentTarget.value = "";
              }}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            />
            <div className="space-y-2">
              {pendingAttachments.length ? pendingAttachments.map((attachment) => (
                <div key={attachment.local_id} className="flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground font-body">{attachment.file.name}</p>
                    <p className="text-xs text-muted-foreground font-body">{attachment.attachment_type.replace(/_/g, " ")}</p>
                  </div>
                  <Button type="button" variant="ghost" className="rounded-xl" onClick={() => removePendingAttachment(attachment.local_id)}>
                    Remove
                  </Button>
                </div>
              )) : (
                <div className="rounded-xl border border-border bg-accent/10 px-4 py-3 text-sm text-muted-foreground font-body">
                  No invoice attachments selected yet.
                </div>
              )}
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

          {currentCreateClient ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Client Snapshot</p>
                <p className="mt-2 text-sm font-semibold text-foreground font-body">
                  {currentCreateClient.company_name
                    || currentCreateClient.profiles?.full_name
                    || [currentCreateClient.first_name, currentCreateClient.last_name].filter(Boolean).join(" ")
                    || "Client"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground font-body">{currentCreateClient.profiles?.email || "No email"}</p>
                <p className="text-sm text-muted-foreground font-body">{currentCreateClient.profiles?.phone || "No phone"}</p>
                <p className="mt-2 text-sm text-muted-foreground font-body">
                  {getAddressLabel([
                    currentCreateClient.address_line_1,
                    currentCreateClient.address_line_2,
                    currentCreateClient.city,
                    currentCreateClient.province,
                    currentCreateClient.postal_code,
                    currentCreateClient.country,
                  ]) || "No client address"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Invoice Preview Summary</p>
                <p className="mt-2 text-sm text-muted-foreground font-body">Subtotal: {formatCurrency(computedSubtotal)}</p>
                <p className="text-sm text-muted-foreground font-body">Discount: {formatCurrency(Number(invoiceDiscountAmount || 0))}</p>
                <p className="text-sm text-muted-foreground font-body">VAT ({invoiceVatAmount}%): {formatCurrency(calculateInvoiceVatAmount(invoiceLineItems, invoiceVatAmount, invoiceDiscountAmount))}</p>
                <p className="mt-2 text-sm font-semibold text-foreground font-body">Final Total: {formatCurrency(computedFinalTotal)}</p>
              </div>
            </div>
          ) : null}

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
