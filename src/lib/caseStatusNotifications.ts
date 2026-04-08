import { supabase } from "@/integrations/supabase/client";
import { formatCaseReference } from "@/lib/practitionerAssignments";

type CaseStatusNotificationInput = {
  caseId: string;
  clientProfileId: string;
  clientEmail?: string | null;
  clientName: string;
  serviceType: string;
  previousStatus: string;
  newStatus: string;
  updatedAt?: string;
};

type CaseStatusNotificationResult = {
  error?: Error;
  skipped?: boolean;
};

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export async function sendCaseStatusChangedNotification(
  input: CaseStatusNotificationInput,
): Promise<CaseStatusNotificationResult> {
  const clientEmail = input.clientEmail?.trim();

  if (!clientEmail) {
    return {
      error: new Error("The client does not have an email address."),
    };
  }

  const { data, error } = await supabase.functions.invoke("send-portal-email", {
    body: {
      type: "case_status_changed",
      caseId: input.caseId,
      caseNumber: formatCaseReference(input.caseId),
      clientProfileId: input.clientProfileId,
      clientEmail,
      clientName: input.clientName,
      serviceType: input.serviceType.replace(/_/g, " "),
      previousStatus: formatStatusLabel(input.previousStatus),
      newStatus: formatStatusLabel(input.newStatus),
      updateDate: new Date(input.updatedAt ?? Date.now()).toLocaleDateString("en-ZA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
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
