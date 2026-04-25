import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Search, Send, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClientRecord } from "@/hooks/useClientRecord";
import { useNotificationSectionRead } from "@/hooks/useNotificationSectionRead";
import { assertValidChatAttachment, openChatAttachment, uploadChatAttachment } from "@/lib/chatAttachments";

function getSenderLabel(isOwnMessage: boolean) {
  return isOwnMessage ? "You" : "Acapolite Consulting";
}

export default function Messages() {
  useNotificationSectionRead("messages");
  const { user } = useAuth();
  const { data: client } = useClientRecord();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedConversation, setSelectedConversation] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);

  const { data: conversations } = useQuery({
    queryKey: ["conversations", client?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("client_id", client!.id)
        .order("last_message_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!client,
  });

  useEffect(() => {
    if (!selectedConversation && conversations?.length) {
      setSelectedConversation(conversations[0].id);
    }
  }, [conversations, selectedConversation]);

  const conversationIds = useMemo(
    () => (conversations ?? []).map((conversation) => conversation.id),
    [conversations],
  );

  const { data: unreadMessages } = useQuery({
    queryKey: ["client-unread-messages", conversationIds],
    queryFn: async () => {
      if (!conversationIds.length) return [];

      const { data } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_type")
        .in("conversation_id", conversationIds)
        .in("sender_type", ["admin", "consultant"])
        .eq("is_read", false);

      return data ?? [];
    },
    enabled: conversationIds.length > 0,
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", selectedConversation],
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
    queryKey: ["client-message-attachments", attachmentIds],
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

  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!selectedConversation || !messages?.length) return;

      const unreadIncomingMessages = messages.filter(
        (message) => message.sender_profile_id !== user?.id
          && ["admin", "consultant"].includes(message.sender_type)
          && !message.is_read,
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
        queryClient.invalidateQueries({ queryKey: ["messages", selectedConversation] });
        queryClient.invalidateQueries({ queryKey: ["client-unread-messages"] });
        queryClient.invalidateQueries({ queryKey: ["client-dashboard-summary", user?.id] });
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

  const unreadCounts = useMemo(() => {
    return (unreadMessages ?? []).reduce<Record<string, number>>((accumulator, message) => {
      accumulator[message.conversation_id] = (accumulator[message.conversation_id] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [unreadMessages]);

  const attachmentMap = useMemo(
    () => new Map((attachmentDocuments ?? []).map((document) => [document.id, document])),
    [attachmentDocuments],
  );

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return conversations ?? [];
    }

    return (conversations ?? []).filter((conversation) =>
      (conversation.subject || "general support").toLowerCase().includes(normalizedSearch));
  }, [conversations, searchQuery]);

  const selectedConversationRecord = filteredConversations.find((conversation) => conversation.id === selectedConversation)
    || conversations?.find((conversation) => conversation.id === selectedConversation)
    || null;

  const startConversation = async () => {
    if (!client || !user) return;

    const { data, error } = await supabase.from("conversations").insert({
      client_id: client.id,
      subject: "General Support",
      created_by: user.id,
    }).select("*").single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setSelectedConversation(data.id);
    queryClient.invalidateQueries({ queryKey: ["conversations", client.id] });
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !attachmentFile) || !selectedConversation || !user || !client) return;

    setSendingMessage(true);

    let attachmentDocumentId: string | null = null;

    try {
      if (attachmentFile) {
        const uploadedDocument = await uploadChatAttachment({
          file: attachmentFile,
          uploadedBy: user.id,
          clientId: client.id,
          recipientProfileId: null,
          title: `Conversation Attachment - ${attachmentFile.name}`,
        });
        attachmentDocumentId = uploadedDocument.id;
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConversation,
        sender_profile_id: user.id,
        sender_type: "client",
        message_text: newMessage.trim() || `Sent an attachment: ${attachmentFile?.name || "File"}`,
        attachment_document_id: attachmentDocumentId,
      });

      if (error) {
        throw error;
      }

      setNewMessage("");
      setAttachmentFile(null);
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = "";
      }
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ["client-unread-messages"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-unread-messages"] });
      queryClient.invalidateQueries({ queryKey: ["conversations", client.id] });
      queryClient.invalidateQueries({ queryKey: ["documents", client.id] });
      queryClient.invalidateQueries({ queryKey: ["staff-documents"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send this message.");
    } finally {
      setSendingMessage(false);
    }
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
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Messages</h1>
          <p className="text-muted-foreground font-body text-sm">Communicate with your consultant and track unread replies.</p>
        </div>
        <Button onClick={startConversation} disabled={!client} className="rounded-xl">
          Start Conversation
        </Button>
      </div>

      {!client ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">Your client record is not ready yet. Acapolite staff can complete it for you.</p>
        </div>
      ) : (
        <div className="grid xl:grid-cols-[320px_1fr] gap-6 h-[72vh] min-h-0">
          <div className="bg-card rounded-2xl border border-border shadow-card flex min-h-0 flex-col overflow-hidden">
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search conversations..."
                  className="rounded-xl pl-9"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
              {filteredConversations.length > 0 ? (
                filteredConversations.map((conversation) => {
                  const unreadCount = unreadCounts[conversation.id] ?? 0;
                  const isSelected = conversation.id === selectedConversation;

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
                            {conversation.subject || "General Support"}
                          </p>
                          <p className="text-xs text-muted-foreground font-body truncate">
                            Last activity {new Date(conversation.last_message_at).toLocaleString()}
                          </p>
                        </div>
                        {unreadCount > 0 ? (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary text-primary-foreground">
                            {unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground font-body">No conversations found.</p>
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
                        {selectedConversationRecord.subject || "General Support"}
                      </h2>
                      <p className="text-sm text-muted-foreground font-body mt-1">
                        {unreadCounts[selectedConversationRecord.id] ? `${unreadCounts[selectedConversationRecord.id]} unread message(s)` : "All caught up"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
                  {messages && messages.length > 0 ? messages.map((message) => {
                    const isOwnMessage = message.sender_profile_id === user?.id;

                    return (
                    <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                      <div className={`flex max-w-[84%] items-end gap-3 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
                        {!isOwnMessage ? (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(59,130,246,1),rgba(30,64,175,1))] text-white shadow-[0_12px_24px_rgba(30,64,175,0.22)]">
                            <Shield className="h-4 w-4" />
                          </div>
                        ) : null}
                        <div className={`rounded-3xl px-4 py-3 ${
                          isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        }`}>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-75">
                            {getSenderLabel(isOwnMessage)}
                          </p>
                          <p className="text-sm font-body whitespace-pre-wrap">{message.message_text}</p>
                          {message.attachment_document_id && attachmentMap.get(message.attachment_document_id) ? (
                            <button
                              type="button"
                              className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                isOwnMessage ? "bg-white/15 text-primary-foreground" : "bg-card text-foreground"
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
                          <p className={`mt-3 text-xs ${isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {new Date(message.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-center text-muted-foreground font-body text-sm">No messages yet. Start the conversation.</p>
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
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 rounded-xl"
                      onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && sendMessage()}
                    />
                    <Button onClick={sendMessage} className="rounded-xl shrink-0" disabled={sendingMessage || (!newMessage.trim() && !attachmentFile)}>
                      <Send className="h-4 w-4 mr-2" />
                      {sendingMessage ? "Sending..." : "Send"}
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
                <p className="text-muted-foreground font-body">Select a conversation to view messages.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
