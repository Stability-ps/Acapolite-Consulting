import { toast } from "sonner";

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
  /**
   * Kept for backward compatibility with the existing buttons:
   * false = PDF Preview, true = direct .pdf download.
   */
  autoPrint?: boolean;
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(Number.isFinite(value) ? value : 0)
    .replace("ZAR", "R")
    .replace(/\u00a0/g, "");
}

function buildInvoiceHtml(payload: InvoicePdfPayload) {
  const logoUrl =
    payload.logoUrl && /^https?:\/\//i.test(payload.logoUrl)
      ? payload.logoUrl
      : "https://acapoliteconsulting.co.za/acapolite-logo.png";

  const discount = Number(payload.discountAmount || 0);
  const vat = Number(payload.vatAmount || 0);
  const subtotal = Number(payload.subtotal || 0);
  const total = subtotal - discount + vat;
  const vatRate =
    payload.vatRate ??
    (vat > 0 && subtotal - discount > 0
      ? Math.round((vat / (subtotal - discount)) * 100)
      : 0);

  const lineItems = payload.lineItems
    .map((item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      return `
        <tr>
          <td>${escapeHtml(item.serviceItem || "Service item")}</td>
          <td class="right">${escapeHtml(quantity || 1)}</td>
          <td class="right">${escapeHtml(formatMoney(unitPrice))}</td>
          <td class="right">${escapeHtml(formatMoney((quantity || 1) * unitPrice))}</td>
        </tr>`;
    })
    .join("");

  const notes = [
    payload.notesToClient || "Thank you for your business.",
    payload.termsAndConditions ||
      "Payment is due by the invoice due date. Proof of payment must be uploaded through the Acapolite portal. Late payment may delay work progress and final submission.",
    payload.paymentReference
      ? `Payment Reference: ${payload.paymentReference}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="invoice-document">
      <div class="header">
        <div class="issuer">
          <img src="${escapeHtml(logoUrl)}" alt="Acapolite Consulting" crossorigin="anonymous" />
          <h1>${escapeHtml(payload.practitioner.name || "Acapolite Consulting")}</h1>
          ${payload.practitioner.address ? `<p>${escapeHtml(payload.practitioner.address)}</p>` : ""}
          ${payload.practitioner.email ? `<p>Email: ${escapeHtml(payload.practitioner.email)}</p>` : ""}
          ${payload.practitioner.phone ? `<p>Phone: ${escapeHtml(payload.practitioner.phone)}</p>` : ""}
          <p>VAT No: ${escapeHtml(payload.practitioner.vatNumber || "")}</p>
        </div>
        <div class="invoice-meta">
          <div class="invoice-title">Tax Invoice</div>
          <p>Invoice #: ${escapeHtml(payload.invoiceNumber)}</p>
          <p>Date: ${escapeHtml(formatDate(payload.issueDate))}</p>
          <p>Due: ${escapeHtml(formatDate(payload.dueDate))}</p>
        </div>
      </div>

      <div class="blue-rule"></div>

      <div class="details-grid">
        <section class="detail-card">
          <div class="section-title">CLIENT DETAILS</div>
          <strong>${escapeHtml(payload.client.name)}</strong>
          ${payload.client.address ? `<p>${escapeHtml(payload.client.address)}</p>` : ""}
          ${payload.client.email ? `<p>Email: ${escapeHtml(payload.client.email)}</p>` : ""}
          ${payload.client.phone ? `<p>Phone: ${escapeHtml(payload.client.phone)}</p>` : ""}
          <p>VAT No: ${escapeHtml(payload.client.vatNumber || "")}</p>
        </section>

        <section class="detail-card">
          <div class="section-title">VERIFIED PRACTITIONER BANKING</div>
          <p>Bank Name: ${escapeHtml(payload.bankName || "")}</p>
          <p>Account Name: ${escapeHtml(payload.accountName || payload.practitioner.name || "")}</p>
          <p>Account Number: ${escapeHtml(payload.accountNumber || "")}</p>
          <p>Branch Code: ${escapeHtml(payload.branchCode || "")}</p>
          <p>Reference: ${escapeHtml(payload.paymentReference || payload.invoiceNumber)}</p>
        </section>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Qty</th>
            <th class="right">Rate</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>${lineItems}</tbody>
      </table>

      <div class="totals-wrap">
        <table class="totals">
          <tbody>
            <tr><td>Subtotal</td><td class="right">${escapeHtml(formatMoney(subtotal))}</td></tr>
            ${discount > 0 ? `<tr><td>Discount</td><td class="right">${escapeHtml(formatMoney(discount))}</td></tr>` : ""}
            <tr><td>VAT (${escapeHtml(vatRate)}%)</td><td class="right">${escapeHtml(formatMoney(vat))}</td></tr>
            <tr class="total-due"><td>Total Due</td><td class="right">${escapeHtml(formatMoney(total))}</td></tr>
          </tbody>
        </table>
      </div>

      <section class="terms">
        <strong>Terms &amp; Conditions</strong>
        <p>${escapeHtml(notes)}</p>
      </section>

      <footer>Acapolite Consulting · Professional SARS Tax Assistance · Generated electronically.</footer>
    </div>
  `;
}

function createInvoiceContainer(payload: InvoicePdfPayload) {
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.position = "fixed";
  container.style.left = "-100000px";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.background = "#fff";
  container.innerHTML = `
    <style>
      .invoice-document {
        box-sizing: border-box;
        width: 210mm;
        min-height: 297mm;
        padding: 10mm 9mm 8mm;
        background: #fff;
        color: #374151;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 10.5pt;
        line-height: 1.38;
      }
      .invoice-document * { box-sizing: border-box; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
      .issuer { width: 58%; }
      .issuer img { display: block; width: 165px; height: 48px; object-fit: contain; object-position: left center; margin-bottom: 7px; }
      .issuer h1 { margin: 0 0 9px; font-size: 18pt; line-height: 1.1; color: #155bb8; font-weight: 700; }
      .issuer p, .invoice-meta p, .detail-card p { margin: 2px 0; }
      .invoice-meta { width: 38%; text-align: right; color: #374151; }
      .invoice-title { margin-bottom: 5px; font-size: 25pt; line-height: 1; font-weight: 800; color: #111827; }
      .blue-rule { height: 3px; margin: 18px 0 16px; background: #2468b9; }
      .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .detail-card { min-height: 128px; border: 1px solid #d1d5db; border-radius: 8px; padding: 11px 12px; }
      .detail-card strong { display: block; margin-bottom: 5px; color: #111827; }
      .section-title { margin-bottom: 7px; color: #2468b9; font-size: 9.5pt; font-weight: 800; letter-spacing: .09em; }
      .items { width: 100%; margin-top: 22px; border-collapse: collapse; }
      .items th { padding: 7px 9px; background: #2468b9; color: #fff; text-align: left; font-weight: 700; }
      .items td { padding: 7px 9px; border-bottom: 1px solid #e5e7eb; color: #374151; }
      .right { text-align: right !important; }
      .totals-wrap { display: flex; justify-content: flex-end; margin-top: 12px; }
      .totals { width: 44%; border-collapse: collapse; }
      .totals td { padding: 8px 6px; border-bottom: 1px solid #e5e7eb; }
      .total-due td { padding-top: 10px; border-bottom: 0; color: #155bb8; font-size: 15pt; font-weight: 800; }
      .terms { margin-top: 24px; border-left: 4px solid #2468b9; background: #f8fafc; padding: 11px 10px; color: #374151; }
      .terms strong { color: #111827; }
      .terms p { margin: 4px 0 0; }
      footer { margin-top: 15px; padding-top: 14px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 9pt; }
    </style>
    ${buildInvoiceHtml(payload)}
  `;
  document.body.appendChild(container);
  return container;
}

async function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
}

export async function openInvoicePdf(
  payload: InvoicePdfPayload,
  options: OpenInvoicePdfOptions = {},
) {
  const shouldDownload = options.autoPrint === true;
  const toastId = toast.loading("Generating Tax Invoice...", {
    description: "Please wait while we prepare your document.",
  });
  const container = createInvoiceContainer(payload);

  try {
    await waitForImages(container);
    const { default: html2pdf } = await import("html2pdf.js");
    const filename = `invoice-${payload.invoiceNumber}.pdf`;
    const worker = html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(container);

    if (shouldDownload) {
      await worker.save();
    } else {
      const pdfBlob = await worker.outputPdf("blob");
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    }

    toast.success("PDF generated successfully!", { id: toastId });
  } catch (err) {
    console.error("PDF generation error:", err);
    const message = err instanceof Error ? err.message : "Unable to generate the invoice PDF.";
    toast.error(`Failed to generate PDF: ${message}`, { id: toastId });
  } finally {
    container.remove();
  }
}
