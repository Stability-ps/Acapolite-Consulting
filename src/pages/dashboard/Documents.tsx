import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Image, File, X, Paperclip, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClientRecord } from "@/hooks/useClientRecord";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { sendClientDocumentUploadConfirmation, sendClientDocumentUploadNotification } from "@/lib/documentUploadNotifications";
import { logSystemActivity } from "@/lib/systemActivityLog";
import { useNotificationSectionRead } from "@/hooks/useNotificationSectionRead";

const documentTypeOptions = [
  "IRP5",
  "SARS Letter",
  "Bank Statement",
  "ID Document",
  "Company Registration",
  "Proof of Address",
  "Tax Certificate",
  "Proof of Payment",
  "Other",
] as const;

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

async function uploadDocumentFile(file: File, userId: string, clientId: string) {
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error("Files larger than 10 MB are not allowed.");
  }

  const safeFileName = sanitizeFileName(file.name);
  const uniqueFileName = `${Date.now()}-${safeFileName}`;
  const candidatePaths = [
    `${userId}/${clientId}/general/${uniqueFileName}`,
    `${clientId}/general/${uniqueFileName}`,
  ];

  let lastError: string | null = null;

  for (const filePath of candidatePaths) {
    const { error } = await supabase.storage.from("documents").upload(filePath, file, {
      upsert: false,
    });

    if (!error) {
      return filePath;
    }

    lastError = error.message;
  }

  throw new Error(lastError ?? "Unable to upload document.");
}

export default function Documents() {
  useNotificationSectionRead("documents");
  const { user, profile, role } = useAuth();
  const { data: client } = useClientRecord();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [openingDocument, setOpeningDocument] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "chat" | "case" | "general">("all");

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", client?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*, linked_case:cases!documents_case_id_fkey(id, case_title, case_number)")
        .eq("client_id", client!.id)
        .order("uploaded_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!client,
  });

  const resetUploadState = () => {
    setSelectedFile(null);
    setDocumentType("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const closeUploadModal = () => {
    if (uploading) return;

    setIsUploadModalOpen(false);
    resetUploadState();
  };

  const openUploadModal = () => {
    if (!client || uploading) return;
    setIsUploadModalOpen(true);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      toast.error("Choose a file before uploading.");
      return;
    }

    if (!documentType) {
      toast.error("Select a document type first.");
      return;
    }

    if (!user || !client) {
      toast.error("Your client profile is not ready yet.");
      return;
    }

    setUploading(true);

    let filePath = "";

    try {
      filePath = await uploadDocumentFile(selectedFile, user.id, client.id);

      const { data: documentRow, error: dbError } = await supabase.from("documents").insert({
        client_id: client.id,
        uploaded_by: user.id,
        sender_profile_id: user.id,
        recipient_profile_id: client.profile_id,
        visibility: "shared",
        title: documentType,
        file_name: selectedFile.name,
        file_path: filePath,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        category: documentType,
        status: "uploaded",
      }).select("id, uploaded_at").single();

      if (dbError || !documentRow) {
        await supabase.storage.from("documents").remove([filePath]);
        throw new Error(dbError?.message || "Unable to save the uploaded document.");
      }

      const notification = await sendClientDocumentUploadNotification({
        documentId: documentRow.id,
        clientProfileId: client.profile_id,
        clientName:
          client.company_name
          || profile?.full_name
          || [client.first_name, client.last_name].filter(Boolean).join(" ")
          || client.client_code
          || "Client",
        documentList: `${documentType} | ${selectedFile.name}`,
        uploadedAt: documentRow.uploaded_at,
      });

      if (notification.error) {
        console.error("Document upload email failed:", notification.error);
        toast.error("Document uploaded, but the admin email notification could not be delivered.");
      } else {
        toast.success("Document uploaded successfully.");
      }

      const confirmation = await sendClientDocumentUploadConfirmation({
        documentId: documentRow.id,
        clientProfileId: client.profile_id,
        clientName:
          client.company_name
          || profile?.full_name
          || [client.first_name, client.last_name].filter(Boolean).join(" ")
          || client.client_code
          || "Client",
        clientEmail: profile?.email || user.email || "",
        documentList: `${documentType} | ${selectedFile.name}`,
        uploadedAt: documentRow.uploaded_at,
      });

      if (confirmation.error) {
        console.error("Client document confirmation email failed:", confirmation.error);
      }

      if (user && role) {
        await logSystemActivity({
          actorProfileId: user.id,
          actorRole: role,
          action: "document_uploaded",
          targetType: "document",
          targetId: documentRow.id,
          metadata: {
            documentTitle: documentType,
            fileName: selectedFile.name,
          },
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["documents", client.id] });
      await queryClient.invalidateQueries({ queryKey: ["staff-documents"] });
      closeUploadModal();
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Document upload failed.";
      const message = rawMessage.toLowerCase().includes("bucket not found")
        ? "The Supabase storage bucket 'documents' has not been created yet."
        : rawMessage;
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const getIcon = (type?: string | null) => {
    if (type?.startsWith("image")) return Image;
    if (type?.includes("pdf")) return FileText;
    return File;
  };

  const filteredDocuments = (documents ?? []).filter((document) => {
    if (sourceFilter === "all") {
      return true;
    }

    const isChatAttachment = (document.category ?? "").toLowerCase() === "chat attachment";
    const isCaseDocument = Boolean(document.case_id);

    if (sourceFilter === "chat") {
      return isChatAttachment;
    }

    if (sourceFilter === "case") {
      return isCaseDocument;
    }

    return !isChatAttachment && !isCaseDocument;
  });

  const selectedDocument = documents?.find((document) => document.id === selectedDocumentId) ?? null;

  const openSelectedDocument = async () => {
    if (!selectedDocument) return;

    setOpeningDocument(true);
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(selectedDocument.file_path, 60 * 10);

    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Unable to open this file.");
      setOpeningDocument(false);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    setOpeningDocument(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Documents</h1>
          <p className="text-muted-foreground font-body text-sm">Upload and manage your tax documents, case files, and chat attachments</p>
        </div>
        <Button
          disabled={uploading || !client}
          className="rounded-xl"
          onClick={openUploadModal}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Document"}
        </Button>
      </div>

      {!client ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">
            Your client profile is still being prepared. If you just created your account, refresh shortly and make
            sure the latest Supabase migration has been applied.
          </p>
        </div>
      ) : isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : documents && documents.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All Files" },
              { value: "general", label: "General Uploads" },
              { value: "case", label: "Case Files" },
              { value: "chat", label: "Chat Attachments" },
            ].map((filter) => (
              <Button
                key={filter.value}
                type="button"
                variant={sourceFilter === filter.value ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setSourceFilter(filter.value as typeof sourceFilter)}
              >
                {filter.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3">
          {filteredDocuments.map((doc) => {
            const Icon = getIcon(doc.mime_type);
            const isChatAttachment = (doc.category ?? "").toLowerCase() === "chat attachment";
            const sourceLabel = isChatAttachment ? "Chat Attachment" : doc.case_id ? "Case File" : "General Upload";
            const caseLabel = doc.linked_case?.case_title || doc.linked_case?.case_number || null;

            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedDocumentId(doc.id)}
                className="w-full text-left bg-card rounded-xl border border-border shadow-card p-4 flex items-center gap-4 hover:shadow-elevated hover:border-primary/30 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-body font-medium text-foreground truncate">{doc.category || doc.title}</p>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-body">
                      {doc.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-body">
                      {sourceLabel}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-body truncate">
                    {doc.file_name}
                  </p>
                  {caseLabel ? (
                    <p className="text-xs text-muted-foreground font-body truncate">
                      Related case: {caseLabel}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground font-body">
                    {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB | ` : ""}
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              </button>
            );
          })}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-body">No documents uploaded yet. Upload IRP5s, SARS letters, bank statements and more.</p>
        </div>
      )}

      {isUploadModalOpen ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={closeUploadModal}
        >
          <div
            className="w-full max-w-xl rounded-[28px] bg-card border border-border shadow-elevated p-6 sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="font-display text-3xl font-bold text-foreground">Upload Document</h2>
                <p className="text-muted-foreground font-body mt-2">
                  Tag your document with the correct type before uploading
                </p>
              </div>
              <button
                type="button"
                onClick={closeUploadModal}
                className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Close upload dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="document-type" className="block text-sm font-semibold text-foreground font-body mb-2">
                  Document Type
                </label>
                <select
                  id="document-type"
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm font-body text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select document type...</option>
                  {documentTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground font-body mb-2">
                  File
                </label>
                <div className="rounded-2xl border border-dashed border-border bg-accent/40 p-4">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-body text-sm text-foreground">
                        {selectedFile ? selectedFile.name : "Choose the file you want to upload"}
                      </p>
                      <p className="font-body text-xs text-muted-foreground mt-1">
                        Accepted: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      {selectedFile ? "Change File" : "Choose File"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="rounded-xl" onClick={closeUploadModal} disabled={uploading}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={handleUploadSubmit}
                  disabled={uploading || !selectedFile || !documentType}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Upload Document"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <DashboardItemDialog
        open={!!selectedDocument}
        onOpenChange={(open) => {
          if (!open) setSelectedDocumentId(null);
        }}
        title={selectedDocument?.category || selectedDocument?.title || "Document Details"}
        description="Review the uploaded file information and current review status."
      >
        {selectedDocument ? (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">File Name</p>
                <p className="font-body text-foreground break-all">{selectedDocument.file_name}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Status</p>
                <p className="font-body text-foreground">{selectedDocument.status.replace(/_/g, " ")}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Source</p>
                <p className="font-body text-foreground">
                  {(selectedDocument.category ?? "").toLowerCase() === "chat attachment"
                    ? "Chat Attachment"
                    : selectedDocument.case_id
                      ? "Case File"
                      : "General Upload"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Uploaded</p>
                <p className="font-body text-foreground">{new Date(selectedDocument.uploaded_at).toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Size</p>
                <p className="font-body text-foreground">
                  {selectedDocument.file_size ? `${(selectedDocument.file_size / 1024).toFixed(1)} KB` : "Unknown"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4 sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Related Case</p>
                <p className="font-body text-foreground">
                  {selectedDocument.linked_case?.case_title || selectedDocument.linked_case?.case_number || "No linked case"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="rounded-xl" onClick={openSelectedDocument} disabled={openingDocument}>
                <ExternalLink className="h-4 w-4 mr-2" />
                {openingDocument ? "Opening..." : "Open File"}
              </Button>
            </div>

            {selectedDocument.rejection_reason ? (
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Rejection Reason</p>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="font-body text-red-700">{selectedDocument.rejection_reason}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}
