import { normalizeMetadata } from "../../../../supabase/functions/_shared/ingestionMetadata";
import { DocumentIngestionDialog } from "./DocumentIngestionDialog";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Paperclip, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { KnowledgeActionConfirm } from "@/components/dashboard/admin/KnowledgeActionConfirm";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { logSystemActivity } from "@/lib/systemActivityLog";
import {
  runKnowledgeIndex,
  downloadAiKnowledgeFile,
  AI_INDEX_STATUS_LABELS,
  KNOWLEDGE_STATUS_LABELS,
  buildTaxKnowledgeStoragePath,
  computeFileChecksumSha256,
  deleteAiKnowledgeRecord,
  findTaxKnowledgeDuplicateByChecksum,
  getAiIndexStatusBadgeClass,
  getAiKnowledgeSignedUrl,
  getKnowledgeStatusBadgeClass,
  uploadToDocumentsBucket,
  validateAiKnowledgeFile,
} from "@/lib/aiKnowledgeStorage";

type KnowledgeRow = Tables<"tax_knowledge_library">;

type FormState = {
  title: string;
  category: string;
  source: string;
  issuing_authority: string;
  tax_type: string;
  legislation: string;
  section_reference: string;
  publication_date: string;
  effective_from: string;
  effective_to: string;
  version: string;
  jurisdiction: string;
  source_url: string;
  summary: string;
  tags: string;
  status: KnowledgeRow["status"];
  approved_for_ai_use: boolean;
};

const emptyForm: FormState = {
  title: "",
  category: "",
  source: "",
  issuing_authority: "",
  tax_type: "",
  legislation: "",
  section_reference: "",
  publication_date: "",
  effective_from: "",
  effective_to: "",
  version: "",
  jurisdiction: "South Africa",
  source_url: "",
  summary: "",
  tags: "",
  status: "draft",
  approved_for_ai_use: false,
};

export function TaxKnowledgeLibraryPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [confirmDuplicateUpload, setConfirmDuplicateUpload] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [retryingIndex, setRetryingIndex] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["ai-knowledge-tax-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_knowledge_library")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setSelectedFile(null);
    setDuplicateWarning(null);
    setConfirmDuplicateUpload(false);
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (row: KnowledgeRow) => {
    setEditingId(row.id);
    setForm({
      title: row.title,
      category: row.category ?? "",
      source: row.source ?? "",
      issuing_authority: row.issuing_authority ?? "",
      tax_type: row.tax_type ?? "",
      legislation: row.legislation ?? "",
      section_reference: row.section_reference ?? "",
      publication_date: row.publication_date ?? "",
      effective_from: row.effective_from ?? "",
      effective_to: row.effective_to ?? "",
      version: row.version ?? "",
      jurisdiction: row.jurisdiction,
      source_url: row.source_url ?? "",
      summary: row.summary ?? "",
      tags: (row.tags ?? []).join(", "),
      status: row.status,
      approved_for_ai_use: row.approved_for_ai_use,
    });
    setSelectedFile(null);
    setDuplicateWarning(null);
    setConfirmDuplicateUpload(false);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    resetForm();
  };

  const handleFileSelected = async (file: File | null) => {
    setSelectedFile(file);
    setDuplicateWarning(null);
    setConfirmDuplicateUpload(false);

    if (!file) return;

    const validationError = validateAiKnowledgeFile(file);
    if (validationError) {
      toast.error(validationError);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      const checksum = await computeFileChecksumSha256(file);
      const duplicate = await findTaxKnowledgeDuplicateByChecksum(checksum);
      if (duplicate && duplicate.id !== editingId) {
        setDuplicateWarning(
          `This exact file already exists in the Tax Knowledge Library as "${duplicate.title}" (status: ${duplicate.status}, added ${new Date(duplicate.created_at).toLocaleDateString()}).`,
        );
      }
    } catch (error) {
      console.error("Checksum/duplicate check failed", error);
    }
  };

  const triggerIndexing = async (id: string, action: "index" | "remove") => {
    try {
      const status = await runKnowledgeIndex("tax_knowledge_library", id, action);
      if (status === "processing") toast.info("Still processing. Use Check / Retry Indexing to check completion.");
    } catch (error) {toast.error(error instanceof Error ? error.message : "Indexing failed. Original preserved.");}
    await queryClient.invalidateQueries({ queryKey: ["ai-knowledge-tax-library"] });
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }

    if (!user) {
      toast.error("Your session is not ready yet.");
      return;
    }

    if (duplicateWarning && !confirmDuplicateUpload) {
      toast.error("Confirm you want to proceed with a possible duplicate before saving.");
      return;
    }

    setSaving(true);


    try {
      const tags = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      let fileFields: Partial<KnowledgeRow> = {};

      if (selectedFile) {
        const checksum = await computeFileChecksumSha256(selectedFile);
        const path = buildTaxKnowledgeStoragePath(selectedFile.name);
        await uploadToDocumentsBucket(path, selectedFile);
        fileFields = {
          file_name: selectedFile.name,
          file_path: path,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          checksum_sha256: checksum,
          ai_index_status: "pending",
        };
      }

      const payload = {
        title: form.title.trim(),
        category: form.category.trim() || null,
        source: form.source.trim() || null,
        issuing_authority: form.issuing_authority.trim() || null,
        tax_type: form.tax_type.trim() || null,
        legislation: form.legislation.trim() || null,
        section_reference: form.section_reference.trim() || null,
        publication_date: form.publication_date || null,
        effective_from: form.effective_from || null,
        effective_to: form.effective_to || null,
        version: form.version.trim() || null,
        jurisdiction: form.jurisdiction.trim() || "South Africa",
        source_url: form.source_url.trim() || null,
        summary: form.summary.trim() || null,
        tags: tags.length > 0 ? tags : null,
        status: form.status,
        approved_for_ai_use: form.approved_for_ai_use,
        ...fileFields,
      };

      const previousEntry = editingId ? entries?.find((entry) => entry.id === editingId) : undefined;

      let savedId = editingId;

      if (editingId) {
        const { error } = await supabase.from("tax_knowledge_library").update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);

        await logSystemActivity({
          actorProfileId: user.id,
          actorRole: "admin",
          action: "tax_knowledge_updated",
          targetType: "tax_knowledge_library",
          targetId: editingId,
          metadata: { title: payload.title },
        });
        if (selectedFile && previousEntry?.file_path) {
          await logSystemActivity({
            actorProfileId: user.id,
            actorRole: "admin",
            action: "knowledge_file_replaced",
            targetType: "tax_knowledge_library",
            targetId: editingId,
            metadata: {
              title: payload.title,
              previousFilePath: previousEntry.file_path,
              filePath: selectedFile ? fileFields.file_path : null,
              checksumSha256: fileFields.checksum_sha256,
            },
          });
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("tax_knowledge_library")
          .insert({ ...payload, created_by: user.id })
          .select("id")
          .single();
        if (error || !inserted) throw new Error(error?.message ?? "Unable to save entry.");
        savedId = inserted.id;

        await logSystemActivity({
          actorProfileId: user.id,
          actorRole: "admin",
          action: "tax_knowledge_uploaded",
          targetType: "tax_knowledge_library",
          targetId: inserted.id,
          metadata: { title: payload.title, hasFile: Boolean(selectedFile) },
        });
        await logSystemActivity({
          actorProfileId: user.id,
          actorRole: "admin",
          action: "knowledge_entry_created",
          targetType: "tax_knowledge_library",
          targetId: inserted.id,
          metadata: {
            title: payload.title,
            filePath: fileFields.file_path,
            checksumSha256: fileFields.checksum_sha256,
          },
        });
      }

      if (savedId) {
        const revokingApproval = Boolean(previousEntry?.approved_for_ai_use) && !payload.approved_for_ai_use;
        const nowArchived = previousEntry?.status !== "archived" && payload.status === "archived";

        if (payload.approved_for_ai_use && payload.status !== "archived" && (selectedFile || !previousEntry?.approved_for_ai_use)) {
          await triggerIndexing(savedId, "index");
        } else if (revokingApproval || nowArchived) {
          await triggerIndexing(savedId, "remove");
          await logSystemActivity({ actorProfileId: user.id, actorRole: "admin", action: "index_removed", targetType: "tax_knowledge_library", targetId: savedId, metadata: { reason: nowArchived ? "archived" : "approval_revoked" } });

          await logSystemActivity({
            actorProfileId: user.id,
            actorRole: "admin",
            action: "tax_knowledge_ai_revoked",
            targetType: "tax_knowledge_library",
            targetId: savedId,
            metadata: { reason: nowArchived ? "archived" : "approval_revoked" },
          });
        }
      }

      toast.success(editingId ? "Entry updated." : "Entry added to the Tax Knowledge Library.");
      await queryClient.invalidateQueries({ queryKey: ["ai-knowledge-tax-library"] });
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      // Preserve the private original even if indexing or a later operation fails.
      toast.error(error instanceof Error ? error.message : "Unable to save this entry.");
    } finally {
      setSaving(false);
    }
  };

  const handleRetryIndexing = async () => {
    if (!editingId) return;
    setRetryingIndex(true);
    try {
      await logSystemActivity({ actorProfileId: user.id!, actorRole: "admin", action: "index_retried", targetType: "tax_knowledge_library", targetId: editingId, metadata: {} });
      await triggerIndexing(editingId, "index");
    } finally {
      setRetryingIndex(false);
    }
  };

  const handleLifecycle = async (action: "archive" | "restore" | "delete") => {
    const row = entries?.find((entry) => entry.id === editingId);
    if (!row || !user) return;
    setLifecycleBusy(true);
    try {
      if (action === "delete") {
        await deleteAiKnowledgeRecord("tax_knowledge_library", row.id);
        toast.success("Tax Knowledge entry deleted.");
        setDeleteDialogOpen(false);
        setDialogOpen(false);
        resetForm();
      } else {
        const nextStatus = action === "archive" ? "archived" : "draft";
        const { error } = await supabase.from("tax_knowledge_library").update({ status: nextStatus, approved_for_ai_use: action === "restore" ? row.approved_for_ai_use : false, ai_index_status: action === "archive" ? "removed" : row.ai_index_status }).eq("id", row.id);
        if (error) throw new Error(error.message);
        if (action === "archive") {
          await triggerIndexing(row.id, "remove");
          await logSystemActivity({ actorProfileId: user.id, actorRole: "admin", action: "index_removed", targetType: "tax_knowledge_library", targetId: row.id, metadata: { reason: "archived" } });
          await logSystemActivity({ actorProfileId: user.id, actorRole: "admin", action: "knowledge_entry_archived", targetType: "tax_knowledge_library", targetId: row.id, metadata: { title: row.title } });
        }
        if (action === "restore" && row.approved_for_ai_use && row.file_path) await triggerIndexing(row.id, "index");
        if (action === "restore") await logSystemActivity({ actorProfileId: user.id, actorRole: "admin", action: "knowledge_entry_restored", targetType: "tax_knowledge_library", targetId: row.id, metadata: { title: row.title } });
        toast.success(action === "archive" ? "Entry archived." : "Entry restored.");
      }
      await queryClient.invalidateQueries({ queryKey: ["ai-knowledge-tax-library"] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Lifecycle action failed; no record was deleted."); }
    finally { setLifecycleBusy(false); }
  };

  const openFile = async (row: KnowledgeRow) => {
    if (!row.file_path) return;
    setOpeningId(row.id);
    try {
      const url = await getAiKnowledgeSignedUrl(row.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open this file.");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-body max-w-2xl">
          Global tax legislation, SARS guidance, court authority and internal guidance. Never linked to a client or
          case. Only entries with <span className="font-semibold">Current</span> status and{" "}
          <span className="font-semibold">AI use approved</span> are treated as current authority by Tax AI.
        </p>
        <Button className="rounded-xl shrink-0" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </div>

      <DocumentIngestionDialog kind="tax_knowledge" />

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : entries && entries.length > 0 ? (
        <div className="grid gap-3">
          {entries.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => openEditDialog(row)}
              className="w-full text-left bg-card rounded-xl border border-border shadow-card p-4 hover:shadow-elevated hover:border-primary/30 transition-all"
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="font-body font-medium text-foreground">{row.title}</p>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border font-body ${getKnowledgeStatusBadgeClass(row.status)}`}>
                  {KNOWLEDGE_STATUS_LABELS[row.status]}
                </span>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border font-body ${row.approved_for_ai_use ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-slate-100 text-slate-600 border-slate-300"}`}>
                  {row.approved_for_ai_use ? "AI Use Approved" : "Not Approved for AI"}
                </span>
                {row.file_path ? (
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border font-body ${getAiIndexStatusBadgeClass(row.ai_index_status)}`}>
                    {AI_INDEX_STATUS_LABELS[row.ai_index_status]}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground font-body">
                {[row.category, row.tax_type, row.issuing_authority].filter(Boolean).join(" | ") || "No category set"}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-body">No Tax Knowledge Library entries yet.</p>
        </div>
      )}

      <DashboardItemDialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        title={editingId ? "Edit Tax Knowledge Entry" : "Add Tax Knowledge Entry"}
        description="Global reference material. Not linked to any client or case."
      >
        <div className="space-y-5">
          {editingId && entries?.find(e => e.id === editingId)?.file_path && <Button variant="outline" disabled={saving} onClick={async () => {
            setSaving(true);
            try {
              const file = entries.find(e => e.id === editingId)!;
              const {data, error} = await supabase.functions.invoke("ai-document-analyze", {body: {kind: "tax_knowledge", files: [{path: file.file_path}]}});
              if (error || data?.error) throw new Error(data?.error ?? error?.message);
              setForm(f => ({...f, ...normalizeMetadata("tax_knowledge", data.metadata)}));
              toast.info("Proposed details loaded. Review before saving; unknown dates stay blank.");
            } catch (error) {toast.error(error instanceof Error ? error.message : "Analysis failed. Original preserved.");}
            finally {setSaving(false);}
          }}>Propose details from document</Button>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Title *</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Category</label>
              <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Legislation, SARS Guide, Court Judgment" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Source</label>
              <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Issuing Authority</label>
              <Input value={form.issuing_authority} onChange={(e) => setForm((f) => ({ ...f, issuing_authority: e.target.value }))} placeholder="e.g. SARS, Tax Court" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Tax Type</label>
              <Input value={form.tax_type} onChange={(e) => setForm((f) => ({ ...f, tax_type: e.target.value }))} placeholder="e.g. VAT, PAYE, Income Tax" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Legislation</label>
              <Input value={form.legislation} onChange={(e) => setForm((f) => ({ ...f, legislation: e.target.value }))} placeholder="e.g. Tax Administration Act" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Section Reference</label>
              <Input value={form.section_reference} onChange={(e) => setForm((f) => ({ ...f, section_reference: e.target.value }))} placeholder="e.g. s104" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Publication Date</label>
              <Input type="date" value={form.publication_date} onChange={(e) => setForm((f) => ({ ...f, publication_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Effective From</label>
              <Input type="date" value={form.effective_from} onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Effective To</label>
              <Input type="date" value={form.effective_to} onChange={(e) => setForm((f) => ({ ...f, effective_to: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Version</label>
              <Input value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Jurisdiction</label>
              <Input value={form.jurisdiction} onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Source URL</label>
              <Input value={form.source_url} onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Summary</label>
              <Textarea rows={3} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Tags (comma separated)</label>
              <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="vat, objection, dispute-resolution" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Status</label>
              <Select value={form.status} onValueChange={(value) => setForm((f) => ({ ...f, status: value as FormState["status"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KNOWLEDGE_STATUS_LABELS) as Array<KnowledgeRow["status"]>).map((status) => (
                    <SelectItem key={status} value={status}>{KNOWLEDGE_STATUS_LABELS[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.status === "superseded" ? (
                <p className="text-xs text-muted-foreground font-body mt-2 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-orange-500" />
                  Superseded material stays searchable for historical context but must never be presented as current authority.
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-semibold text-foreground font-body">Approved for AI Use</p>
                <p className="text-xs text-muted-foreground font-body">Only approved entries are retrievable by Tax AI.</p>
              </div>
              <Switch checked={form.approved_for_ai_use} onCheckedChange={(checked) => setForm((f) => ({ ...f, approved_for_ai_use: checked }))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">
              {editingId ? "Replace File (optional)" : "File"}
            </label>
            <div className="rounded-2xl border border-dashed border-border bg-accent/40 p-4">
              <Input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => void handleFileSelected(event.target.files?.[0] ?? null)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-body text-sm text-foreground min-w-0 truncate">
                  {selectedFile ? selectedFile.name : "No file selected"}
                </p>
                <Button type="button" variant="outline" className="rounded-xl shrink-0" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-4 w-4 mr-2" />
                  {selectedFile ? "Change File" : "Choose File"}
                </Button>
              </div>
            </div>
            {duplicateWarning ? (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm text-amber-800 font-body flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  {duplicateWarning}
                </p>
                <label className="flex items-center gap-2 mt-2 text-sm text-amber-800 font-body">
                  <input
                    type="checkbox"
                    checked={confirmDuplicateUpload}
                    onChange={(e) => setConfirmDuplicateUpload(e.target.checked)}
                  />
                  Upload anyway
                </label>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Entry"}
            </Button>
          </div>

          {editingId ? (
            <div className="pt-2 border-t border-border flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => void handleLifecycle(form.status === "archived" ? "restore" : "archive")} disabled={lifecycleBusy}>{lifecycleBusy ? "Working..." : form.status === "archived" ? "Restore" : "Archive"}</Button>
              <Button type="button" variant="destructive" className="rounded-xl" onClick={() => setDeleteDialogOpen(true)} disabled={lifecycleBusy}>Delete</Button>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => openFile(entries!.find((e) => e.id === editingId)!)} disabled={openingId === editingId || !entries?.find((e) => e.id === editingId)?.file_path}>
                <ExternalLink className="h-4 w-4 mr-2" />
                {openingId === editingId ? "Opening..." : "Open Current File"}
              </Button>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => { const file = entries?.find((e) => e.id === editingId); if (file?.file_path) void downloadAiKnowledgeFile(file.file_path, file.file_name ?? undefined); }} disabled={!entries?.find((e) => e.id === editingId)?.file_path}>Download</Button>
              {entries?.find((e) => e.id === editingId)?.file_path ? (
                <>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border font-body ${getAiIndexStatusBadgeClass(entries.find((e) => e.id === editingId)!.ai_index_status)}`}>
                    {AI_INDEX_STATUS_LABELS[entries.find((e) => e.id === editingId)!.ai_index_status]}
                  </span>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => void handleRetryIndexing()} disabled={retryingIndex}>
                    {retryingIndex ? "Checking..." : "Check / Retry Indexing"}
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </DashboardItemDialog>

      <KnowledgeActionConfirm
        open={deleteDialogOpen}
        onOpenChange={(open) => { if (!open) setDeleteDialogOpen(false); }}
        title="Delete Tax Knowledge entry permanently?"
        description="This permanently removes the source document and AI index. This action cannot be undone."
        confirmLabel="Delete Entry"
        busyLabel="Deleting..."
        busy={lifecycleBusy}
        onConfirm={() => handleLifecycle("delete")}
      />
    </div>
  );
}
