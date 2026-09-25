/**
 * Pure request-handling logic for the generate-invoice-pdf edge function,
 * separated from Deno.serve/HTTP wiring and the real Supabase/provider
 * clients so it can be unit tested with fakes (same pattern as
 * socialPublishExecution.ts).
 */

export const TEMPLATE_ID = "dc90e595-e2ca-440a-ac11-4fe1f58efb23";
export const MAX_LINE_ITEMS = 200;
const MAX_STRING_LENGTH = 500;
const MAX_NOTES_LENGTH = 5000;
const AMOUNT_TOLERANCE = 0.02;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InvoiceRow = {
  invoice_number: string;
  subtotal?: number | string | null;
  amount?: number | string | null;
  tax_amount?: number | string | null;
  vat_amount?: number | string | null;
  discount_amount?: number | string | null;
};

export type AuthenticatedUser = { id: string };

export type InvoicePdfRequestContext = {
  getAuthenticatedUser: () => Promise<AuthenticatedUser | null>;
  fetchInvoiceRow: (invoiceId: string) => Promise<InvoiceRow | null>;
  requestPdf: (
    apiPayload: Record<string, unknown>,
  ) => Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; providerStatus: number }>;
};

export type InvoicePdfResult =
  | { status: 200; bytes: ArrayBuffer; invoiceNumber: string }
  | { status: 401 | 400 | 404 | 502 | 500; error: string };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonEmptyString(value: unknown, maxLength = MAX_STRING_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function optionalString(value: unknown, maxLength = MAX_STRING_LENGTH): string | null {
  if (value === null || value === undefined) return null;
  return nonEmptyString(value, maxLength);
}

function optionalHttpUrl(value: unknown): string | null {
  const candidate = optionalString(value, 2000);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return candidate;
  } catch {
    return null;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return value || "";
  }
}

function closeEnough(a: number, b: number) {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function handleInvoicePdfRequest(
  rawPayload: unknown,
  context: InvoicePdfRequestContext,
): Promise<InvoicePdfResult> {
  const user = await context.getAuthenticatedUser();
  if (!user) return { status: 401, error: "Authentication required." };

  if (!rawPayload || typeof rawPayload !== "object") {
    return { status: 400, error: "A valid request body is required." };
  }
  const payload = rawPayload as Record<string, unknown>;

  const invoiceId = typeof payload.invoiceId === "string" ? payload.invoiceId : null;
  if (!invoiceId || !UUID_PATTERN.test(invoiceId)) {
    return { status: 400, error: "A valid invoiceId is required." };
  }

  // This is the authorisation check: RLS (via the caller's own scoped
  // client, wired up by the caller of this function) decides whether the
  // row is visible at all. An authenticated-but-unauthorised caller and a
  // caller referencing a nonexistent invoice both surface identically here
  // - that's intentional, matching the sars-correspondence-draft pattern.
  const invoiceRow = await context.fetchInvoiceRow(invoiceId);
  if (!invoiceRow) return { status: 404, error: "Invoice not found or not accessible." };

  const invoiceNumber = nonEmptyString(payload.invoiceNumber, 100);
  if (!invoiceNumber) return { status: 400, error: "A valid invoiceNumber is required." };
  if (invoiceNumber !== invoiceRow.invoice_number) {
    return { status: 400, error: "invoiceNumber does not match the requested invoice." };
  }

  const practitioner = (payload.practitioner && typeof payload.practitioner === "object"
    ? payload.practitioner
    : {}) as Record<string, unknown>;
  const practitionerName = nonEmptyString(practitioner.name, 200) ?? "Practitioner";

  const client = (payload.client && typeof payload.client === "object"
    ? payload.client
    : {}) as Record<string, unknown>;
  const clientName = nonEmptyString(client.name, 200) ?? "Client";

  const rawLineItems = Array.isArray(payload.lineItems) ? payload.lineItems : [];
  if (rawLineItems.length === 0) return { status: 400, error: "At least one line item is required." };
  if (rawLineItems.length > MAX_LINE_ITEMS) {
    return { status: 400, error: `A maximum of ${MAX_LINE_ITEMS} line items is supported.` };
  }

  const lineItems = rawLineItems.map((item) => {
    const record = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const serviceItem = nonEmptyString(record.serviceItem, MAX_STRING_LENGTH) ?? "Service item";
    const quantity = isFiniteNumber(record.quantity) && record.quantity > 0 ? record.quantity : 1;
    const unitPrice = isFiniteNumber(record.unitPrice) && record.unitPrice >= 0 ? record.unitPrice : 0;
    return { description: serviceItem, quantity, unit_price: unitPrice };
  });

  const submittedSubtotal = isFiniteNumber(payload.subtotal) ? payload.subtotal : null;
  const submittedVatAmount = isFiniteNumber(payload.vatAmount) ? payload.vatAmount : null;
  const submittedDiscountAmount = isFiniteNumber(payload.discountAmount) ? payload.discountAmount : 0;

  const dbSubtotal = toNumber(invoiceRow.subtotal ?? invoiceRow.amount);
  const dbVatAmount = toNumber(invoiceRow.tax_amount ?? invoiceRow.vat_amount);
  const dbDiscountAmount = toNumber(invoiceRow.discount_amount);

  if (submittedSubtotal !== null && !closeEnough(submittedSubtotal, dbSubtotal)) {
    return { status: 400, error: "subtotal does not match the requested invoice." };
  }
  if (submittedVatAmount !== null && !closeEnough(submittedVatAmount, dbVatAmount)) {
    return { status: 400, error: "vatAmount does not match the requested invoice." };
  }
  if (!closeEnough(submittedDiscountAmount, dbDiscountAmount)) {
    return { status: 400, error: "discountAmount does not match the requested invoice." };
  }

  const subtotal = submittedSubtotal ?? dbSubtotal;
  const vatAmount = submittedVatAmount ?? dbVatAmount;
  const vatRate = isFiniteNumber(payload.vatRate) && payload.vatRate >= 0 && payload.vatRate <= 100
    ? payload.vatRate
    : subtotal > 0 && vatAmount > 0
      ? Math.round((vatAmount / subtotal) * 100)
      : 0;

  const logoUrl = optionalHttpUrl(payload.logoUrl) ?? "https://acapoliteconsulting.co.za/acapolite-logo.png";

  const notesText = [
    optionalString(payload.notesToClient, MAX_NOTES_LENGTH) || "Thank you for your business.",
    optionalString(payload.termsAndConditions, MAX_NOTES_LENGTH) ||
      "Payment due within 7 days. Late payments may attract penalties.",
    optionalString(payload.paymentReference, MAX_STRING_LENGTH)
      ? `Payment Reference: ${optionalString(payload.paymentReference, MAX_STRING_LENGTH)}`
      : null,
  ].filter(Boolean).join("\n\n");

  const apiPayload = {
    template_id: TEMPLATE_ID,
    invoice_number: invoiceNumber,
    currency: "R",
    variable_data: {
      accent_color: "#155bb8",
      logo_url: logoUrl,

      invoice_label: "Tax Invoice",
      invoice_number: invoiceNumber,
      invoice_date: formatDate(optionalString(payload.issueDate, 40)),
      due_date: formatDate(optionalString(payload.dueDate, 40)),
      case_reference: optionalString(payload.caseReference, MAX_STRING_LENGTH),

      practitioner_name: practitionerName,
      practitioner_address: optionalString(practitioner.address, MAX_STRING_LENGTH) || "",
      practitioner_email: optionalString(practitioner.email, MAX_STRING_LENGTH) || "",
      practitioner_phone: optionalString(practitioner.phone, 60) || "",
      practitioner_vat: optionalString(practitioner.vatNumber, 60) || "",

      client_name: clientName,
      client_address: optionalString(client.address, MAX_STRING_LENGTH) || "",
      client_email: optionalString(client.email, MAX_STRING_LENGTH) || "",
      client_phone: optionalString(client.phone, 60) || "",
      client_vat: optionalString(client.vatNumber, 60) || "",

      bank_name: optionalString(payload.bankName, MAX_STRING_LENGTH) || "",
      account_name: optionalString(payload.accountName, MAX_STRING_LENGTH) || practitionerName,
      account_number: optionalString(payload.accountNumber, 60) || "",
      branch_code: optionalString(payload.branchCode, 60) || "",
      reference: optionalString(payload.paymentReference, MAX_STRING_LENGTH) || invoiceNumber,

      vat_rate: vatRate,
      discount_raw: submittedDiscountAmount,

      notes: notesText,

      footer_text: "Acapolite Consulting · Professional SARS Tax Assistance · Generated electronically.",

      line_items: lineItems,
    },
  };

  const providerResult = await context.requestPdf(apiPayload);
  if (!providerResult.ok) {
    return { status: 502, error: "PDF generation is temporarily unavailable. Please try again." };
  }

  return { status: 200, bytes: providerResult.bytes, invoiceNumber };
}
