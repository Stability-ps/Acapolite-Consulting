import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { useAuth } from "@/hooks/useAuth";
import { useAccessibleClientIds } from "@/hooks/useAccessibleClientIds";
import type { Enums, TablesInsert } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getClientIdentityFieldLabel, getClientIdentityLabel, getClientTypeLabel, getClientWarningSummary } from "@/lib/clientRisk";
import { sendPractitionerAssignmentNotification } from "@/lib/practitionerAssignments";
import { sendClientMessageNotification } from "@/lib/clientMessageNotifications";
import { sendInvoiceCreatedNotification } from "@/lib/invoiceNotifications";
import { sendCaseStatusChangedNotification } from "@/lib/caseStatusNotifications";
import { sendDocumentRequestNotification } from "@/lib/documentRequestNotifications";
import { sendCaseCreatedNotification } from "@/lib/caseCreatedNotifications";
import {
  AlertTriangle,
  User,
  FolderOpen,
  Upload,
  Receipt,
  MessageSquare,
  ExternalLink,
} from "lucide-react";

const caseStatusOptions: Enums<"case_status">[] = [
  "new",
  "under_review",
  "in_progress",
  "awaiting_client_documents",
  "awaiting_sars_response",
  "resolved",
  "closed",
];

const caseTypeOptions: Enums<"case_type">[] = [
  "individual_tax_return",
  "corporate_tax_return",
  "vat_registration",
  "provisional_tax",
  "tax_clearance_certificate",
  "sars_dispute_objection",
  "other",
];

const invoiceStatusOptions: Enums<"invoice_status">[] = [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
];

const alertStatusOptions: Enums<"alert_status">[] = [
  "active",
  "acknowledged",
  "resolved",
  "dismissed",
];

const alertTypeOptions: Enums<"alert_type">[] = [
  "sars_due_date",
  "missing_document",
  "payment_deadline",
  "general_deadline",
  "provisional_tax_date",
  "follow_up_required",
  "other",
];

const UNASSIGNED_CONSULTANT = "unassigned";

type ClientOption = {
  id: string;
  client_code: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type ClientDetails = {
  id: string;
  profile_id: string;
  client_type: string;
  company_registration_number: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  tax_number: string | null;
  sars_reference_number: string | null;
  id_number: string | null;
  sars_outstanding_debt: number;
  returns_filed: boolean;
  client_code: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  assigned_consultant?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type ClientCase = {
  id: string;
  case_title: string;
  case_type: string;
  status: string;
  due_date: string | null;
  last_activity_at: string;
  priority: number;
  description: string | null;
  assigned_consultant_id: string | null;
  assigned_consultant?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type ClientDocument = {
  id: string;
  title: string;
  category: string | null;
  status: string;
  uploaded_at: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
};

type ClientInvoice = {
  id: string;
  invoice_number: string;
  title: string | null;
  status: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  due_date: string | null;
};

type ClientAlert = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  alert_type: string;
  alert_at: string;
};

type ClientDocumentRequest = {
  id: string;
  title?: string | null;
  description?: string | null;
  required_document_type?: string | null;
  due_date?: string | null;
  is_required: boolean;
  is_fulfilled: boolean;
};

type ClientConversation = {
  id: string;
  subject: string | null;
  case_id: string | null;
  last_message_at: string;
  is_closed: boolean;
};

type ClientMessage = {
  id: string;
  sender_type: string;
  message_text: string;
  created_at: string;
};

type ConsultantOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

function getClientName(client?: Partial<ClientOption> | null) {
  return (
    client?.company_name ||
    client?.profiles?.full_name ||
    [client?.first_name, client?.last_name].filter(Boolean).join(" ") ||
    client?.client_code ||
    "Client"
  );
}

function getAddress(client?: ClientDetails | null) {
  return [
    client?.address_line_1,
    client?.address_line_2,
    client?.city,
    client?.province,
    client?.postal_code,
    client?.country,
  ].filter(Boolean).join(", ");
}

function formatLabel(value?: string | null) {
  return (value || "").replace(/_/g, " ");
}

function formatCurrency(value: number) {
  return `R ${Number(value).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadgeClass(status?: string) {
  switch (status) {
    case "approved":
    case "paid":
    case "resolved":
    case "closed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
    case "overdue":
      return "border-red-200 bg-red-50 text-red-700";
    case "pending_review":
    case "under_review":
    case "awaiting_client_documents":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700";
  }
}

function getSenderLabel(senderType: string) {
  return senderType === "client" ? "Client" : "Acapolite Team";
}

export default function AdminClientWorkspace() {
  const queryClient = useQueryClient();
  const { user, role, profile, hasStaffPermission, isConsultant } = useAuth();
  const { accessibleClientIds, hasRestrictedClientScope, isLoadingAccessibleClientIds } = useAccessibleClientIds();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [isCreateAlertOpen, setIsCreateAlertOpen] = useState(false);
  const [isCreateDocumentRequestOpen, setIsCreateDocumentRequestOpen] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [creatingAlert, setCreatingAlert] = useState(false);
  const [creatingDocumentRequest, setCreatingDocumentRequest] = useState(false);
  const [clientForm, setClientForm] = useState({
    full_name: "",
    phone: "",
    client_type: "individual",
    company_registration_number: "",
    first_name: "",
    last_name: "",
    company_name: "",
    tax_number: "",
    sars_reference_number: "",
    id_number: "",
    sars_outstanding_debt: "0",
    returns_filed: false,
    client_code: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    province: "",
    postal_code: "",
    country: "South Africa",
    notes: "",
  });
  const [caseForm, setCaseForm] = useState({
    case_title: "",
    case_type: "individual_tax_return" as Enums<"case_type">,
    description: "",
    due_date: "",
    priority: "2",
    assigned_consultant_id: UNASSIGNED_CONSULTANT,
    notify_client: true,
  });
  const [invoiceForm, setInvoiceForm] = useState({
    title: "",
    description: "",
    total_amount: "",
    due_date: "",
    status: "draft" as Enums<"invoice_status">,
  });
  const [alertForm, setAlertForm] = useState({
    title: "",
    description: "",
    alert_type: "general_deadline" as Enums<"alert_type">,
    alert_at: "",
    status: "active" as Enums<"alert_status">,
  });
  const [documentRequestForm, setDocumentRequestForm] = useState({
    case_id: "",
    title: "",
    description: "",
    required_document_type: "",
    due_date: "",
  });
  const selectedClientId = searchParams.get("clientId") ?? "";
  const accessibleClientIdsKey = accessibleClientIds?.join(",") ?? "all";
  const canManageClients = hasStaffPermission("can_manage_clients");
  const canManageCases = hasStaffPermission("can_manage_cases");
  const canManageInvoices = hasStaffPermission("can_manage_invoices");
  const canReplyMessages = hasStaffPermission("can_reply_messages");
  const canAssignConsultants = canManageCases && !isConsultant;

  const { data: clients } = useQuery({
    queryKey: ["staff-client-workspace-options", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase
        .from("clients")
        .select("id, client_code, company_name, first_name, last_name, profiles!clients_profile_id_fkey(full_name, email)")
        .order("created_at", { ascending: false });
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("id", accessibleClientIds);
      }
      const { data } = await query;
      return (data ?? []) as ClientOption[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: consultants } = useQuery({
    queryKey: ["staff-client-workspace-consultants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "consultant")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as ConsultantOption[];
    },
    enabled: canAssignConsultants,
  });

  useEffect(() => {
    if (!selectedClientId && clients?.length) {
      setSearchParams({ clientId: clients[0].id }, { replace: true });
    }
  }, [clients, selectedClientId, setSearchParams]);

  useEffect(() => {
    if (!selectedClientId || !clients?.length) return;
    if (!clients.some((client) => client.id === selectedClientId)) {
      setSearchParams({ clientId: clients[0].id }, { replace: true });
    }
  }, [clients, selectedClientId, setSearchParams]);

  const { data: clientDetails, isLoading } = useQuery({
    queryKey: ["staff-client-workspace-details", selectedClientId, accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.includes(selectedClientId)) {
        return null;
      }
      const { data } = await supabase
        .from("clients")
        .select(`
          *,
          profiles!clients_profile_id_fkey(full_name, email, phone),
          assigned_consultant:profiles!clients_assigned_consultant_id_fkey(full_name, email)
        `)
        .eq("id", selectedClientId)
        .maybeSingle();
      return (data ?? null) as ClientDetails | null;
    },
    enabled: !!selectedClientId && (!hasRestrictedClientScope || !isLoadingAccessibleClientIds),
  });

  const { data: clientCases } = useQuery({
    queryKey: ["staff-client-workspace-cases", selectedClientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select("id, case_title, case_type, status, due_date, last_activity_at, priority, description, assigned_consultant_id, assigned_consultant:profiles!cases_assigned_consultant_id_fkey(full_name, email)")
        .eq("client_id", selectedClientId)
        .order("last_activity_at", { ascending: false });
      return (data ?? []) as ClientCase[];
    },
    enabled: !!selectedClientId,
  });

  const { data: clientDocuments } = useQuery({
    queryKey: ["staff-client-workspace-documents", selectedClientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, title, category, status, uploaded_at, file_name, file_path, file_size")
        .eq("client_id", selectedClientId)
        .order("uploaded_at", { ascending: false });
      return (data ?? []) as ClientDocument[];
    },
    enabled: !!selectedClientId,
  });

  const { data: clientInvoices } = useQuery({
    queryKey: ["staff-client-workspace-invoices", selectedClientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, title, status, total_amount, amount_paid, balance_due, due_date")
        .eq("client_id", selectedClientId)
        .order("created_at", { ascending: false });
      return (data ?? []) as ClientInvoice[];
    },
    enabled: !!selectedClientId,
  });

  const { data: clientDocumentRequests } = useQuery({
    queryKey: ["staff-client-workspace-document-requests", selectedClientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_requests")
        .select("id, title, description, required_document_type, due_date, is_required, is_fulfilled")
        .eq("client_id", selectedClientId);
      return (data ?? []) as ClientDocumentRequest[];
    },
    enabled: !!selectedClientId,
  });

  const { data: clientAlerts } = useQuery({
    queryKey: ["staff-client-workspace-alerts", selectedClientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("id, title, description, status, alert_type, alert_at")
        .eq("client_id", selectedClientId)
        .order("alert_at", { ascending: true });
      return (data ?? []) as ClientAlert[];
    },
    enabled: !!selectedClientId,
  });

  const { data: clientConversations } = useQuery({
    queryKey: ["staff-client-workspace-conversations", selectedClientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, subject, case_id, last_message_at, is_closed")
        .eq("client_id", selectedClientId)
        .order("last_message_at", { ascending: false });
      return (data ?? []) as ClientConversation[];
    },
    enabled: !!selectedClientId,
  });

  useEffect(() => {
    if (!selectedConversation && clientConversations?.length) {
      setSelectedConversation(clientConversations[0].id);
    }
  }, [clientConversations, selectedConversation]);

  const { data: selectedMessages } = useQuery({
    queryKey: ["staff-client-workspace-messages", selectedConversation],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_type, message_text, created_at")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });
      return (data ?? []) as ClientMessage[];
    },
    enabled: !!selectedConversation,
  });

  useEffect(() => {
    if (!clientDetails) return;

    setClientForm({
      full_name: clientDetails.profiles?.full_name || "",
      phone: clientDetails.profiles?.phone || "",
      client_type: clientDetails.client_type === "company" ? "company" : "individual",
      company_registration_number: clientDetails.company_registration_number || "",
      first_name: clientDetails.first_name || "",
      last_name: clientDetails.last_name || "",
      company_name: clientDetails.company_name || "",
      tax_number: clientDetails.tax_number || "",
      sars_reference_number: clientDetails.sars_reference_number || "",
      id_number: clientDetails.id_number || "",
      sars_outstanding_debt: String(clientDetails.sars_outstanding_debt ?? 0),
      returns_filed: clientDetails.returns_filed,
      client_code: clientDetails.client_code || "",
      address_line_1: clientDetails.address_line_1 || "",
      address_line_2: clientDetails.address_line_2 || "",
      city: clientDetails.city || "",
      province: clientDetails.province || "",
      postal_code: clientDetails.postal_code || "",
      country: clientDetails.country || "South Africa",
      notes: clientDetails.notes || "",
    });
  }, [clientDetails]);

  const consultantOptions = useMemo(
    () =>
      (consultants ?? []).map((consultant) => ({
        id: consultant.id,
        label: consultant.full_name || consultant.email || "Consultant",
        email: consultant.email,
      })),
    [consultants],
  );

  const consultantOptionMap = useMemo(
    () => new Map(consultantOptions.map((consultant) => [consultant.id, consultant])),
    [consultantOptions],
  );

  const summary = useMemo(() => {
    const invoices = clientInvoices ?? [];
    const documents = clientDocuments ?? [];
    const documentRequests = clientDocumentRequests ?? [];
    const outstandingDocumentRequests = documentRequests.filter((request) => request.is_required && !request.is_fulfilled).length;
    const outstandingInvoices = invoices.filter((invoice) => ["issued", "partially_paid", "overdue"].includes(invoice.status) && Number(invoice.balance_due || 0) > 0).length;
    const warningSummary = clientDetails
      ? getClientWarningSummary(clientDetails, {
        outstandingInvoices,
        outstandingDocumentRequests,
      })
      : null;

    return {
      cases: clientCases?.length ?? 0,
      documents: documents.length,
      invoices: invoices.length,
      conversations: clientConversations?.length ?? 0,
      outstandingBalance: invoices.reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0),
      pendingDocuments: documents.filter((document) => ["uploaded", "pending_review"].includes(document.status)).length,
      outstandingDocumentRequests,
      outstandingInvoices,
      warningSummary,
    };
  }, [clientCases, clientDetails, clientDocumentRequests, clientDocuments, clientInvoices, clientConversations]);

  const selectedConversationRecord = clientConversations?.find((conversation) => conversation.id === selectedConversation) ?? null;

  const openDocument = async (filePath: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 60 * 10);

    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Unable to open this file.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const refreshWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-clients"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-workspace-options"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-workspace-details", selectedClientId] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-workspace-cases", selectedClientId] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-workspace-documents", selectedClientId] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-workspace-invoices", selectedClientId] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-workspace-document-requests", selectedClientId] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-workspace-alerts", selectedClientId] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-workspace-conversations", selectedClientId] }),
      queryClient.invalidateQueries({ queryKey: ["staff-overview-case-statuses"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-dashboard-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-overview-invoice-health"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-overview-risk-clients"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-risk-document-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-risk-invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-overview-due-alerts"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-overview-recent-documents"] }),
    ]);
  };

  const notifyAssignedConsultant = async (params: {
    caseId: string;
    consultantId: string;
    clientName: string;
    caseType: string;
    priority: number;
  }) => {
    const consultant = consultantOptionMap.get(params.consultantId);

    if (!consultant) {
      toast.error("The selected consultant profile could not be loaded for email notification.");
      return false;
    }

    const result = await sendPractitionerAssignmentNotification({
      caseId: params.caseId,
      practitionerProfileId: params.consultantId,
      practitionerEmail: consultant.email,
      practitionerName: consultant.label,
      clientName: params.clientName,
      caseType: params.caseType,
      priority: params.priority,
    });

    if (result.error) {
      console.error("Practitioner assignment email failed:", result.error);
      toast.error("The case was assigned, but the practitioner email could not be sent.");
      return false;
    }

    return !result.skipped;
  };

  const updateClientProfile = async () => {
    if (!clientDetails) return;

    setSavingClient(true);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: clientForm.full_name.trim() || null,
        phone: clientForm.phone.trim() || null,
      })
      .eq("id", clientDetails.profile_id);

    if (profileError) {
      toast.error(profileError.message);
      setSavingClient(false);
      return;
    }

    const { error: clientError } = await supabase
      .from("clients")
      .update({
        client_type: clientForm.client_type,
        company_registration_number: clientForm.client_type === "company" ? clientForm.company_registration_number.trim() || null : null,
        first_name: clientForm.first_name.trim() || null,
        last_name: clientForm.last_name.trim() || null,
        company_name: clientForm.client_type === "company" ? clientForm.company_name.trim() || null : null,
        tax_number: clientForm.tax_number.trim() || null,
        sars_reference_number: clientForm.sars_reference_number.trim() || null,
        id_number: clientForm.client_type === "individual" ? clientForm.id_number.trim() || null : null,
        sars_outstanding_debt: Number(clientForm.sars_outstanding_debt || 0),
        returns_filed: clientForm.returns_filed,
        client_code: clientForm.client_code.trim() || null,
        address_line_1: clientForm.address_line_1.trim() || null,
        address_line_2: clientForm.address_line_2.trim() || null,
        city: clientForm.city.trim() || null,
        province: clientForm.province.trim() || null,
        postal_code: clientForm.postal_code.trim() || null,
        country: clientForm.country.trim() || "South Africa",
        notes: clientForm.notes.trim() || null,
      })
      .eq("id", clientDetails.id);

    if (clientError) {
      toast.error(clientError.message);
      setSavingClient(false);
      return;
    }

    toast.success("Client profile updated.");
    setSavingClient(false);
    setIsEditClientOpen(false);
    await refreshWorkspace();
  };

  const resetCaseForm = () => {
    setCaseForm({
      case_title: "",
      case_type: "individual_tax_return",
      description: "",
      due_date: "",
      priority: "2",
      assigned_consultant_id: UNASSIGNED_CONSULTANT,
      notify_client: true,
    });
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({
      title: "",
      description: "",
      total_amount: "",
      due_date: "",
      status: "draft",
    });
  };

  const resetAlertForm = () => {
    setAlertForm({
      title: "",
      description: "",
      alert_type: "general_deadline",
      alert_at: "",
      status: "active",
    });
  };

  const resetDocumentRequestForm = () => {
    setDocumentRequestForm({
      case_id: "",
      title: "",
      description: "",
      required_document_type: "",
      due_date: "",
    });
  };

  const createCase = async () => {
    if (!canManageCases) {
      toast.error("This consultant profile cannot create cases.");
      return;
    }

    if (!selectedClientId || !caseForm.case_title.trim()) {
      toast.error("Enter a case title first.");
      return;
    }

    setCreatingCase(true);

    const payload: TablesInsert<"cases"> = {
      client_id: selectedClientId,
      case_title: caseForm.case_title.trim(),
      case_type: caseForm.case_type,
      description: caseForm.description.trim() || null,
      priority: Number(caseForm.priority),
      created_by: user?.id ?? null,
      assigned_consultant_id: isConsultant ? user?.id ?? null : caseForm.assigned_consultant_id === UNASSIGNED_CONSULTANT ? null : caseForm.assigned_consultant_id,
      due_date: caseForm.due_date ? new Date(`${caseForm.due_date}T12:00:00`).toISOString() : null,
    };

    const { data, error } = await supabase.from("cases").insert(payload).select("id, created_at").single();

    if (error) {
      toast.error(error.message);
      setCreatingCase(false);
      return;
    }

    const assignedConsultantId = payload.assigned_consultant_id;
    let notified = false;
    let clientNotified = false;

    if (assignedConsultantId && data?.id) {
      notified = await notifyAssignedConsultant({
        caseId: data.id,
        consultantId: assignedConsultantId,
        clientName: getClientName(clientDetails),
        caseType: caseForm.case_type,
        priority: Number(caseForm.priority),
      });
    }

    if (caseForm.notify_client && clientDetails?.profile_id && data?.id) {
      const clientNotification = await sendCaseCreatedNotification({
        caseId: data.id,
        clientProfileId: clientDetails.profile_id,
        clientEmail: clientDetails.profiles?.email,
        clientName: getClientName(clientDetails),
        createdAt: data.created_at,
      });

      if (clientNotification.error) {
        console.error("Case created email failed:", clientNotification.error);
        toast.error("Case created, but the client email notification could not be delivered.");
      } else {
        clientNotified = !clientNotification.skipped;
      }
    }

    toast.success(
      assignedConsultantId && notified
        ? clientNotified
          ? "Case created. Practitioner and client notified."
          : "Case created and practitioner notified."
        : clientNotified
          ? "Case created and client notified."
          : "Case created.",
    );
    setCreatingCase(false);
    setIsCreateCaseOpen(false);
    resetCaseForm();
    await refreshWorkspace();
  };

  const createInvoice = async () => {
    if (!canManageInvoices) {
      toast.error("This consultant profile cannot create invoices.");
      return;
    }

    if (!selectedClientId || !invoiceForm.total_amount.trim()) {
      toast.error("Enter the invoice amount first.");
      return;
    }

    setCreatingInvoice(true);
    const totalAmount = Number(invoiceForm.total_amount);

    if (Number.isNaN(totalAmount) || totalAmount < 0) {
      toast.error("Enter a valid invoice amount.");
      setCreatingInvoice(false);
      return;
    }

    const payload: TablesInsert<"invoices"> = {
      client_id: selectedClientId,
      invoice_number: `TEMP-${Date.now()}`,
      title: invoiceForm.title.trim() || null,
      description: invoiceForm.description.trim() || null,
      subtotal: totalAmount,
      tax_amount: 0,
      total_amount: totalAmount,
      amount_paid: 0,
      status: invoiceForm.status,
      due_date: invoiceForm.due_date || null,
      created_by: user?.id ?? null,
    };

    const { data, error } = await supabase.from("invoices").insert(payload).select("id, invoice_number, due_date, status").single();

    if (error) {
      toast.error(error.message);
      setCreatingInvoice(false);
      return;
    }

    let notified = false;

    if (clientDetails?.profile_id && data?.id) {
      const notification = await sendInvoiceCreatedNotification({
        invoiceId: data.id,
        invoiceNumber: data.invoice_number,
        clientProfileId: clientDetails.profile_id,
        clientEmail: clientDetails.profiles?.email,
        clientName: getClientName(clientDetails),
        serviceDescription: invoiceForm.title.trim() || invoiceForm.description.trim() || "Professional tax services",
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

    toast.success(notified ? "Invoice created and client notified." : "Invoice created.");
    setCreatingInvoice(false);
    setIsCreateInvoiceOpen(false);
    resetInvoiceForm();
    await refreshWorkspace();
  };

  const createAlert = async () => {
    if (!selectedClientId || !alertForm.title.trim() || !alertForm.alert_at) {
      toast.error("Enter the alert title and due date first.");
      return;
    }

    setCreatingAlert(true);

    const payload: TablesInsert<"alerts"> = {
      client_id: selectedClientId,
      title: alertForm.title.trim(),
      description: alertForm.description.trim() || null,
      alert_type: alertForm.alert_type,
      status: alertForm.status,
      alert_at: new Date(`${alertForm.alert_at}T12:00:00`).toISOString(),
      created_by: user?.id ?? null,
    };

    const { error } = await supabase.from("alerts").insert(payload);

    if (error) {
      toast.error(error.message);
      setCreatingAlert(false);
      return;
    }

    toast.success("Alert created.");
    setCreatingAlert(false);
    setIsCreateAlertOpen(false);
    resetAlertForm();
    await refreshWorkspace();
  };

  const updateCaseStatus = async (caseId: string, status: Enums<"case_status">) => {
    if (!canManageCases) {
      toast.error("This consultant profile cannot update case statuses.");
      return;
    }

    const currentCase = (clientCases ?? []).find((caseItem) => caseItem.id === caseId);

    if (!currentCase || currentCase.status === status) {
      return;
    }

    const { data, error } = await supabase
      .from("cases")
      .update({ status })
      .eq("id", caseId)
      .select("updated_at")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    let notified = false;

    if (clientDetails?.profile_id) {
      const notification = await sendCaseStatusChangedNotification({
        caseId,
        clientProfileId: clientDetails.profile_id,
        clientEmail: clientDetails.profiles?.email,
        clientName: getClientName(clientDetails),
        serviceType: currentCase.case_type,
        previousStatus: currentCase.status,
        newStatus: status,
        updatedAt: data?.updated_at,
      });

      if (notification.error) {
        console.error("Case status email failed:", notification.error);
        toast.error("Case updated, but the client email notification could not be delivered.");
      } else {
        notified = !notification.skipped;
      }
    }

    toast.success(notified ? "Case updated and client notified." : "Case updated.");
    await refreshWorkspace();
  };

  const createDocumentRequest = async () => {
    if (!selectedClientId || !documentRequestForm.title.trim()) {
      toast.error("Enter the requested document title first.");
      return;
    }

    setCreatingDocumentRequest(true);

    const payload: TablesInsert<"document_requests"> = {
      client_id: selectedClientId,
      case_id: documentRequestForm.case_id || null,
      title: documentRequestForm.title.trim(),
      description: documentRequestForm.description.trim() || null,
      required_document_type: documentRequestForm.required_document_type.trim() || null,
      due_date: documentRequestForm.due_date ? new Date(`${documentRequestForm.due_date}T12:00:00`).toISOString() : null,
      is_required: true,
      requested_by: user?.id ?? null,
    };

    const { data, error } = await supabase.from("document_requests").insert(payload).select("id").single();

    if (error) {
      toast.error(error.message);
      setCreatingDocumentRequest(false);
      return;
    }

    let notified = false;

    if (clientDetails?.profile_id && data?.id) {
      const requesterName = profile?.full_name?.trim()
        || (role === "consultant" ? "Your Consultant" : "Acapolite Consulting");
      const documentList = [
        documentRequestForm.title.trim(),
        documentRequestForm.required_document_type.trim(),
      ].filter(Boolean).join(" | ");

      const notification = await sendDocumentRequestNotification({
        requestId: data.id,
        clientProfileId: clientDetails.profile_id,
        clientEmail: clientDetails.profiles?.email,
        clientName: getClientName(clientDetails),
        practitionerName: requesterName,
        caseId: documentRequestForm.case_id || null,
        documentList,
        deadlineDate: payload.due_date,
      });

      if (notification.error) {
        console.error("Document request email failed:", notification.error);
        toast.error("Document request created, but the client email notification could not be delivered.");
      } else {
        notified = !notification.skipped;
      }
    }

    toast.success(notified ? "Document request created and client notified." : "Document request created.");
    setCreatingDocumentRequest(false);
    setIsCreateDocumentRequestOpen(false);
    resetDocumentRequestForm();
    await refreshWorkspace();
  };

  const updateAssignedConsultant = async (caseItem: ClientCase, consultantId: string | null) => {
    if (!canAssignConsultants) {
      return;
    }

    if (caseItem.assigned_consultant_id === consultantId) {
      return;
    }

    const { error } = await supabase
      .from("cases")
      .update({ assigned_consultant_id: consultantId })
      .eq("id", caseItem.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    let notified = false;

    if (consultantId) {
      notified = await notifyAssignedConsultant({
        caseId: caseItem.id,
        consultantId,
        clientName: getClientName(clientDetails),
        caseType: caseItem.case_type,
        priority: caseItem.priority,
      });
    }

    toast.success(
      consultantId
        ? notified
          ? "Consultant assigned and notified."
          : "Consultant assigned."
        : "Consultant removed from this case.",
    );
    await refreshWorkspace();
  };

  const updateInvoiceStatus = async (invoiceId: string, status: Enums<"invoice_status">) => {
    if (!canManageInvoices) {
      toast.error("This consultant profile cannot update invoices.");
      return;
    }

    const { error } = await supabase.from("invoices").update({ status }).eq("id", invoiceId);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Invoice updated.");
    await refreshWorkspace();
  };

  const updateAlertStatus = async (alertId: string, status: Enums<"alert_status">) => {
    const { error } = await supabase.from("alerts").update({ status }).eq("id", alertId);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Alert updated.");
    await refreshWorkspace();
  };

  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim() || !user) return;
    if (!canReplyMessages) {
      toast.error("This consultant profile cannot reply to client messages.");
      return;
    }

    const outgoingMessage = newMessage.trim();

    const { data, error } = await supabase.from("messages").insert({
      conversation_id: selectedConversation,
      sender_profile_id: user.id,
      sender_type: role === "consultant" ? "consultant" : "admin",
      message_text: outgoingMessage,
    }).select("id, created_at").single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setNewMessage("");
    if (clientDetails?.profile_id) {
      const senderName = profile?.full_name?.trim()
        || (role === "consultant" ? "Your Consultant" : "Acapolite Consulting");
      const notification = await sendClientMessageNotification({
        messageId: data.id,
        clientProfileId: clientDetails.profile_id,
        clientEmail: clientDetails.profiles?.email,
        clientName: getClientName(clientDetails),
        senderName,
        messageText: outgoingMessage,
        sentAt: data.created_at,
        caseId: selectedConversationRecord?.case_id,
        conversationSubject: selectedConversationRecord?.subject,
      });

      if (notification.error) {
        console.error("Client message email failed:", notification.error);
        toast.error("Message sent, but the client email notification could not be delivered.");
      } else {
        toast.success("Message sent.");
      }
    } else {
      toast.success("Message sent.");
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-client-workspace-messages", selectedConversation] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-workspace-conversations", selectedClientId] }),
      queryClient.invalidateQueries({ queryKey: ["staff-unread-messages"] }),
      queryClient.invalidateQueries({ queryKey: ["sidebar-unread-messages"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-dashboard-summary"] }),
    ]);
  };

  const startConversation = async () => {
    if (!canReplyMessages) {
      toast.error("This consultant profile cannot start client conversations.");
      return;
    }

    if (!selectedClientId) return;

    setCreatingConversation(true);

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        client_id: selectedClientId,
        subject: "General Support",
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      setCreatingConversation(false);
      return;
    }

    toast.success("Conversation created.");
    setSelectedConversation(data.id);
    setCreatingConversation(false);
    await refreshWorkspace();
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <p className="mb-3 font-body text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">
          Client 360
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              Full client workspace
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground font-body sm:text-base">
              Open one client and review profile details, cases, uploads, invoices, alerts, and chat history in one place.
            </p>
          </div>
          <div className="w-full max-w-md">
            <label className="mb-2 block text-sm font-semibold text-foreground font-body">Choose Client</label>
            <Select
              value={selectedClientId}
              onValueChange={(value) => {
                setSelectedConversation("");
                setSearchParams({ clientId: value });
              }}
            >
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {getClientName(client)}{client.client_code ? ` (${client.client_code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {isLoading || isLoadingAccessibleClientIds ? (
        <div className="text-muted-foreground font-body">Loading client workspace...</div>
      ) : !clientDetails ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground font-body">Select a client to open the workspace.</p>
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Cases", value: summary.cases, icon: FolderOpen },
              { label: "Documents", value: summary.documents, icon: Upload },
              { label: "Pending Review", value: summary.pendingDocuments, icon: Upload },
              { label: "Invoices", value: summary.invoices, icon: Receipt },
              { label: "Conversations", value: summary.conversations, icon: MessageSquare },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <card.icon className="mb-4 h-5 w-5 text-primary" />
                <p className="font-display text-4xl font-bold text-foreground">{card.value}</p>
                <p className="mt-2 text-sm text-muted-foreground font-body">{card.label}</p>
              </div>
            ))}
          </section>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-2xl border border-border bg-card p-2">
              <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
              <TabsTrigger value="cases" className="rounded-xl">Cases</TabsTrigger>
              <TabsTrigger value="documents" className="rounded-xl">Documents</TabsTrigger>
              <TabsTrigger value="messages" className="rounded-xl">Messages</TabsTrigger>
              <TabsTrigger value="invoices" className="rounded-xl">Invoices</TabsTrigger>
              <TabsTrigger value="alerts" className="rounded-xl">Alerts</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-primary" />
                      <div>
                        <h2 className="font-display text-xl font-semibold text-foreground">{getClientName(clientDetails)}</h2>
                        <p className="text-sm text-muted-foreground font-body">
                          {clientDetails.client_code || "No client code"} • {clientDetails.profiles?.email || "No email"}
                        </p>
                      </div>
                    </div>
                    {canManageClients ? (
                      <Button type="button" className="rounded-xl" onClick={() => setIsEditClientOpen(true)}>
                        Edit Client Profile
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-accent/30 p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Phone</p>
                      <p className="font-body text-foreground">{clientDetails.profiles?.phone || "Not provided"}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-accent/30 p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Client Type</p>
                      <p className="font-body text-foreground">{getClientTypeLabel(clientDetails.client_type)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-accent/30 p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Assigned Consultant</p>
                      <p className="font-body text-foreground">{clientDetails.assigned_consultant?.full_name || clientDetails.assigned_consultant?.email || "Not assigned"}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-accent/30 p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Tax Number</p>
                      <p className="font-body text-foreground">{clientDetails.tax_number || "Not provided"}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-accent/30 p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">SARS Reference</p>
                      <p className="font-body text-foreground">{clientDetails.sars_reference_number || "Not provided"}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-accent/30 p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">{getClientIdentityFieldLabel(clientDetails.client_type)}</p>
                      <p className="font-body text-foreground">{getClientIdentityLabel(clientDetails)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-accent/30 p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">SARS Outstanding / Debt</p>
                      <p className="font-body text-foreground">{formatCurrency(clientDetails.sars_outstanding_debt)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-accent/30 p-4 sm:col-span-2">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Returns Filed</p>
                      <p className="font-body text-foreground">{clientDetails.returns_filed ? "Filed" : "Not filed"}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-accent/30 p-4 sm:col-span-2">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Address</p>
                      <p className="font-body text-foreground">{getAddress(clientDetails) || "No address details added yet."}</p>
                    </div>
                    <div className="rounded-xl border border-border p-4 sm:col-span-2">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Internal Notes</p>
                      <p className="whitespace-pre-wrap font-body text-foreground">{clientDetails.notes || "No internal notes yet."}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                    <h2 className="mb-5 font-display text-xl font-semibold text-foreground">Financial Summary</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-border bg-accent/30 p-4">
                        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Outstanding Balance</p>
                        <p className="font-display text-2xl text-foreground">{formatCurrency(summary.outstandingBalance)}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-accent/30 p-4">
                        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Active Alerts</p>
                        <p className="font-display text-2xl text-foreground">{clientAlerts?.filter((alert) => alert.status === "active").length ?? 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-2xl border p-6 shadow-card ${summary.warningSummary?.hasIssues ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${summary.warningSummary?.hasIssues ? "text-red-600" : "text-emerald-600"}`} />
                      <div className="space-y-3">
                        <div>
                          <h2 className={`font-display text-xl font-semibold ${summary.warningSummary?.hasIssues ? "text-red-700" : "text-emerald-700"}`}>
                            {summary.warningSummary?.hasIssues ? "Risk Snapshot" : "Risk Snapshot Clear"}
                          </h2>
                          <p className={`text-sm font-body ${summary.warningSummary?.hasIssues ? "text-red-700/80" : "text-emerald-700/80"}`}>
                            {summary.warningSummary?.hasIssues ? "This client account has issues that need attention." : "No active risk indicators are showing for this client right now."}
                          </p>
                        </div>
                        {summary.warningSummary?.hasIssues ? (
                          <div className="flex flex-wrap gap-2">
                            {summary.warningSummary.reasons.map((reason) => (
                              <span key={reason} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-700">
                                {reason}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <h2 className="font-display text-xl font-semibold text-foreground">Recent Client Activity</h2>
                      <Link to="/dashboard/staff/messages" className="text-sm font-semibold text-primary hover:underline">
                        Open staff inbox
                      </Link>
                    </div>

                    <div className="space-y-3">
                      {(clientCases ?? []).slice(0, 2).map((caseItem) => (
                        <div key={caseItem.id} className="rounded-xl border border-border p-4">
                          <p className="font-body font-medium text-foreground">{caseItem.case_title}</p>
                          <p className="mt-1 text-xs text-muted-foreground font-body">Case • {formatLabel(caseItem.status)}</p>
                        </div>
                      ))}
                      {(clientDocuments ?? []).slice(0, 2).map((document) => (
                        <div key={document.id} className="rounded-xl border border-border p-4">
                          <p className="font-body font-medium text-foreground">{document.category || document.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground font-body">Document • {formatLabel(document.status)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="cases" className="space-y-4">
              {canManageCases ? (
                <div className="flex justify-end">
                  <Button type="button" className="rounded-xl" onClick={() => setIsCreateCaseOpen(true)}>
                    Add Case
                  </Button>
                </div>
              ) : null}
              {(clientCases ?? []).length > 0 ? (clientCases ?? []).map((caseItem) => (
                <div key={caseItem.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-foreground">{caseItem.case_title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground font-body">{formatLabel(caseItem.case_type)}</p>
                    </div>
                    <Badge variant="outline" className={statusBadgeClass(caseItem.status)}>{formatLabel(caseItem.status)}</Badge>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Priority</p>
                      <p className="font-body text-foreground">{caseItem.priority}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Due Date</p>
                      <p className="font-body text-foreground">{caseItem.due_date ? new Date(caseItem.due_date).toLocaleDateString() : "Not set"}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Last Activity</p>
                      <p className="font-body text-foreground">{new Date(caseItem.last_activity_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="text-xs text-muted-foreground font-body">Update status:</span>
                    {canManageCases ? (
                      <Select value={caseItem.status} onValueChange={(value) => updateCaseStatus(caseItem.id, value as Enums<"case_status">)}>
                        <SelectTrigger className="w-64 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {caseStatusOptions.map((status) => (
                            <SelectItem key={status} value={status}>{formatLabel(status)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">View only</span>
                    )}
                    {canAssignConsultants ? (
                      <>
                        <span className="ml-2 text-xs text-muted-foreground font-body">Consultant:</span>
                        <Select
                          value={caseItem.assigned_consultant_id ?? UNASSIGNED_CONSULTANT}
                          onValueChange={(value) => updateAssignedConsultant(caseItem, value === UNASSIGNED_CONSULTANT ? null : value)}
                        >
                          <SelectTrigger className="w-64 rounded-xl">
                            <SelectValue placeholder="Assign consultant" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED_CONSULTANT}>Unassigned</SelectItem>
                            {consultantOptions.map((consultant) => (
                              <SelectItem key={consultant.id} value={consultant.id}>{consultant.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : caseItem.assigned_consultant ? (
                      <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                        {caseItem.assigned_consultant.full_name || caseItem.assigned_consultant.email}
                      </span>
                    ) : null}
                  </div>
                  {caseItem.description ? <p className="mt-4 text-sm text-muted-foreground font-body whitespace-pre-wrap">{caseItem.description}</p> : null}
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                  <p className="text-muted-foreground font-body">No cases for this client yet.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              {canManageCases ? (
                <div className="flex justify-end">
                  <Button type="button" className="rounded-xl" onClick={() => setIsCreateDocumentRequestOpen(true)}>
                    Request Documents
                  </Button>
                </div>
              ) : null}

              {(clientDocumentRequests ?? []).length > 0 ? (
                <div className="space-y-3">
                  {(clientDocumentRequests ?? []).map((request) => (
                    <div key={request.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="font-display text-lg font-semibold text-foreground">
                            {request.title || request.required_document_type || "Document Request"}
                          </h2>
                          {request.description ? (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground font-body">{request.description}</p>
                          ) : null}
                        </div>
                        <Badge
                          variant="outline"
                          className={request.is_fulfilled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}
                        >
                          {request.is_fulfilled ? "fulfilled" : "outstanding"}
                        </Badge>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Requested Type</p>
                          <p className="font-body text-foreground">{request.required_document_type || "General supporting documents"}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Deadline</p>
                          <p className="font-body text-foreground">{request.due_date ? new Date(request.due_date).toLocaleDateString() : "As soon as possible"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {(clientDocuments ?? []).length > 0 ? (clientDocuments ?? []).map((document) => (
                <div key={document.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-foreground">{document.category || document.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground font-body">
                        {document.file_name}{document.file_size ? ` • ${(document.file_size / 1024).toFixed(1)} KB` : ""}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground font-body">Uploaded {new Date(document.uploaded_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={statusBadgeClass(document.status)}>{formatLabel(document.status)}</Badge>
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => openDocument(document.file_path)}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                      </Button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                  <p className="text-muted-foreground font-body">No documents for this client yet.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="messages" className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
                <div className="rounded-2xl border border-border bg-card shadow-card">
                  <div className="border-b border-border px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-display text-lg font-semibold text-foreground">Conversations</h2>
                      {canReplyMessages ? (
                        <Button type="button" className="rounded-xl" onClick={startConversation} disabled={creatingConversation}>
                          {creatingConversation ? "Starting..." : "Start Chat"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="max-h-[540px] overflow-y-auto p-3 space-y-2">
                    {(clientConversations ?? []).length > 0 ? (clientConversations ?? []).map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => setSelectedConversation(conversation.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                          selectedConversation === conversation.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30 hover:bg-accent/30"
                        }`}
                      >
                        <p className="font-body font-semibold text-foreground truncate">{conversation.subject || "General Support"}</p>
                        <p className="mt-1 text-xs text-muted-foreground font-body">Last activity {new Date(conversation.last_message_at).toLocaleString()}</p>
                      </button>
                    )) : (
                      <div className="p-6 text-center">
                        <p className="text-sm text-muted-foreground font-body">No conversations found.</p>
                        {canReplyMessages ? (
                          <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={startConversation} disabled={creatingConversation}>
                            {creatingConversation ? "Starting..." : "Start First Chat"}
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card shadow-card">
                  {selectedConversationRecord ? (
                    <>
                      <div className="border-b border-border px-6 py-5">
                        <h2 className="font-display text-xl font-semibold text-foreground">{selectedConversationRecord.subject || "General Support"}</h2>
                        <p className="mt-1 text-sm text-muted-foreground font-body">{selectedConversationRecord.is_closed ? "Closed conversation" : "Open conversation"}</p>
                      </div>
                      <div className="max-h-[540px] overflow-y-auto p-6 space-y-4">
                        {(selectedMessages ?? []).length > 0 ? (selectedMessages ?? []).map((message) => {
                          const isClientMessage = message.sender_type === "client";
                          return (
                            <div key={message.id} className={`flex ${isClientMessage ? "justify-start" : "justify-end"}`}>
                              <div className={`max-w-[78%] rounded-3xl px-4 py-3 ${isClientMessage ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{getSenderLabel(message.sender_type)}</p>
                                <p className="text-sm font-body whitespace-pre-wrap">{message.message_text}</p>
                                <p className={`mt-3 text-xs ${isClientMessage ? "text-muted-foreground" : "text-primary-foreground/70"}`}>{new Date(message.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="p-10 text-center">
                            <p className="text-sm text-muted-foreground font-body">No messages in this conversation yet.</p>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-border p-4">
                        <div className="flex gap-3">
                          <Input
                            value={newMessage}
                            onChange={(event) => setNewMessage(event.target.value)}
                            placeholder={canReplyMessages ? "Type a message to this client..." : "View-only messaging access"}
                            className="flex-1 rounded-xl"
                            disabled={!canReplyMessages}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void sendMessage();
                              }
                            }}
                          />
                          <Button type="button" className="rounded-xl" onClick={sendMessage} disabled={!canReplyMessages}>
                            {canReplyMessages ? "Send" : "View Only"}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-[300px] items-center justify-center p-12">
                      <div className="text-center">
                        <p className="text-muted-foreground font-body">Select a conversation to view the client chat.</p>
                        {canReplyMessages ? (
                          <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={startConversation} disabled={creatingConversation}>
                            {creatingConversation ? "Starting..." : "Start Chat"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="invoices" className="space-y-4">
              {canManageInvoices ? (
                <div className="flex justify-end">
                  <Button type="button" className="rounded-xl" onClick={() => setIsCreateInvoiceOpen(true)}>
                    Add Invoice
                  </Button>
                </div>
              ) : null}
              {(clientInvoices ?? []).length > 0 ? (clientInvoices ?? []).map((invoice) => (
                <div key={invoice.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-foreground">{invoice.invoice_number}</h2>
                      <p className="mt-1 text-sm text-muted-foreground font-body">{invoice.title || "Service invoice"}</p>
                    </div>
                    <Badge variant="outline" className={statusBadgeClass(invoice.status)}>{formatLabel(invoice.status)}</Badge>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Total</p>
                      <p className="font-body text-foreground">{formatCurrency(invoice.total_amount)}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Paid</p>
                      <p className="font-body text-foreground">{formatCurrency(invoice.amount_paid)}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Balance</p>
                      <p className="font-body text-foreground">{formatCurrency(invoice.balance_due)}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Due Date</p>
                      <p className="font-body text-foreground">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "Not set"}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-body">Update status:</span>
                    <Select value={invoice.status} onValueChange={(value) => updateInvoiceStatus(invoice.id, value as Enums<"invoice_status">)}>
                      <SelectTrigger className="w-64 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {invoiceStatusOptions.map((status) => (
                          <SelectItem key={status} value={status}>{formatLabel(status)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                  <p className="text-muted-foreground font-body">No invoices for this client yet.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="alerts" className="space-y-4">
              <div className="flex justify-end">
                <Button type="button" className="rounded-xl" onClick={() => setIsCreateAlertOpen(true)}>
                  Add Alert
                </Button>
              </div>
              {(clientAlerts ?? []).length > 0 ? (clientAlerts ?? []).map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-foreground">{alert.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground font-body">{formatLabel(alert.alert_type)}</p>
                    </div>
                    <Badge variant="outline" className={statusBadgeClass(alert.status)}>{formatLabel(alert.status)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-body">Due {new Date(alert.alert_at).toLocaleDateString()}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-body">Update status:</span>
                    <Select value={alert.status} onValueChange={(value) => updateAlertStatus(alert.id, value as Enums<"alert_status">)}>
                      <SelectTrigger className="w-64 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {alertStatusOptions.map((status) => (
                          <SelectItem key={status} value={status}>{formatLabel(status)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {alert.description ? <p className="mt-3 text-sm text-muted-foreground font-body whitespace-pre-wrap">{alert.description}</p> : null}
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                  <p className="text-muted-foreground font-body">No alerts for this client right now.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DashboardItemDialog
            open={isEditClientOpen}
            onOpenChange={setIsEditClientOpen}
            title="Edit Client Profile"
            description="Update this client's profile, tax details, contact information, and address from the admin workspace."
          >
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Full Name</label>
                  <Input
                    value={clientForm.full_name}
                    onChange={(event) => setClientForm((current) => ({ ...current, full_name: event.target.value }))}
                    placeholder="Client full name"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Email</label>
                  <Input
                    value={clientDetails?.profiles?.email || ""}
                    readOnly
                    disabled
                    className="rounded-xl bg-accent/40 text-muted-foreground"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Phone</label>
                  <Input
                    value={clientForm.phone}
                    onChange={(event) => setClientForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="Client phone number"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Client Type</label>
                  <Select value={clientForm.client_type} onValueChange={(value) => setClientForm((current) => ({ ...current, client_type: value }))}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Client Code</label>
                  <Input
                    value={clientForm.client_code}
                    onChange={(event) => setClientForm((current) => ({ ...current, client_code: event.target.value }))}
                    placeholder="Client code"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">First Name</label>
                  <Input
                    value={clientForm.first_name}
                    onChange={(event) => setClientForm((current) => ({ ...current, first_name: event.target.value }))}
                    placeholder="First name"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Last Name</label>
                  <Input
                    value={clientForm.last_name}
                    onChange={(event) => setClientForm((current) => ({ ...current, last_name: event.target.value }))}
                    placeholder="Last name"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {clientForm.client_type === "company" ? (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground font-body">Company Name</label>
                      <Input
                        value={clientForm.company_name}
                        onChange={(event) => setClientForm((current) => ({ ...current, company_name: event.target.value }))}
                        placeholder="Company name"
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground font-body">Company Registration Number</label>
                      <Input
                        value={clientForm.company_registration_number}
                        onChange={(event) => setClientForm((current) => ({ ...current, company_registration_number: event.target.value }))}
                        placeholder="Registration number"
                        className="rounded-xl"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground font-body">ID Number</label>
                    <Input
                      value={clientForm.id_number}
                      onChange={(event) => setClientForm((current) => ({ ...current, id_number: event.target.value }))}
                      placeholder="ID number"
                      className="rounded-xl"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Tax Number</label>
                  <Input
                    value={clientForm.tax_number}
                    onChange={(event) => setClientForm((current) => ({ ...current, tax_number: event.target.value }))}
                    placeholder="Tax number"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">SARS Reference</label>
                  <Input
                    value={clientForm.sars_reference_number}
                    onChange={(event) => setClientForm((current) => ({ ...current, sars_reference_number: event.target.value }))}
                    placeholder="SARS reference number"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">SARS Outstanding / Debt</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={clientForm.sars_outstanding_debt}
                    onChange={(event) => setClientForm((current) => ({ ...current, sars_outstanding_debt: event.target.value }))}
                    placeholder="0.00"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="client-returns-filed"
                    checked={clientForm.returns_filed}
                    onCheckedChange={(checked) => setClientForm((current) => ({ ...current, returns_filed: checked === true }))}
                  />
                  <label htmlFor="client-returns-filed" className="text-sm font-semibold text-foreground font-body">
                    Returns filed
                  </label>
                </div>
                <p className="mt-2 text-xs text-muted-foreground font-body">
                  Unchecked clients will be highlighted with a red warning in the admin dashboard risk views.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Address Line 1</label>
                  <Input
                    value={clientForm.address_line_1}
                    onChange={(event) => setClientForm((current) => ({ ...current, address_line_1: event.target.value }))}
                    placeholder="Street address"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Address Line 2</label>
                  <Input
                    value={clientForm.address_line_2}
                    onChange={(event) => setClientForm((current) => ({ ...current, address_line_2: event.target.value }))}
                    placeholder="Building, suite, or area"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">City</label>
                  <Input
                    value={clientForm.city}
                    onChange={(event) => setClientForm((current) => ({ ...current, city: event.target.value }))}
                    placeholder="City"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Province</label>
                  <Input
                    value={clientForm.province}
                    onChange={(event) => setClientForm((current) => ({ ...current, province: event.target.value }))}
                    placeholder="Province"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Postal Code</label>
                  <Input
                    value={clientForm.postal_code}
                    onChange={(event) => setClientForm((current) => ({ ...current, postal_code: event.target.value }))}
                    placeholder="Postal code"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Country</label>
                  <Input
                    value={clientForm.country}
                    onChange={(event) => setClientForm((current) => ({ ...current, country: event.target.value }))}
                    placeholder="Country"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Internal Notes</label>
                <Textarea
                  value={clientForm.notes}
                  onChange={(event) => setClientForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Add client notes for the Acapolite team."
                  className="min-h-[120px] rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsEditClientOpen(false)} disabled={savingClient}>
                  Cancel
                </Button>
                <Button type="button" className="rounded-xl" onClick={updateClientProfile} disabled={savingClient}>
                  {savingClient ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </div>
          </DashboardItemDialog>

          <DashboardItemDialog
            open={isCreateCaseOpen}
            onOpenChange={setIsCreateCaseOpen}
            title="Add Case"
            description="Create a new case directly from this client workspace."
          >
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Case Title</label>
                <Input
                  value={caseForm.case_title}
                  onChange={(event) => setCaseForm((current) => ({ ...current, case_title: event.target.value }))}
                  placeholder="Example: 2026 Individual Tax Return"
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Case Type</label>
                  <Select value={caseForm.case_type} onValueChange={(value) => setCaseForm((current) => ({ ...current, case_type: value as Enums<"case_type"> }))}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {caseTypeOptions.map((caseType) => (
                        <SelectItem key={caseType} value={caseType}>{formatLabel(caseType)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Priority</label>
                  <Select value={caseForm.priority} onValueChange={(value) => setCaseForm((current) => ({ ...current, priority: value }))}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - High</SelectItem>
                      <SelectItem value="2">2 - Normal</SelectItem>
                      <SelectItem value="3">3 - Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {canAssignConsultants ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Assigned Consultant</label>
                  <Select
                    value={caseForm.assigned_consultant_id}
                    onValueChange={(value) => setCaseForm((current) => ({ ...current, assigned_consultant_id: value }))}
                  >
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="Assign consultant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_CONSULTANT}>Unassigned</SelectItem>
                      {consultantOptions.map((consultant) => (
                        <SelectItem key={consultant.id} value={consultant.id}>{consultant.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Due Date</label>
                <Input
                  type="date"
                  value={caseForm.due_date}
                  onChange={(event) => setCaseForm((current) => ({ ...current, due_date: event.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Description</label>
                <Textarea
                  value={caseForm.description}
                  onChange={(event) => setCaseForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Add case details, SARS issue, or service scope."
                  className="rounded-xl"
                />
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={caseForm.notify_client}
                    onCheckedChange={(checked) => setCaseForm((current) => ({ ...current, notify_client: checked === true }))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground font-body">Notify client by email</span>
                    <span className="block text-xs text-muted-foreground font-body mt-1">
                      Send the case-created email to the client for this specific case.
                    </span>
                  </span>
                </label>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsCreateCaseOpen(false)} disabled={creatingCase}>
                  Cancel
                </Button>
                <Button type="button" className="rounded-xl" onClick={createCase} disabled={creatingCase}>
                  {creatingCase ? "Creating..." : "Create Case"}
                </Button>
              </div>
            </div>
          </DashboardItemDialog>

          <DashboardItemDialog
            open={isCreateInvoiceOpen}
            onOpenChange={setIsCreateInvoiceOpen}
            title="Add Invoice"
            description="Create a new invoice directly from this client workspace."
          >
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Invoice Title</label>
                <Input
                  value={invoiceForm.title}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Example: Tax Return Filing"
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Description</label>
                <Textarea
                  value={invoiceForm.description}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Optional billing description."
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Total Amount</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoiceForm.total_amount}
                    onChange={(event) => setInvoiceForm((current) => ({ ...current, total_amount: event.target.value }))}
                    placeholder="0.00"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Status</label>
                  <Select value={invoiceForm.status} onValueChange={(value) => setInvoiceForm((current) => ({ ...current, status: value as Enums<"invoice_status"> }))}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {invoiceStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>{formatLabel(status)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Due Date</label>
                <Input
                  type="date"
                  value={invoiceForm.due_date}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, due_date: event.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsCreateInvoiceOpen(false)} disabled={creatingInvoice}>
                  Cancel
                </Button>
                <Button type="button" className="rounded-xl" onClick={createInvoice} disabled={creatingInvoice}>
                  {creatingInvoice ? "Creating..." : "Create Invoice"}
                </Button>
              </div>
            </div>
          </DashboardItemDialog>

          <DashboardItemDialog
            open={isCreateAlertOpen}
            onOpenChange={setIsCreateAlertOpen}
            title="Add Alert"
            description="Create a reminder, due date, or follow-up item for this client."
          >
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Alert Title</label>
                <Input
                  value={alertForm.title}
                  onChange={(event) => setAlertForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Example: Upload outstanding IRP5"
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Description</label>
                <Textarea
                  value={alertForm.description}
                  onChange={(event) => setAlertForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Optional reminder details."
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Alert Type</label>
                  <Select value={alertForm.alert_type} onValueChange={(value) => setAlertForm((current) => ({ ...current, alert_type: value as Enums<"alert_type"> }))}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {alertTypeOptions.map((alertType) => (
                        <SelectItem key={alertType} value={alertType}>{formatLabel(alertType)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Status</label>
                  <Select value={alertForm.status} onValueChange={(value) => setAlertForm((current) => ({ ...current, status: value as Enums<"alert_status"> }))}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {alertStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>{formatLabel(status)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Due Date</label>
                <Input
                  type="date"
                  value={alertForm.alert_at}
                  onChange={(event) => setAlertForm((current) => ({ ...current, alert_at: event.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsCreateAlertOpen(false)} disabled={creatingAlert}>
                  Cancel
                </Button>
                <Button type="button" className="rounded-xl" onClick={createAlert} disabled={creatingAlert}>
                  {creatingAlert ? "Creating..." : "Create Alert"}
                </Button>
              </div>
            </div>
          </DashboardItemDialog>

          <DashboardItemDialog
            open={isCreateDocumentRequestOpen}
            onOpenChange={(open) => {
              setIsCreateDocumentRequestOpen(open);
              if (!open) resetDocumentRequestForm();
            }}
            title="Request Documents"
            description="Ask this client to upload the exact documents needed to keep the case moving."
          >
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Request Title</label>
                <Input
                  value={documentRequestForm.title}
                  onChange={(event) => setDocumentRequestForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Example: Upload latest IRP5 and SARS letter"
                  className="rounded-xl"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Related Case</label>
                  <Select
                    value={documentRequestForm.case_id || "general"}
                    onValueChange={(value) => setDocumentRequestForm((current) => ({ ...current, case_id: value === "general" ? "" : value }))}
                  >
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General account request</SelectItem>
                      {(clientCases ?? []).map((caseItem) => (
                        <SelectItem key={caseItem.id} value={caseItem.id}>{caseItem.case_title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Deadline</label>
                  <Input
                    type="date"
                    value={documentRequestForm.due_date}
                    onChange={(event) => setDocumentRequestForm((current) => ({ ...current, due_date: event.target.value }))}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Document Type</label>
                <Input
                  value={documentRequestForm.required_document_type}
                  onChange={(event) => setDocumentRequestForm((current) => ({ ...current, required_document_type: event.target.value }))}
                  placeholder="Example: IRP5, bank statement, proof of address"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Instructions</label>
                <Textarea
                  value={documentRequestForm.description}
                  onChange={(event) => setDocumentRequestForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Add any notes or guidance for the client."
                  className="rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsCreateDocumentRequestOpen(false)} disabled={creatingDocumentRequest}>
                  Cancel
                </Button>
                <Button type="button" className="rounded-xl" onClick={createDocumentRequest} disabled={creatingDocumentRequest}>
                  {creatingDocumentRequest ? "Creating..." : "Send Request"}
                </Button>
              </div>
            </div>
          </DashboardItemDialog>
        </>
      )}
    </div>
  );
}
