import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isValidServiceNeeded, normalizeServiceNeeded, SERVICE_NEEDED_VALUES } from "./serviceNormalization.ts";

Deno.test("SERVICE_NEEDED_VALUES has no duplicates and matches the known production enum size", () => {
  assertEquals(new Set(SERVICE_NEEDED_VALUES).size, SERVICE_NEEDED_VALUES.length);
  assertEquals(SERVICE_NEEDED_VALUES.length, 75);
});

Deno.test("isValidServiceNeeded accepts only real enum members", () => {
  assert(isValidServiceNeeded("other"));
  assert(isValidServiceNeeded("business_sars_debt_arrangements"));
  assert(!isValidServiceNeeded("SARS registration"));
  assert(!isValidServiceNeeded(""));
  assert(!isValidServiceNeeded(null));
  assert(!isValidServiceNeeded(undefined));
  assert(!isValidServiceNeeded(42));
});

Deno.test("'SARS registration' (individual, from the production bug report) maps to a valid registration value", () => {
  const result = normalizeServiceNeeded("SARS registration", { clientType: "individual" });
  assertEquals(result.value, "individual_tax_number_registration");
  assertEquals(result.matched, true);
  assertEquals(result.method, "keyword");
  assert(isValidServiceNeeded(result.value));
});

Deno.test("'register my company for tax' maps to a company income tax value", () => {
  const result = normalizeServiceNeeded("register my company for tax", { clientType: "company" });
  assertEquals(result.value, "business_company_income_tax");
  assert(isValidServiceNeeded(result.value));
});

Deno.test("'register my company for tax' detects company-ness from the wording itself, without explicit context", () => {
  const result = normalizeServiceNeeded("register my company for tax");
  assertEquals(result.value, "business_company_income_tax");
});

Deno.test("'I owe SARS R25m' maps to individual SARS debt assistance", () => {
  const result = normalizeServiceNeeded("I owe SARS R25m", { clientType: "individual" });
  assertEquals(result.value, "individual_sars_debt_assistance");
  assert(isValidServiceNeeded(result.value));
});

Deno.test("'I owe SARS R25m' for a company maps to business debt arrangements", () => {
  const result = normalizeServiceNeeded("I owe SARS R25m", { clientType: "company" });
  assertEquals(result.value, "business_sars_debt_arrangements");
});

Deno.test("'need payment arrangement' maps to a debt-assistance value", () => {
  const individual = normalizeServiceNeeded("need payment arrangement", { clientType: "individual" });
  assertEquals(individual.value, "individual_sars_debt_assistance");
  const company = normalizeServiceNeeded("need payment arrangement", { clientType: "company" });
  assertEquals(company.value, "business_sars_debt_arrangements");
});

Deno.test("'VAT registration' maps to business_vat_registration", () => {
  const result = normalizeServiceNeeded("VAT registration");
  assertEquals(result.value, "business_vat_registration");
  assertEquals(result.matched, true);
});

Deno.test("'EMP501 issue' maps to business_paye_compliance", () => {
  const result = normalizeServiceNeeded("EMP501 issue");
  assertEquals(result.value, "business_paye_compliance");
});

Deno.test("'tax clearance' maps to a clearance-certificate value per client type", () => {
  assertEquals(normalizeServiceNeeded("tax clearance", { clientType: "individual" }).value, "individual_tax_clearance_certificates");
  assertEquals(normalizeServiceNeeded("tax clearance", { clientType: "company" }).value, "business_tax_clearance_certificates");
  assertEquals(normalizeServiceNeeded("tax clearance", { clientType: "trust" }).value, "trust_tax_clearance");
});

Deno.test("\"can't access eFiling\" has no dedicated enum value and falls back to the category catch-all, never failing", () => {
  const noContext = normalizeServiceNeeded("can't access eFiling");
  assert(isValidServiceNeeded(noContext.value));
  assertEquals(noContext.value, "other");

  const individual = normalizeServiceNeeded("can't access eFiling", { clientType: "individual" });
  assertEquals(individual.value, "individual_other");

  const company = normalizeServiceNeeded("can't access eFiling", { clientType: "company" });
  assertEquals(company.value, "business_tax_other");
});

Deno.test("completely unknown future wording never fails, falls back and reports matched=false", () => {
  const result = normalizeServiceNeeded("zzqx flibbertigibbet blorp 9000", { clientType: "individual" });
  assert(isValidServiceNeeded(result.value));
  assertEquals(result.matched, false);
  assertEquals(result.method, "fallback");
  assertEquals(result.value, "individual_other");
});

Deno.test("weird casing and punctuation still resolve to the same canonical value", () => {
  const clean = normalizeServiceNeeded("SARS registration", { clientType: "individual" });
  const messy = normalizeServiceNeeded("   SaRs   REGISTRATION!!!  ,,, ", { clientType: "individual" });
  assertEquals(messy.value, clean.value);
  assertEquals(messy.value, "individual_tax_number_registration");
});

Deno.test("previously-working debt/payment-arrangement flow: an already-valid enum value passes through unchanged (exact match)", () => {
  const result = normalizeServiceNeeded("business_sars_debt_arrangements", { clientType: "company" });
  assertEquals(result.value, "business_sars_debt_arrangements");
  assertEquals(result.matched, true);
  assertEquals(result.method, "exact");
});

Deno.test("an already-valid enum value with incidental surrounding whitespace still passes through as exact", () => {
  const result = normalizeServiceNeeded("  individual_sars_debt_assistance  ");
  assertEquals(result.value, "individual_sars_debt_assistance");
  assertEquals(result.method, "exact");
});

Deno.test("null/undefined/empty wording never fails and falls back to the category catch-all", () => {
  assertEquals(normalizeServiceNeeded(null).value, "other");
  assertEquals(normalizeServiceNeeded(undefined).value, "other");
  assertEquals(normalizeServiceNeeded("").value, "other");
  assertEquals(normalizeServiceNeeded("   ").value, "other");
  assertEquals(normalizeServiceNeeded(null, { clientType: "trust" }).value, "trust_other");
  assertEquals(normalizeServiceNeeded(null, { clientType: "npo_organisation" }).value, "npo_organisation_other");
});

Deno.test("REGRESSION: no arbitrary service string can ever produce an invalid enum value", () => {
  const wildInputs = [
    "SARS registration",
    "sars regsitration", // misspelled
    "Registration for SARS please!!",
    "I need to register for income tax ASAP",
    "vat returns overdue",
    "VAT",
    "paye",
    "PAYE registration",
    "emp201 correction",
    "itr12 outstanding",
    "ITR14 for my company",
    "objection to assessment",
    "dispute with SARS",
    "ADR process",
    "tax compliance status",
    "compliance status pin",
    "tax clearance certificate",
    "can I get a TCC",
    "profile merge needed",
    "update banking details",
    "statement of account request",
    "administrative penalty",
    "penalties for late submission",
    "SARS audit notice",
    "verification of my return",
    "refund not received",
    "deregister my VAT number",
    "deregistration of company",
    "company tax matters",
    "individual tax matters",
    "bookkeeping help",
    "financial statements needed",
    "trust tax return",
    "npo tax exemption",
    "voluntary disclosure programme",
    "tax directive request",
    "deceased estate tax",
    "'; DROP TABLE service_requests; --",
    "<script>alert(1)</script>",
    "日本語のテキスト",
    "emoji request 🚀🔥💸",
    "a".repeat(5000),
    "\n\t\r  ",
    "NULL",
    "undefined",
    "12345",
    "😀",
    "SARS SARS SARS SARS debt debt debt",
    "completely made up future service nobody has said yet",
  ];

  for (const input of wildInputs) {
    for (const clientType of [null, "individual", "company", "trust", "npo_organisation"] as const) {
      const result = normalizeServiceNeeded(input, { clientType });
      assert(
        isValidServiceNeeded(result.value),
        `normalizeServiceNeeded(${JSON.stringify(input)}, clientType=${clientType}) produced an invalid value: ${result.value}`,
      );
    }
  }
});

Deno.test("REGRESSION: fully random strings (fuzz) always resolve to a valid enum value", () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !@#$%^&*()_+-=[]{}|;':\",./<>?";
  let seed = 42;
  const rand = () => {
    // Deterministic PRNG (no Math.random dependency) so this test is reproducible.
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 200; i++) {
    const length = Math.floor(rand() * 60);
    let s = "";
    for (let j = 0; j < length; j++) s += chars[Math.floor(rand() * chars.length)];
    const result = normalizeServiceNeeded(s, { clientType: null });
    assert(isValidServiceNeeded(result.value), `fuzz input ${JSON.stringify(s)} produced invalid value ${result.value}`);
  }
});
