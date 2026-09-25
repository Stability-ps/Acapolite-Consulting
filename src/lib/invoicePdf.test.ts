import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { functionsInvokeMock } = vi.hoisted(() => ({ functionsInvokeMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: functionsInvokeMock } },
}));

vi.mock("sonner", () => ({
  toast: { loading: vi.fn(() => "toast-id"), success: vi.fn(), error: vi.fn() },
}));

import { openInvoicePdf, type InvoicePdfPayload } from "./invoicePdf";
import { toast } from "sonner";

const BASE_PAYLOAD: InvoicePdfPayload = {
  invoiceId: "11111111-1111-1111-1111-111111111111",
  invoiceNumber: "INV-0001",
  issueDate: "2026-09-25",
  practitioner: { name: "Jane Practitioner" },
  client: { name: "Acme Co" },
  lineItems: [{ serviceItem: "Tax return", quantity: 1, unitPrice: 1000 }],
  subtotal: 1000,
  vatAmount: 150,
};

describe("openInvoicePdf", () => {
  beforeEach(() => {
    functionsInvokeMock.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    if (!("createObjectURL" in URL)) {
      // @ts-expect-error jsdom doesn't implement this
      URL.createObjectURL = vi.fn(() => "blob:mock");
    }
    if (!("revokeObjectURL" in URL)) {
      // @ts-expect-error jsdom doesn't implement this
      URL.revokeObjectURL = vi.fn();
    }
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the generate-invoice-pdf edge function with the full payload, not the external provider directly", async () => {
    functionsInvokeMock.mockResolvedValue({ data: new Blob(["%PDF"], { type: "application/pdf" }), error: null });

    await openInvoicePdf(BASE_PAYLOAD);

    expect(functionsInvokeMock).toHaveBeenCalledTimes(1);
    expect(functionsInvokeMock).toHaveBeenCalledWith("generate-invoice-pdf", { body: BASE_PAYLOAD });
  });

  it("on success, opens the returned blob and shows a success toast", async () => {
    functionsInvokeMock.mockResolvedValue({ data: new Blob(["%PDF"], { type: "application/pdf" }), error: null });

    await openInvoicePdf(BASE_PAYLOAD);

    expect(window.open).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("on an edge-function error, shows a failure toast and never throws", async () => {
    functionsInvokeMock.mockResolvedValue({ data: null, error: { message: "Invoice not found or not accessible." } });

    await expect(openInvoicePdf(BASE_PAYLOAD)).resolves.toBeUndefined();
    expect(toast.error).toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });

  it("on an unexpected non-blob response, fails gracefully rather than opening garbage", async () => {
    functionsInvokeMock.mockResolvedValue({ data: { error: "unexpected shape" }, error: null });

    await expect(openInvoicePdf(BASE_PAYLOAD)).resolves.toBeUndefined();
    expect(toast.error).toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });
});
