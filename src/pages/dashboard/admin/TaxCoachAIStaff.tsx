import { FormEvent, useState } from "react";
import { Bot, Loader2, Send, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TaxCoachMarkdown } from "@/components/dashboard/TaxCoachMarkdown";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function TaxCoachAIStaff() {
  const { isAdmin } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);

    const { data, error } = await supabase.functions.invoke("tax-coach-ai", {
      body: { messages: nextMessages.slice(-20) },
    });

    if (error || !data?.answer) {
      toast.error(data?.error || error?.message || "Tax Coach AI is temporarily unavailable.");
      setIsSending(false);
      return;
    }

    setMessages((current) => [...current, { role: "assistant", content: data.answer }]);
    setIsSending(false);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary"><Sparkles className="h-6 w-6" /></div>
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-body">
              {isAdmin ? "Admin Tools" : "Practitioner Tools"}
            </p>
            <h1 className="mt-2 font-display text-3xl text-foreground">Tax Coach AI</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground font-body">
              Tax, Accounting, SARS &amp; Business Support Across South Africa. Get professional support with SARS matters, bookkeeping, CIPC, company compliance, business structures and practical business support.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-card">
        <div className="min-h-[420px] space-y-4 p-5 sm:p-7" aria-live="polite">
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-[360px] max-w-xl flex-col items-center justify-center text-center">
              <div className="rounded-full bg-primary/10 p-4 text-primary"><Bot className="h-8 w-8" /></div>
              <h2 className="mt-4 font-display text-xl text-foreground">How can I help with this tax matter?</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground font-body">
                Do not include passwords or unnecessary personal information. Review all AI-generated work before sending it to SARS or a client.
              </p>
            </div>
          ) : messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" ? <Bot className="mt-2 h-5 w-5 shrink-0 text-primary" /> : null}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 font-body ${message.role === "user" ? "whitespace-pre-wrap bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                {message.role === "assistant" ? <TaxCoachMarkdown content={message.content} /> : message.content}
              </div>
              {message.role === "user" ? <UserRound className="mt-2 h-5 w-5 shrink-0 text-primary" /> : null}
            </div>
          ))}
          {isSending ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Tax Coach is thinking…</div> : null}
        </div>

        <form onSubmit={sendMessage} className="border-t border-border p-4 sm:p-5">
          <div className="flex items-end gap-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={8000}
              placeholder="Ask Tax Coach AI…"
              className="min-h-[52px] resize-none"
              disabled={isSending}
            />
            <Button type="submit" size="icon" className="h-[52px] w-[52px] shrink-0" disabled={!draft.trim() || isSending} aria-label="Send message">
              {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
