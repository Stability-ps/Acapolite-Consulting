import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Paperclip, Plus, ShieldAlert, Upload } from "lucide-react";
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { logSystemActivity } from "@/lib/systemActivityLog";
import {
  AI_INDEX_STATUS_LABELS,
  ANONYMISATION_STATUS_LABELS,
  buildPastCaseDocumentStoragePath,
  computeFileChecksumSha256,
  findPastCaseDocumentDuplicateByChecksum,
  getAiIndexStatusBadgeClass,
  getAiKnowledgeSignedUrl,
  getAnonymisationStatusBadgeClass,
  removeFromDocumentsBucket,
  uploadToDocumentsBucket,
  validateAiKnowledgeFile,
} from "@/lib/aiKnowledgeStorage";

type PastCaseRow = Tables<"past_cases">;
type PastCaseDocumentRow = Tables<"past_case_documents">;

type FormState = {
  title: string;
  case_type: string;
  tax_type: string;
  sars_stage: string;
  issue: string;
  outcome: string;
  success_status: string;
  summary: string;
  facts_summary: string;
  key_arguments: string;
  supporting_documents_summary: string;
  lessons_learned: string;
  precedent_value: string;
  tags: string;
  closed_date: string;
  anonymisation_status: PastCaseRow["anonymisation_status"];
  approved_for_ai_use: boolean;
};

const emptyForm: FormState = {
  title: "",
  case_type: "",
  tax_type: "",
  sars_stage: "",
  issue: "",
  outcome: "",
  success_status: "",
  summary: "",
  facts_summary: "",
  key_arguments: "",
  supporting_documents_summary: "",
  lessons_learned: "",
  precedent_value: "",
  tags: "",
  closed_date: "",
  anonymisation_status: "not_reviewed",
  approved_for_ai_use: false,
};

export function PastCasesPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [confirmDuplicateUpload, setConfirmDuplicateUpload] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["ai-knowledge-past-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("past_cases")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: activeDocuments, refetch: refetchDocuments } = useQuery({
    queryKey: ["ai-knowledge-past-case-documents", editingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("past_case_documents")
        .select("*")
        .eq("past_case_id", editingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(editingId),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setSelectedFile(null);
    setDuplicateWarning(null);
    setConfirmDuplicateUpload(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (row: PastCaseRow) => {
    setEditingId(row.id);
    setForm({
      title: row.title,
      case_type: row.case_type ?? "",
      tax_type: row.tax_type ?? "",
      sars_stage: row.sars_stage ?? "",
      issue: row.issue ?? "",
      outcome: row.outcome ?? "",
      success_status: row.success_status ?? "",
      summary: row.summary ?? "",
      facts_summary: row.facts_summary ?? "",
      key_arguments: row.key_arguments ?? "",
      supporting_documents_summary: row.supporting_documents_summary ?? "",
      lessons_learned: row.lessons_learned ?? "",
      precedent_value: row.precedent_value ?? "",
      tags: (row.tags ?? []).join(", "),
      closed_date: row.closed_date ?? "",
      anonymisation_status: row.anonymisation_status,
      approved_for_ai_use: row.approved_for_ai_use,
    });
    setSelectedFile(null);
    setDuplicateWarning(null);
    setConfirmDuplicateUpload(false);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving || uploadingDocument) return;
    setDialogOpen(false);
    resetForm();
  };

  const handleSaveMetadata = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!user) {
      toast.error("Your session is not ready yet.");
      return;
    }
    if (form.approved_for_ai_use && form.anonymisation_status === "contains_confidential_information") {
      toast.error("This record is flagged as containing confidential information and cannot be approved for AI use until it is reviewed and anonymised.");
      return;
    }

    setSaving(true);

    try {
      const tags = form.tags.split(",").map((tag) => tag.trim()).filter(Boolean);

      const payload = {
        title: form.title.trim(),
        case_type: form.case_type.trim() || null,
        tax_type: form.tax_type.trim() || null,
        sars_stage: form.sars_stage.trim() || null,
        issue: form.issue.trim() || null,
        outcome: form.outcome.trim() || null,
        success_status: form.success_status.trim() || null,
        summary: form.summary.trim() || null,
        facts_summary: form.facts_summary.trim() || null,
        key_arguments: form.key_arguments.trim() || null,
        supporting_documents_summary: form.supporting_documents_summary.trim() || null,
        lessons_learned: form.lessons_learned.trim() || null,
        precedent_value: form.precedent_value.trim() || null,
        tags: tags.length > 0 ? tags : null,
        closed_date: form.closed_date || null,
        anonymisation_status: form.anonymisation_status,
        approved_for_ai_use: form.approved_for_ai_use,
      };

      if (editingId) {
        const { error } = await supabase.from("past_cases").update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);

        await logSystemActivity({
          actorProfileId: user.id,
          actorRole: "admin",
          action: "past_case_updated",
          targetType: "past_case",
          targetId: editingId,
          metadata: { title: payload.title, anonymisation_status: payload.anonymisation_status, approved_for_ai_use: payload.approved_for_ai_use },
        });

        toast.success("Past case updated.");
      } else {
        const { data: inserted, error } = await supabase
          .from("past_cases")
          .insert({ ...payload, created_by: user.id })
          .select("id")
          .single();
        if (error || !inserted) throw new Error(error?.message ?? "Unable to save this precedent.");

        await logSystemActivity({
          actorProfileId: user.id,
          actorRole: "admin",
          action: "past_case_created",
          targetType: "past_case",
          targetId: inserted.id,
          metadata: { title: payload.title },
        });

        toast.success("Past case saved. You can now attach supporting documents.");
        setEditingId(inserted.id);
      }

      await queryClient.invalidateQueries({ queryKey: ["ai-knowledge-past-cases"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save this precedent.");
    } finally {
      setSaving(false);
    }
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
      const duplicate = await findPastCaseDocumentDuplicateByChecksum(checksum);
      if (duplicate) {
        setDuplicateWarning(
          `This exact file is already attached as "${duplicate.file_name}" (added ${new Date(duplicate.created_at).toLocaleDateString()}).`,
        );
      }
    } catch (error) {
      console.error("Checksum/duplicate check failed", error);
    }
  };

  const handleUploadDocument = async () => {
    if (!editingId || !selectedFile || !user) return;
    if (duplicateWarning && !confirmDuplicateUpload) {
      toast.error("Confirm you want to attach a possible duplicate before uploading.");
      return;
    }

    setUploadingDocument(true);
    let uploadedPath: string | null = null;

    try {
      const checksum = await computeFileChecksumSha256(selectedFile);
      const path = buildPastCaseDocumentStoragePath(editingId, selectedFile.name);
      await uploadToDocumentsBucket(path, selectedFile);
      uploadedPath = path;

      const { data: inserted, error } = await supabase
        .from("past_case_documents")
        .insert({
          past_case_id: editingId,
          file_name: selectedFile.name,
          file_path: path,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          checksum_sha256: checksum,
          ai_index_status: "pending",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (error || !inserted) throw new Error(error?.message ?? "Unable to save this document.");

      await logSystemActivity({
        actorProfileId: user.id,
        actorRole: "admin",
        action: "past_case_document_uploaded",
        targetType: "past_case_document",
        targetId: inserted.id,
        metadata: { pastCaseId: editingId, fileName: selectedFile.name },
      });

      toast.success("Document attached.");
      setSelectedFile(null);
      setDuplicateWarning(null);
      setConfirmDuplicateUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refetchDocuments();
    } catch (error) {
      if (uploadedPath) await removeFromDocumentsBucket(uploadedPath);
      toast.error(error instanceof Error ? error.message : "Unable to attach this document.");
    } finally {
      setUploadingDocument(false);
    }
  };

  const openDocument = async (doc: PastCaseDocumentRow) => {
    setOpeningDocId(doc.id);
    try {
      const url = await getAiKnowledgeSignedUrl(doc.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open this file.");
    } finally {
      setOpeningDocId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 font-body">
          Historical case material may contain taxpayer information. Redact or anonymise confidential information
          before marking a precedent <span className="font-semibold">Approved for AI Use</span>. Only approved
          precedents are retrievable by Tax AI, and they are used as practical precedent — never as binding law.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-body max-w-2xl">
          Global institutional knowledge. Never linked to a current client or case.
        </p>
        <Button className="rounded-xl shrink-0" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Past Case
        </Button>
      </div>

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
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border font-body ${getAnonymisationStatusBadgeClass(row.anonymisation_status)}`}>
                  {ANONYMISATION_STATUS_LABELS[row.anonymisation_status]}
                </span>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border font-body ${row.approved_for_ai_use ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-slate-100 text-slate-600 border-slate-300"}`}>
                  {row.approved_for_ai_use ? "AI Use Approved" : "Not Approved for AI"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-body">
                {[row.case_type, row.tax_type, row.success_status].filter(Boolean).join(" | ") || "No classification set"}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-body">No past cases recorded yet.</p>
        </div>
      )}

      <DashboardItemDialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        title={editingId ? "Edit Past Case" : "Add Past Case"}
        description="Global institutional precedent. Not linked to any current client or case."
      >
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Title *</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Case Type</label>
              <Input value={form.case_type} onChange={(e) => setForm((f) => ({ ...f, case_type: e.target.value }))} placeholder="e.g. VAT Audit, Objection" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Tax Type</label>
              <Input value={form.tax_type} onChange={(e) => setForm((f) => ({ ...f, tax_type: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">SARS Stage</label>
              <Input value={form.sars_stage} onChange={(e) => setForm((f) => ({ ...f, sars_stage: e.target.value }))} placeholder="e.g. ADR, Appeal" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Success Status</label>
              <Input value={form.success_status} onChange={(e) => setForm((f) => ({ ...f, success_status: e.target.value }))} placeholder="e.g. Successful, Partially Successful" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Issue</label>
              <Textarea rows={2} value={form.issue} onChange={(e) => setForm((f) => ({ ...f, issue: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Outcome</label>
              <Textarea rows={2} value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Summary</label>
              <Textarea rows={3} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Facts Summary</label>
              <Textarea rows={3} value={form.facts_summary} onChange={(e) => setForm((f) => ({ ...f, facts_summary: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Key Arguments</label>
              <Textarea rows={3} value={form.key_arguments} onChange={(e) => setForm((f) => ({ ...f, key_arguments: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Supporting Documents Summary</label>
              <Textarea rows={2} value={form.supporting_documents_summary} onChange={(e) => setForm((f) => ({ ...f, supporting_documents_summary: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Lessons Learned</label>
              <Textarea rows={2} value={form.lessons_learned} onChange={(e) => setForm((f) => ({ ...f, lessons_learned: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Precedent Value</label>
              <Textarea rows={2} value={form.precedent_value} onChange={(e) => setForm((f) => ({ ...f, precedent_value: e.target.value }))} placeholder="Why this precedent is useful for similar future matters" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Closed Date</label>
              <Input type="date" value={form.closed_date} onChange={(e) => setForm((f) => ({ ...f, closed_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Tags (comma separated)</label>
              <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Anonymisation Status</label>
              <Select value={form.anonymisation_status} onValueChange={(value) => setForm((f) => ({ ...f, anonymisation_status: value as FormState["anonymisation_status"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ANONYMISATION_STATUS_LABELS) as Array<PastCaseRow["anonymisation_status"]>).map((status) => (
                    <SelectItem key={status} value={status}>{ANONYMISATION_STATUS_LABELS[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-semibold text-foreground font-body">Approved for AI Use</p>
                <p className="text-xs text-muted-foreground font-body">Only approved precedents are retrievable by Tax AI.</p>
              </div>
              <Switch checked={form.approved_for_ai_use} onCheckedChange={(checked) => setForm((f) => ({ ...f, approved_for_ai_use: checked }))} />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={handleSaveMetadata} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Save & Continue"}
            </Button>
          </div>

          {editingId ? (
            <div className="pt-4 border-t border-border space-y-3">
              <p className="text-sm font-semibold text-foreground font-body">Supporting Documents</p>

              {(activeDocuments ?? []).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="font-body text-sm text-foreground truncate">{doc.file_name}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border font-body ${getAiIndexStatusBadgeClass(doc.ai_index_status)}`}>
                      {AI_INDEX_STATUS_LABELS[doc.ai_index_status]}
                    </span>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => openDocument(doc)} disabled={openingDocId === doc.id}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    {openingDocId === doc.id ? "Opening..." : "Open"}
                  </Button>
                </div>
              ))}

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
                    {selectedFile ? selectedFile.name : "Attach a supporting document"}
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                    <Button type="button" className="rounded-xl" onClick={handleUploadDocument} disabled={!selectedFile || uploadingDocument}>
                      {uploadingDocument ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                </div>
              </div>
              {duplicateWarning ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <p className="text-sm text-amber-800 font-body flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    {duplicateWarning}
                  </p>
                  <label className="flex items-center gap-2 mt-2 text-sm text-amber-800 font-body">
                    <input type="checkbox" checked={confirmDuplicateUpload} onChange={(e) => setConfirmDuplicateUpload(e.target.checked)} />
                    Upload anyway
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </DashboardItemDialog>
    </div>
  );
}
