import { describe, expect, it } from "vitest";
import {
  applyProspectFilters,
  buildProspectExportRows,
  guessProspectMapping,
  mapImportRows,
  sanitizeImportedText,
  sanitizeSearchTerm,
  skipReasonLabel,
  stageLabel,
  whatsappLink,
  type ProspectListRow,
} from "./prospectHub";
import { renderTemplate, unknownVariables } from "./prospectTemplates";

function recorder() {
  const calls: Array<[string, ...unknown[]]> = [];
  const handler: ProxyHandler<object> = {
    get: (_t, prop: string) => (...args: unknown[]) => { calls.push([prop, ...args]); return proxy; },
  };
  const proxy = new Proxy({}, handler);
  return { proxy, calls };
}

describe("applyProspectFilters", () => {
  it("builds server-side filters for search, stage, location, contact and score", () => {
    const { proxy, calls } = recorder();
    applyProspectFilters(proxy, { search: "Mahika", stage: "new", province: "Gauteng", sector: "IT", minScore: 70, hasEmail: true, doNotContact: "exclude", contacted: "not_contacted", procurement: true });
    expect(calls).toContainEqual(["or", "company_name.ilike.*Mahika*,registration_number.ilike.*Mahika*,email.ilike.*Mahika*,phone.ilike.*Mahika*,city.ilike.*Mahika*,sector.ilike.*Mahika*"]);
    expect(calls).toContainEqual(["eq", "status", "new"]);
    expect(calls).toContainEqual(["eq", "province", "Gauteng"]);
    expect(calls).toContainEqual(["gte", "score", 70]);
    expect(calls).toContainEqual(["not", "email", "is", null]);
    expect(calls).toContainEqual(["eq", "do_not_contact", false]);
    expect(calls).toContainEqual(["is", "last_contacted_at", null]);
    expect(calls).toContainEqual(["gt", "procurement_record_count", 0]);
  });

  it("ignores 'all' selections and restricts leads to lead stages", () => {
    const { proxy, calls } = recorder();
    applyProspectFilters(proxy, { stage: "all", province: "all", leadsOnly: true });
    expect(calls).toEqual([["in", "status", ["qualified", "consultation"]]]);
  });
});

describe("sanitizeSearchTerm", () => {
  it("strips characters that could break out of a PostgREST or() filter", () => {
    expect(sanitizeSearchTerm("abc),id.eq.1,(x")).toBe("abc id.eq.1 x");
    expect(sanitizeSearchTerm("  a%*b  ")).toBe("a b");
  });
});

describe("prospect import", () => {
  it("guesses column mapping from common headers", () => {
    expect(guessProspectMapping(["Company Name", "E-mail", "Tel", "Province"])).toEqual({ company_name: "Company Name", email: "E-mail", phone: "Tel", province: "Province" });
  });

  it("validates rows and removes spreadsheet formula prefixes", () => {
    const rows = mapImportRows(
      [
        { Company: "=HYPERLINK(\"http://evil\")", Email: "ok@example.co.za" },
        { Company: "", Email: "x" },
        { Company: "Good Co", Email: "not-an-email", Province: "Atlantis" },
      ],
      { company_name: "Company", email: "Email", province: "Province" },
    );
    expect(rows[0].row.company_name).toBe("HYPERLINK(\"http://evil\")");
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toContain("Company name is required");
    expect(rows[2].errors).toEqual(expect.arrayContaining(["Invalid email", 'Unknown province "Atlantis"']));
    expect(rows[2].rowNumber).toBe(4);
    expect(sanitizeImportedText("+cmd|' /C calc'!A0")).toBe("cmd|' /C calc'!A0");
  });
});

describe("prospect export", () => {
  it("neutralises formula injection and labels stages", () => {
    const row = { company_name: "=1+1", status: "qualified", score: 80, do_not_contact: false, email: "@evil" } as unknown as ProspectListRow;
    const [out] = buildProspectExportRows([row]);
    expect(out["Company"]).toBe("'=1+1");
    expect(out["Public Email"]).toBe("'@evil");
    expect(out["Stage"]).toBe("Qualified lead");
    expect(out["Fit Score"]).toBe(80);
    expect(out["Do Not Contact"]).toBe("No");
  });
});

describe("labels and links", () => {
  it("formats stage and skip reasons for humans", () => {
    expect(stageLabel("converted")).toBe("Client");
    expect(skipReasonLabel("recently_contacted")).toBe("Contacted recently");
    expect(skipReasonLabel("missing_template_variable:contact_name")).toBe("Missing template value (contact_name)");
  });
  it("only builds WhatsApp links for valid SA numbers", () => {
    expect(whatsappLink("+27821234567")).toBe("https://wa.me/27821234567");
    expect(whatsappLink("12345")).toBeNull();
  });
});

describe("campaign template rendering (shared with the edge worker)", () => {
  it("never invents a contact name", () => {
    expect(renderTemplate("Dear {{contact_name}}", { company_name: "X" }).missing).toEqual(["contact_name"]);
    expect(renderTemplate("Dear {{contact_name|Sir/Madam}}", {}).text).toBe("Dear Sir/Madam");
    expect(unknownVariables("{{sars_status}}")).toEqual(["sars_status"]);
  });
});
