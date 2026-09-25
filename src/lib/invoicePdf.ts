import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Payload for invoice PDF generation.
 *
 * This is sent to the generate-invoice-pdf Supabase Edge Function, which
 * authenticates the caller, re-fetches the authoritative invoice row via
 * the caller's own RLS-scoped client (that lookup is what actually
 * authorises the request), cross-checks the financial fields below
 * against that row, and only then talks to the external PDF provider
 * using a server-side-only credential. The provider credential is never
 * present in this file or in any browser-side code.
 */
export type InvoicePdfPayload = {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  status?: string | null;
  caseReference?: string | null;
  logoUrl?: string | null;
  practitioner: {
    name: string;
    subtitle?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    vatNumber?: string | null;
  };
  client: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    vatNumber?: string | null;
  };
  lineItems: Array<{
    serviceItem: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal: number;
  discountAmount?: number;
  vatAmount: number;
  vatRate?: number;
  notesToClient?: string | null;
  termsAndConditions?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  branchCode?: string | null;
  paymentReference?: string | null;
};

type OpenInvoicePdfOptions = {
  autoPrint?: boolean;
};

/**
 * Generates and opens/downloads the invoice PDF via Acapolite's own
 * authenticated generate-invoice-pdf Edge Function.
 */
export async function openInvoicePdf(
  payload: InvoicePdfPayload,
  options: OpenInvoicePdfOptions = {},
) {
  const shouldDownload = options.autoPrint === true;

  const toastId = toast.loading("Generating Tax Invoice...", {
    description: "Please wait while we prepare your document.",
  });

  try {
    const { data, error } = await supabase.functions.invoke("generate-invoice-pdf", {
      body: payload,
    });

    if (error) {
      let message = error.message || "Unable to generate the invoice PDF.";
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === "function") {
        try {
          const body = await context.clone().json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          // Response wasn't JSON - fall back to the generic message above.
        }
      }
      throw new Error(message);
    }

    if (!(data instanceof Blob)) {
      throw new Error("The PDF service returned an unexpected response.");
    }

    const pdfBlob = data;

    if (shouldDownload) {
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `invoice-${payload.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 10_000);
    } else {
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    }

    toast.success("PDF generated successfully!", { id: toastId });
  } catch (err) {
    console.error("PDF generation error:", err);
    const message = err instanceof Error ? err.message : "Unable to generate the invoice PDF.";
    toast.error(`Failed to generate PDF: ${message}`, { id: toastId });
  }
}
