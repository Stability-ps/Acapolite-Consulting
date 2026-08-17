import { describe, expect, it } from "vitest";
import { canUseTaxCoach } from "../../supabase/functions/_shared/taxCoachAccess";

describe("Tax Coach API authorization", () => {
  it("allows admins even without a permission row", () => {
    expect(canUseTaxCoach("admin", undefined)).toBe(true);
  });

  it("allows only opted-in practitioners", () => {
    expect(canUseTaxCoach("consultant", true)).toBe(true);
    expect(canUseTaxCoach("consultant", false)).toBe(false);
  });

  it("denies clients and unauthenticated callers", () => {
    expect(canUseTaxCoach("client", true)).toBe(false);
    expect(canUseTaxCoach(null, true)).toBe(false);
  });
});
