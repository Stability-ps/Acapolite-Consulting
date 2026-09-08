import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Paperclip, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CorrespondenceDrafterDialog } from "@/components/dashboard/admin/CaseCorrespondenceSection";

type ChatMessage = { role: "user" | "assistant"; content: string };
type SourceCitation = { citationLabel: string; classification: string };
type PendingAttachment = { name: string; mimeType: string; size: number; dataUrl: string };

export type TaxAICaseContext = {
  clientId: string;
  caseId: string;
  clientLabel: string;
  caseLabel: string;
  taxType?: string | null;
  taxPeriod?: string | null;
};

interface TaxAIChatProps {
  scope: "general" | "case";
  caseContext?: TaxAICaseContext;
}

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  "LEGISLATION / LAW": "Legislation",
  "SARS GUIDANCE": "SARS Guidance",
  "COURT AUTHORITY": "Court Authority",
  "PAST CASE / PRECEDENT": "Past Case (precedent, not law)",
  "SARS DOCUMENT": "Client File",
  "CLIENT FACT": "Client Fact",
  "ACAPOLITE INTERNAL GUIDANCE": "Internal Guidance",
};

export function TaxAIChat({ scope, caseContext }: TaxAIChatProps) {
  const { user, role, hasStaffPermission } = useAuth();
  const queryClient = useQueryClient();
  const canGenerateCorrespondence = role === "admin" || hasStaffPermission("can_generate_sars_correspondence");
  const canApproveCorrespondence = role === "admin" || hasStaffPermission("can_approve_sars_correspondence");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sources, setSources] = useState<SourceCitation[]>([]);
  const [includeKnowledge, setIncludeKnowledge] = useState(true);
  const [includePastCases, setIncludePastCases] = useState(true);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [convertingAnalysis, setConvertingAnalysis] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      toast.error(`Attach at most ${MAX_ATTACHMENTS} files.`);
      return;
    }

    const next: PendingAttachment[] = [...attachments];
    for (const file of files) {
      if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only PDF, JPEG, PNG or WebP files are supported.`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name}: exceeds the 4 MB limit.`);
        continue;
      }
      const dataUrl = await fileToDataUrl(file);
      next.push({ name: file.name, mimeType: file.type, size: file.size, dataUrl });
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;
    if (sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed || "(see attached file)" }];
    setMessages(nextMessages);
    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("tax-coach-ai", {
        body: {
          messages: nextMessages,
          attachments: sentAttachments.length > 0 ? sentAttachments : undefined,
          scope,
          clientId: caseContext?.clientId,
          caseId: caseContext?.caseId,
          includeKnowledge,
          includePastCases,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.answer) throw new Error("Tax AI returned no answer.");

      setMessages([...nextMessages, { role: "assistant", content: data.answer }]);
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tax AI request failed.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="rounded-[28px] border border-border bg-card shadow-card overflow-hidden">
      <div className="border-b border-border p-4 sm:p-5 bg-accent/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="font-display text-lg text-foreground">
              {scope === "case" ? "Case Tax AI" : "General Tax AI"}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-body text-muted-foreground">
            <label className="flex items-center gap-2">
              <Switch checked={includeKnowledge} onCheckedChange={setIncludeKnowledge} />
              Tax Knowledge
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={includePastCases} onCheckedChange={setIncludePastCases} />
              Past Cases
            </label>
          </div>
        </div>

        {scope === "case" && caseContext ? (
          <div className="mt-3 rounded-2xl border border-border bg-card p-3 text-xs font-body text-muted-foreground">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span><span className="text-foreground font-semibold">Client:</span> {caseContext.clientLabel}</span>
              <span><span className="text-foreground font-semibold">Matter:</span> {caseContext.caseLabel}</span>
              {caseContext.taxType ? <span><span className="text-foreground font-semibold">Tax Type:</span> {caseContext.taxType}</span> : null}
              {caseContext.taxPeriod ? <span><span className="text-foreground font-semibold">Tax Period:</span> {caseContext.taxPeriod}</span> : null}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <span className="text-emerald-600 font-semibold">✓ Current Case</span>
              <span className={includeKnowledge ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                {includeKnowledge ? "✓" : "✗"} Tax Knowledge
              </span>
              <span className={includePastCases ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                {includePastCases ? "✓" : "✗"} Past Cases
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs font-body text-muted-foreground">
            General mode: Tax Knowledge and approved Past Cases only. No client case documents are accessed here — open a case for case-specific answers.
          </p>
        )}
      </div>

      <div className="max-h-[26rem] min-h-[16rem] overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground font-body">
            Ask a South African tax, SARS, accounting or compliance question to get started.
          </p>
        ) : null}

        {messages.map((message, index) => (
          <div key={index} className={message.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[85%]"}>
            <div
              className={`rounded-2xl px-4 py-3 text-sm font-body whitespace-pre-wrap ${
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"
              }`}
            >
              {message.content}
            </div>
            {message.role === "assistant" && scope === "case" && caseContext && canGenerateCorrespondence ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl mt-2"
                onClick={() => setConvertingAnalysis(message.content)}
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Convert to SARS Letter
              </Button>
            ) : null}
          </div>
        ))}

        {sending ? <div className="text-sm text-muted-foreground font-body">Tax AI is thinking...</div> : null}
        <div ref={bottomRef} />
      </div>

      {sources.length > 0 ? (
        <div className="border-t border-border p-4 sm:p-5 bg-accent/20">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Sources</p>
          <div className="flex flex-wrap gap-2">
            {sources.map((source, index) => (
              <span
                key={index}
                title={CLASSIFICATION_LABELS[source.classification] ?? source.classification}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-card border-border text-foreground font-body"
              >
                {source.citationLabel}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="border-t border-border p-4 sm:p-5 space-y-3">
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <span key={index} className="inline-flex items-center gap-1.5 text-xs font-body bg-accent rounded-full px-3 py-1">
                {attachment.name}
                <button type="button" onClick={() => removeAttachment(index)} aria-label={`Remove ${attachment.name}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Tax AI..."
            rows={2}
            className="resize-none"
            disabled={sending}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(event) => void handleFilesSelected(event.target.files)}
          />
          <Button type="button" variant="outline" size="icon" className="rounded-xl shrink-0" onClick={() => fileInputRef.current?.click()} disabled={sending}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" className="rounded-xl shrink-0" onClick={() => void handleSend()} disabled={sending || (!input.trim() && attachments.length === 0)}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {convertingAnalysis !== null && scope === "case" && caseContext ? (
        <CorrespondenceDrafterDialog
          open={convertingAnalysis !== null}
          onOpenChange={(open) => { if (!open) setConvertingAnalysis(null); }}
          caseId={caseContext.caseId}
          clientId={caseContext.clientId}
          clientLabel={caseContext.clientLabel}
          caseLabel={caseContext.caseLabel}
          existing={null}
          canApprove={canApproveCorrespondence}
          userId={user?.id ?? null}
          initialPriorAnalysis={convertingAnalysis}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["case-correspondence", caseContext.caseId] })}
        />
      ) : null}
    </div>
  );
}
