import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function getConversationName(conversation: {
  subject: string | null;
  clients?: { company_name?: string | null; first_name?: string | null; last_name?: string | null; client_code?: string | null } | null;
}) {
  return (
    conversation.clients?.company_name ||
    [conversation.clients?.first_name, conversation.clients?.last_name].filter(Boolean).join(" ") ||
    conversation.subject ||
    conversation.clients?.client_code ||
    "Conversation"
  );
}

function getConversationPreview(messageText?: string | null) {
  if (!messageText?.trim()) return "No messages yet";
  return messageText.split("\n")[0];
}

export default function AdminMessages() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [selectedConversation, setSelectedConversation] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: conversations } = useQuery({
    queryKey: ["staff-conversations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*, clients(company_name, first_name, last_name, client_code)")
        .order("last_message_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!selectedConversation && conversations?.length) {
      setSelectedConversation(conversations[0].id);
    }
  }, [conversations, selectedConversation]);

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
        .select("id, conversation_id, sender_type")
        .in("conversation_id", conversationIds)
        .eq("sender_type", "client")
        .eq("is_read", false);

      return data ?? [];
    },
    enabled: conversationIds.length > 0,
  });

  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!selectedConversation || !messages?.length) return;

      const unreadIncomingMessages = messages.filter(
        (message) => message.sender_profile_id !== user?.id
          && message.sender_type === "client"
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

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return conversations ?? [];
    }

    return (conversations ?? []).filter((conversation) => {
      const name = getConversationName(conversation).toLowerCase();
      const subject = (conversation.subject || "").toLowerCase();
      const code = (conversation.clients?.client_code || "").toLowerCase();
      return name.includes(normalizedSearch) || subject.includes(normalizedSearch) || code.includes(normalizedSearch);
    });
  }, [conversations, searchQuery]);

  const unreadCounts = useMemo(() => {
    return (unreadMessages ?? []).reduce<Record<string, number>>((accumulator, message) => {
      accumulator[message.conversation_id] = (accumulator[message.conversation_id] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [unreadMessages]);

  const selectedConversationRecord = filteredConversations.find((conversation) => conversation.id === selectedConversation)
    || conversations?.find((conversation) => conversation.id === selectedConversation)
    || null;

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedConversation,
      sender_profile_id: user.id,
      sender_type: role === "consultant" ? "consultant" : "admin",
      message_text: newMessage.trim(),
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setNewMessage("");
    toast.success("Message sent");
    queryClient.invalidateQueries({ queryKey: ["staff-messages", selectedConversation] });
    queryClient.invalidateQueries({ queryKey: ["staff-conversations"] });
    queryClient.invalidateQueries({ queryKey: ["sidebar-unread-messages"] });
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">All Messages</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Manage communication across all client conversations</p>

      <div className="grid xl:grid-cols-[360px_1fr] gap-6 h-[72vh] min-h-0">
        <div className="bg-card rounded-2xl border border-border shadow-card flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search client chats..."
                className="rounded-xl pl-9"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
            {filteredConversations.length > 0 ? (
              filteredConversations.map((conversation) => {
                const isSelected = conversation.id === selectedConversation;
                const lastMessage = conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleString() : "";
                const unreadCount = unreadCounts[conversation.id] ?? 0;

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
                      {unreadCounts[selectedConversationRecord.id] ? `${unreadCounts[selectedConversationRecord.id]} unread client message(s)` : selectedConversationRecord.subject || "General conversation"}
                    </p>
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
                  <Input
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    placeholder="Type a reply..."
                    className="flex-1 rounded-xl"
                    onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && sendMessage()}
                  />
                  <Button onClick={sendMessage} className="rounded-xl shrink-0">
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
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
