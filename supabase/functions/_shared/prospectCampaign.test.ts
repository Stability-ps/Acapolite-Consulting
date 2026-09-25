import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCampaignEmail, isRetryableStatus, renderTemplate, templateVariables, unknownVariables } from "./prospectCampaign.ts";

Deno.test("renderTemplate fills only known values", () => {
  const r = renderTemplate("Dear {{contact_name|Sir/Madam}}, {{company_name}} in {{ city }}", { company_name: "Mahika Technologies", city: "Pretoria" });
  assertEquals(r.text, "Dear Sir/Madam, Mahika Technologies in Pretoria");
  assertEquals(r.missing, []);
});

Deno.test("renderTemplate never invents a contact name - missing value without fallback is reported", () => {
  const r = renderTemplate("Dear {{contact_name}},", { company_name: "X" });
  assertEquals(r.text, "Dear ,");
  assertEquals(r.missing, ["contact_name"]);
});

Deno.test("renderTemplate treats blank values as missing", () => {
  assertEquals(renderTemplate("{{sector|your sector}}", { sector: "   " }).text, "your sector");
});

Deno.test("unknownVariables rejects unsupported placeholders", () => {
  assertEquals(unknownVariables("{{company_name}} {{sars_status}} {{tax_debt}}"), ["sars_status", "tax_debt"]);
  assertEquals(templateVariables("{{contact_name|Good day}}"), [{ name: "contact_name", fallback: "Good day" }]);
});

Deno.test("buildCampaignEmail includes unsubscribe link, footer and escapes HTML", () => {
  const e = buildCampaignEmail({ body: "Hello <b>there</b>\n\nSecond para", footer: "Acapolite Consulting", unsubscribeUrl: "https://acapoliteconsulting.co.za/unsubscribe?token=abc" });
  assert(e.text.includes("https://acapoliteconsulting.co.za/unsubscribe?token=abc"));
  assert(e.html.includes("&lt;b&gt;there&lt;/b&gt;"));
  assert(e.html.includes("Unsubscribe</a>"));
  assert(e.html.includes("Acapolite Consulting"));
});

Deno.test("only 429/5xx provider responses are retryable", () => {
  assert(isRetryableStatus(429));
  assert(isRetryableStatus(503));
  assert(!isRetryableStatus(400));
  assert(!isRetryableStatus(401));
});
