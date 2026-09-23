import { describe, expect, it } from "vitest";
import { getClientEmail, getClientPhone, type StaffClient } from "./AdminClients";

function baseClient(overrides: Partial<StaffClient> = {}): StaffClient {
  return {
    archive_notes: null,
    archive_reason: null,
    archived_at: null,
    archived_by: null,
    id: "client-1",
    profile_id: null,
    created_by: null,
    client_type: "individual",
    company_registration_number: null,
    first_name: "Jane",
    last_name: "Doe",
    company_name: null,
    email: null,
    phone: null,
    tax_number: null,
    sars_reference_number: null,
    id_number: null,
    vat_number: null,
    sars_outstanding_debt: 0,
    returns_filed: true,
    client_code: null,
    address_line_1: null,
    address_line_2: null,
    city: null,
    province: null,
    postal_code: null,
    country: null,
    is_archived: false,
    notes: null,
    created_at: new Date().toISOString(),
    profiles: null,
    assigned_consultant: null,
    created_by_profile: null,
    ...overrides,
  };
}

describe("getClientPhone / getClientEmail: clients.* is the canonical business contact field", () => {
  it("a no-portal client (no profiles row) reads from clients.phone/email", () => {
    const client = baseClient({ profile_id: null, phone: "0821234567", email: "jane@example.test", profiles: null });
    expect(getClientPhone(client)).toBe("0821234567");
    expect(getClientEmail(client)).toBe("jane@example.test");
  });

  it("prefers clients.phone/email over the linked portal account's profiles.phone/email", () => {
    const client = baseClient({
      profile_id: "profile-1",
      phone: "0821234567",
      email: "jane.business@example.test",
      profiles: { full_name: "Jane Doe", email: "jane.portal-login@example.test", phone: "0000000000" },
    });
    expect(getClientPhone(client)).toBe("0821234567");
    expect(getClientEmail(client)).toBe("jane.business@example.test");
  });

  it("falls back to profiles.phone/email for older records where clients.phone/email was never backfilled", () => {
    const client = baseClient({
      profile_id: "profile-1",
      phone: null,
      email: null,
      profiles: { full_name: "Jane Doe", email: "jane@legacy.test", phone: "0827654321" },
    });
    expect(getClientPhone(client)).toBe("0827654321");
    expect(getClientEmail(client)).toBe("jane@legacy.test");
  });

  it("returns null when neither source has a value", () => {
    const client = baseClient({ phone: null, email: null, profiles: null });
    expect(getClientPhone(client)).toBeNull();
    expect(getClientEmail(client)).toBeNull();
  });
});
