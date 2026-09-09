import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logSystemActivity } from "@/lib/systemActivityLog";
import { computeFileChecksumSha256, downloadAiKnowledgeFile, getAiKnowledgeSignedUrl, removeFromDocumentsBucket, sanitizeAiKnowledgeFileName, uploadToDocumentsBucket } from "@/lib/aiKnowledgeStorage";
import { metadataFields, normalizeMetadata, type IngestionKind } from "../../../../supabase/functions/_shared/ingestionMetadata";

type SourceFile = {file_name: string; file_path: string; file_size: number; mime_type: string; checksum_sha256: string};
const titles = {tax_knowledge: "Upload Document", past_case: "Upload Past Case", template: "Upload Template"};
export function DocumentIngestionDialog({kind}: {kind: IngestionKind}) {
  const {user} = useAuth();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [metadata, setMetadata] = useState<Record<string, string>>(normalizeMetadata(kind, {}));
  const [reviewed, setReviewed] = useState(false);
  const [pastCaseId, setPastCaseId] = useState<string | null>(null);
  const [savedPaths, setSavedPaths] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const cleanupTemporaryFiles = async (paths: string[]) => {
    const temporaryPaths = paths.filter(path => path.startsWith("ai-knowledge/intake/"));
    if (!temporaryPaths.length) return;
    try {
      await Promise.all(temporaryPaths.map(async path => {
        await removeFromDocumentsBucket(path);
        if (user) await logSystemActivity({ actorProfileId: user.id, actorRole: "admin", action: "temporary_upload_cleaned", targetType: "document", targetId: null, metadata: { domain: kind, filePath: path } });
      }));
    } catch (error) {
      console.error("Temporary upload cleanup failed", error);
      setNotice("The file was removed from this form, but private temporary cleanup needs attention.");
    }
  };
  const analyse = async (sources = files) => {
    setBusy(true);
    try {
      const {data, error} = await supabase.functions.invoke("ai-document-analyze", {body: {kind, files: sources.map(f => ({path: f.file_path}))}});
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      setMetadata(normalizeMetadata(kind, data.metadata));
      setReviewed(false);
      setNotice("Proposed from document content. Review every field; unknown dates stay blank.");
    } catch (error) {setNotice(error instanceof Error ? error.message : "Analysis failed. Retry or enter details manually. Original preserved.");}
    finally {setBusy(false);}
  };
  const upload = async (selection: FileList | null) => {
    if (!selection || !user) return;
    const selected = Array.from(selection);
    if (selected.length > (kind === "past_case" ? 5 : 1) || selected.some(f => !/\.(pdf|docx|txt)$/i.test(f.name) || f.size < 1 || f.size > 10 * 1024 * 1024) || selected.reduce((n,f) => n+f.size, 0) > 20*1024*1024) {toast.error("Choose PDF, DOCX or TXT: 10 MB per file; up to five files and 20 MB for one past case."); return;}
    setBusy(true); setNotice("");
    const next: SourceFile[] = [];
    try {
      for (const file of selected) {
        const checksum = await computeFileChecksumSha256(file);
        if (next.some(f => f.checksum_sha256 === checksum)) continue;
        const {data, error} = kind === "tax_knowledge"
          ? await supabase.from("tax_knowledge_library").select("id").eq("checksum_sha256", checksum).limit(1)
          : kind === "past_case"
            ? await supabase.from("past_case_documents").select("id").eq("checksum_sha256", checksum).limit(1)
            : await supabase.from("correspondence_templates").select("id").eq("source_checksum_sha256", checksum).limit(1);
        if (error) throw error;
        if (data?.length) throw new Error(`${file.name} already exists. Open the existing record instead.`);
        const path = `ai-knowledge/intake/${user.id}/${crypto.randomUUID()}/${sanitizeAiKnowledgeFileName(file.name)}`;
        await uploadToDocumentsBucket(path, file);
        next.push({file_name: file.name, file_path: path, file_size: file.size, mime_type: file.type || "text/plain", checksum_sha256: checksum});
        setFiles([...next]);
      }
      await analyse(next);
    } catch (error) {setNotice(error instanceof Error ? error.message : "Upload failed. Successfully uploaded originals remain private.");}
    finally {setBusy(false);}
  };
  const save = async () => {
    if (!user || !files.length || !reviewed) return;
    const values = normalizeMetadata(kind, metadata);
    if (!(values.title || values.name)?.trim()) {toast.error("A title or template name is required."); return;}
    setBusy(true);
    try {
      const nullable = Object.fromEntries(Object.entries(values).map(([k,v]) => [k, v || null]));
      const tags = values.tags?.split(",").map(t => t.trim()).filter(Boolean) ?? [];
      if (kind === "tax_knowledge") {
        const {data: inserted, error} = await supabase.from("tax_knowledge_library").insert({...nullable, title: values.title, jurisdiction: values.jurisdiction || "South Africa", tags, ...files[0], status: "draft", approved_for_ai_use: false, ai_index_status: "pending", created_by: user.id}).select("id").single();
        if (error || !inserted) throw error ?? new Error("Unable to save Tax Knowledge entry.");
        await logSystemActivity({ actorProfileId: user.id, actorRole: "admin", action: "knowledge_entry_created", targetType: "tax_knowledge_library", targetId: inserted.id, metadata: { title: values.title, filePath: files[0].file_path, checksumSha256: files[0].checksum_sha256, domain: kind } });
      } else if (kind === "past_case") {
        let id = pastCaseId;
        if (!id) {
          const {data, error} = await supabase.from("past_cases").insert({...nullable, title: values.title, tags, approved_for_ai_use: false, anonymisation_status: "not_reviewed", created_by: user.id}).select("id").single();
          if (error) throw error;
          id = data.id; setPastCaseId(id);
          await logSystemActivity({ actorProfileId: user.id, actorRole: "admin", action: "past_case_created", targetType: "past_case", targetId: id, metadata: { title: values.title, domain: kind } });
        }
        // Keep progress if a later file fails; retry does not create a second case.
        for (const file of files.filter(f => !savedPaths.includes(f.file_path))) {
          const {data: insertedDocument, error} = await supabase.from("past_case_documents").insert({...file, past_case_id: id, ai_index_status: "pending", created_by: user.id}).select("id").single();
          if (error || !insertedDocument) throw error ?? new Error("Unable to save Past Case document.");
          setSavedPaths(paths => [...paths, file.file_path]);
          await logSystemActivity({ actorProfileId: user.id, actorRole: "admin", action: "past_case_document_added", targetType: "past_case_document", targetId: insertedDocument.id, metadata: { pastCaseId: id, fileName: file.file_name, filePath: file.file_path, checksumSha256: file.checksum_sha256, domain: kind } });
        }
      } else {
        const file = files[0];
        const {data: inserted, error} = await supabase.from("correspondence_templates").insert({...nullable, name: values.name, correspondence_type: values.correspondence_type || "Other / custom", approved: false, status: "draft", created_by: user.id, source_file_name: file.file_name, source_file_path: file.file_path, source_file_size: file.file_size, source_mime_type: file.mime_type, source_checksum_sha256: file.checksum_sha256}).select("id").single();
        if (error || !inserted) throw error ?? new Error("Unable to save correspondence template.");
        await logSystemActivity({ actorProfileId: user.id, actorRole: "admin", action: "template_created", targetType: "correspondence_template", targetId: inserted.id, metadata: { name: values.name, filePath: file.file_path, checksumSha256: file.checksum_sha256, domain: kind } });
      }
      await cache.invalidateQueries();
      toast.success("Draft saved. Open it to review and explicitly approve for AI use.");
      setOpen(false); setFiles([]); setMetadata(normalizeMetadata(kind, {})); setPastCaseId(null); setSavedPaths([]); setReviewed(false); setNotice("");
    } catch (error) {setNotice(error instanceof Error ? error.message : "Save failed. Private originals are preserved; retry saving.");}
    finally {setBusy(false);}
  };
  return <>
    <Button variant="outline" className="rounded-xl" onClick={() => setOpen(true)}>{titles[kind]}</Button>
    <DashboardItemDialog open={open} onOpenChange={value => { if (!busy) { if (!value) void cleanupTemporaryFiles(files.filter(file => !savedPaths.includes(file.file_path)).map(file => file.file_path)); setOpen(value); } }} title={titles[kind]} description="Upload, review the proposed details, then save a draft. Approval is a separate step.">
      <div className="space-y-4">
        {kind === "past_case" && <p className="text-sm">These files belong to one historical matter. Redact taxpayer information before upload. AI suggestions do not replace anonymisation review.</p>}
        <label className="block">Source document{kind === "past_case" ? "s (up to five)" : ""}<Input type="file" accept=".pdf,.docx,.txt" multiple={kind === "past_case"} disabled={busy || files.length > 0} onChange={e => void upload(e.target.files)} /></label>
        {files.map((file, index) => <div key={file.file_path} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"><p className="text-sm truncate">{index + 1}. {file.file_name} — stored privately</p><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={async () => { try { window.open(await getAiKnowledgeSignedUrl(file.file_path), "_blank", "noopener,noreferrer"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to open file."); } }}>View</Button><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void downloadAiKnowledgeFile(file.file_path, file.file_name)}>Download</Button><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { void cleanupTemporaryFiles([file.file_path]); setFiles(previous => previous.filter((_, fileIndex) => fileIndex !== index)); setReviewed(false); window.setTimeout(() => document.querySelector<HTMLInputElement>("input[type=file]")?.click(), 0); }}>Change</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { void cleanupTemporaryFiles([file.file_path]); setFiles(previous => previous.filter((_, fileIndex) => fileIndex !== index)); setReviewed(false); }}>Remove</Button></div></div>)}
        {notice && <p role="status" className="text-sm">{notice}</p>}
        {busy && <p role="status">Processing this document…</p>}
        {files.length > 0 && <>
          <Button variant="outline" disabled={busy || !!pastCaseId} onClick={() => void analyse()}>Analyse again</Button>
          <div className="grid gap-4 sm:grid-cols-2">{metadataFields[kind].map(field => <label key={field} className={/summary|body_structure|arguments|lessons|issue|outcome/.test(field) ? "sm:col-span-2" : ""}><span className="block text-sm font-medium mb-1">{field.replaceAll("_", " ")}</span>{/date|effective_from|effective_to/.test(field) ? <Input type="date" value={metadata[field] ?? ""} disabled={busy || !!pastCaseId} onChange={e => {setMetadata(v => ({...v, [field]: e.target.value})); setReviewed(false);}} /> : <Textarea rows={field === "body_structure" ? 8 : 2} value={metadata[field] ?? ""} disabled={busy || !!pastCaseId} onChange={e => {setMetadata(v => ({...v, [field]: e.target.value})); setReviewed(false);}} />}</label>)}</div>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e => setReviewed(e.target.checked)} />I reviewed these proposed details. Save as a draft without AI approval.</label>
          <Button disabled={busy || !reviewed} onClick={() => void save()}>Save draft</Button>
        </>}
      </div>
    </DashboardItemDialog>
  </>;
}
