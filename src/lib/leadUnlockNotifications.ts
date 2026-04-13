import { supabase } from "@/integrations/supabase/client";

type LeadUnlockNotificationInput = {
  requestId: string;
  clientEmail: string;
  clientName: string;
  practitionerName: string;
  serviceType: string;
};

type LeadUnlockNotificationResult = {
  error?: Error;
  skipped?: boolean;
};

export async function sendLeadUnlockedNotification(
  input: LeadUnlockNotificationInput,
): Promise<LeadUnlockNotificationResult> {
  const clientEmail = input.clientEmail?.trim();

  if (!clientEmail) {
    return { error: new Error("Client email is required for lead unlock notifications.") };
  }

  const { data, error } = await supabase.functions.invoke("send-portal-email", {
    body: {
      type: "lead_unlocked",
      requestId: input.requestId,
      clientEmail,
      clientName: input.clientName?.trim() || "Client",
      practitionerName: input.practitionerName?.trim() || "Practitioner",
      serviceType: input.serviceType?.replace(/_/g, " ") || "Tax support",
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
