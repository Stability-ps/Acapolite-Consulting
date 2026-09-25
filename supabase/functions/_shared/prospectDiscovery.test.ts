import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { addDays, awardedSuppliers, classifySector, cleanSupplierName, dayWindows, normalizeProvince } from "./prospectDiscovery.ts";

// Shape taken from a real eTenders OCDS release (2026-06-02).
const awardedRelease = {
  ocid: "ocds-9t57fa-161207",
  date: "2026-06-02T00:00:00Z",
  tender: {
    title: "POU00003VR",
    status: "active",
    category: "Supplies: Computer Equipment",
    province: "Gauteng",
    description: "MC Pretoria - Toners and Drums",
    procuringEntity: { id: "1", name: "Department of Justice" },
  },
  buyer: { id: "1", name: "Department of Justice and Constitutional Development" },
  parties: [{
    name: "MAHIKA TECHNOLOGIES",
    id: "72140",
    // NB: this is the *buyer's* contact person, not the supplier's.
    contactPoint: { name: "Tshegofatso", telephone: "060-409-6943", email: "WiNkosi@justice.gov.za", url: "https://justice.gov.za" },
    roles: ["supplier"],
  }],
  awards: [{ id: "72140", title: "MAHIKA TECHNOLOGIES", status: "active", description: "EME", value: { amount: 21796778.0, currency: "ZAR" }, suppliers: [{ id: "478679", name: "MAHIKA TECHNOLOGIES" }] }],
};

Deno.test("awardedSuppliers extracts the awarded supplier with evidence", () => {
  const [s, ...rest] = awardedSuppliers(awardedRelease);
  assertEquals(rest.length, 0);
  assertEquals(s.companyName, "MAHIKA TECHNOLOGIES");
  assertEquals(s.supplierId, "478679");
  assertEquals(s.supplierSize, "EME");
  assertEquals(s.sector, "IT");
  assertEquals(s.province, "Gauteng");
  assertEquals(s.awardValue, 21796778);
  assertEquals(s.buyerName, "Department of Justice and Constitutional Development");
  assertEquals(s.sourceRecordId, "ocds-9t57fa-161207:478679");
  assertEquals(s.sourceUrl, "https://ocds-api.etenders.gov.za/api/OCDSReleases/release/ocds-9t57fa-161207");
});

Deno.test("awardedSuppliers never exposes the buyer contactPoint as supplier contact", () => {
  const s = awardedSuppliers(awardedRelease)[0] as unknown as Record<string, unknown>;
  const serialized = JSON.stringify(s);
  assertEquals(serialized.includes("justice.gov.za\""), false);
  assertEquals(serialized.includes("060-409-6943"), false);
  assertEquals("email" in s || "phone" in s || "website" in s, false);
});

Deno.test("awardedSuppliers ignores cancelled tenders, tenders without awards and malformed releases", () => {
  assertEquals(awardedSuppliers({ ...awardedRelease, tender: { ...awardedRelease.tender, status: "cancelled" } }).length, 0);
  assertEquals(awardedSuppliers({ ...awardedRelease, awards: [] }).length, 0);
  assertEquals(awardedSuppliers({ tender: {} }).length, 0);
  assertEquals(awardedSuppliers(null).length, 0);
  assertEquals(awardedSuppliers({ ...awardedRelease, awards: [{ suppliers: [{ id: "1", name: "  " }] }] }).length, 0);
});

Deno.test("awardedSuppliers de-duplicates a supplier listed twice in one release", () => {
  const release = { ...awardedRelease, awards: [awardedRelease.awards[0], awardedRelease.awards[0]] };
  assertEquals(awardedSuppliers(release).length, 1);
});

Deno.test("cleanSupplierName strips appended CSD numbers", () => {
  assertEquals(cleanSupplierName("AGRIMARK OPERATIONS and MAAA1234716"), { name: "AGRIMARK OPERATIONS", csdNumber: "MAAA1234716" });
  assertEquals(cleanSupplierName("RUKHO SECURITY SERVICES"), { name: "RUKHO SECURITY SERVICES", csdNumber: null });
});

Deno.test("classifySector maps eTenders categories and generic-category keywords", () => {
  assertEquals(classifySector("Security and investigation activities", null, null), "Security");
  assertEquals(classifySector("Construction of buildings", "T17", "CONSTRUCTION OF 206 HOUSES"), "Construction");
  assertEquals(classifySector("Specialised construction activities", null, "Day to day maintenance"), "Construction");
  assertEquals(classifySector("Services: Functional (Including Cleaning and Security Services)", null, "Security, patrol, and access control services"), "Security");
  assertEquals(classifySector("Services: General", null, "PROVISION OF ABLUTION CLEANING AND HYGIENE"), "Cleaning");
  assertEquals(classifySector("Food and beverage service activities", null, "Panel of caterers"), "Catering");
  assertEquals(classifySector("Computer programming, consultancy and related activities", null, "SAP Business One System"), "IT");
  assertEquals(classifySector("Repair and installation of machinery and equipment", null, "Pyrolyzer repairs"), "Maintenance");
  assertEquals(classifySector("Services: Professional", null, "Provision of Job Grading Exercise"), null);
});

Deno.test("normalizeProvince accepts only real provinces", () => {
  assertEquals(normalizeProvince("KwaZulu-Natal"), "KwaZulu-Natal");
  assertEquals(normalizeProvince("kwazulu natal"), "KwaZulu-Natal");
  assertEquals(normalizeProvince("National"), null);
});

Deno.test("dayWindows walks forward one day at a time and stops before today", () => {
  assertEquals(dayWindows("2026-09-23", "2026-09-26", 5), [
    { from: "2026-09-23", to: "2026-09-24" },
    { from: "2026-09-24", to: "2026-09-25" },
    { from: "2026-09-25", to: "2026-09-26" },
  ]);
  assertEquals(dayWindows("2026-09-26", "2026-09-26", 3), []);
  assertEquals(addDays("2026-09-30", 1), "2026-10-01");
});
