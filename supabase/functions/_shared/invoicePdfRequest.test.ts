import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleInvoicePdfRequest, MAX_LINE_ITEMS, TEMPLATE_ID, type InvoicePdfRequestContext, type InvoiceRow } from "./invoicePdfRequest.ts";

const VALID_INVOICE_ID = "11111111-1111-1111-1111-111111111111";

const BASE_ROW: InvoiceRow = {
  invoice_number: "INV-0001",
  subtotal: 1000,
  tax_amount: 150,
  discount_amount: 0,
};

function makeContext(overrides: Partial<InvoicePdfRequestContext> = {}): InvoicePdfRequestContext {
  return {
    getAuthenticatedUser: async () => ({ id: "user-1" }),
    fetchInvoiceRow: async () => ({ ...BASE_ROW }),
    requestPdf: async () => ({ ok: true, bytes: new TextEncoder().encode("%PDF-fake").buffer }),
    ...overrides,
  };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    invoiceId: VALID_INVOICE_ID,
    invoiceNumber: "INV-0001",
    issueDate: "2026-09-25",
    practitioner: { name: "Jane Practitioner" },
    client: { name: "Acme Co" },
    lineItems: [{ serviceItem: "Tax return", quantity: 1, unitPrice: 1000 }],
    subtotal: 1000,
    vatAmount: 150,
    discountAmount: 0,
    ...overrides,
  };
}

Deno.test("unauthenticated request is rejected with 401", async () => {
  const context = makeContext({ getAuthenticatedUser: async () => null });
  const result = await handleInvoicePdfRequest(validPayload(), context);
  assertEquals(result.status, 401);
});

Deno.test("a request for an invoice RLS blocks (or that doesn't exist) is rejected with 404 - this is the authorisation check", async () => {
  const context = makeContext({ fetchInvoiceRow: async () => null });
  const result = await handleInvoicePdfRequest(validPayload(), context);
  assertEquals(result.status, 404);
});

Deno.test("a valid, matching payload is accepted and forwarded with the fixed template id", async () => {
  const captured: Record<string, unknown>[] = [];
  const context = makeContext({
    requestPdf: async (apiPayload) => {
      captured.push(apiPayload);
      return { ok: true, bytes: new ArrayBuffer(4) };
    },
  });
  const result = await handleInvoicePdfRequest(validPayload(), context);
  assertEquals(result.status, 200);
  assertEquals(captured.length, 1);
  assertEquals(captured[0].template_id, TEMPLATE_ID);
  assertEquals(captured[0].invoice_number, "INV-0001");
});

Deno.test("client-supplied template_id is ignored - only the fixed TEMPLATE_ID is ever sent", async () => {
  const captured: Record<string, unknown>[] = [];
  const context = makeContext({
    requestPdf: async (apiPayload) => {
      captured.push(apiPayload);
      return { ok: true, bytes: new ArrayBuffer(4) };
    },
  });
  await handleInvoicePdfRequest(validPayload({ template_id: "attacker-supplied-template" }), context);
  assertEquals(captured.length, 1);
  assertEquals(captured[0].template_id, TEMPLATE_ID);
});

Deno.test("missing invoiceId is rejected with 400", async () => {
  const payload = validPayload() as Record<string, unknown>;
  delete payload.invoiceId;
  const result = await handleInvoicePdfRequest(payload, makeContext());
  assertEquals(result.status, 400);
});

Deno.test("malformed (non-UUID) invoiceId is rejected with 400", async () => {
  const result = await handleInvoicePdfRequest(validPayload({ invoiceId: "not-a-uuid" }), makeContext());
  assertEquals(result.status, 400);
});

Deno.test("invoiceNumber mismatched against the authoritative row is rejected with 400", async () => {
  const result = await handleInvoicePdfRequest(validPayload({ invoiceNumber: "INV-9999" }), makeContext());
  assertEquals(result.status, 400);
});

Deno.test("subtotal that diverges from the authoritative row is rejected with 400 (amount-forgery guard)", async () => {
  const result = await handleInvoicePdfRequest(validPayload({ subtotal: 999999 }), makeContext());
  assertEquals(result.status, 400);
});

Deno.test("vatAmount that diverges from the authoritative row is rejected with 400", async () => {
  const result = await handleInvoicePdfRequest(validPayload({ vatAmount: 5 }), makeContext());
  assertEquals(result.status, 400);
});

Deno.test("subtotal within floating-point rounding tolerance of the DB row is accepted", async () => {
  const result = await handleInvoicePdfRequest(validPayload({ subtotal: 1000.01 }), makeContext());
  assertEquals(result.status, 200);
});

Deno.test("empty lineItems array is rejected with 400", async () => {
  const result = await handleInvoicePdfRequest(validPayload({ lineItems: [] }), makeContext());
  assertEquals(result.status, 400);
});

Deno.test("non-array lineItems is rejected with 400", async () => {
  const result = await handleInvoicePdfRequest(validPayload({ lineItems: "not-an-array" }), makeContext());
  assertEquals(result.status, 400);
});

Deno.test(`more than ${MAX_LINE_ITEMS} line items is rejected with 400`, async () => {
  const tooMany = Array.from({ length: MAX_LINE_ITEMS + 1 }, (_, i) => ({
    serviceItem: `Item ${i}`,
    quantity: 1,
    unitPrice: 1,
  }));
  const result = await handleInvoicePdfRequest(validPayload({ lineItems: tooMany }), makeContext());
  assertEquals(result.status, 400);
});

Deno.test("a non-http(s) logoUrl is dropped in favour of the default, not passed through", async () => {
  const captured: Record<string, unknown>[] = [];
  const context = makeContext({
    requestPdf: async (apiPayload) => {
      captured.push(apiPayload);
      return { ok: true, bytes: new ArrayBuffer(4) };
    },
  });
  await handleInvoicePdfRequest(validPayload({ logoUrl: "javascript:alert(1)" }), context);
  assertEquals(captured.length, 1);
  const variableData = captured[0].variable_data as Record<string, unknown>;
  assertEquals(variableData.logo_url, "https://acapoliteconsulting.co.za/acapolite-logo.png");
});

Deno.test("a completely malformed (non-object) request body is rejected with 400", async () => {
  const result = await handleInvoicePdfRequest("not an object", makeContext());
  assertEquals(result.status, 400);
});

Deno.test("provider failure is surfaced as 502 without leaking provider details", async () => {
  const context = makeContext({ requestPdf: async () => ({ ok: false, providerStatus: 500 }) });
  const result = await handleInvoicePdfRequest(validPayload(), context);
  assertEquals(result.status, 502);
  if (result.status !== 200) {
    assert(!result.error.toLowerCase().includes("provider"));
  }
});

Deno.test("a caller in a different, unrelated case cannot forge access via a guessed invoiceId - fetchInvoiceRow is the sole gate", async () => {
  // Simulates RLS correctly scoping rows: this context only "has" one
  // invoice, everything else looks not-found regardless of shape.
  const context = makeContext({
    fetchInvoiceRow: async (invoiceId) => (invoiceId === VALID_INVOICE_ID ? { ...BASE_ROW } : null),
  });
  const otherInvoiceId = "22222222-2222-2222-2222-222222222222";
  const result = await handleInvoicePdfRequest(validPayload({ invoiceId: otherInvoiceId }), context);
  assertEquals(result.status, 404);
});
