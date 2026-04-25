import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, MessageSquare, Paperclip, SendHorizonal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import type { Enums, Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useAccessibleClientIds } from "@/hooks/useAccessibleClientIds";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { getClientWarningSummary } from "@/lib/clientRisk";
import { sendPractitionerAssignmentNotification } from "@/lib/practitionerAssignments";
import { sendCaseStatusChangedNotification } from "@/lib/caseStatusNotifications";
import { sendCaseCreatedNotification } from "@/lib/caseCreatedNotifications";
import { logSystemActivity } from "@/lib/systemActivityLog";
import { useNotificationSectionRead } from "@/hooks/useNotificationSectionRead";
import { assertValidChatAttachment, openChatAttachment, uploadChatAttachment } from "@/lib/chatAttachments";

const statusOptions: Enums<"case_status">[] = [
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

const UNASSIGNED_CONSULTANT = "unassigned";

type ConsultantOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type CaseRecord = {
  archive_notes: string | null;
  archive_reason: string | null;
  archived_at: string | null;
  archived_by: string | null;
  id: string;
  is_archived: boolean;
  client_id: string;
  case_title: string;
  case_type: string;
  status: Enums<"case_status">;
  description: string | null;
  created_at: string;
  due_date: string | null;
  priority: number;
  assigned_consultant_id: string | null;
  clients?: {
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    client_code?: string | null;
  } | null;
  assigned_consultant?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type ConversationRecord = Tables<"conversations">;
type MessageRecord = Tables<"messages">;
type PractitionerChangeRequestRecord = Tables<"practitioner_change_requests">;

export default function AdminCases() {
  useNotificationSectionRead("cases");
  const queryClient = useQueryClient();
  const caseAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role, hasStaffPermission, isConsultant } = useAuth();
  const { accessibleClientIds, hasRestrictedClientScope, isLoadingAccessibleClientIds } = useAccessibleClientIds();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseView, setCaseView] = useState<"active" | "archived">("active");
  const [caseReply, setCaseReply] = useState("");
  const [caseAttachmentFile, setCaseAttachmentFile] = useState<File | null>(null);
  const [sendingCaseReply, setSendingCaseReply] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [archivingCaseId, setArchivingCaseId] = useState<string | null>(null);
  const [caseArchiveReason, setCaseArchiveReason] = useState<string>("inactive");
  const [caseArchiveNotes, setCaseArchiveNotes] = useState("");
  const [changeRequestResponse, setChangeRequestResponse] = useState("");
  const [adminChangeDecisionNote, setAdminChangeDecisionNote] = useState("");
  const [submittingChangeResponseId, setSubmittingChangeResponseId] = useState<string | null>(null);
  const [reviewingChangeRequestId, setReviewingChangeRequestId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [form, setForm] = useState({
    client_id: "",
    case_title: "",
    case_type: "individual_tax_return" as Enums<"case_type">,
    description: "",
    due_date: "",
    priority: "2",
    assigned_consultant_id: UNASSIGNED_CONSULTANT,
    notify_client: true,
  });

  const accessibleClientIdsKey = accessibleClientIds?.join(",") ?? "all";
  const caseIdFromQuery = searchParams.get("caseId");
  const canManageCases = hasStaffPermission("can_manage_cases");
  const canAssignConsultants = canManageCases && !isConsultant;
  const canReplyMessages = hasStaffPermission("can_reply_messages");

  const { data: cases, isLoading } = useQuery({
    queryKey: ["staff-cases", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase
        .from("cases")
        .select("*, clients(company_name, first_name, last_name, client_code), assigned_consultant:profiles!cases_assigned_consultant_id_fkey(full_name, email)")
        .order("last_activity_at", { ascending: false });

      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }

      const { data } = await query;
      return (data ?? []) as CaseRecord[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: clients } = useQuery({
    queryKey: ["staff-case-clients", accessibleClientIdsKey],
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

  const { data: consultants } = useQuery({
    queryKey: ["staff-case-consultants"],
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

  const { data: riskClients } = useQuery({
    queryKey: ["staff-case-risk-clients", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase.from("clients").select("id, sars_outstanding_debt, returns_filed");
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("id", accessibleClientIds);
      }
      const { data } = await query;
      return data ?? [];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: riskInvoices } = useQuery({
    queryKey: ["staff-case-risk-invoices", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase.from("invoices").select("client_id, status, balance_due");
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }
      const { data } = await query;
      return data ?? [];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: riskRequests } = useQuery({
    queryKey: ["staff-case-risk-document-requests", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase.from("document_requests").select("client_id, is_required, is_fulfilled");
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }
      const { data } = await query;
      return data ?? [];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: selectedCaseConversations } = useQuery({
    queryKey: ["staff-case-conversations", selectedCaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("case_id", selectedCaseId!)
        .order("last_message_at", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ConversationRecord[];
    },
    enabled: !!selectedCaseId,
  });

  const selectedCaseConversationIds = (selectedCaseConversations ?? []).map((conversation) => conversation.id);
  const primaryCaseConversationId = selectedCaseConversations?.[0]?.id ?? "";

  const { data: selectedCaseMessages } = useQuery({
    queryKey: ["staff-case-messages", selectedCaseConversationIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", selectedCaseConversationIds)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as MessageRecord[];
    },
    enabled: selectedCaseConversationIds.length > 0,
  });

  const caseMessageAttachmentIds = useMemo(
    () =>
      Array.from(
        new Set(
          (selectedCaseMessages ?? [])
            .map((message) => message.attachment_document_id)
            .filter(Boolean),
        ),
      ) as string[],
    [selectedCaseMessages],
  );

  const { data: caseMessageAttachments } = useQuery({
    queryKey: ["staff-case-message-attachments", caseMessageAttachmentIds],
    queryFn: async () => {
      if (!caseMessageAttachmentIds.length) return [];

      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, file_path")
        .in("id", caseMessageAttachmentIds);

      if (error) throw error;
      return data ?? [];
    },
    enabled: caseMessageAttachmentIds.length > 0,
  });

  const { data: selectedCaseChangeRequests } = useQuery({
    queryKey: ["staff-case-change-requests", selectedCaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_change_requests")
        .select("*")
        .eq("case_id", selectedCaseId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as PractitionerChangeRequestRecord[];
    },
    enabled: !!selectedCaseId,
  });

  const clientOptions = useMemo(
    () =>
      (clients ?? []).map((client) => ({
        id: client.id,
        label: client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || client.client_code || "Client",
        clientCode: client.client_code,
      })),
    [clients],
  );

  const clientOptionMap = useMemo(
    () => new Map(clientOptions.map((client) => [client.id, client])),
    [clientOptions],
  );

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

  const clientIssueMap = useMemo(() => {
    const riskClientsById = new Map((riskClients ?? []).map((client) => [client.id, client]));
    const outstandingInvoicesByClient = new Map<string, number>();
    const outstandingRequestsByClient = new Map<string, number>();

    for (const invoice of riskInvoices ?? []) {
      const isOutstanding = ["issued", "partially_paid", "overdue"].includes(invoice.status) && Number(invoice.balance_due || 0) > 0;
      if (!isOutstanding) continue;
      outstandingInvoicesByClient.set(invoice.client_id, (outstandingInvoicesByClient.get(invoice.client_id) ?? 0) + 1);
    }

    for (const request of riskRequests ?? []) {
      const isOutstanding = request.is_required && !request.is_fulfilled;
      if (!isOutstanding) continue;
      outstandingRequestsByClient.set(request.client_id, (outstandingRequestsByClient.get(request.client_id) ?? 0) + 1);
    }

    const map = new Map<string, ReturnType<typeof getClientWarningSummary>>();
    for (const [clientId, client] of riskClientsById.entries()) {
      map.set(
        clientId,
        getClientWarningSummary(client, {
          outstandingInvoices: outstandingInvoicesByClient.get(clientId) ?? 0,
          outstandingDocumentRequests: outstandingRequestsByClient.get(clientId) ?? 0,
        }),
      );
    }

    return map;
  }, [riskClients, riskInvoices, riskRequests]);

  const filteredCases = useMemo(() => {
    const scopedCases = (cases ?? []).filter((caseItem) =>
      caseView === "active" ? !caseItem.is_archived : caseItem.is_archived,
    );

    if (priorityFilter === "all") {
      return scopedCases;
    }

    const targetPriority = priorityFilter === "high" ? 1 : priorityFilter === "medium" ? 2 : 3;
    return scopedCases.filter((caseItem) => caseItem.priority === targetPriority);
  }, [caseView, cases, priorityFilter]);

  const selectedCase = filteredCases.find((caseItem) => caseItem.id === selectedCaseId)
    || cases?.find((caseItem) => caseItem.id === selectedCaseId)
    || null;
  const selectedCaseChangeRequest = selectedCaseChangeRequests?.[0] ?? null;
  const caseAttachmentMap = useMemo(
    () => new Map((caseMessageAttachments ?? []).map((document) => [document.id, document])),
    [caseMessageAttachments],
  );

  const canArchiveSelectedCase = canManageCases && Boolean(selectedCase);

  useEffect(() => {
    if (!caseIdFromQuery || !(cases ?? []).some((caseItem) => caseItem.id === caseIdFromQuery)) {
      return;
    }

    setSelectedCaseId(caseIdFromQuery);
  }, [caseIdFromQuery, cases]);

  useEffect(() => {
    setCaseArchiveReason(selectedCase?.archive_reason || "inactive");
    setCaseArchiveNotes(selectedCase?.archive_notes || "");
  }, [selectedCase?.archive_notes, selectedCase?.archive_reason]);

  useEffect(() => {
    setChangeRequestResponse(selectedCaseChangeRequest?.practitioner_response || "");
    setAdminChangeDecisionNote(selectedCaseChangeRequest?.admin_response || "");
  }, [selectedCaseChangeRequest?.admin_response, selectedCaseChangeRequest?.practitioner_response]);

  const handleCaseAttachmentChange = (file: File | null) => {
    if (!file) {
      setCaseAttachmentFile(null);
      return;
    }

    try {
      assertValidChatAttachment(file);
      setCaseAttachmentFile(file);
    } catch (error) {
      if (caseAttachmentInputRef.current) {
        caseAttachmentInputRef.current.value = "";
      }
      toast.error(error instanceof Error ? error.message : "Unable to attach this file.");
    }
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

  const updateStatus = async (caseId: string, status: Enums<"case_status">) => {
    if (!canManageCases) {
      toast.error("This consultant profile cannot update case statuses.");
      return;
    }

    const currentCase = cases?.find((caseItem) => caseItem.id === caseId);

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

    const matchingClient = (clients ?? []).find((client) => client.id === currentCase.client_id) as {
      id: string;
      profile_id?: string | null;
      company_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      client_code?: string | null;
      profiles?: { full_name?: string | null; email?: string | null } | null;
    } | undefined;

    let notified = false;

    if (matchingClient?.profile_id) {
      const notification = await sendCaseStatusChangedNotification({
        caseId,
        clientProfileId: matchingClient.profile_id,
        clientEmail: matchingClient.profiles?.email,
        clientName:
          matchingClient.company_name
          || matchingClient.profiles?.full_name
          || [matchingClient.first_name, matchingClient.last_name].filter(Boolean).join(" ")
          || matchingClient.client_code
          || "Client",
        serviceType: currentCase.case_type,
        previousStatus: currentCase.status,
        newStatus: status,
        updatedAt: data?.updated_at,
      });

      if (notification.error) {
        console.error("Case status email failed:", notification.error);
        toast.error("Case status updated, but the client email notification could not be delivered.");
      } else {
        notified = !notification.skipped;
      }
    }

    toast.success(notified ? "Status updated and client notified." : "Status updated");
    if (user && role) {
      await logSystemActivity({
        actorProfileId: user.id,
        actorRole: role,
        action: "case_status_updated",
        targetType: "case",
        targetId: caseId,
        metadata: {
          previousStatus: currentCase.status,
          newStatus: status,
        },
      });
    }
    queryClient.invalidateQueries({ queryKey: ["staff-cases"] });
  };

  const updateAssignedConsultant = async (caseItem: CaseRecord, consultantId: string | null) => {
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

    const clientName = caseItem.clients?.company_name
      || [caseItem.clients?.first_name, caseItem.clients?.last_name].filter(Boolean).join(" ")
      || caseItem.clients?.client_code
      || "Client";

    let notified = false;

    if (consultantId) {
      notified = await notifyAssignedConsultant({
        caseId: caseItem.id,
        consultantId,
        clientName,
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
    if (user && role) {
      await logSystemActivity({
        actorProfileId: user.id,
        actorRole: role,
        action: "case_assignment_updated",
        targetType: "case",
        targetId: caseItem.id,
        metadata: {
          assignedConsultantId: consultantId,
        },
      });
    }
    queryClient.invalidateQueries({ queryKey: ["staff-cases"] });
  };

  const createCase = async () => {
    if (!canManageCases) {
      toast.error("This consultant profile cannot create cases.");
      return;
    }

    if (!form.client_id || !form.case_title.trim()) {
      toast.error("Select a client and enter a case title.");
      return;
    }

    setCreating(true);

    const payload: TablesInsert<"cases"> = {
      client_id: form.client_id,
      case_title: form.case_title.trim(),
      case_type: form.case_type,
      description: form.description.trim() || null,
      priority: Number(form.priority),
      created_by: user?.id ?? null,
      assigned_consultant_id: isConsultant ? user?.id ?? null : form.assigned_consultant_id === UNASSIGNED_CONSULTANT ? null : form.assigned_consultant_id,
      due_date: form.due_date ? new Date(`${form.due_date}T12:00:00`).toISOString() : null,
    };

    const { data, error } = await supabase.from("cases").insert(payload).select("id, created_at").single();

    if (error) {
      toast.error(error.message);
      setCreating(false);
      return;
    }

    const assignedConsultantId = payload.assigned_consultant_id;
    let notified = false;
    let clientNotified = false;
    const selectedClient = (clients ?? []).find((client) => client.id === form.client_id);

    if (assignedConsultantId && data?.id) {
      notified = await notifyAssignedConsultant({
        caseId: data.id,
        consultantId: assignedConsultantId,
        clientName: clientOptionMap.get(form.client_id)?.label || "Client",
        caseType: form.case_type,
        priority: Number(form.priority),
      });
    }

    if (form.notify_client && selectedClient?.profile_id && data?.id) {
      const clientNotification = await sendCaseCreatedNotification({
        caseId: data.id,
        clientProfileId: selectedClient.profile_id,
        clientEmail: selectedClient.profiles?.email,
        clientName: clientOptionMap.get(form.client_id)?.label || "Client",
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
          : "Case created",
    );
    setForm({
      client_id: "",
      case_title: "",
      case_type: "individual_tax_return",
      description: "",
      due_date: "",
      priority: "2",
      assigned_consultant_id: UNASSIGNED_CONSULTANT,
      notify_client: true,
    });
    setCreating(false);
    setIsCreateModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["staff-cases"] });
  };

  const sendCaseReply = async () => {
    if (!canReplyMessages) {
      toast.error("This staff profile cannot reply to case messages.");
      return;
    }

    if (!selectedCase || !user || (!caseReply.trim() && !caseAttachmentFile)) {
      return;
    }

    setSendingCaseReply(true);

    try {
      let attachmentDocumentId: string | null = null;
      let conversationId = primaryCaseConversationId;

      if (!conversationId) {
        const { data: conversation, error: conversationError } = await supabase
          .from("conversations")
          .insert({
            client_id: selectedCase.client_id,
            case_id: selectedCase.id,
            subject: `${selectedCase.case_title} - ${selectedCase.case_type.replace(/_/g, " ")}`,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (conversationError || !conversation) {
          throw new Error(conversationError?.message || "Unable to start the case conversation.");
        }

        conversationId = conversation.id;
      }

      if (caseAttachmentFile) {
        const uploadedDocument = await uploadChatAttachment({
          file: caseAttachmentFile,
          uploadedBy: user.id,
          clientId: selectedCase.client_id,
          caseId: selectedCase.id,
          recipientProfileId: null,
          title: `Case Attachment - ${caseAttachmentFile.name}`,
        });
        attachmentDocumentId = uploadedDocument.id;
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_profile_id: user.id,
        sender_type: role === "consultant" ? "consultant" : "admin",
        message_text: caseReply.trim() || `Sent an attachment: ${caseAttachmentFile?.name || "File"}`,
        attachment_document_id: attachmentDocumentId,
      });

      if (error) {
        throw error;
      }

      setCaseReply("");
      setCaseAttachmentFile(null);
      if (caseAttachmentInputRef.current) {
        caseAttachmentInputRef.current.value = "";
      }
        toast.success("Case message sent.");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["staff-case-conversations", selectedCase.id] }),
          queryClient.invalidateQueries({ queryKey: ["staff-case-messages"] }),
          queryClient.invalidateQueries({ queryKey: ["staff-conversations"] }),
          queryClient.invalidateQueries({ queryKey: ["staff-messages"] }),
          queryClient.invalidateQueries({ queryKey: ["sidebar-unread-messages"] }),
          queryClient.invalidateQueries({ queryKey: ["staff-documents"] }),
          queryClient.invalidateQueries({ queryKey: ["documents", selectedCase.client_id] }),
        ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send this case message.");
    } finally {
      setSendingCaseReply(false);
    }
  };

  const archiveCase = async () => {
    if (!selectedCase || !canManageCases) {
      toast.error("This consultant profile cannot archive this case.");
      return;
    }

    setArchivingCaseId(selectedCase.id);
    const { error } = await supabase
      .from("cases")
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by: user?.id ?? null,
        archive_reason: caseArchiveReason,
        archive_notes: caseArchiveNotes.trim() || null,
      })
      .eq("id", selectedCase.id);
    setArchivingCaseId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Case archived.");
    await queryClient.invalidateQueries({ queryKey: ["staff-cases"] });
  };

  const restoreCase = async () => {
    if (!selectedCase || !canManageCases) {
      toast.error("This consultant profile cannot restore this case.");
      return;
    }

    setArchivingCaseId(selectedCase.id);
    const { error } = await supabase
      .from("cases")
      .update({
        is_archived: false,
        archived_at: null,
        archived_by: null,
        archive_reason: null,
        archive_notes: null,
      })
      .eq("id", selectedCase.id);
    setArchivingCaseId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Case restored.");
    await queryClient.invalidateQueries({ queryKey: ["staff-cases"] });
  };

  const submitChangeRequestResponse = async () => {
    if (!selectedCaseChangeRequest) {
      return;
    }

    setSubmittingChangeResponseId(selectedCaseChangeRequest.id);
    const { error } = await supabase.rpc("submit_practitioner_change_response", {
      p_change_request_id: selectedCaseChangeRequest.id,
      p_response: changeRequestResponse.trim(),
    });
    setSubmittingChangeResponseId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Your response was sent to admin for review.");
    await queryClient.invalidateQueries({ queryKey: ["staff-case-change-requests", selectedCaseId] });
  };

  const reviewChangeRequest = async (decision: "approved" | "rejected") => {
    if (!selectedCaseChangeRequest) {
      return;
    }

    setReviewingChangeRequestId(selectedCaseChangeRequest.id);
    const { error } = await supabase.rpc("review_practitioner_change_request", {
      p_change_request_id: selectedCaseChangeRequest.id,
      p_decision: decision,
      p_admin_response: adminChangeDecisionNote.trim() || null,
    });
    setReviewingChangeRequestId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(decision === "approved" ? "Change request approved." : "Change request rejected.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-case-change-requests", selectedCaseId] }),
      queryClient.invalidateQueries({ queryKey: ["staff-cases"] }),
    ]);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-700";
      case "in_progress": return "bg-yellow-100 text-yellow-700";
      case "under_review": return "bg-purple-100 text-purple-700";
      case "awaiting_client_documents": return "bg-orange-100 text-orange-700";
      case "awaiting_sars_response": return "bg-sky-100 text-sky-700";
      case "resolved": return "bg-green-100 text-green-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">All Cases</h1>
          <p className="text-muted-foreground font-body text-sm">
            {hasRestrictedClientScope ? "Manage case progress for assigned client accounts only." : "Manage case progress across all clients"}
          </p>
        </div>
        {canManageCases ? (
          <Button className="rounded-xl" onClick={() => setIsCreateModalOpen(true)}>
            Create Case
          </Button>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant={caseView === "active" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setCaseView("active")}
        >
          Active Cases
        </Button>
        <Button
          type="button"
          size="sm"
          variant={caseView === "archived" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setCaseView("archived")}
        >
          Archived Cases
        </Button>
      </div>

      {isLoading || isLoadingAccessibleClientIds ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-body">Priority</span>
            <Button
              type="button"
              size="sm"
              variant={priorityFilter === "all" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setPriorityFilter("all")}
            >
              All
            </Button>
            <Button
              type="button"
              size="sm"
              variant={priorityFilter === "high" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setPriorityFilter("high")}
            >
              🔴 High
            </Button>
            <Button
              type="button"
              size="sm"
              variant={priorityFilter === "medium" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setPriorityFilter("medium")}
            >
              🟡 Medium
            </Button>
            <Button
              type="button"
              size="sm"
              variant={priorityFilter === "low" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setPriorityFilter("low")}
            >
              🟢 Low
            </Button>
          </div>

          {filteredCases?.map((caseItem) => (
            <div key={caseItem.id} className="bg-card rounded-xl border border-border shadow-card p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">{caseItem.case_title}</h3>
                  <p className="text-sm text-muted-foreground font-body">
                    {caseItem.clients?.company_name || [caseItem.clients?.first_name, caseItem.clients?.last_name].filter(Boolean).join(" ") || "Client"} | {caseItem.case_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-muted-foreground font-body mt-1">
                    Created: {new Date(caseItem.created_at).toLocaleString()}
                    {caseItem.due_date ? ` | Due: ${new Date(caseItem.due_date).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className={statusColor(caseItem.status)}>
                  {caseItem.status.replace(/_/g, " ")}
                </Badge>
              </div>
              {caseItem.is_archived ? (
                <div className="mb-3 inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                  Archived{caseItem.archive_reason ? ` · ${caseItem.archive_reason}` : ""}
                </div>
              ) : null}
              {caseItem.description && <p className="text-sm text-muted-foreground font-body mb-4">{caseItem.description}</p>}
              {clientIssueMap.get(caseItem.client_id)?.hasIssues ? (
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {clientIssueMap.get(caseItem.client_id)?.reasons.join(" • ")}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-muted-foreground font-body">
                  {caseItem.clients?.client_code ? `Client code: ${caseItem.clients.client_code}` : "No client code"}
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setSelectedCaseId(caseItem.id)}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Open Case
                  </Button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-body">Update status:</span>
                    {canManageCases ? (
                      <Select value={caseItem.status} onValueChange={(value) => updateStatus(caseItem.id, value as Enums<"case_status">)}>
                        <SelectTrigger className="w-56 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                        View only
                      </span>
                    )}
                  </div>

                  {canAssignConsultants ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-body">Consultant:</span>
                      <Select
                        value={caseItem.assigned_consultant_id ?? UNASSIGNED_CONSULTANT}
                        onValueChange={(value) => updateAssignedConsultant(caseItem, value === UNASSIGNED_CONSULTANT ? null : value)}
                      >
                        <SelectTrigger className="w-60 h-8 text-xs">
                          <SelectValue placeholder="Assign consultant" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED_CONSULTANT}>Unassigned</SelectItem>
                          {consultantOptions.map((consultant) => (
                            <SelectItem key={consultant.id} value={consultant.id}>
                              {consultant.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : caseItem.assigned_consultant ? (
                    <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                      {caseItem.assigned_consultant.full_name || caseItem.assigned_consultant.email}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <DashboardItemDialog
        open={Boolean(selectedCase)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCaseId(null);
            setCaseReply("");
            if (caseIdFromQuery) {
              const next = new URLSearchParams(searchParams);
              next.delete("caseId");
              setSearchParams(next, { replace: true });
            }
          }
        }}
        title={selectedCase?.case_title || "Case"}
        description={selectedCase ? "Review this case and keep all related communication inside this case thread." : undefined}
      >
        {selectedCase ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Case Details</p>
                <p className="mt-2 text-sm font-semibold text-foreground font-body">{selectedCase.case_type.replace(/_/g, " ")}</p>
                <p className="mt-1 text-sm text-muted-foreground font-body">
                  Status: {selectedCase.status.replace(/_/g, " ")}
                  {selectedCase.due_date ? ` | Due ${new Date(selectedCase.due_date).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Client</p>
                <p className="mt-2 text-sm font-semibold text-foreground font-body">
                  {selectedCase.clients?.company_name || [selectedCase.clients?.first_name, selectedCase.clients?.last_name].filter(Boolean).join(" ") || selectedCase.clients?.client_code || "Client"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground font-body">
                  Assigned practitioner: {selectedCase.assigned_consultant?.full_name || selectedCase.assigned_consultant?.email || "Unassigned"}
                </p>
              </div>
            </div>

            {selectedCase.description ? (
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Description</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground font-body">{selectedCase.description}</p>
              </div>
            ) : null}

            {selectedCaseChangeRequest ? (
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-3">Practitioner Change Request</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-accent/20 p-3">
                    <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Status</p>
                    <p className="text-sm text-foreground font-body">{selectedCaseChangeRequest.status.replace(/_/g, " ")}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-accent/20 p-3">
                    <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Requested</p>
                    <p className="text-sm text-foreground font-body">{new Date(selectedCaseChangeRequest.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-accent/20 p-3">
                    <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Client Reason</p>
                    <p className="text-sm text-foreground font-body">{selectedCaseChangeRequest.reason || "No reason provided."}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-accent/20 p-3">
                    <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Practitioner Response</p>
                    <p className="text-sm text-foreground font-body">{selectedCaseChangeRequest.practitioner_response || "No practitioner response yet."}</p>
                  </div>
                </div>

                {role === "consultant"
                && user?.id === selectedCaseChangeRequest.current_practitioner_profile_id
                && selectedCaseChangeRequest.status === "pending" ? (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-semibold text-foreground font-body">Your response for admin</label>
                    <Textarea
                      value={changeRequestResponse}
                      onChange={(event) => setChangeRequestResponse(event.target.value)}
                      placeholder="Share your response or explanation for admin review."
                      className="min-h-[110px] rounded-xl"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        className="rounded-xl"
                        onClick={submitChangeRequestResponse}
                        disabled={submittingChangeResponseId === selectedCaseChangeRequest.id || !changeRequestResponse.trim()}
                      >
                        {submittingChangeResponseId === selectedCaseChangeRequest.id ? "Submitting..." : "Submit Response"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {role === "admin" && selectedCaseChangeRequest.status === "pending" ? (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-semibold text-foreground font-body">Admin decision notes</label>
                    <Textarea
                      value={adminChangeDecisionNote}
                      onChange={(event) => setAdminChangeDecisionNote(event.target.value)}
                      placeholder="Optional notes for the final decision."
                      className="min-h-[110px] rounded-xl"
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => void reviewChangeRequest("rejected")}
                        disabled={reviewingChangeRequestId === selectedCaseChangeRequest.id}
                      >
                        {reviewingChangeRequestId === selectedCaseChangeRequest.id ? "Saving..." : "Reject Request"}
                      </Button>
                      <Button
                        type="button"
                        className="rounded-xl"
                        onClick={() => void reviewChangeRequest("approved")}
                        disabled={reviewingChangeRequestId === selectedCaseChangeRequest.id}
                      >
                        {reviewingChangeRequestId === selectedCaseChangeRequest.id ? "Saving..." : "Approve Request"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {canArchiveSelectedCase ? (
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-3">Case Archive Controls</p>
                {selectedCase.is_archived ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground font-body">
                      This case is archived and hidden from the active case list.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-border bg-accent/20 p-3">
                        <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Archive Reason</p>
                        <p className="text-sm text-foreground font-body">{selectedCase.archive_reason || "Not provided"}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-accent/20 p-3">
                        <p className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Archive Notes</p>
                        <p className="text-sm text-foreground font-body">{selectedCase.archive_notes || "No notes added."}</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={restoreCase}
                        disabled={archivingCaseId === selectedCase.id}
                      >
                        {archivingCaseId === selectedCase.id ? "Restoring..." : "Restore Case"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground font-body">Archive Reason</label>
                      <Select value={caseArchiveReason} onValueChange={setCaseArchiveReason}>
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="duplicate">Duplicate</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground font-body">Archive Notes</label>
                      <Textarea
                        value={caseArchiveNotes}
                        onChange={(event) => setCaseArchiveNotes(event.target.value)}
                        placeholder="Optional notes for why this case was archived."
                        className="min-h-[96px] rounded-xl"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={archiveCase}
                        disabled={archivingCaseId === selectedCase.id}
                      >
                        {archivingCaseId === selectedCase.id ? "Archiving..." : "Archive Case"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Case Messages</p>
                <p className="mt-1 text-sm text-muted-foreground font-body">
                  Only communication linked to this case appears here.
                </p>
              </div>
              <div className="max-h-[380px] space-y-3 overflow-y-auto p-4">
                {selectedCaseMessages?.length ? (
                  selectedCaseMessages.map((message) => {
                    const isOwnMessage = message.sender_profile_id === user?.id;

                    return (
                      <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[84%] rounded-3xl px-4 py-3 ${
                          isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        }`}>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-75">
                            {isOwnMessage
                              ? "You"
                              : message.sender_type === "client"
                                ? "Client"
                                : message.sender_type === "consultant"
                                  ? "Practitioner"
                                  : "Admin"}
                          </p>
                          <p className="whitespace-pre-wrap text-sm font-body">{message.message_text}</p>
                          {message.attachment_document_id && caseAttachmentMap.get(message.attachment_document_id) ? (
                            <button
                              type="button"
                              className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                isOwnMessage ? "bg-white/15 text-primary-foreground" : "bg-card text-foreground"
                              }`}
                              onClick={() => {
                                const attachment = caseAttachmentMap.get(message.attachment_document_id!);
                                if (!attachment) return;
                                setOpeningAttachmentId(message.id);
                                void openChatAttachment(attachment.file_path)
                                  .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to open attachment."))
                                  .finally(() => setOpeningAttachmentId(null));
                              }}
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              {openingAttachmentId === message.id ? "Opening..." : caseAttachmentMap.get(message.attachment_document_id)?.file_name}
                            </button>
                          ) : null}
                          <p className={`mt-3 text-xs ${isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {new Date(message.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground font-body">
                    No messages on this case yet. Start the case-specific thread below.
                  </p>
                )}
              </div>
              <div className="border-t border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    ref={caseAttachmentInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => handleCaseAttachmentChange(event.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl shrink-0"
                    onClick={() => caseAttachmentInputRef.current?.click()}
                    disabled={!canReplyMessages}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={caseReply}
                    onChange={(event) => setCaseReply(event.target.value)}
                    placeholder="Reply inside this case..."
                    className="flex-1 rounded-xl"
                    disabled={!canReplyMessages}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendCaseReply();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    className="rounded-xl"
                    onClick={() => void sendCaseReply()}
                    disabled={!canReplyMessages || sendingCaseReply || (!caseReply.trim() && !caseAttachmentFile)}
                  >
                    <SendHorizonal className="mr-2 h-4 w-4" />
                    {sendingCaseReply ? "Sending..." : "Send"}
                  </Button>
                </div>
                {caseAttachmentFile ? (
                  <p className="mt-2 text-xs text-muted-foreground font-body">
                    Attached: {caseAttachmentFile.name} ({Math.max(1, Math.round(caseAttachmentFile.size / 1024))} KB)
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground font-body">
                    You can send a message, a file, or both. Maximum file size: 10 MB.
                  </p>
                )}
                {!canReplyMessages ? (
                  <p className="mt-2 text-xs text-muted-foreground font-body">
                    This staff profile can view case communication but cannot reply.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>

      <DashboardItemDialog
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Create Case"
        description="Open a new tax or SARS case for a client from the staff workspace."
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Client</label>
            <Select value={form.client_id} onValueChange={(value) => setForm((current) => ({ ...current, client_id: value }))}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clientOptions.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.label}{client.clientCode ? ` (${client.clientCode})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Case Title</label>
            <Input
              value={form.case_title}
              onChange={(event) => setForm((current) => ({ ...current, case_title: event.target.value }))}
              placeholder="Example: 2026 Individual Tax Return"
              className="rounded-xl"
            />
          </div>

          {canAssignConsultants ? (
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Assigned Consultant</label>
              <Select
                value={form.assigned_consultant_id}
                onValueChange={(value) => setForm((current) => ({ ...current, assigned_consultant_id: value }))}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Assign consultant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_CONSULTANT}>Unassigned</SelectItem>
                  {consultantOptions.map((consultant) => (
                    <SelectItem key={consultant.id} value={consultant.id}>
                      {consultant.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Case Type</label>
              <Select value={form.case_type} onValueChange={(value) => setForm((current) => ({ ...current, case_type: value as Enums<"case_type"> }))}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {caseTypeOptions.map((caseType) => (
                    <SelectItem key={caseType} value={caseType}>
                      {caseType.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Priority</label>
              <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}>
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

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Due Date</label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Description</label>
            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Add the client need, SARS issue, or service details."
              className="rounded-xl"
            />
          </div>

          <div className="rounded-2xl border border-border bg-accent/20 p-4">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={form.notify_client}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, notify_client: checked === true }))}
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
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsCreateModalOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={createCase} disabled={creating}>
              {creating ? "Creating..." : "Create Case"}
            </Button>
          </div>
        </div>
      </DashboardItemDialog>
    </div>
  );
}
