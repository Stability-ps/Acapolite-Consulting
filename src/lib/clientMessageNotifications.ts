import { supabase } from "@/integrations/supabase/client";
import { formatCaseReference } from "@/lib/practitionerAssignments";

type ClientMessageNotificationInput = {
  messageId: string;
  clientProfileId: string;
  clientEmail?: string | null;
  clientName: string;
  senderName: string;
  messageText: string;
  sentAt?: string;
  caseId?: string | null;
  conversationSubject?: string | null;
};

type ClientMessageNotificationResult = {
  error?: Error;
  skipped?: boolean;
};

function formatMessagePreview(messageText: string) {
  const condensed = messageText.replace(/\s+/g, " ").trim();
  if (condensed.length <= 140) return condensed;
  return `${condensed.slice(0, 137)}...`;
}

function formatCaseLabel(caseId?: string | null, subject?: string | null) {
  if (caseId) {
    return formatCaseReference(caseId);
  }

  const trimmedSubject = subject?.trim();
  return trimmedSubject || "General Support";
}

export async function sendClientMessageNotification(
  input: ClientMessageNotificationInput,
): Promise<ClientMessageNotificationResult> {
  const clientEmail = input.clientEmail?.trim();

  if (!clientEmail) {
    return {
      error: new Error("The client does not have an email address."),
    };
  }

  const caseNumber = formatCaseLabel(input.caseId, input.conversationSubject);

  const { data, error } = await supabase.functions.invoke("send-portal-email", {
    body: {
      type: "practitioner_message",
      messageId: input.messageId,
      clientProfileId: input.clientProfileId,
      clientEmail,
      clientName: input.clientName,
      practitionerName: input.senderName,
      caseNumber,
      messagePreview: formatMessagePreview(input.messageText),
      sentDate: new Date(input.sentAt ?? Date.now()).toLocaleDateString("en-ZA", {
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
