type InvoicePdfPayload = {
  invoiceNumber: string;
  clientName: string;
  caseReference?: string | null;
  serviceDescription?: string | null;
  issueDate: string;
  dueDate?: string | null;
  status?: string | null;
  subtotal: number;
  vatAmount: number;
  total: number;
  bankDetails?: string | null;
};

const disclaimerText =
  "Payment is made directly to the practitioner. Acapolite Consulting is not responsible for payment processing or payment disputes.";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(amount: number) {
  return `R ${Number(amount).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
}

export function openInvoicePdf(payload: InvoicePdfPayload) {
  const pdfWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!pdfWindow) {
    return;
  }

  const body = `
    <div class="header">
      <div>
        <div class="eyebrow">Invoice</div>
        <h1>${escapeHtml(payload.invoiceNumber)}</h1>
        <p>Status: ${escapeHtml(payload.status ?? "Draft")}</p>
      </div>
      <div class="dates">
        <div><span>Issue Date:</span> ${escapeHtml(formatDate(payload.issueDate))}</div>
        <div><span>Due Date:</span> ${escapeHtml(formatDate(payload.dueDate))}</div>
      </div>
    </div>
    <div class="section">
      <h2>Client</h2>
      <p>${escapeHtml(payload.clientName)}</p>
      <p class="muted">Case Reference: ${escapeHtml(payload.caseReference || "General Support")}</p>
    </div>
    <div class="section">
      <h2>Service Description</h2>
      <p>${escapeHtml(payload.serviceDescription || "Professional tax services")}</p>
    </div>
    <div class="section totals">
      <div class="row"><span>Amount</span><strong>${escapeHtml(formatCurrency(payload.subtotal))}</strong></div>
      <div class="row"><span>VAT</span><strong>${escapeHtml(formatCurrency(payload.vatAmount))}</strong></div>
      <div class="row total"><span>Total</span><strong>${escapeHtml(formatCurrency(payload.total))}</strong></div>
    </div>
    <div class="section">
      <h2>Practitioner Banking Details</h2>
      <pre>${escapeHtml(payload.bankDetails || "Bank details will be provided by the practitioner.")}</pre>
    </div>
    <div class="disclaimer">${escapeHtml(disclaimerText)}</div>
  `;

  pdfWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Invoice ${escapeHtml(payload.invoiceNumber)}</title>
        <style>
          body { font-family: "Inter", "Segoe UI", sans-serif; color: #0f172a; margin: 32px; }
          h1 { margin: 6px 0 2px; font-size: 28px; }
          h2 { font-size: 16px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
          .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; color: #64748b; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; }
          .dates { font-size: 13px; color: #475569; line-height: 1.6; }
          .dates span { font-weight: 600; color: #0f172a; }
          .section { border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; margin-bottom: 16px; background: #f8fafc; }
          .section p { margin: 0; line-height: 1.5; }
          .muted { color: #64748b; font-size: 13px; margin-top: 6px; }
          .totals { background: #ffffff; }
          .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
          .row.total { font-size: 16px; }
          pre { margin: 0; white-space: pre-wrap; font-family: "Inter", "Segoe UI", sans-serif; font-size: 13px; color: #0f172a; }
          .disclaimer { margin-top: 24px; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        ${body}
        <script>
          window.onload = () => {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  pdfWindow.document.close();
}

