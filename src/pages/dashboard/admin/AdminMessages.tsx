import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccessibleClientIds } from "@/hooks/useAccessibleClientIds";
import { sendClientMessageNotification } from "@/lib/clientMessageNotifications";
import { formatCaseReference } from "@/lib/practitionerAssignments";
import { useSearchParams } from "react-router-dom";
import { useNotificationSectionRead } from "@/hooks/useNotificationSectionRead";
import { assertValidChatAttachment, openChatAttachment, uploadChatAttachment } from "@/lib/chatAttachments";

type ConversationRecord = {
  id: string;
  subject: string | null;
  case_id: string | null;
  client_id: string | null;
  practitioner_profile_id: string | null;
  is_closed?: boolean;
  last_message_at?: string | null;
  clients?: {
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    client_code?: string | null;
    profile_id?: string | null;
    profiles?: { full_name?: string | null; email?: string | null } | null;
  } | null;
  practitioner?: {
    full_name?: string | null;
    email?: string | null;
    practitioner_profiles?: { business_name?: string | null }[] | null;
  } | null;
  cases?: { id?: string | null; status?: string | null; case_title?: string | null; case_number?: string | null } | null;
};

type ConversationFilter = "all" | "clients" | "practitioners" | "open_cases" | "support";

function getConversationName(conversation: ConversationRecord) {
  const practitionerBusinessName = conversation.practitioner?.practitioner_profiles?.[0]?.business_name;
  return (
    conversation.clients?.company_name ||
    conversation.clients?.profiles?.full_name ||
    [conversation.clients?.first_name, conversation.clients?.last_name].filter(Boolean).join(" ") ||
    practitionerBusinessName ||
    conversation.practitioner?.full_name ||
    conversation.subject ||
    conversation.clients?.client_code ||
    conversation.practitioner?.email ||
    "Conversation"
  );
}

function getConversationTags(conversation: ConversationRecord) {
  const tags: string[] = [];

  if (conversation.case_id) {
    tags.push("Case");
  }

  if (conversation.client_id) {
    tags.push("Client");
  }

  if (conversation.practitioner_profile_id) {
    tags.push("Practitioner");
  }

  if (!conversation.case_id) {
    tags.push("Support");
  }

  return tags;
}

export default function AdminMessages() {
  useNotificationSectionRead("messages");
  const { user, role, profile, hasStaffPermission } = useAuth();
  const { accessibleClientIds, hasRestrictedClientScope, isLoadingAccessibleClientIds } = useAccessibleClientIds();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedConversationId = searchParams.get("conversationId") ?? "";
  const [selectedConversation, setSelectedConversation] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ConversationFilter>("all");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);

  const accessibleClientIdsKey = accessibleClientIds?.join(",") ?? "all";
  const canReplyMessages = hasStaffPermission("can_reply_messages");

  const { data: conversations } = useQuery({
    queryKey: ["staff-conversations", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase
        .from("conversations")
        .select("*, clients(company_name, first_name, last_name, client_code, profile_id, profiles!clients_profile_id_fkey(full_name, email)), practitioner:practitioner_profile_id(full_name, email, practitioner_profiles!practitioner_profiles_profile_id_fkey(business_name)), cases:case_id(id, status, case_title, case_number)")
        .order("last_message_at", { ascending: false });

      if (hasRestrictedClientScope) {
        if (!accessibleClientIds?.length && !user?.id) {
          return [];
        }

        const filters: string[] = [];
        if (accessibleClientIds?.length) {
          filters.push(`client_id.in.(${accessibleClientIds.join(",")})`);
        }
        if (user?.id) {
          filters.push(`practitioner_profile_id.eq.${user.id}`);
        }
        if (filters.length) {
          query = query.or(filters.join(","));
        }
      }

      const { data } = await query;
      return data ?? [];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  useEffect(() => {
    if (requestedConversationId && selectedConversation !== requestedConversationId) {
      setSelectedConversation(requestedConversationId);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("conversationId");
        return next;
      });
      return;
    }

    if (!selectedConversation && conversations?.length) {
      setSelectedConversation(conversations[0].id);
    }
  }, [conversations, requestedConversationId, selectedConversation, setSearchParams]);

  const { data: messages } = useQuery({
    queryKey: ["staff-messages", selectedConversation],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!selectedConversation,
  });

  const attachmentIds = useMemo(
    () => Array.from(new Set((messages ?? []).map((message) => message.attachment_document_id).filter(Boolean))) as string[],
    [messages],
  );

  const { data: attachmentDocuments } = useQuery({
    queryKey: ["staff-message-attachments", attachmentIds],
    queryFn: async () => {
      if (!attachmentIds.length) return [];

      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, file_path")
        .in("id", attachmentIds);

      if (error) throw error;
      return data ?? [];
    },
    enabled: attachmentIds.length > 0,
  });

  const conversationIds = useMemo(
    () => (conversations ?? []).map((conversation) => conversation.id),
    [conversations],
  );

  const { data: unreadMessages } = useQuery({
    queryKey: ["staff-unread-messages", conversationIds],
    queryFn: async () => {
      if (!conversationIds.length) return [];

      const { data } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_type, sender_profile_id")
        .in("conversation_id", conversationIds)
        .eq("is_read", false);

      return data ?? [];
    },
    enabled: conversationIds.length > 0,
  });

  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!selectedConversation || !messages?.length) return;

      const unreadIncomingMessages = messages.filter(
        (message) => message.sender_profile_id !== user?.id && !message.is_read,
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
        queryClient.invalidateQueries({ queryKey: ["staff-messages", selectedConversation] });
        queryClient.invalidateQueries({ queryKey: ["staff-unread-messages"] });
        queryClient.invalidateQueries({ queryKey: ["staff-dashboard-summary"] });
        queryClient.invalidateQueries({ queryKey: ["sidebar-unread-messages"] });
      }
    };

    void markMessagesAsRead();
  }, [messages, queryClient, selectedConversation, user?.id]);

  useEffect(() => {
    if (!selectedConversation) return;

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, selectedConversation]);

  useEffect(() => {
    const channel = supabase.channel("staff-conversations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["staff-conversations"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase.channel(`staff-messages-${selectedConversation}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${selectedConversation}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["staff-messages", selectedConversation] });
        queryClient.invalidateQueries({ queryKey: ["staff-unread-messages"] });
        queryClient.invalidateQueries({ queryKey: ["staff-conversations"] });
        queryClient.invalidateQueries({ queryKey: ["sidebar-unread-messages"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, selectedConversation]);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredByType = (conversations ?? []).filter((conversation) => {
      switch (activeFilter) {
        case "clients":
          return Boolean(conversation.client_id);
        case "practitioners":
          return Boolean(conversation.practitioner_profile_id);
        case "open_cases": {
          if (!conversation.case_id) return false;
          const status = conversation.cases?.status ?? "";
          return !["resolved", "closed"].includes(status);
        }
        case "support":
          return !conversation.case_id;
        default:
          return true;
      }
    });

    if (!normalizedSearch) {
      return filteredByType;
    }

    return filteredByType.filter((conversation) => {
      const name = getConversationName(conversation).toLowerCase();
      const subject = (conversation.subject || "").toLowerCase();
      const code = (conversation.clients?.client_code || "").toLowerCase();
      const clientEmail = (conversation.clients?.profiles?.email || "").toLowerCase();
      const practitionerEmail = (conversation.practitioner?.email || "").toLowerCase();
      const caseReference = conversation.case_id
        ? formatCaseReference(conversation.case_id, conversation.cases?.case_number).toLowerCase()
        : "";
      const caseTitle = (conversation.cases?.case_title || "").toLowerCase();
      const tags = getConversationTags(conversation).map((tag) => tag.toLowerCase());
      return [
        name,
        subject,
        code,
        clientEmail,
        practitionerEmail,
        caseReference,
        caseTitle,
        ...tags,
      ].some((value) => value.includes(normalizedSearch));
    });
  }, [activeFilter, conversations, searchQuery]);

  const unreadCounts = useMemo(() => {
    return (unreadMessages ?? []).reduce<Record<string, number>>((accumulator, message) => {
      if (message.sender_profile_id === user?.id) {
        return accumulator;
      }
      accumulator[message.conversation_id] = (accumulator[message.conversation_id] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [unreadMessages, user?.id]);

  const attachmentMap = useMemo(
    () => new Map((attachmentDocuments ?? []).map((document) => [document.id, document])),
    [attachmentDocuments],
  );

  const selectedConversationRecord = filteredConversations.find((conversation) => conversation.id === selectedConversation)
    || conversations?.find((conversation) => conversation.id === selectedConversation)
    || null;

  const sendMessage = async () => {
    if ((!newMessage.trim() && !attachmentFile) || !selectedConversation || !user) return;
    if (!canReplyMessages) {
      toast.error("This consultant profile cannot reply to client messages.");
      return;
    }

    const outgoingMessage = newMessage.trim();
    setSendingMessage(true);
    let attachmentDocumentId: string | null = null;

    try {
      if (attachmentFile && selectedConversationRecord?.client_id) {
        const uploadedDocument = await uploadChatAttachment({
          file: attachmentFile,
          uploadedBy: user.id,
          clientId: selectedConversationRecord.client_id,
          caseId: selectedConversationRecord.case_id,
          recipientProfileId: selectedConversationRecord.clients?.profile_id ?? null,
          title: `Conversation Attachment - ${attachmentFile.name}`,
        });
        attachmentDocumentId = uploadedDocument.id;
      }

      const { data, error } = await supabase.from("messages").insert({
        conversation_id: selectedConversation,
        sender_profile_id: user.id,
        sender_type: role === "consultant" ? "consultant" : "admin",
        message_text: outgoingMessage || `Sent an attachment: ${attachmentFile?.name || "File"}`,
        attachment_document_id: attachmentDocumentId,
      }).select("id, created_at").single();

      if (error) {
        throw error;
      }

      setNewMessage("");
      setAttachmentFile(null);
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = "";
      }
      if (selectedConversationRecord?.clients?.profile_id) {
        const senderName = profile?.full_name?.trim()
          || (role === "consultant" ? "Your Consultant" : "Acapolite Consulting");
        const notification = await sendClientMessageNotification({
          messageId: data.id,
          clientProfileId: selectedConversationRecord.clients.profile_id,
          clientEmail: selectedConversationRecord.clients.profiles?.email,
          clientName: getConversationName(selectedConversationRecord),
          senderName,
          messageText: outgoingMessage || `Sent an attachment: ${attachmentFile?.name || "File"}`,
          sentAt: data.created_at,
          caseId: selectedConversationRecord.case_id,
          conversationSubject: selectedConversationRecord.subject,
        });

        if (notification.error) {
          console.error("Client message email failed:", notification.error);
          toast.error("Message sent, but the client email notification could not be delivered.");
        } else {
          toast.success("Message sent");
        }
      } else {
        toast.success("Message sent");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send this message.");
    } finally {
      setSendingMessage(false);
    }

    queryClient.invalidateQueries({ queryKey: ["staff-messages", selectedConversation] });
    queryClient.invalidateQueries({ queryKey: ["staff-conversations"] });
    queryClient.invalidateQueries({ queryKey: ["sidebar-unread-messages"] });
  };

  const handleAttachmentChange = (file: File | null) => {
    if (!file) {
      setAttachmentFile(null);
      return;
    }

    try {
      assertValidChatAttachment(file);
      setAttachmentFile(file);
    } catch (error) {
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = "";
      }
      toast.error(error instanceof Error ? error.message : "Unable to attach this file.");
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">All Messages</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">
        {hasRestrictedClientScope ? "Manage communication for assigned client and practitioner conversations." : "Manage communication across all client and practitioner conversations."}
      </p>

      <div className="grid xl:grid-cols-[360px_1fr] gap-6 h-[72vh] min-h-0">
        <div className="bg-card rounded-2xl border border-border shadow-card flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name, email, case #, or role..."
                className="rounded-xl pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {([
                { id: "all", label: "All" },
                { id: "clients", label: "Clients" },
                { id: "practitioners", label: "Practitioners" },
                { id: "open_cases", label: "Open Cases" },
                { id: "support", label: "Support" },
              ] as { id: ConversationFilter; label: string }[]).map((filter) => (
                <Button
                  key={filter.id}
                  type="button"
                  size="sm"
                  variant={activeFilter === filter.id ? "secondary" : "outline"}
                  onClick={() => setActiveFilter(filter.id)}
                  className="rounded-full px-4"
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
            {isLoadingAccessibleClientIds ? null : filteredConversations.length > 0 ? (
              filteredConversations.map((conversation) => {
                const isSelected = conversation.id === selectedConversation;
                const lastMessage = conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleString() : "";
                const unreadCount = unreadCounts[conversation.id] ?? 0;
                const tags = getConversationTags(conversation);

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedConversation(conversation.id)}
                    className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${
                      isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30 hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="font-body font-semibold text-foreground truncate">
                          {getConversationName(conversation)}
                        </p>
                        <p className="text-xs text-muted-foreground font-body truncate">
                          {conversation.subject || "General conversation"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {unreadCount > 0 ? (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary text-primary-foreground">
                            {unreadCount}
                          </span>
                        ) : null}
                        {conversation.clients?.client_code ? (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-accent text-accent-foreground">
                            {conversation.clients.client_code}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground font-body truncate">
                      {lastMessage}
                    </p>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground font-body">No conversations match your search.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-card flex min-h-0 flex-col overflow-hidden">
          {selectedConversationRecord ? (
            <>
              <div className="border-b border-border px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-foreground">
                      {getConversationName(selectedConversationRecord)}
                    </h2>
                    <p className="text-sm text-muted-foreground font-body mt-1">
                      {unreadCounts[selectedConversationRecord.id] ? `${unreadCounts[selectedConversationRecord.id]} unread message(s)` : selectedConversationRecord.subject || "General conversation"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getConversationTags(selectedConversationRecord).map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent text-accent-foreground font-body"
                        >
                          {tag}
                        </span>
                      ))}
                      {selectedConversationRecord.cases?.status ? (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-body">
                          {selectedConversationRecord.cases.status.replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </div>
                    {selectedConversationRecord.case_id ? (
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                        {formatCaseReference(selectedConversationRecord.case_id, selectedConversationRecord.cases?.case_number)}
                      </p>
                    ) : null}
                  </div>
                  {selectedConversationRecord.clients?.client_code ? (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-accent text-accent-foreground font-body">
                      {selectedConversationRecord.clients.client_code}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
                {messages && messages.length > 0 ? messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender_profile_id === user?.id ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] rounded-3xl px-4 py-3 ${
                      message.sender_profile_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] mb-2 opacity-75">
                        {message.sender_profile_id === user?.id ? "You" : message.sender_type}
                      </p>
                      <p className="text-sm font-body whitespace-pre-wrap">{message.message_text}</p>
                      {message.attachment_document_id && attachmentMap.get(message.attachment_document_id) ? (
                        <button
                          type="button"
                          className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                            message.sender_profile_id === user?.id ? "bg-white/15 text-primary-foreground" : "bg-card text-foreground"
                          }`}
                          onClick={() => {
                            const attachment = attachmentMap.get(message.attachment_document_id!);
                            if (!attachment) return;
                            setOpeningAttachmentId(message.id);
                            void openChatAttachment(attachment.file_path)
                              .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to open attachment."))
                              .finally(() => setOpeningAttachmentId(null));
                          }}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {openingAttachmentId === message.id ? "Opening..." : attachmentMap.get(message.attachment_document_id)?.file_name}
                        </button>
                      ) : null}
                      <p className={`text-xs mt-3 ${message.sender_profile_id === user?.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(message.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-center text-muted-foreground font-body text-sm">No messages yet for this conversation.</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-border p-4">
                <div className="flex gap-3">
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => handleAttachmentChange(event.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl shrink-0"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={!canReplyMessages}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    placeholder={canReplyMessages ? "Type a reply..." : "View-only messaging access"}
                    className="flex-1 rounded-xl"
                    onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && sendMessage()}
                    disabled={!canReplyMessages}
                  />
                  <Button onClick={sendMessage} className="rounded-xl shrink-0" disabled={!canReplyMessages || sendingMessage || (!newMessage.trim() && !attachmentFile)}>
                    <Send className="h-4 w-4 mr-2" />
                    {canReplyMessages ? (sendingMessage ? "Sending..." : "Send") : "View Only"}
                  </Button>
                </div>
                {attachmentFile ? (
                  <p className="mt-3 text-xs text-muted-foreground font-body">
                    Attached: {attachmentFile.name} ({Math.max(1, Math.round(attachmentFile.size / 1024))} KB)
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground font-body">
                    You can send a message, a file, or both. Maximum file size: 10 MB.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-12">
              <p className="text-muted-foreground font-body">Select a conversation from the left to view the chat.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
