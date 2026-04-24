import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  Clock3,
  Download,
  FileUp,
  Loader2,
  Paperclip,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  REQUIRED_DOCUMENT_TYPES,
  OPTIONAL_DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  formatFileSize,
  getDocumentStatusBadgeClass,
  getDocumentStatusLabel,
} from "@/lib/practitionerDocuments";

type VerificationDocument = Tables<"practitioner_verification_documents">;

interface PractitionerDocumentUploadProps {
  practitionerId: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function UploadPicker({
  docType,
  selectedFile,
  compact = false,
  onSelect,
}: {
  docType: string;
  selectedFile?: File;
  compact?: boolean;
  onSelect: (file: File | null) => void;
}) {
  return (
    <label
      htmlFor={`upload-${docType}`}
      className={`block cursor-pointer rounded-2xl border transition-colors ${
        selectedFile
          ? "border-emerald-300 bg-emerald-50"
          : "border-dashed border-border bg-background hover:border-primary/40 hover:bg-accent/30"
      } ${compact ? "p-3" : "p-4"}`}
    >
      <input
        id={`upload-${docType}`}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        className="hidden"
      />

      <div className={`flex items-center justify-between gap-3 ${compact ? "min-h-12" : "min-h-16"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex shrink-0 items-center justify-center rounded-xl ${
              selectedFile
                ? "bg-emerald-600 text-white"
                : "bg-primary/10 text-primary"
            } ${compact ? "h-10 w-10" : "h-11 w-11"}`}
          >
            {selectedFile ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {selectedFile ? selectedFile.name : "Choose file to upload"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedFile
                ? `${formatFileSize(selectedFile.size)} attached`
                : "PDF, JPG, PNG, DOC, or DOCX"}
            </p>
          </div>
        </div>

        <div
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            selectedFile
              ? "bg-emerald-600 text-white"
              : "bg-primary/10 text-primary"
          }`}
        >
          {selectedFile ? "Change" : compact ? "Browse" : "Select File"}
        </div>
      </div>
    </label>
  );
}

export function PractitionerDocumentUpload({
  practitionerId,
}: PractitionerDocumentUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({});
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["practitioner-my-documents", practitionerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_verification_documents")
        .select("*")
        .eq("practitioner_profile_id", practitionerId)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load your documents");
        throw error;
      }

      return (data ?? []) as VerificationDocument[];
    },
  });

  const handleFileSelect = (docType: string, file: File | null) => {
    if (!file) {
      const nextFiles = { ...selectedFiles };
      delete nextFiles[docType];
      setSelectedFiles(nextFiles);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File size must be less than ${formatFileSize(MAX_FILE_SIZE)}`);
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error("File type not allowed. Please upload PDF, image, or document files.");
      return;
    }

    setSelectedFiles((prev) => ({ ...prev, [docType]: file }));
  };

  const uploadDocument = async (docType: string, file: File) => {
    try {
      const fileName = `${docType}-${Date.now()}-${file.name}`;
      const filePath = `practitioner-verifications/${practitionerId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        return false;
      }

      const { error: dbError } = await supabase
        .from("practitioner_verification_documents")
        .insert({
          practitioner_profile_id: practitionerId,
          document_type: docType as never,
          display_name: DOCUMENT_TYPE_LABELS[docType] || file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          status: "pending_review",
          is_required: REQUIRED_DOCUMENT_TYPES.includes(docType),
          uploaded_at: new Date().toISOString(),
        });

      if (dbError) {
        await supabase.storage.from("documents").remove([filePath]);
        toast.error(`Failed to save document: ${dbError.message}`);
        return false;
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
      return false;
    }
  };

  const handleUploadAll = async () => {
    if (Object.keys(selectedFiles).length === 0) {
      toast.error("Please select at least one document to upload");
      return;
    }

    setUploading(true);
    try {
      const uploadPromises = Object.entries(selectedFiles).map(([docType, file]) =>
        uploadDocument(docType, file),
      );

      const results = await Promise.all(uploadPromises);

      if (results.every(Boolean)) {
        toast.success(`${results.length} document(s) uploaded successfully!`);
        setSelectedFiles({});
        await queryClient.invalidateQueries({
          queryKey: ["practitioner-my-documents", practitionerId],
        });
      } else {
        toast.error("Some documents failed to upload");
      }
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (filePath: string, fileName: string) => {
    try {
      const { data } = await supabase.storage.from("documents").download(filePath);
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download document");
    }
  };

  const pendingDocs = (documents ?? []).filter((d) => d.status === "pending_review");
  const approvedDocs = (documents ?? []).filter((d) => d.status === "approved");
  const rejectedDocs = (documents ?? []).filter((d) => d.status === "rejected");

  const getDocumentStatus = (docType: string) =>
    documents?.find((d) => d.document_type === docType);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Loading your documents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Upload Verification Documents
        </h3>

        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">Required Documents</p>
            <p className="mt-1 text-sm text-amber-800">
              All of these documents are required for verification. Admin will
              review and approve before you can be marked as verified.
            </p>
          </div>

          <div className="space-y-3">
            {REQUIRED_DOCUMENT_TYPES.map((docType) => {
              const docStatus = getDocumentStatus(docType);
              const selectedFile = selectedFiles[docType];

              return (
                <div
                  key={docType}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">
                          {DOCUMENT_TYPE_LABELS[docType]}
                        </p>
                        <Badge variant="outline" className="bg-blue-50">
                          Required
                        </Badge>
                        {docStatus ? (
                          <Badge
                            className={`rounded-full border ${getDocumentStatusBadgeClass(docStatus.status as never)}`}
                          >
                            {getDocumentStatusLabel(docStatus.status as never)}
                          </Badge>
                        ) : null}
                      </div>

                      {docStatus ? (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <p>Uploaded: {new Date(docStatus.uploaded_at).toLocaleDateString()}</p>
                          {docStatus.rejection_reason ? (
                            <div className="mt-2 rounded bg-red-50 p-2">
                              <p className="font-medium text-red-700">Why it was rejected:</p>
                              <p className="text-red-600">{docStatus.rejection_reason}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-[220px]">
                      {docStatus?.status === "approved" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() =>
                            downloadDocument(docStatus.file_path, docStatus.display_name)
                          }
                        >
                          <Download className="mr-1 h-4 w-4" />
                          Download
                        </Button>
                      ) : (
                        <UploadPicker
                          docType={docType}
                          selectedFile={selectedFile}
                          onSelect={(file) => handleFileSelect(docType, file)}
                        />
                      )}
                    </div>
                  </div>

                  {selectedFile ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 space-y-4 border-t border-border pt-6">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-medium text-foreground">Optional Documents</p>
            <p className="mt-1 text-sm text-muted-foreground">
              These help improve your profile visibility but are not required
              for verification.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {OPTIONAL_DOCUMENT_TYPES.map((docType) => {
              const docStatus = getDocumentStatus(docType);
              const selectedFile = selectedFiles[docType];

              return (
                <div
                  key={docType}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {DOCUMENT_TYPE_LABELS[docType]}
                      </p>
                      {docStatus ? (
                        <Badge
                          className={`mt-2 rounded-full border ${getDocumentStatusBadgeClass(docStatus.status as never)}`}
                        >
                          {getDocumentStatusLabel(docStatus.status as never)}
                        </Badge>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Optional, but helpful for profile trust and visibility.
                        </p>
                      )}
                    </div>
                  </div>

                  <UploadPicker
                    docType={docType}
                    selectedFile={selectedFile}
                    compact
                    onSelect={(file) => handleFileSelect(docType, file)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {Object.keys(selectedFiles).length > 0 ? (
          <div className="mt-6 flex gap-3 border-t border-border pt-6">
            <Button
              onClick={handleUploadAll}
              disabled={uploading}
              className="rounded-xl"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  Upload {Object.keys(selectedFiles).length} Selected Document
                  {Object.keys(selectedFiles).length === 1 ? "" : "s"}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setSelectedFiles({})}
              disabled={uploading}
            >
              Clear Selection
            </Button>
          </div>
        ) : null}
      </div>

      {documents && documents.length > 0 ? (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            Your Documents
          </h3>

          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">
                Pending
                {pendingDocs.length > 0 ? (
                  <Badge variant="secondary" className="ml-2">
                    {pendingDocs.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved
                {approvedDocs.length > 0 ? (
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-emerald-100 text-emerald-700"
                  >
                    {approvedDocs.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected
                {rejectedDocs.length > 0 ? (
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-red-100 text-red-700"
                  >
                    {rejectedDocs.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-3 pt-4">
              {pendingDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending documents.
                </p>
              ) : (
                pendingDocs.map((doc) => (
                  <DocumentStatusCard
                    key={doc.id}
                    document={doc}
                    onDownload={() =>
                      downloadDocument(doc.file_path, doc.display_name)
                    }
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-3 pt-4">
              {approvedDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No approved documents yet.
                </p>
              ) : (
                approvedDocs.map((doc) => (
                  <DocumentStatusCard
                    key={doc.id}
                    document={doc}
                    onDownload={() =>
                      downloadDocument(doc.file_path, doc.display_name)
                    }
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="rejected" className="space-y-3 pt-4">
              {rejectedDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No rejected documents.
                </p>
              ) : (
                rejectedDocs.map((doc) => (
                  <DocumentStatusCard
                    key={doc.id}
                    document={doc}
                    onDownload={() =>
                      downloadDocument(doc.file_path, doc.display_name)
                    }
                    showRejectionReason
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </div>
  );
}

interface DocumentStatusCardProps {
  document: VerificationDocument;
  onDownload: () => void;
  showRejectionReason?: boolean;
}

function DocumentStatusCard({
  document,
  onDownload,
  showRejectionReason = false,
}: DocumentStatusCardProps) {
  const statusIcon =
    {
      pending_review: <Clock3 className="h-5 w-5 text-amber-600" />,
      approved: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      rejected: <XCircle className="h-5 w-5 text-red-600" />,
    }[document.status] || null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="font-medium">{document.display_name}</span>
            {document.is_required ? (
              <Badge variant="outline" className="bg-blue-50">
                Required
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Uploaded: {new Date(document.uploaded_at).toLocaleDateString()}
            {document.file_size ? ` • ${formatFileSize(document.file_size)}` : ""}
          </p>

          {showRejectionReason && document.rejection_reason ? (
            <div className="mt-2 rounded bg-red-50 p-2">
              <p className="text-xs font-medium text-red-700">
                Feedback from admin:
              </p>
              <p className="text-xs text-red-600">
                {document.rejection_reason}
              </p>
            </div>
          ) : null}
        </div>

        <Button
          size="sm"
          variant="outline"
          className="rounded-lg"
          onClick={onDownload}
        >
          <Download className="mr-1 h-4 w-4" />
          Download
        </Button>
      </div>
    </div>
  );
}
