import { describe, expect, it } from "vitest";
import { TAX_COACH_INSTRUCTIONS } from "../../supabase/functions/_shared/taxCoachPrompt";

describe("Tax Coach scope", () => {
  it("includes Acapolite's complete professional service scope", () => {
    expect(TAX_COACH_INSTRUCTIONS).toContain("Tax, Accounting, SARS & Business Support Across South Africa");
    expect(TAX_COACH_INSTRUCTIONS).toContain("bookkeeping");
    expect(TAX_COACH_INSTRUCTIONS).toContain("CIPC");
    expect(TAX_COACH_INSTRUCTIONS).toContain("business structures");
    expect(TAX_COACH_INSTRUCTIONS).toContain("company compliance");
  });

  it("requires a strict refusal outside the business scope", () => {
    expect(TAX_COACH_INSTRUCTIONS).toContain("If a request falls outside this scope, do not answer it");
    expect(TAX_COACH_INSTRUCTIONS).toContain("I can only assist with South African tax, accounting, SARS, CIPC");
  });
});
