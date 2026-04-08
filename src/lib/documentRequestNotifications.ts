import { supabase } from "@/integrations/supabase/client";
import { formatCaseReference } from "@/lib/practitionerAssignments";

type DocumentRequestNotificationInput = {
  requestId: string;
  clientProfileId: string;
  clientEmail?: string | null;
  clientName: string;
  practitionerName: string;
  caseId?: string | null;
  documentList: string;
  deadlineDate?: string | null;
};

type DocumentRequestNotificationResult = {
  error?: Error;
  skipped?: boolean;
};

function formatDeadlineLabel(value?: string | null) {
  if (!value) return "As soon as possible";
  return new Date(value).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function sendDocumentRequestNotification(
  input: DocumentRequestNotificationInput,
): Promise<DocumentRequestNotificationResult> {
  const clientEmail = input.clientEmail?.trim();

  if (!clientEmail) {
    return {
      error: new Error("The client does not have an email address."),
    };
  }

  const { data, error } = await supabase.functions.invoke("send-portal-email", {
    body: {
      type: "documents_requested",
      requestId: input.requestId,
      clientProfileId: input.clientProfileId,
      clientEmail,
      clientName: input.clientName,
      practitionerName: input.practitionerName,
      caseNumber: input.caseId ? formatCaseReference(input.caseId) : "General Support",
      documentList: input.documentList,
      deadlineDate: formatDeadlineLabel(input.deadlineDate),
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
