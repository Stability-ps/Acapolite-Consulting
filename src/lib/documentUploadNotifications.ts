import { supabase } from "@/integrations/supabase/client";

type DocumentUploadNotificationInput = {
  documentId: string;
  clientProfileId: string;
  clientName: string;
  documentList: string;
  uploadedAt?: string;
  caseNumber?: string | null;
};

type DocumentUploadNotificationResult = {
  error?: Error;
  skipped?: boolean;
};

function formatDateLabel(value?: string) {
  return new Date(value ?? Date.now()).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function sendClientDocumentUploadNotification(
  input: DocumentUploadNotificationInput,
): Promise<DocumentUploadNotificationResult> {
  const { data, error } = await supabase.functions.invoke("send-portal-email", {
    body: {
      type: "documents_uploaded_admin",
      documentId: input.documentId,
      clientProfileId: input.clientProfileId,
      clientName: input.clientName,
      caseNumber: input.caseNumber?.trim() || "General Support",
      documentList: input.documentList,
      uploadDate: formatDateLabel(input.uploadedAt),
    },
  });

  if (error) {
    return { error };
  }

  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return { error: new Error(data.error) };
  }

  return {
    skipped: Boolean(data && typeof data === "object" && "skipped" in data && data.skipped),
  };
}
