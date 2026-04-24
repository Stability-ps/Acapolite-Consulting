import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useClientRecord } from "@/hooks/useClientRecord";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { RatingStars } from "@/components/dashboard/RatingStars";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { formatCaseReference } from "@/lib/practitionerAssignments";
import { useNotificationSectionRead } from "@/hooks/useNotificationSectionRead";

const caseTypeOptions = [
  "individual_tax_return",
  "corporate_tax_return",
  "vat_registration",
  "provisional_tax",
  "tax_clearance_certificate",
  "sars_dispute_objection",
  "other",
] as const;

type CaseRecord = Tables<"cases"> & {
  assigned_consultant: Pick<Tables<"profiles">, "full_name" | "email"> | null;
};

type PractitionerReview = Tables<"practitioner_reviews">;

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

async function uploadRequestFile(file: File, userId: string, clientId: string) {
  const safeFileName = sanitizeFileName(file.name);
  const uniqueFileName = `${Date.now()}-${safeFileName}`;
  const candidatePaths = [
    `${userId}/${clientId}/case-requests/${uniqueFileName}`,
    `${clientId}/case-requests/${uniqueFileName}`,
  ];

  let lastError: string | null = null;

  for (const filePath of candidatePaths) {
    const { error } = await supabase.storage
      .from("documents")
      .upload(filePath, file, {
        upsert: false,
      });

    if (!error) {
      return filePath;
    }

    lastError = error.message;
  }

  throw new Error(lastError ?? "Unable to upload attachment.");
}

function extractRequestTitle(subject?: string | null) {
  if (!subject) return "New Case Request";
  return subject.replace(/^New Case Request:\s*/i, "");
}

function parseRequestMessage(messageText?: string | null) {
  const lines = (messageText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title =
    lines
      .find((line) => line.startsWith("Title:"))
      ?.replace("Title:", "")
      .trim() || "";
  const type =
    lines
      .find((line) => line.startsWith("Type:"))
      ?.replace("Type:", "")
      .trim() || "";
  const description =
    lines
      .find((line) => line.startsWith("Description:"))
      ?.replace("Description:", "")
      .trim() || "";
  const attachment =
    lines
      .find((line) => line.startsWith("Attachment:"))
      ?.replace("Attachment:", "")
      .trim() || "";

  return { title, type, description, attachment };
}

export default function Cases() {
  useNotificationSectionRead("cases");
  const { user } = useAuth();
  const { data: client } = useClientRecord();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [isRequestCaseOpen, setIsRequestCaseOpen] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [caseReply, setCaseReply] = useState("");
  const [sendingCaseReply, setSendingCaseReply] = useState(false);
  const [requestForm, setRequestForm] = useState({
    case_title: "",
    case_type: "individual_tax_return",
    description: "",
  });

  const { data: cases, isLoading } = useQuery({
    queryKey: ["cases", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "*, assigned_consultant:profiles!cases_assigned_consultant_id_fkey(full_name, email)",
        )
        .eq("client_id", client!.id)
        .order("last_activity_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as CaseRecord[];
    },
    enabled: !!client,
  });

  const { data: requestConversations } = useQuery({
    queryKey: ["case-requests", client?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("client_id", client!.id)
        .like("subject", "New Case Request:%")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!client,
  });

  const { data: selectedRequestMessages } = useQuery({
    queryKey: ["case-request-messages", selectedRequestId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedRequestId!)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!selectedRequestId,
  });

  const { data: selectedReview } = useQuery({
    queryKey: ["case-practitioner-review", client?.id, selectedCaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_reviews")
        .select("*")
        .eq("client_id", client!.id)
        .eq("case_id", selectedCaseId!)
        .maybeSingle();

      if (error) throw error;
      return data as PractitionerReview | null;
    },
    enabled: !!client && !!selectedCaseId,
  });

  const { data: selectedCaseConversations } = useQuery({
    queryKey: ["case-conversations", selectedCaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("case_id", selectedCaseId!)
        .order("last_message_at", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedCaseId,
  });

  const selectedCaseConversationIds = (selectedCaseConversations ?? []).map(
    (conversation) => conversation.id,
  );
  const primaryCaseConversationId = selectedCaseConversations?.[0]?.id ?? "";

  const { data: selectedCaseMessages } = useQuery({
    queryKey: ["case-messages", selectedCaseConversationIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", selectedCaseConversationIds)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: selectedCaseConversationIds.length > 0,
  });

  const selectedCase =
    cases?.find((caseItem) => caseItem.id === selectedCaseId) ?? null;
  const caseIdFromQuery = searchParams.get("caseId");
  const selectedRequest =
    requestConversations?.find((request) => request.id === selectedRequestId) ??
    null;
  const requestSummary = parseRequestMessage(
    selectedRequestMessages?.[0]?.message_text,
  );
  const canReviewSelectedCase = Boolean(
    selectedCase?.assigned_consultant_id &&
    selectedCase &&
    ["resolved", "closed"].includes(selectedCase.status),
  );

  useEffect(() => {
    if (!caseIdFromQuery || !(cases ?? []).some((caseItem) => caseItem.id === caseIdFromQuery)) {
      return;
    }

    setSelectedCaseId(caseIdFromQuery);
  }, [caseIdFromQuery, cases]);

  useEffect(() => {
    if (!selectedReview) {
      setReviewRating(5);
      setReviewText("");
      return;
    }

    setReviewRating(selectedReview.rating);
    setReviewText(selectedReview.review_text || "");
  }, [selectedReview, selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId || !selectedCaseMessages?.length) return;

    const markMessagesAsRead = async () => {
      const unreadIncomingMessages = selectedCaseMessages.filter(
        (message) =>
          message.sender_profile_id !== user?.id &&
          ["admin", "consultant"].includes(message.sender_type) &&
          !message.is_read,
      );

      if (!unreadIncomingMessages.length) return;

      const unreadIds = unreadIncomingMessages.map((message) => message.id);

      const { error } = await supabase
        .from("messages")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .in("id", unreadIds);

      if (!error) {
        queryClient.invalidateQueries({
          queryKey: ["case-messages", selectedCaseConversationIds],
        });
        queryClient.invalidateQueries({ queryKey: ["client-unread-messages"] });
        queryClient.invalidateQueries({
          queryKey: ["sidebar-unread-messages"],
        });
      }
    };

    void markMessagesAsRead();
  }, [
    queryClient,
    selectedCaseConversationIds,
    selectedCaseId,
    selectedCaseMessages,
    user?.id,
  ]);

  const resetRequestForm = () => {
    setRequestForm({
      case_title: "",
      case_type: "individual_tax_return",
      description: "",
    });
    setAttachmentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "in_progress":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "under_review":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "awaiting_client_documents":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "awaiting_sars_response":
        return "bg-sky-100 text-sky-700 border-sky-200";
      case "resolved":
        return "bg-green-100 text-green-700 border-green-200";
      case "closed":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const submitCaseRequest = async () => {
    if (!client || !user) {
      toast.error("Your account is not ready for case requests yet.");
      return;
    }

    if (!requestForm.case_title.trim() || !requestForm.description.trim()) {
      toast.error("Enter a case title and a short description.");
      return;
    }

    setSubmittingRequest(true);

    let uploadedDocumentId: string | null = null;
    let uploadedFilePath = "";

    try {
      if (attachmentFile) {
        uploadedFilePath = await uploadRequestFile(
          attachmentFile,
          user.id,
          client.id,
        );

        const { data: documentRow, error: documentError } = await supabase
          .from("documents")
          .insert({
            client_id: client.id,
            uploaded_by: user.id,
            sender_profile_id: user.id,
            recipient_profile_id: client.profile_id,
            visibility: "shared",
            title: `Case Request Attachment - ${requestForm.case_title.trim()}`,
            file_name: attachmentFile.name,
            file_path: uploadedFilePath,
            file_size: attachmentFile.size,
            mime_type: attachmentFile.type,
            category: "Case Request Attachment",
            status: "uploaded",
          })
          .select("id")
          .single();

        if (documentError || !documentRow) {
          if (uploadedFilePath) {
            await supabase.storage.from("documents").remove([uploadedFilePath]);
          }
          throw new Error(
            documentError?.message || "Unable to save the attachment.",
          );
        }

        uploadedDocumentId = documentRow.id;
      }

      const subject = `New Case Request: ${requestForm.case_title.trim()}`;

      const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .insert({
          client_id: client.id,
          subject,
          created_by: user.id,
        })
        .select("*")
        .single();

      if (conversationError || !conversation) {
        throw new Error(
          conversationError?.message || "Unable to create your request.",
        );
      }

      const requestMessage = [
        "New case request submitted by client.",
        `Title: ${requestForm.case_title.trim()}`,
        `Type: ${requestForm.case_type.replace(/_/g, " ")}`,
        `Description: ${requestForm.description.trim()}`,
        attachmentFile ? `Attachment: ${attachmentFile.name}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const { error: messageError } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_profile_id: user.id,
        sender_type: "client",
        message_text: requestMessage,
        attachment_document_id: uploadedDocumentId,
      });

      if (messageError) {
        throw new Error(messageError.message);
      }

      await queryClient.invalidateQueries({
        queryKey: ["case-requests", client.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["conversations", client.id],
      });
      setSubmittingRequest(false);
      setIsRequestCaseOpen(false);
      resetRequestForm();
      toast.success("Your new case request was sent to Acapolite.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to send your case request.";
      toast.error(message);
      setSubmittingRequest(false);
    }
  };

  const savePractitionerReview = async () => {
    if (
      !client ||
      !selectedCase?.assigned_consultant_id ||
      !canReviewSelectedCase
    ) {
      toast.error("This case is not ready for a practitioner review yet.");
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      toast.error("Please choose a rating between 1 and 5 stars.");
      return;
    }

    setSavingReview(true);

    const { error } = await supabase.from("practitioner_reviews").upsert(
      {
        id: selectedReview?.id,
        practitioner_profile_id: selectedCase.assigned_consultant_id,
        client_id: client.id,
        case_id: selectedCase.id,
        rating: reviewRating,
        review_text: reviewText.trim() || null,
      },
      { onConflict: "case_id" },
    );

    setSavingReview(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      selectedReview
        ? "Practitioner review updated."
        : "Practitioner review submitted.",
    );
    await queryClient.invalidateQueries({
      queryKey: ["case-practitioner-review", client.id, selectedCase.id],
    });
  };

  const sendCaseReply = async () => {
    if (!client || !user || !selectedCase || !caseReply.trim()) {
      return;
    }

    setSendingCaseReply(true);

    try {
      let conversationId = primaryCaseConversationId;

      if (!conversationId) {
        const { data: conversation, error: conversationError } = await supabase
          .from("conversations")
          .insert({
            client_id: client.id,
            case_id: selectedCase.id,
            subject: `${selectedCase.case_number} - ${selectedCase.case_title}`,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (conversationError || !conversation) {
          throw new Error(
            conversationError?.message ||
              "Unable to start the case conversation.",
          );
        }

        conversationId = conversation.id;
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_profile_id: user.id,
        sender_type: "client",
        message_text: caseReply.trim(),
      });

      if (error) {
        throw error;
      }

      setCaseReply("");
      toast.success("Case message sent.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["case-conversations", selectedCase.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["case-messages"] }),
        queryClient.invalidateQueries({ queryKey: ["messages"] }),
        queryClient.invalidateQueries({
          queryKey: ["conversations", client.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["cases", client.id] }),
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to send your case message.";
      toast.error(message);
    } finally {
      setSendingCaseReply(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">
            My Cases
          </h1>
          <p className="text-muted-foreground font-body text-sm">
            Track all your tax cases and submit new case requests to Acapolite.
          </p>
        </div>
        <Button
          className="rounded-xl"
          disabled={!client}
          onClick={() => setIsRequestCaseOpen(true)}
        >
          Request New Case
        </Button>
      </div>

      {!client ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">
            Your client record is not ready yet. Acapolite staff can complete it
            for you.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-4">
              <h2 className="font-display text-xl font-semibold text-foreground">
                Active Cases
              </h2>
              <p className="text-muted-foreground font-body text-sm">
                These are the formal cases already opened for your account.
              </p>
            </div>

            {isLoading ? (
              <div className="text-muted-foreground font-body">
                Loading cases...
              </div>
            ) : cases && cases.length > 0 ? (
              <div className="space-y-4">
                {cases.map((caseItem) => (
                  <button
                    key={caseItem.id}
                    type="button"
                    onClick={() => setSelectedCaseId(caseItem.id)}
                    className="w-full text-left bg-card rounded-xl border border-border shadow-card p-6 hover:shadow-elevated hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3 gap-4">
                      <div>
                        <h3 className="font-display text-lg font-semibold text-foreground">
                          {caseItem.case_title}
                        </h3>
                        <p className="text-sm text-muted-foreground font-body">
                          {caseItem.case_number}{" "}
                          {caseItem.sars_case_reference
                            ? `• SARS Ref: ${caseItem.sars_case_reference}`
                            : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={statusColor(caseItem.status)}
                      >
                        {caseItem.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    {caseItem.description && (
                      <p className="text-sm text-muted-foreground font-body mb-3">
                        {caseItem.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-body">
                      <span>Type: {caseItem.case_type.replace(/_/g, " ")}</span>
                      <span>Priority: {caseItem.priority}</span>
                      {caseItem.assigned_consultant ? (
                        <span>
                          Assigned:{" "}
                          {caseItem.assigned_consultant.full_name ||
                            caseItem.assigned_consultant.email}
                        </span>
                      ) : null}
                      <span>
                        Opened:{" "}
                        {new Date(caseItem.opened_at).toLocaleDateString()}
                      </span>
                      <span>
                        Last activity:{" "}
                        {new Date(
                          caseItem.last_activity_at,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border p-12 text-center">
                <p className="text-muted-foreground font-body">
                  No cases yet. Use `Request New Case` if you need Acapolite to
                  open one for you.
                </p>
              </div>
            )}
          </section>

          <section>
            <div className="mb-4">
              <h2 className="font-display text-xl font-semibold text-foreground">
                Requested Cases
              </h2>
              <p className="text-muted-foreground font-body text-sm">
                These are your submitted requests waiting for Acapolite to
                review and open.
              </p>
            </div>

            {requestConversations && requestConversations.length > 0 ? (
              <div className="space-y-3">
                {requestConversations.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedRequestId(request.id)}
                    className="w-full text-left bg-card rounded-xl border border-border shadow-card p-5 hover:shadow-elevated hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="font-display text-lg font-semibold text-foreground">
                          {extractRequestTitle(request.subject)}
                        </h3>
                        <p className="text-sm text-muted-foreground font-body">
                          Submitted{" "}
                          {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full font-body ${request.is_closed ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        {request.is_closed ? "Handled" : "Submitted"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-body">
                      Open this request to review the details and attachment you
                      sent.
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border p-12 text-center">
                <p className="text-muted-foreground font-body">
                  No requested cases yet.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      <DashboardItemDialog
        open={!!selectedCase}
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
        title={selectedCase?.case_title ?? "Case Details"}
        description="View the full case summary, updates, and messages for this case."
      >
        {selectedCase ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant="outline"
                className={statusColor(selectedCase.status)}
              >
                {selectedCase.status.replace(/_/g, " ")}
              </Badge>
              <span className="text-sm font-body text-muted-foreground">
                {selectedCase.case_type.replace(/_/g, " ")}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  Case Number
                </p>
                <p className="font-body text-foreground">
                  {selectedCase.case_number ||
                    formatCaseReference(selectedCase.id)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  SARS Reference
                </p>
                <p className="font-body text-foreground">
                  {selectedCase.sars_case_reference || "Not assigned yet"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  Assigned Practitioner
                </p>
                <p className="font-body text-foreground">
                  {selectedCase.assigned_consultant?.full_name ||
                    selectedCase.assigned_consultant?.email ||
                    "Not assigned yet"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  Priority
                </p>
                <p className="font-body text-foreground">
                  {selectedCase.priority}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  Opened
                </p>
                <p className="font-body text-foreground">
                  {new Date(selectedCase.opened_at).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  Due Date
                </p>
                <p className="font-body text-foreground">
                  {selectedCase.due_date
                    ? new Date(selectedCase.due_date).toLocaleDateString()
                    : "No due date set"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                Description
              </p>
              <div className="rounded-2xl border border-border p-4">
                <p className="font-body text-foreground">
                  {selectedCase.description ||
                    "No additional case description yet."}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                Case Communication
              </p>
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="max-h-[320px] space-y-4 overflow-y-auto p-4">
                  {selectedCaseMessages?.length ? (
                    selectedCaseMessages.map((message) => {
                      const isOwnMessage =
                        message.sender_profile_id === user?.id;

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[84%] rounded-3xl px-4 py-3 ${
                              isOwnMessage
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"
                            }`}
                          >
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-75">
                              {isOwnMessage
                                ? "You"
                                : message.sender_type === "consultant"
                                  ? "Practitioner"
                                  : "Acapolite"}
                            </p>
                            <p className="text-sm font-body whitespace-pre-wrap">
                              {message.message_text}
                            </p>
                            <p
                              className={`mt-3 text-xs ${isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                            >
                              {new Date(message.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground font-body">
                      No messages on this case yet. When Acapolite or your
                      practitioner updates this case, it will appear here.
                    </p>
                  )}
                </div>
                <div className="border-t border-border p-4">
                  <div className="flex gap-3">
                    <Input
                      value={caseReply}
                      onChange={(event) => setCaseReply(event.target.value)}
                      placeholder={`Reply on ${selectedCase.case_number || formatCaseReference(selectedCase.id)}...`}
                      className="flex-1 rounded-xl"
                      onKeyDown={(event) =>
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        sendCaseReply()
                      }
                    />
                    <Button
                      type="button"
                      className="rounded-xl"
                      onClick={sendCaseReply}
                      disabled={sendingCaseReply || !caseReply.trim()}
                    >
                      {sendingCaseReply ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {selectedCase.assigned_consultant_id ? (
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  Practitioner Review
                </p>
                <div className="rounded-2xl border border-border p-4 space-y-4">
                  {canReviewSelectedCase ? (
                    <>
                      <div>
                        <p className="font-body text-foreground">
                          Rate{" "}
                          {selectedCase.assigned_consultant?.full_name ||
                            "your practitioner"}{" "}
                          for this completed case.
                        </p>
                        <p className="text-sm text-muted-foreground font-body mt-1">
                          Your rating helps improve practitioner quality and
                          marketplace trust.
                        </p>
                      </div>

                      <RatingStars
                        value={reviewRating}
                        onChange={setReviewRating}
                      />

                      <Textarea
                        value={reviewText}
                        onChange={(event) => setReviewText(event.target.value)}
                        placeholder="Optional: share what went well or what could have been better."
                        className="rounded-xl"
                      />

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          className="rounded-xl"
                          onClick={savePractitionerReview}
                          disabled={savingReview}
                        >
                          {savingReview
                            ? "Saving..."
                            : selectedReview
                              ? "Update Review"
                              : "Submit Review"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground font-body">
                      Ratings open once the case has been resolved or closed.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DashboardItemDialog>

      <DashboardItemDialog
        open={!!selectedRequest}
        onOpenChange={(open) => {
          if (!open) setSelectedRequestId(null);
        }}
        title={
          selectedRequest
            ? extractRequestTitle(selectedRequest.subject)
            : "Requested Case"
        }
        description="Review the request you sent to Acapolite before the formal case is opened."
      >
        {selectedRequest ? (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  Submitted
                </p>
                <p className="font-body text-foreground">
                  {new Date(selectedRequest.created_at).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  Status
                </p>
                <p className="font-body text-foreground">
                  {selectedRequest.is_closed
                    ? "Handled by Acapolite"
                    : "Waiting for review"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                Requested Type
              </p>
              <div className="rounded-2xl border border-border p-4">
                <p className="font-body text-foreground">
                  {requestSummary.type || "Not specified"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                Description
              </p>
              <div className="rounded-2xl border border-border p-4">
                <p className="font-body text-foreground whitespace-pre-wrap">
                  {requestSummary.description || "No description available."}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                Attachment
              </p>
              <div className="rounded-2xl border border-border p-4">
                <p className="font-body text-foreground">
                  {requestSummary.attachment ||
                    "No attachment was uploaded for this request."}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>

      <DashboardItemDialog
        open={isRequestCaseOpen}
        onOpenChange={(open) => {
          setIsRequestCaseOpen(open);
          if (!open && !submittingRequest) {
            resetRequestForm();
          }
        }}
        title="Request New Case"
        description="Tell Acapolite what kind of tax matter you need help with, and attach a file if you want staff to review something immediately."
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">
              Case Title
            </label>
            <Input
              value={requestForm.case_title}
              onChange={(event) =>
                setRequestForm((current) => ({
                  ...current,
                  case_title: event.target.value,
                }))
              }
              placeholder="Example: 2026 provisional tax submission"
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">
              Case Type
            </label>
            <Select
              value={requestForm.case_type}
              onValueChange={(value) =>
                setRequestForm((current) => ({ ...current, case_type: value }))
              }
            >
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
            <label className="block text-sm font-semibold text-foreground font-body mb-2">
              Description
            </label>
            <Textarea
              value={requestForm.description}
              onChange={(event) =>
                setRequestForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Describe the SARS issue, filing need, deadline, or service you want Acapolite to open."
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">
              Optional Attachment
            </label>
            <div className="rounded-2xl border border-dashed border-border bg-accent/30 p-4">
              <Input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) =>
                  setAttachmentFile(event.target.files?.[0] ?? null)
                }
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-body text-sm text-foreground">
                    {attachmentFile
                      ? attachmentFile.name
                      : "Attach a file if you want Acapolite to review it with the request"}
                  </p>
                  <p className="font-body text-xs text-muted-foreground mt-1">
                    Accepted: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  {attachmentFile ? "Change File" : "Choose File"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setIsRequestCaseOpen(false);
                resetRequestForm();
              }}
              disabled={submittingRequest}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={submitCaseRequest}
              disabled={submittingRequest}
            >
              {submittingRequest ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </div>
      </DashboardItemDialog>
    </div>
  );
}
