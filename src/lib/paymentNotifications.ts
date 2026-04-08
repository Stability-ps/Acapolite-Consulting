import { supabase } from "@/integrations/supabase/client";

type ProofOfPaymentNotificationInput = {
  invoiceId: string;
  invoiceNumber: string;
  clientProfileId: string;
  clientName: string;
  caseNumber?: string | null;
  amount: number;
  uploadedAt?: string;
};

type ProofOfPaymentNotificationResult = {
  error?: Error;
  skipped?: boolean;
};

function formatCurrency(amount: number) {
  return `R ${Number(amount).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateLabel(value?: string) {
  return new Date(value ?? Date.now()).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function sendProofOfPaymentUploadedNotification(
  input: ProofOfPaymentNotificationInput,
): Promise<ProofOfPaymentNotificationResult> {
  const { data, error } = await supabase.functions.invoke("send-portal-email", {
    body: {
      type: "proof_of_payment_uploaded",
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      clientProfileId: input.clientProfileId,
      clientName: input.clientName,
      caseNumber: input.caseNumber?.trim() || "General Support",
      amount: formatCurrency(input.amount),
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
