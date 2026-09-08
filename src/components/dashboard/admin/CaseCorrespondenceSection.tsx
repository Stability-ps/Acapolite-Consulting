import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Copy,
  Download,
  FileText,
  Plus,
  Sparkles,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { logSystemActivity } from "@/lib/systemActivityLog";
import {
  CORRESPONDENCE_PURPOSES,
  CORRESPONDENCE_STATUS_LABELS,
  CORRESPONDENCE_TONES,
  CORRESPONDENCE_TYPES,
  exportCorrespondenceDocx,
  exportCorrespondencePdf,
  getCorrespondenceStatusBadgeClass,
} from "@/lib/sarsCorrespondence";

type CorrespondenceRow = Tables<"case_correspondence">;
type DocumentRow = { id: string; title: string; category: string | null; file_name: string; document_date: string | null };
type SourceUsed = { citationLabel: string; classification: string };

type DraftResult = {
  body: string;
  missingInformation: string[];
  warnings: string[];
  sourcesUsed: SourceUsed[];
  annexureManifest: Array<{ letter: string; documentId: string; label: string }>;
  model: string;
};

const REVISION_ACTIONS: Array<{ key: string; label: string; instruction: string }> = [
  { key: "shorten", label: "Shorten", instruction: "Shorten this letter while preserving every fact, reference and citation. Remove only redundant wording." },
  { key: "formal", label: "Make More Formal", instruction: "Make the tone more formal and measured throughout, without changing any fact, reference or citation." },
  { key: "firmer", label: "Make Firmer", instruction: "Make the tone firmer and more assertive on the practitioner's position, while remaining professional and non-aggressive." },
  { key: "detailed", label: "Make More Detailed", instruction: "Expand the letter to address each point in more detail, using only the facts and sources already provided - do not introduce new facts." },
  { key: "add_legal", label: "Add Legal Support", instruction: "Where relevant legislation or SARS guidance was provided as a source but not yet cited in the letter, add appropriate citations using their exact citation keys." },
  { key: "remove_legal", label: "Remove Legal Citations", instruction: "Remove legal/legislative citations from the letter body, keeping the substantive content and factual representations intact." },
  { key: "add_annexures", label: "Add Annexure Schedule", instruction: "Ensure the letter body explicitly refers to each selected annexure by its letter where relevant to the point being made." },
];

interface CaseCorrespondenceSectionProps {
  caseId: string;
  clientId: string;
  clientLabel: string;
  caseLabel: string;
}

export function CaseCorrespondenceSection({ caseId, clientId, clientLabel, caseLabel }: CaseCorrespondenceSectionProps) {
  const { user, role, hasStaffPermission } = useAuth();
  const isAdmin = role === "admin";
  const canGenerate = isAdmin || hasStaffPermission("can_generate_sars_correspondence");
  const canApprove = isAdmin || hasStaffPermission("can_approve_sars_correspondence");
  const queryClient = useQueryClient();

  const [drafterOpen, setDrafterOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const { data: history } = useQuery({
    queryKey: ["case-correspondence", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_correspondence")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const viewingRecord = history?.find((row) => row.id === viewingId) ?? null;

  return (
    <div className="rounded-[28px] border border-border bg-card shadow-card overflow-hidden">
      <div className="border-b border-border p-4 sm:p-5 bg-accent/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <p className="font-display text-lg text-foreground">SARS Correspondence</p>
        </div>
        {canGenerate ? (
          <Button type="button" size="sm" className="rounded-xl" onClick={() => { setViewingId(null); setDrafterOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Draft SARS Correspondence
          </Button>
        ) : null}
      </div>

      <div className="p-4 sm:p-5">
        {history && history.length > 0 ? (
          <div className="space-y-2">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setViewingId(item.id); setDrafterOpen(true); }}
                className="w-full text-left rounded-xl border border-border p-3 hover:border-primary/30 hover:shadow-elevated transition-all flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground font-body truncate">
                    {item.subject || item.correspondence_type}
                  </p>
                  <p className="text-xs text-muted-foreground font-body">
                    {item.correspondence_type} | v{item.version} | {new Date(item.created_at).toLocaleDateString()}
                    {item.generated_by_ai ? " | AI generated" : ""}
                  </p>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border font-body shrink-0 ${getCorrespondenceStatusBadgeClass(item.status)}`}>
                  {CORRESPONDENCE_STATUS_LABELS[item.status]}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground font-body">No SARS correspondence drafted for this case yet.</p>
        )}
      </div>

      {drafterOpen ? (
        <CorrespondenceDrafterDialog
          open={drafterOpen}
          onOpenChange={(open) => { setDrafterOpen(open); if (!open) setViewingId(null); }}
          caseId={caseId}
          clientId={clientId}
          clientLabel={clientLabel}
          caseLabel={caseLabel}
          existing={viewingRecord}
          canApprove={canApprove}
          userId={user?.id ?? null}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["case-correspondence", caseId] })}
        />
      ) : null}
    </div>
  );
}

interface CorrespondenceDrafterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  clientId: string;
  clientLabel: string;
  caseLabel: string;
  existing: CorrespondenceRow | null;
  canApprove: boolean;
  userId: string | null;
  onSaved: () => void;
  initialPriorAnalysis?: string;
}

export function CorrespondenceDrafterDialog({
  open,
  onOpenChange,
  caseId,
  clientId,
  clientLabel,
  caseLabel,
  existing,
  canApprove,
  userId,
  onSaved,
  initialPriorAnalysis,
}: CorrespondenceDrafterDialogProps) {
  const [correspondenceType, setCorrespondenceType] = useState(existing?.correspondence_type ?? CORRESPONDENCE_TYPES[0]);
  const [purpose, setPurpose] = useState(existing?.purpose ?? "");
  const [recipient, setRecipient] = useState(existing?.recipient ?? "SARS");
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [sarsReference, setSarsReference] = useState(existing?.sars_reference ?? "");
  const [taxType, setTaxType] = useState(existing?.tax_type ?? "");
  const [taxPeriod, setTaxPeriod] = useState(existing?.tax_period ?? "");
  const [deadline, setDeadline] = useState(existing?.deadline ?? "");
  const [tone, setTone] = useState(existing?.tone ?? "formal");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [selectedAnnexureIds, setSelectedAnnexureIds] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<string>("none");

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [draft, setDraft] = useState<DraftResult | null>(
    existing
      ? {
          body: existing.body,
          missingInformation: existing.missing_information ?? [],
          warnings: existing.warnings ?? [],
          sourcesUsed: Array.isArray(existing.source_snapshot) ? (existing.source_snapshot as unknown as SourceUsed[]) : [],
          annexureManifest: Array.isArray(existing.annexure_manifest) ? (existing.annexure_manifest as unknown as DraftResult["annexureManifest"]) : [],
          model: existing.model_used ?? "",
        }
      : null,
  );
  const [savedId, setSavedId] = useState<string | null>(existing?.id ?? null);
  const [savedStatus, setSavedStatus] = useState<CorrespondenceRow["status"]>(existing?.status ?? "draft");
  const [savedVersion, setSavedVersion] = useState<number>(existing?.version ?? 1);
  const [bodyManuallyEdited, setBodyManuallyEdited] = useState(false);

  const isReadOnly = savedStatus === "approved" || savedStatus === "sent";

  const { data: caseDocuments } = useQuery({
    queryKey: ["case-correspondence-annexure-candidates", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, category, file_name, document_date")
        .eq("case_id", caseId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentRow[];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["correspondence-templates-active", correspondenceType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("correspondence_templates")
        .select("id, name")
        .eq("correspondence_type", correspondenceType)
        .eq("status", "active")
        .eq("approved", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (existing?.annexure_manifest && Array.isArray(existing.annexure_manifest)) {
      const ids = (existing.annexure_manifest as unknown as Array<{ documentId: string }>).map((a) => a.documentId);
      setSelectedAnnexureIds(ids);
    }
  }, [existing]);

  const toggleAnnexure = (id: string) => {
    if (isReadOnly) return;
    setSelectedAnnexureIds((prev) => (prev.includes(id) ? prev.filter((existingId) => existingId !== id) : [...prev, id]));
  };

  const runGenerate = async (revisionOf?: { body: string; instruction: string }) => {
    if (generating) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("sars-correspondence-draft", {
        body: {
          caseId,
          correspondenceType,
          purpose: purpose || undefined,
          recipient: recipient || undefined,
          subject: subject || undefined,
          sarsReference: sarsReference || undefined,
          taxType: taxType || undefined,
          taxPeriod: taxPeriod || undefined,
          deadline: deadline || undefined,
          tone,
          additionalInstructions: additionalInstructions || undefined,
          annexureDocumentIds: selectedAnnexureIds,
          templateId: templateId !== "none" ? templateId : undefined,
          priorAnalysis: !revisionOf ? initialPriorAnalysis : undefined,
          revisionOf,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setDraft(data as DraftResult);
      toast.success(revisionOf ? "Draft revised." : "Draft generated.");

      if (userId) {
        await logSystemActivity({
          actorProfileId: userId,
          actorRole: "consultant",
          action: revisionOf ? "correspondence_regenerated" : "correspondence_generated",
          targetType: "case",
          targetId: caseId,
          metadata: { correspondenceType, revised: Boolean(revisionOf) },
        });
      }
      setBodyManuallyEdited(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to generate this draft.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!draft || !userId) return;
    setSaving(true);

    try {
      const payload = {
        case_id: caseId,
        client_id: clientId,
        correspondence_type: correspondenceType,
        purpose: purpose || null,
        recipient: recipient || null,
        subject: subject || null,
        body: draft.body,
        tone,
        sars_reference: sarsReference || null,
        tax_type: taxType || null,
        tax_period: taxPeriod || null,
        deadline: deadline || null,
        generated_by_ai: true,
        model_used: draft.model || null,
        source_snapshot: draft.sourcesUsed as unknown as never,
        missing_information: draft.missingInformation,
        warnings: draft.warnings,
        annexure_manifest: draft.annexureManifest as unknown as never,
        created_by: userId,
      };

      if (savedId && !isReadOnly) {
        const { error } = await supabase.from("case_correspondence").update(payload).eq("id", savedId);
        if (error) throw new Error(error.message);
        toast.success("Draft saved.");
        await logSystemActivity({
          actorProfileId: userId,
          actorRole: "consultant",
          action: bodyManuallyEdited ? "correspondence_edited" : "correspondence_saved",
          targetType: "case",
          targetId: caseId,
          metadata: { correspondenceId: savedId },
        });
        setBodyManuallyEdited(false);
      } else if (savedId && isReadOnly) {
        // Approved/sent - never overwrite. Create a new version instead.
        const { data: inserted, error } = await supabase
          .from("case_correspondence")
          .insert({ ...payload, version: savedVersion + 1, supersedes_id: savedId, status: "draft" })
          .select("id, version, status")
          .single();
        if (error || !inserted) throw new Error(error?.message ?? "Unable to save new version.");

        await supabase.from("case_correspondence").update({ status: "superseded" }).eq("id", savedId);
        await logSystemActivity({ actorProfileId: userId, actorRole: "consultant", action: "correspondence_superseded", targetType: "case", targetId: caseId, metadata: { correspondenceId: savedId, supersededBy: inserted.id } });

        setSavedId(inserted.id);
        setSavedVersion(inserted.version);
        setSavedStatus(inserted.status);
        setBodyManuallyEdited(false);
        toast.success(`Saved as version ${inserted.version}.`);
        await logSystemActivity({ actorProfileId: userId, actorRole: "consultant", action: "correspondence_saved", targetType: "case", targetId: caseId, metadata: { correspondenceId: inserted.id, version: inserted.version, supersedes: savedId } });
      } else {
        const { data: inserted, error } = await supabase
          .from("case_correspondence")
          .insert(payload)
          .select("id, version, status")
          .single();
        if (error || !inserted) throw new Error(error?.message ?? "Unable to save this draft.");
        setSavedId(inserted.id);
        setSavedVersion(inserted.version);
        setSavedStatus(inserted.status);
        toast.success("Draft saved.");
        await logSystemActivity({ actorProfileId: userId, actorRole: "consultant", action: "correspondence_saved", targetType: "case", targetId: caseId, metadata: { correspondenceId: inserted.id } });
      }

      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save this draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!draft || !userId) return;
    try {
      const { data: inserted, error } = await supabase
        .from("case_correspondence")
        .insert({
          case_id: caseId,
          client_id: clientId,
          correspondence_type: correspondenceType,
          purpose: purpose || null,
          recipient: recipient || null,
          subject: subject ? `${subject} (copy)` : null,
          body: draft.body,
          tone,
          sars_reference: sarsReference || null,
          tax_type: taxType || null,
          tax_period: taxPeriod || null,
          deadline: deadline || null,
          generated_by_ai: true,
          model_used: draft.model || null,
          source_snapshot: draft.sourcesUsed as unknown as never,
          missing_information: draft.missingInformation,
          warnings: draft.warnings,
          annexure_manifest: draft.annexureManifest as unknown as never,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error || !inserted) throw new Error(error?.message ?? "Unable to duplicate this draft.");
      toast.success("Draft duplicated.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to duplicate this draft.");
    }
  };

  const handleCopy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(draft.body);
    toast.success("Letter text copied.");
  };

  const handleStatusChange = async (nextStatus: CorrespondenceRow["status"]) => {
    if (!savedId || !userId) return;
    try {
      const updates: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === "approved") {
        updates.approved_by = userId;
        updates.approved_at = new Date().toISOString();
      }
      if (nextStatus === "sent") {
        updates.sent_at = new Date().toISOString();
      }
      const { error } = await supabase.from("case_correspondence").update(updates).eq("id", savedId);
      if (error) throw new Error(error.message);
      setSavedStatus(nextStatus);
      toast.success(`Status updated to ${CORRESPONDENCE_STATUS_LABELS[nextStatus]}.`);

      const statusAuditAction: Record<string, "correspondence_approved" | "correspondence_archived" | null> = {
        approved: "correspondence_approved",
        archived: "correspondence_archived",
      };
      const auditAction = statusAuditAction[nextStatus] ?? null;
      if (auditAction) {
        await logSystemActivity({
          actorProfileId: userId,
          actorRole: "consultant",
          action: auditAction,
          targetType: "case",
          targetId: caseId,
          metadata: { correspondenceId: savedId, status: nextStatus },
        });
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update status.");
    }
  };

  const exportPayload = useMemo(() => draft ? {
    correspondenceType,
    subject,
    recipient,
    sarsReference,
    taxType,
    taxPeriod,
    body: draft.body,
    annexureManifest: draft.annexureManifest,
    clientLegalName: clientLabel,
  } : null, [draft, correspondenceType, subject, recipient, sarsReference, taxType, taxPeriod, clientLabel]);

  const handleExport = async (format: "word" | "pdf") => {
    if (!exportPayload) return;
    setExporting(true);
    try {
      if (format === "word") {
        await exportCorrespondenceDocx(exportPayload);
      } else {
        await exportCorrespondencePdf(exportPayload);
      }
      if (userId && savedId) {
        await logSystemActivity({ actorProfileId: userId, actorRole: "consultant", action: "correspondence_exported", targetType: "case", targetId: caseId, metadata: { correspondenceId: savedId, format } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardItemDialog
      open={open}
      onOpenChange={onOpenChange}
      title="SARS Correspondence"
      description={`${clientLabel} - ${caseLabel}`}
    >
      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Correspondence Type</label>
            <Select value={correspondenceType} onValueChange={setCorrespondenceType} disabled={isReadOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CORRESPONDENCE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Purpose</label>
            <Select value={purpose} onValueChange={setPurpose} disabled={isReadOnly}>
              <SelectTrigger><SelectValue placeholder="Select purpose..." /></SelectTrigger>
              <SelectContent>
                {CORRESPONDENCE_PURPOSES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Recipient / SARS Unit</label>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} disabled={isReadOnly} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Subject</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isReadOnly} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">SARS Reference</label>
            <Input value={sarsReference} onChange={(e) => setSarsReference(e.target.value)} disabled={isReadOnly} placeholder="Leave blank if not on record" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Tax Type</label>
            <Input value={taxType} onChange={(e) => setTaxType(e.target.value)} disabled={isReadOnly} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Tax Period</label>
            <Input value={taxPeriod} onChange={(e) => setTaxPeriod(e.target.value)} disabled={isReadOnly} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Deadline</label>
            <Input type="date" value={deadline ?? ""} onChange={(e) => setDeadline(e.target.value)} disabled={isReadOnly} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Tone</label>
            <Select value={tone} onValueChange={setTone} disabled={isReadOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CORRESPONDENCE_TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Template (optional)</label>
            <Select value={templateId} onValueChange={setTemplateId} disabled={isReadOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template — draft from scratch</SelectItem>
                {(templates ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Additional Instructions</label>
            <Textarea rows={2} value={additionalInstructions} onChange={(e) => setAdditionalInstructions(e.target.value)} disabled={isReadOnly} />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground font-body mb-2">Supporting Documents / Annexures</p>
          <div className="rounded-xl border border-border divide-y divide-border max-h-40 overflow-y-auto">
            {(caseDocuments ?? []).length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground font-body">No documents uploaded to this case yet.</p>
            ) : (
              caseDocuments!.map((doc) => (
                <label key={doc.id} className="flex items-center gap-2 p-2.5 text-sm font-body cursor-pointer">
                  <Checkbox checked={selectedAnnexureIds.includes(doc.id)} onCheckedChange={() => toggleAnnexure(doc.id)} disabled={isReadOnly} />
                  {doc.category || doc.title || doc.file_name}
                </label>
              ))
            )}
          </div>
        </div>

        {!isReadOnly ? (
          <Button type="button" className="rounded-xl w-full" onClick={() => void runGenerate()} disabled={generating}>
            <Sparkles className="h-4 w-4 mr-2" />
            {generating ? "Drafting..." : draft ? "Regenerate" : "Generate Draft"}
          </Button>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 font-body">
            This correspondence is {CORRESPONDENCE_STATUS_LABELS[savedStatus].toLowerCase()} and cannot be edited in place. Saving further changes will create a new version.
          </div>
        )}

        {draft ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">SARS CORRESPONDENCE — DRAFT</p>
              <Textarea
                rows={14}
                value={draft.body}
                onChange={(e) => {
                  if (isReadOnly) return;
                  setDraft({ ...draft, body: e.target.value });
                  setBodyManuallyEdited(true);
                }}
                disabled={isReadOnly}
                className="font-body"
              />
            </div>

            {draft.missingInformation.length > 0 ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-800 font-body mb-1.5 font-semibold">Missing Information</p>
                <ul className="text-sm text-amber-800 font-body list-disc list-inside space-y-0.5">
                  {draft.missingInformation.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            ) : null}

            {draft.warnings.length > 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-red-800 font-body mb-1.5 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Warnings
                </p>
                <ul className="text-sm text-red-800 font-body list-disc list-inside space-y-0.5">
                  {draft.warnings.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            ) : null}

            {draft.sourcesUsed.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Sources Used</p>
                <div className="flex flex-wrap gap-2">
                  {draft.sourcesUsed.map((source, i) => (
                    <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-accent border-border text-foreground font-body">
                      {source.citationLabel}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {draft.annexureManifest.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Selected Annexures</p>
                {draft.annexureManifest.map((a) => (
                  <p key={a.documentId} className="text-sm text-foreground font-body">Annexure {a.letter} - {a.label}</p>
                ))}
              </div>
            ) : null}

            {!isReadOnly ? (
              <div className="flex flex-wrap gap-2">
                {REVISION_ACTIONS.map((action) => (
                  <Button key={action.key} type="button" variant="outline" size="sm" className="rounded-xl" disabled={generating} onClick={() => void runGenerate({ body: draft.body, instruction: action.instruction })}>
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-1.5" /> Copy
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={handleDuplicate}>
                Duplicate
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void handleExport("word")} disabled={exporting}>
                <Download className="h-4 w-4 mr-1.5" /> Export Word
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void handleExport("pdf")} disabled={exporting}>
                <Download className="h-4 w-4 mr-1.5" /> Export PDF
              </Button>
              <Button type="button" size="sm" className="rounded-xl" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              {savedId && canApprove && savedStatus === "draft" ? (
                <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => void handleStatusChange("under_review")}>
                  Move to Under Review
                </Button>
              ) : null}
              {savedId && canApprove && (savedStatus === "draft" || savedStatus === "under_review") ? (
                <Button type="button" size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => void handleStatusChange("approved")}>
                  Approve
                </Button>
              ) : null}
              {savedId && canApprove && savedStatus === "approved" ? (
                <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => void handleStatusChange("sent")}>
                  Mark as Sent
                </Button>
              ) : null}
              {savedId && canApprove && (savedStatus === "draft" || savedStatus === "under_review") ? (
                <Button type="button" size="sm" variant="outline" className="rounded-xl text-muted-foreground" onClick={() => void handleStatusChange("archived")}>
                  Archive
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground font-body">
              Correspondence is never sent automatically. Marking "Sent" only records that a practitioner sent it outside Acapolite.
            </p>
          </div>
        ) : null}
      </div>
    </DashboardItemDialog>
  );
}
