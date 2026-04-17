import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  Clock3,
  Download,
  FileUp,
  Loader2,
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

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
      const newFiles = { ...selectedFiles };
      delete newFiles[docType];
      setSelectedFiles(newFiles);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `File size must be less than ${formatFileSize(MAX_FILE_SIZE)}`,
      );
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error(
        "File type not allowed. Please upload PDF, image, or document files.",
      );
      return;
    }

    setSelectedFiles((prev) => ({ ...prev, [docType]: file }));
  };

  const uploadDocument = async (docType: string, file: File) => {
    try {
      const fileName = `${docType}-${Date.now()}-${file.name}`;
      const filePath = `practitioner-verifications/${practitionerId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        return false;
      }

      // Check if document record already exists
      const { data: existing } = await supabase
        .from("practitioner_verification_documents")
        .select("id")
        .eq("practitioner_profile_id", practitionerId)
        .eq("document_type", docType as any)
        .maybeSingle();

      // If replacing an existing document, mark it as archived/replaced
      if (existing) {
        // For now, we'll just create a new record. In production, you might archive the old one
      }

      // Create document record in database
      const { error: dbError } = await supabase
        .from("practitioner_verification_documents")
        .insert({
          practitioner_profile_id: practitionerId,
          document_type: docType as any,
          display_name: DOCUMENT_TYPE_LABELS[docType] || file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          status: "pending_review",
          is_required: REQUIRED_DOCUMENT_TYPES.includes(docType),
          uploaded_at: new Date().toISOString(),
        });

      if (dbError) {
        // Delete the uploaded file if database insert fails
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
      const uploadPromises = Object.entries(selectedFiles).map(
        ([docType, file]) => uploadDocument(docType, file),
      );

      const results = await Promise.all(uploadPromises);

      if (results.every((r) => r)) {
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
      const { data } = await supabase.storage
        .from("documents")
        .download(filePath);

      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to download document");
    }
  };

  const pendingDocs = (documents ?? []).filter(
    (d) => d.status === "pending_review",
  );
  const approvedDocs = (documents ?? []).filter((d) => d.status === "approved");
  const rejectedDocs = (documents ?? []).filter((d) => d.status === "rejected");

  const getDocumentStatus = (docType: string) => {
    return documents?.find((d) => d.document_type === docType);
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Loading your documents...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Required Documents Upload */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Upload Verification Documents
        </h3>

        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              📋 Required Documents
            </p>
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          {DOCUMENT_TYPE_LABELS[docType]}
                        </p>
                        <Badge variant="outline" className="bg-blue-50">
                          Required
                        </Badge>
                        {docStatus && (
                          <Badge
                            className={`rounded-full border ${getDocumentStatusBadgeClass(docStatus.status as any)}`}
                          >
                            {getDocumentStatusLabel(docStatus.status as any)}
                          </Badge>
                        )}
                      </div>

                      {docStatus && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <p>
                            Uploaded:{" "}
                            {new Date(
                              docStatus.uploaded_at,
                            ).toLocaleDateString()}
                          </p>
                          {docStatus.rejection_reason && (
                            <div className="mt-2 rounded bg-red-50 p-2">
                              <p className="font-medium text-red-700">
                                Why it was rejected:
                              </p>
                              <p className="text-red-600">
                                {docStatus.rejection_reason}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {docStatus && docStatus.status === "approved" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() =>
                            downloadDocument(
                              docStatus.file_path,
                              docStatus.display_name,
                            )
                          }
                        >
                          <Download className="mr-1 h-4 w-4" />
                          Download
                        </Button>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) =>
                              handleFileSelect(
                                docType,
                                e.target.files?.[0] ?? null,
                              )
                            }
                            className="hidden"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            asChild
                          >
                            <span>
                              <FileUp className="mr-1 h-4 w-4" />
                              {selectedFile ? "Change" : "Upload"}
                            </span>
                          </Button>
                        </label>
                      )}
                    </div>
                  </div>

                  {selectedFile && (
                    <div className="mt-2 text-xs text-amber-700">
                      📁 Selected: {selectedFile.name} (
                      {formatFileSize(selectedFile.size)})
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Optional Documents Section */}
        <div className="mt-6 space-y-4 border-t border-border pt-6">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-medium text-foreground">
              ✨ Optional Documents
            </p>
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
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {DOCUMENT_TYPE_LABELS[docType]}
                      </p>
                      {docStatus && (
                        <Badge
                          className={`mt-1 rounded-full border ${getDocumentStatusBadgeClass(docStatus.status as any)}`}
                        >
                          {getDocumentStatusLabel(docStatus.status as any)}
                        </Badge>
                      )}
                    </div>

                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) =>
                          handleFileSelect(docType, e.target.files?.[0] ?? null)
                        }
                        className="hidden"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg h-8 w-8 p-0"
                        asChild
                      >
                        <span>
                          <FileUp className="h-4 w-4" />
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {Object.keys(selectedFiles).length > 0 && (
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
                  Upload {Object.keys(selectedFiles).length} Document(s)
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
        )}
      </div>

      {/* Document Status Overview */}
      {documents && documents.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            Your Documents
          </h3>

          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">
                Pending
                {pendingDocs.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {pendingDocs.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved
                {approvedDocs.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-emerald-100 text-emerald-700"
                  >
                    {approvedDocs.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected
                {rejectedDocs.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-red-100 text-red-700"
                  >
                    {rejectedDocs.length}
                  </Badge>
                )}
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
      )}
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
            {document.is_required && (
              <Badge variant="outline" className="bg-blue-50">
                Required
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Uploaded: {new Date(document.uploaded_at).toLocaleDateString()}
            {document.file_size && ` • ${formatFileSize(document.file_size)}`}
          </p>

          {showRejectionReason && document.rejection_reason && (
            <div className="mt-2 rounded bg-red-50 p-2">
              <p className="text-xs font-medium text-red-700">
                Feedback from admin:
              </p>
              <p className="text-xs text-red-600">
                {document.rejection_reason}
              </p>
            </div>
          )}
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
