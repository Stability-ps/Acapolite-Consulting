import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";
import { toast } from "sonner";

export default function Messages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCase, setSelectedCase] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");

  const { data: cases } = useQuery({
    queryKey: ["cases", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("id, case_number, title").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", selectedCase],
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("*").eq("case_id", selectedCase).order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!selectedCase,
  });

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedCase || !user) return;
    const { error } = await supabase.from("messages").insert({
      case_id: selectedCase,
      sender_id: user.id,
      content: newMessage.trim(),
    });
    if (error) toast.error(error.message);
    else {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedCase] });
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Messages</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Communicate with your consultant</p>

      <div className="mb-6">
        <Select value={selectedCase} onValueChange={setSelectedCase}>
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue placeholder="Select a case" />
          </SelectTrigger>
          <SelectContent>
            {cases?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.case_number} — {c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCase ? (
        <div className="bg-card rounded-xl border border-border shadow-card flex flex-col" style={{ height: "60vh" }}>
          <div className="flex-1 overflow-auto p-6 space-y-4">
            {messages && messages.length > 0 ? messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  msg.sender_id === user?.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  <p className="text-sm font-body">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.sender_id === user?.id ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-center text-muted-foreground font-body text-sm">No messages yet. Start the conversation.</p>
            )}
          </div>
          <div className="p-4 border-t border-border flex gap-3">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <Button onClick={sendMessage} className="rounded-xl shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">Select a case to view messages.</p>
        </div>
      )}
    </div>
  );
}
