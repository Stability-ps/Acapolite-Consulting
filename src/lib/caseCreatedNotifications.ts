import { supabase } from "@/integrations/supabase/client";
import { formatCaseReference } from "@/lib/practitionerAssignments";

type CaseCreatedNotificationInput = {
  caseId: string;
  clientProfileId: string;
  clientEmail?: string | null;
  clientName: string;
  createdAt?: string;
};

type CaseCreatedNotificationResult = {
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

export async function sendCaseCreatedNotification(
  input: CaseCreatedNotificationInput,
): Promise<CaseCreatedNotificationResult> {
  const clientEmail = input.clientEmail?.trim();

  if (!clientEmail) {
    return {
      error: new Error("The client does not have an email address."),
    };
  }

  const { data, error } = await supabase.functions.invoke("send-portal-email", {
    body: {
      type: "case_created",
      caseId: input.caseId,
      caseNumber: formatCaseReference(input.caseId),
      clientProfileId: input.clientProfileId,
      clientEmail,
      clientName: input.clientName,
      createdDate: formatDateLabel(input.createdAt),
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
