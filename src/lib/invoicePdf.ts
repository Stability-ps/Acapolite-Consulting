import { toast } from "sonner";

/**
 * Payload for the PDF generation API
 * Structured to match the requirements for template ID: dc90e595-e2ca-440a-ac11-4fe1f58efb23
 */
export type InvoicePdfPayload = {
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
 * Formats a date string to "DD MMMM YYYY" (e.g. 27 April 2026)
 */
function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (e) {
    return value || "";
  }
}

/**
 * Generates and opens/downloads the invoice PDF via the external Supabase Edge Function
 */
export async function openInvoicePdf(
  payload: InvoicePdfPayload,
  options: OpenInvoicePdfOptions = {},
) {
  // Validate banking details before generating PDF
  const hasCompleteBanking = Boolean(
    payload.bankName?.trim()
    && payload.accountName?.trim()
    && payload.accountNumber?.trim()
    && payload.branchCode?.trim()
  );

  if (!hasCompleteBanking) {
    toast.error("Please complete and verify your banking details before generating or sending invoices.");
    return;
  }

  const shouldDownload = options.autoPrint === true;
  const appLogoUrl = "https://acapoliteconsulting.co.za/acapolite-logo.png";

  const pdfApiUrl =
    import.meta.env.VITE_PDF_API_URL ||
    "https://nxqtduvaaacxsxkkaopd.supabase.co/functions/v1/generate-pdf-api";
  const pdfApiKey =
    import.meta.env.VITE_PDF_API_KEY ||
    "ih_live_9be7d51f616815f04121124e0a09a08ce117fc343ebb695a";

  const toastId = toast.loading("Generating Tax Invoice...", {
    description: "Please wait while we prepare your document.",
  });

  // Calculate dynamic VAT rate if not explicitly provided
  const calculatedVatRate =
    payload.vatRate ??
    (payload.vatAmount > 0 && payload.subtotal > 0
      ? Math.round((payload.vatAmount / payload.subtotal) * 100)
      : 0);

  // Construct the notes field from client notes and payment terms
  const notesText = [
    payload.notesToClient || "Thank you for your business.",
    payload.termsAndConditions || "Payment due within 7 days. Late payments may attract penalties.",
    payload.paymentReference ? `Payment Reference: ${payload.paymentReference}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Construct the API payload exactly as requested
  const apiPayload = {
    template_id: "dc90e595-e2ca-440a-ac11-4fe1f58efb23",
    invoice_number: payload.invoiceNumber,
    currency: "R",
    variable_data: {
      accent_color: "#155bb8",
      logo_url:
        payload.logoUrl && payload.logoUrl.startsWith("http")
          ? payload.logoUrl
          : appLogoUrl,

      invoice_label: "Tax Invoice",
      invoice_number: payload.invoiceNumber,
      invoice_date: formatDate(payload.issueDate),
      due_date: formatDate(payload.dueDate),
      case_reference: payload.caseReference || null,

      practitioner_name: payload.practitioner.name,
      practitioner_address: payload.practitioner.address || "",
      practitioner_email: payload.practitioner.email || "",
      practitioner_phone: payload.practitioner.phone || "",
      practitioner_vat: payload.practitioner.vatNumber || "",

      client_name: payload.client.name,
      client_address: payload.client.address || "",
      client_email: payload.client.email || "",
      client_phone: payload.client.phone || "",
      client_vat: payload.client.vatNumber || "",

      bank_name: payload.bankName || "",
      account_name: payload.accountName || payload.practitioner.name || "",
      account_number: payload.accountNumber || "",
      branch_code: payload.branchCode || "",
      reference: payload.paymentReference || payload.invoiceNumber,

      vat_rate: calculatedVatRate,
      discount_raw: payload.discountAmount ?? 0,

      notes: notesText,

      footer_text:
        "Acapolite Consulting · Professional SARS Tax Assistance · Generated electronically.",

      line_items: payload.lineItems.map((item) => ({
        description: item.serviceItem,
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unitPrice) || 0,
      })),
    },
  };

  try {
    console.log("Requesting PDF with template ID dc90e595-e2ca-440a-ac11-4fe1f58efb23");
    const response = await fetch(pdfApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pdfApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(apiPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const pdfBlob = await response.blob();

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
  } catch (err: any) {
    console.error("PDF generation error:", err);
    toast.error(`Failed to generate PDF: ${err.message}`, { id: toastId });
  }
}
