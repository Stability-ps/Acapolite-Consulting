import { supabase } from "@/integrations/supabase/client";

type InvoiceNotificationInput = {
  invoiceId: string;
  invoiceNumber: string;
  clientProfileId: string;
  clientEmail?: string | null;
  clientName: string;
  serviceDescription: string;
  amount: number;
  dueDate?: string | null;
  caseNumber?: string | null;
  status?: string | null;
};

type InvoiceNotificationResult = {
  error?: Error;
  skipped?: boolean;
};

function formatCurrency(amount: number) {
  return `R ${Number(amount).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateLabel(date?: string | null) {
  if (!date) return "Not set";
  return new Date(date).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatStatusLabel(status?: string | null) {
  if (!status) return "Unpaid";
  return status.replace(/_/g, " ");
}

export async function sendInvoiceCreatedNotification(
  input: InvoiceNotificationInput,
): Promise<InvoiceNotificationResult> {
  const clientEmail = input.clientEmail?.trim();

  if (!clientEmail) {
    return {
      error: new Error("The client does not have an email address."),
    };
  }

  const { data, error } = await supabase.functions.invoke("send-portal-email", {
    body: {
      type: "invoice_created",
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      clientProfileId: input.clientProfileId,
      clientEmail,
      clientName: input.clientName,
      caseNumber: input.caseNumber?.trim() || "General Support",
      serviceDescription: input.serviceDescription,
      amount: formatCurrency(input.amount),
      dueDate: formatDateLabel(input.dueDate),
      status: formatStatusLabel(input.status),
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
