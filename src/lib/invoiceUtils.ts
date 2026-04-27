export type InvoiceAttachmentType =
  | "tax_calculation"
  | "supporting_document"
  | "work_summary";

export type InvoiceLineItemDraft = {
  id?: string;
  service_item: string;
  quantity: string;
  unit_price: string;
};

export type InvoiceFileAttachmentDraft = {
  local_id: string;
  file: File;
  attachment_type: InvoiceAttachmentType;
};

export const invoiceAttachmentTypeOptions: Array<{
  value: InvoiceAttachmentType;
  label: string;
}> = [
  { value: "tax_calculation", label: "Tax Calculation" },
  { value: "supporting_document", label: "Supporting Document" },
  { value: "work_summary", label: "Work Summary" },
];

export const defaultInvoiceTerms =
  "Payment is due by the invoice due date. Proof of payment must be uploaded through the Acapolite portal. Late payment may delay work progress and final submission.";

export function createEmptyInvoiceLineItem(): InvoiceLineItemDraft {
  return {
    service_item: "",
    quantity: "1",
    unit_price: "",
  };
}

export function formatCurrency(amount: number) {
  return `R ${Number(amount || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function sanitizeStorageFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

export function parseNumericInput(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateLineItemTotal(item: InvoiceLineItemDraft) {
  return parseNumericInput(item.quantity) * parseNumericInput(item.unit_price);
}

export function calculateInvoiceSubtotal(items: InvoiceLineItemDraft[]) {
  return items.reduce((total, item) => total + calculateLineItemTotal(item), 0);
}

export function calculateInvoiceFinalTotal(
  items: InvoiceLineItemDraft[],
  taxAmount: string,
  discountAmount: string,
) {
  return Math.max(
    calculateInvoiceSubtotal(items) + parseNumericInput(taxAmount) - parseNumericInput(discountAmount),
    0,
  );
}

export function createInvoiceAttachmentLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
