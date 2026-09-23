import { describe, expect, it } from "vitest";
import { getRequestSource, getServiceIntent } from "@/lib/requestWizard";

describe("request wizard service intent", () => {
  it("recognises supported service-page intents", () => {
    expect(getServiceIntent("sars-debt")?.label).toBe("SARS Debt Help");
    expect(getServiceIntent("payment-arrangement")?.label).toBe("SARS Payment Arrangement");
    expect(getServiceIntent("compromise")?.label).toBe("Section 200 Compromise");
    expect(getServiceIntent("objections")?.label).toBe("SARS Objection or Dispute");
    expect(getServiceIntent("vat")?.label).toBe("VAT Services");
    expect(getServiceIntent("accounting")?.label).toBe("Accounting Services");
  });

  it("routes intent to an appropriate category for the selected entity", () => {
    expect(getServiceIntent("sars-debt")?.categoryForEntity("individual")).toBe("individual_tax");
    expect(getServiceIntent("sars-debt")?.categoryForEntity("company")).toBe("business_tax");
    expect(getServiceIntent("sars-debt")?.categoryForEntity("trust")).toBe("trust_services");
    expect(getServiceIntent("vat")?.categoryForEntity("company")).toBe("business_tax");
    expect(getServiceIntent("bookkeeping")?.categoryForEntity("company")).toBe("accounting");
    expect(getServiceIntent("cipc")?.categoryForEntity("company")).toBe("business_support");
  });

  it("ignores unknown or missing intent values", () => {
    expect(getServiceIntent("unknown")).toBeNull();
    expect(getServiceIntent(null)).toBeNull();
  });
  it("accepts only allow-listed internal request source paths", () => {
    expect(getRequestSource("/vat-services")).toEqual({ path: "/vat-services", label: "VAT Services" });
    expect(getRequestSource("%2Fsars-debt")).toEqual({ path: "/sars-debt", label: "SARS Debt" });
    expect(getRequestSource("https://example.com")).toBeNull();
    expect(getRequestSource("//example.com")).toBeNull();
    expect(getRequestSource("/dashboard/staff")).toBeNull();
    expect(getRequestSource("/unknown-page")).toBeNull();
  });
});
