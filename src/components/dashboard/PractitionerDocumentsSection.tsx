import { useEffect, useMemo, useState } from "react";
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
  Eye,
  FileText,
  FileUp,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  DOCUMENT_TYPE_LABELS,
  REQUIRED_DOCUMENT_TYPES,
  OPTIONAL_DOCUMENT_TYPES,
  formatFileSize,
  getDocumentStatusBadgeClass,
  getDocumentStatusLabel,
} from "@/lib/practitionerDocuments";

type VerificationDocument = Tables<"practitioner_verification_documents">;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

interface PractitionerDocumentsSectionProps {
  practitionerId: string | null;
  isAdmin?: boolean;
  onDocumentsChange?: () => void;
}

const OPTIONAL_DOCUMENT_TYPES = [
  "professional_body_membership",
  "company_registration",
  "vat_number_proof",
  "profile_photo",
  "cv_professional_summary",
];

function getStatusIcon(status: string) {
  switch (status) {
    case "approved":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "rejected":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "pending_review":
      return <Clock3 className="h-4 w-4 text-amber-600" />;
    default:
      return null;
  }
}

export function PractitionerDocumentsSection({
  practitionerId,
  isAdmin = false,
  onDocumentsChange,
}: PractitionerDocumentsSectionProps) {
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<
    Record<string, string>
  >({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>(
    {},
  );
  const [selectedAdminFiles, setSelectedAdminFiles] = useState<
    Record<string, File>
  >({});
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["practitioner-verification-documents", practitionerId],
    queryFn: async () => {
      if (!practitionerId) return [];

      const { data, error } = await supabase
        .from("practitioner_verification_documents")
        .select("*")
        .eq("practitioner_profile_id", practitionerId)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load documents");
        throw error;
      }

      return (data ?? []) as VerificationDocument[];
    },
    enabled: !!practitionerId,
  });

  const { data: requiredDocs } = useQuery({
    queryKey: ["required-documents"],
    queryFn: async () => {
      return REQUIRED_DOCUMENT_TYPES.map((type) => ({
        type,
        label: DOCUMENT_TYPE_LABELS[type] || type,
      }));
    },
  });

  const { data: legacyProfile } = useQuery({
    queryKey: ["practitioner-verification-profile", practitionerId],
    queryFn: async () => {
      if (!practitionerId) return null;

      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select(
          "verification_status, verification_submitted_at, id_document_path, certificate_document_path, proof_of_address_path, bank_confirmation_document_path",
        )
        .eq("profile_id", practitionerId)
        .maybeSingle();

      if (error) {
        toast.error("Failed to load practitioner profile documents");
        throw error;
      }

      return data;
    },
    enabled: !!practitionerId,
  });

  const mergedDocuments = useMemo(() => {
    const existingDocuments = documents ?? [];
    const existingTypes = new Set(existingDocuments.map((doc) => doc.document_type));

    if (!legacyProfile) {
      return existingDocuments;
    }

    const fallbackStatus =
      legacyProfile.verification_status === "verified"
        ? "approved"
        : legacyProfile.verification_status === "rejected"
          ? "rejected"
          : "pending_review";

    const fallbackUploadedAt =
      legacyProfile.verification_submitted_at ?? new Date().toISOString();

    const fallbackDocuments: VerificationDocument[] = [
      {
        id: `legacy-id-copy-${practitionerId}`,
        practitioner_profile_id: practitionerId,
        document_type: "id_copy",
        display_name: "ID Copy",
        file_path: legacyProfile.id_document_path ?? "",
        file_size: null,
        mime_type: null,
        status: fallbackStatus,
        uploaded_at: fallbackUploadedAt,
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
        admin_notes: "Recovered from practitioner signup upload.",
        is_required: true,
        created_at: fallbackUploadedAt,
        updated_at: fallbackUploadedAt,
      },
      {
        id: `legacy-certificate-${practitionerId}`,
        practitioner_profile_id: practitionerId,
        document_type: "tax_registration_certificate",
        display_name: "Tax Practitioner Registration Certificate",
        file_path: legacyProfile.certificate_document_path ?? "",
        file_size: null,
        mime_type: null,
        status: fallbackStatus,
        uploaded_at: fallbackUploadedAt,
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
        admin_notes: "Recovered from practitioner signup upload.",
        is_required: true,
        created_at: fallbackUploadedAt,
        updated_at: fallbackUploadedAt,
      },
      {
        id: `legacy-proof-of-address-${practitionerId}`,
        practitioner_profile_id: practitionerId,
        document_type: "proof_of_address",
        display_name: "Proof of Address",
        file_path: legacyProfile.proof_of_address_path ?? "",
        file_size: null,
        mime_type: null,
        status: fallbackStatus,
        uploaded_at: fallbackUploadedAt,
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
        admin_notes: "Recovered from practitioner signup upload.",
        is_required: true,
        created_at: fallbackUploadedAt,
        updated_at: fallbackUploadedAt,
      },
      {
        id: `legacy-bank-confirmation-${practitionerId}`,
        practitioner_profile_id: practitionerId,
        document_type: "bank_confirmation_letter",
        display_name: "Bank Confirmation Letter",
        file_path: legacyProfile.bank_confirmation_document_path ?? "",
        file_size: null,
        mime_type: null,
        status: fallbackStatus,
        uploaded_at: fallbackUploadedAt,
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
        admin_notes: "Recovered from practitioner signup upload.",
        is_required: true,
        created_at: fallbackUploadedAt,
        updated_at: fallbackUploadedAt,
      },
    ].filter(
      (doc) => Boolean(doc.file_path) && !existingTypes.has(doc.document_type),
    );

    return [...existingDocuments, ...fallbackDocuments];
  }, [documents, legacyProfile, practitionerId]);

  const pendingDocs = mergedDocuments.filter(
    (d) => d.status === "pending_review",
  );
  const approvedDocs = mergedDocuments.filter((d) => d.status === "approved");
  const rejectedDocs = mergedDocuments.filter((d) => d.status === "rejected");

  const ensurePersistedDocument = async (docId: string) => {
    const targetDocument = mergedDocuments.find((doc) => doc.id === docId);

    if (!targetDocument) {
      throw new Error("Document not found.");
    }

    if (!docId.startsWith("legacy-")) {
      return docId;
    }

    const { data, error } = await supabase
      .from("practitioner_verification_documents")
      .insert({
        practitioner_profile_id: targetDocument.practitioner_profile_id,
        document_type: targetDocument.document_type,
        display_name: targetDocument.display_name,
        file_path: targetDocument.file_path,
        file_size: targetDocument.file_size,
        mime_type: targetDocument.mime_type,
        status: "pending_review",
        is_required: targetDocument.is_required,
        uploaded_at: targetDocument.uploaded_at,
        admin_notes: targetDocument.admin_notes,
      })
      .select("id")
      .single();

    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw error;
    }

    if (data?.id) {
      return data.id;
    }

    const { data: existingDocument, error: existingError } = await supabase
      .from("practitioner_verification_documents")
      .select("id")
      .eq("practitioner_profile_id", targetDocument.practitioner_profile_id)
      .eq("document_type", targetDocument.document_type)
      .eq("file_path", targetDocument.file_path)
      .maybeSingle();

    if (existingError || !existingDocument?.id) {
      throw existingError || new Error("Unable to persist practitioner document.");
    }

    return existingDocument.id;
  };

  const approveDocument = async (docId: string) => {
    let persistedDocumentId = docId;

    try {
      persistedDocumentId = await ensurePersistedDocument(docId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to prepare document",
      );
      return;
    }

    const { error } = await supabase
      .from("practitioner_verification_documents")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq("id", persistedDocumentId);

    if (error) {
      toast.error("Failed to approve document");
      return;
    }

    toast.success("Document approved");
    await queryClient.invalidateQueries({
      queryKey: ["practitioner-verification-documents", practitionerId],
    });
    onDocumentsChange?.();
  };

  const rejectDocument = async (docId: string) => {
    const reason = rejectionReason[docId] || "";
    if (!reason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    let persistedDocumentId = docId;

    try {
      persistedDocumentId = await ensurePersistedDocument(docId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to prepare document",
      );
      return;
    }

    const { error } = await supabase
      .from("practitioner_verification_documents")
      .update({
        status: "rejected",
        rejection_reason: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq("id", persistedDocumentId);

    if (error) {
      toast.error("Failed to reject document");
      return;
    }

    toast.success("Document rejected");
    setRejectionReason((prev) => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    setRejectingDocId(null);
    await queryClient.invalidateQueries({
      queryKey: ["practitioner-verification-documents", practitionerId],
    });
    onDocumentsChange?.();
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

  const handleAdminFileSelect = (docType: string, file: File | null) => {
    if (!file) {
      const newFiles = { ...selectedAdminFiles };
      delete newFiles[docType];
      setSelectedAdminFiles(newFiles);
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

    setSelectedAdminFiles((prev) => ({ ...prev, [docType]: file }));
  };

  const uploadAdminDocument = async (docType: string, file: File) => {
    try {
      setUploadingFiles((prev) => ({ ...prev, [docType]: true }));

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
          admin_notes: "Uploaded by admin on behalf of practitioner",
        });

      if (dbError) {
        // Delete the uploaded file if database insert fails
        await supabase.storage.from("documents").remove([filePath]);
        toast.error(`Failed to save document: ${dbError.message}`);
        return false;
      }

      toast.success(`Document uploaded successfully`);
      setSelectedAdminFiles((prev) => {
        const next = { ...prev };
        delete next[docType];
        return next;
      });

      await queryClient.invalidateQueries({
        queryKey: ["practitioner-verification-documents", practitionerId],
      });
      onDocumentsChange?.();

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
      return false;
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [docType]: false }));
    }
  };

  if (!practitionerId) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 p-6">
        <p className="text-sm text-muted-foreground">
          Select a practitioner to view their verification documents.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Practitioner Verification Documents
        </h3>

        {/* Required Documents Checklist */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">
            Required Documents
          </p>
          <div className="space-y-2">
            {requiredDocs?.map((doc) => {
              const uploadedDoc = documents?.find(
                (d) => d.document_type === doc.type,
              ) ?? mergedDocuments.find(
                (d) => d.document_type === doc.type,
              );
              const isApproved = uploadedDoc?.status === "approved";
              const isRejected = uploadedDoc?.status === "rejected";

              return (
                <div
                  key={doc.type}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-background p-3"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-border">
                    {isApproved ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : isRejected ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <Clock3 className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                  <span className="flex-1 text-sm font-medium">
                    {doc.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isApproved
                      ? "✓ Approved"
                      : isRejected
                        ? "✗ Rejected"
                        : "Pending"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {isAdmin && (
          <div className="mb-6 rounded-2xl border border-border bg-blue-50 p-4">
            <div className="mb-4 flex items-center gap-2">
              <FileUp className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-blue-900">
                Admin Document Upload
              </h4>
            </div>
            <p className="mb-4 text-sm text-blue-800">
              Upload documents on behalf of this practitioner if they sent them
              via email or other means.
            </p>

            <div className="space-y-4">
              {/* Required Documents Upload */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-blue-900">
                  Required Documents
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {REQUIRED_DOCUMENT_TYPES.map((docType) => (
                    <div
                      key={docType}
                      className="rounded-lg border border-blue-200 bg-white p-3"
                    >
                      <label className="mb-2 block text-xs font-medium text-foreground">
                        {DOCUMENT_TYPE_LABELS[docType]}
                      </label>
                      <input
                        type="file"
                        onChange={(e) =>
                          handleAdminFileSelect(
                            docType,
                            e.target.files?.[0] || null,
                          )
                        }
                        accept={ALLOWED_FILE_TYPES.map((t) =>
                          t.includes("image/")
                            ? t
                            : t.includes("pdf")
                              ? ".pdf"
                              : t.includes("word")
                                ? ".doc,.docx"
                                : t,
                        ).join(",")}
                        className="mb-2 block w-full text-xs file:mr-3 file:rounded-lg file:border file:border-blue-300 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-blue-700"
                      />
                      {selectedAdminFiles[docType] && (
                        <div className="mb-2 text-xs text-foreground">
                          {selectedAdminFiles[docType]!.name}
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full rounded-lg text-xs"
                        onClick={() => {
                          const file = selectedAdminFiles[docType];
                          if (file) {
                            void uploadAdminDocument(docType, file);
                          }
                        }}
                        disabled={
                          !selectedAdminFiles[docType] ||
                          uploadingFiles[docType]
                        }
                      >
                        {uploadingFiles[docType] ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <FileUp className="mr-2 h-3 w-3" />
                            Upload
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional Documents Upload */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-blue-900">
                  Optional Documents
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {OPTIONAL_DOCUMENT_TYPES.map((docType) => (
                    <div
                      key={docType}
                      className="rounded-lg border border-blue-200 bg-white p-3"
                    >
                      <label className="mb-2 block text-xs font-medium text-foreground">
                        {DOCUMENT_TYPE_LABELS[docType]}
                      </label>
                      <input
                        type="file"
                        onChange={(e) =>
                          handleAdminFileSelect(
                            docType,
                            e.target.files?.[0] || null,
                          )
                        }
                        accept={ALLOWED_FILE_TYPES.map((t) =>
                          t.includes("image/")
                            ? t
                            : t.includes("pdf")
                              ? ".pdf"
                              : t.includes("word")
                                ? ".doc,.docx"
                                : t,
                        ).join(",")}
                        className="mb-2 block w-full text-xs file:mr-3 file:rounded-lg file:border file:border-blue-300 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-blue-700"
                      />
                      {selectedAdminFiles[docType] && (
                        <div className="mb-2 text-xs text-foreground">
                          {selectedAdminFiles[docType]!.name}
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full rounded-lg text-xs"
                        onClick={() => {
                          const file = selectedAdminFiles[docType];
                          if (file) {
                            void uploadAdminDocument(docType, file);
                          }
                        }}
                        disabled={
                          !selectedAdminFiles[docType] ||
                          uploadingFiles[docType]
                        }
                      >
                        {uploadingFiles[docType] ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <FileUp className="mr-2 h-3 w-3" />
                            Upload
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Tabs */}
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
                No pending documents to review.
              </p>
            ) : (
              pendingDocs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  isAdmin={isAdmin}
                  onApprove={() => approveDocument(doc.id)}
                  onReject={() => setRejectingDocId(doc.id)}
                  onDownload={() =>
                    downloadDocument(doc.file_path, doc.display_name)
                  }
                  showRejectionInput={rejectingDocId === doc.id}
                  rejectionReason={rejectionReason[doc.id] || ""}
                  onRejectionReasonChange={(reason) => {
                    setRejectionReason((prev) => ({
                      ...prev,
                      [doc.id]: reason,
                    }));
                  }}
                  onConfirmReject={() => rejectDocument(doc.id)}
                  onCancelReject={() => setRejectingDocId(null)}
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
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  isAdmin={false}
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
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  isAdmin={false}
                  onDownload={() =>
                    downloadDocument(doc.file_path, doc.display_name)
                  }
                  showRejectionReason={true}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

interface DocumentCardProps {
  document: VerificationDocument;
  isAdmin?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onDownload?: () => void;
  showRejectionInput?: boolean;
  rejectionReason?: string;
  onRejectionReasonChange?: (reason: string) => void;
  onConfirmReject?: () => void;
  onCancelReject?: () => void;
  showRejectionReason?: boolean;
}

function DocumentCard({
  document,
  isAdmin = false,
  onApprove,
  onReject,
  onDownload,
  showRejectionInput = false,
  rejectionReason = "",
  onRejectionReasonChange,
  onConfirmReject,
  onCancelReject,
  showRejectionReason = false,
}: DocumentCardProps) {
  const docType =
    DOCUMENT_TYPE_LABELS[document.document_type] || document.display_name;

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
            <FileText className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{docType}</p>
              <Badge
                className={`rounded-full border ${getDocumentStatusBadgeClass(document.status)}`}
              >
                <span className="mr-1">{getStatusIcon(document.status)}</span>
                {getDocumentStatusLabel(document.status as any)}
              </Badge>
              {document.is_required && (
                <Badge variant="outline" className="bg-blue-50">
                  Required
                </Badge>
              )}
            </div>
            <div className="mt-1 space-y-1 text-xs text-muted-foreground">
              <p>
                Uploaded: {new Date(document.uploaded_at).toLocaleDateString()}
              </p>
              <p>Size: {formatFileSize(document.file_size)}</p>
              {document.admin_notes && (
                <p className="mt-2 font-medium text-foreground">
                  Admin Notes: {document.admin_notes}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            onClick={onDownload}
          >
            <Download className="mr-1 h-4 w-4" />
            Download
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            onClick={onDownload}
          >
            <Eye className="mr-1 h-4 w-4" />
            View
          </Button>
          {isAdmin && document.status === "pending_review" && (
            <>
              <Button
                size="sm"
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
                onClick={onApprove}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-lg"
                onClick={onReject}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      </div>

      {showRejectionInput && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Rejection Reason
            </label>
            <Textarea
              placeholder="Explain why this document is being rejected and what needs to be fixed..."
              value={rejectionReason}
              onChange={(e) => onRejectionReasonChange?.(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="rounded-lg bg-red-600 hover:bg-red-700"
              onClick={onConfirmReject}
              disabled={!rejectionReason.trim()}
            >
              Confirm Rejection
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={onCancelReject}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {showRejectionReason && document.rejection_reason && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium text-red-700">
            Rejection Reason:
          </p>
          <p className="text-sm text-muted-foreground">
            {document.rejection_reason}
          </p>
        </div>
      )}
    </div>
  );
}
