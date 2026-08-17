import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { Bot, FileText, Image, Loader2, Paperclip, Send, Sparkles, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TaxCoachMarkdown } from "@/components/dashboard/TaxCoachMarkdown";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ChatMessage = { role: "user" | "assistant"; content: string; attachmentNames?: string[] };
type PendingAttachment = { name: string; mimeType: string; size: number; dataUrl: string };

const acceptedAttachmentTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const maxAttachmentBytes = 4 * 1024 * 1024;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read this file."));
    reader.readAsDataURL(file);
  });
}

export default function TaxCoachAIStaff() {
  const { isAdmin } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectAttachments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    if (attachments.length + files.length > 3) {
      toast.error("You can attach up to 3 files per message.");
      return;
    }

    const invalid = files.find((file) => !acceptedAttachmentTypes.includes(file.type) || file.size > maxAttachmentBytes);
    if (invalid) {
      toast.error("Use PDF, PNG, JPEG or WebP files up to 4 MB each.");
      return;
    }

    try {
      const next = await Promise.all(files.map(async (file) => ({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
      })));
      const totalBytes = [...attachments, ...next].reduce((total, file) => total + file.size, 0);
      if (totalBytes > 10 * 1024 * 1024) {
        toast.error("Attachments can total up to 10 MB per message.");
        return;
      }
      setAttachments((current) => [...current, ...next]);
    } catch {
      toast.error("One of the selected files could not be read.");
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if ((!content && attachments.length === 0) || isSending) return;

    const question = content || "Please scan, read and advise on the attached file within Acapolite Consulting's service scope.";
    const nextMessages = [...messages, {
      role: "user" as const,
      content: question,
      attachmentNames: attachments.map((attachment) => attachment.name),
    }];
    const requestAttachments = attachments;
    setMessages(nextMessages);
    setDraft("");
    setAttachments([]);
    setIsSending(true);

    const { data, error } = await supabase.functions.invoke("tax-coach-ai", {
      body: {
        messages: nextMessages.slice(-20).map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        attachments: requestAttachments,
      },
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
                {message.role === "assistant" ? <TaxCoachMarkdown content={message.content} /> : (
                  <div className="space-y-2">
                    <p>{message.content}</p>
                    {message.attachmentNames?.map((name) => (
                      <div key={name} className="flex items-center gap-2 text-xs opacity-90"><Paperclip className="h-3.5 w-3.5" />{name}</div>
                    ))}
                  </div>
                )}
              </div>
              {message.role === "user" ? <UserRound className="mt-2 h-5 w-5 shrink-0 text-primary" /> : null}
            </div>
          ))}
          {isSending ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Tax Coach is thinking…</div> : null}
        </div>

        <form onSubmit={sendMessage} className="border-t border-border p-4 sm:p-5">
          {attachments.length ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <div key={`${attachment.name}-${index}`} className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs text-foreground">
                  {attachment.mimeType === "application/pdf" ? <FileText className="h-4 w-4 text-primary" /> : <Image className="h-4 w-4 text-primary" />}
                  <span className="max-w-48 truncate">{attachment.name}</span>
                  <button type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${attachment.name}`}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-end gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={selectAttachments}
            />
            <Button type="button" variant="outline" size="icon" className="h-[52px] w-[52px] shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isSending || attachments.length >= 3} aria-label="Attach documents or pictures">
              <Paperclip className="h-5 w-5" />
            </Button>
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
            <Button type="submit" size="icon" className="h-[52px] w-[52px] shrink-0" disabled={(!draft.trim() && attachments.length === 0) || isSending} aria-label="Send message">
              {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
