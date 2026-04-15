import { supabase } from "@/integrations/supabase/client";

type PractitionerAssignmentNotificationInput = {
  caseId: string;
  practitionerProfileId: string;
  practitionerEmail?: string | null;
  practitionerName?: string | null;
  clientName: string;
  caseType: string;
  priority: number;
  assignedAt?: string;
};

type PractitionerAssignmentNotificationResult = {
  error?: Error;
  skipped?: boolean;
};

export function formatCaseReference(caseId: string, caseNumber?: string | null) {
  const normalizedCaseNumber = caseNumber?.trim();
  if (normalizedCaseNumber) {
    return normalizedCaseNumber;
  }

  return `CASE-${caseId.slice(0, 8).toUpperCase()}`;
}

export function formatCaseServiceType(caseType: string) {
  return caseType.replace(/_/g, " ");
}

export function formatCasePriority(priority: number) {
  switch (priority) {
    case 1:
      return "High";
    case 3:
      return "Low";
    default:
      return "Normal";
  }
}

export async function sendPractitionerAssignmentNotification(
  input: PractitionerAssignmentNotificationInput,
): Promise<PractitionerAssignmentNotificationResult> {
  const practitionerEmail = input.practitionerEmail?.trim();

  if (!practitionerEmail) {
    return {
      error: new Error("The assigned practitioner does not have an email address."),
    };
  }

  const { data, error } = await supabase.functions.invoke("send-portal-email", {
    body: {
      type: "practitioner_assigned",
      caseId: input.caseId,
      caseNumber: formatCaseReference(input.caseId),
      practitionerProfileId: input.practitionerProfileId,
      practitionerEmail,
      practitionerName: input.practitionerName?.trim() || "Practitioner",
      clientName: input.clientName,
      serviceType: formatCaseServiceType(input.caseType),
      assignedDate: new Date(input.assignedAt ?? Date.now()).toLocaleDateString("en-ZA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      priority: formatCasePriority(input.priority),
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
