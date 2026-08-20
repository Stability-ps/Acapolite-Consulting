import { describe, expect, it } from "vitest";
import { getWhatsAppLeadGate, getWhatsAppLeadQuality } from "./whatsappLeadQuality";

describe("WhatsApp lead quality gate", () => {
  it("sends complete WhatsApp leads to admin review first", () => {
    const quality = getWhatsAppLeadQuality({
      waId: "27645170301",
      intakePayload: {
        full_name: "Patric Sibande",
        email: "patric@example.com",
        province: "Gauteng",
        service_needed: "business_sars_debt_arrangements",
        description: "SARS debt arrangement needed for a company with active collections.",
        urgency: "urgent",
        client_type: "company",
        company_name: "Acapolite Test",
      },
    });

    expect(quality.status).toBe("ready");
    expect(getWhatsAppLeadGate(quality)).toMatchObject({
      serviceRequestStatus: "pending_client_confirmation",
      lifecycleStage: "pending_client_confirmation",
      marketplaceVisible: false,
      actionLabel: "Send request",
    });
  });

  it("holds usable but incomplete WhatsApp leads for missing info", () => {
    const quality = getWhatsAppLeadQuality({
      waId: "27645170301",
      displayName: "Patric",
      aiSummary: "Company has SARS debt and needs urgent help.",
      intakePayload: {
        service_needed: "business_sars_debt_arrangements",
        description: "SARS debt arrangement needed after bank levy.",
        urgency: "urgent",
      },
      missingFields: ["full_name", "province", "email"],
    });

    expect(quality.status).toBe("needs_info");
    expect(getWhatsAppLeadGate(quality)).toMatchObject({
      serviceRequestStatus: "pending_client_confirmation",
      lifecycleStage: "pending_client_confirmation",
      marketplaceVisible: false,
    });
  });

  it("parks weak chats away from the marketplace", () => {
    const quality = getWhatsAppLeadQuality({
      waId: "27645170301",
      intakePayload: {
        description: "Hi",
      },
    });

    expect(quality.status).toBe("weak");
    expect(getWhatsAppLeadGate(quality)).toMatchObject({
      serviceRequestStatus: "dead_lead",
      lifecycleStage: "expired",
      marketplaceVisible: false,
    });
  });
});
