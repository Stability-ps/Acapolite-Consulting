import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assessIdentity,
  companyTokens,
  contactLinks,
  extractContacts,
  hostOf,
  isNonOfficialHost,
  normalizeSaPhone,
  normalizeWebsite,
  robotsAllows,
} from "./prospectEnrichment.ts";

Deno.test("normalizeWebsite adds https and rejects non-web values", () => {
  assertEquals(normalizeWebsite("acapoliteconsulting.co.za"), "https://acapoliteconsulting.co.za/");
  assertEquals(normalizeWebsite("javascript:alert(1)"), null);
  assertEquals(normalizeWebsite("localhost"), null);
  assertEquals(normalizeWebsite(""), null);
  assertEquals(hostOf("https://www.Example.co.za/contact"), "example.co.za");
});

Deno.test("directories, social media and government hosts are never official websites", () => {
  assert(isNonOfficialHost("www.facebook.com".replace(/^www\./, "")));
  assert(isNonOfficialHost("etenders.gov.za"));
  assert(isNonOfficialHost("justice.gov.za"));
  assert(isNonOfficialHost(null));
  assert(!isNonOfficialHost("mahika.co.za"));
});

Deno.test("company tokens strip legal suffixes and generic words", () => {
  const t = companyTokens("Mahika Technologies (Pty) Ltd");
  assertEquals(t.distinctive, ["mahika"]);
  assertEquals(companyTokens("General Construction Services CC").distinctive, []);
});

Deno.test("identity: domain containing a distinctive token is a match", () => {
  const r = assessIdentity("Mahika Technologies", "<title>Home</title>", "https://www.mahika.co.za/");
  assertEquals(r.verdict, "match");
});

Deno.test("identity: wrong-company search result is a mismatch", () => {
  const html = "<title>Bright Plumbing Johannesburg</title><h1>Bright Plumbing</h1><p>We fix pipes.</p>";
  const r = assessIdentity("Mahika Technologies", html, "https://brightplumbing.co.za/");
  assertEquals(r.verdict, "mismatch");
});

Deno.test("identity: name in page title is a match even on an unrelated domain", () => {
  const html = "<title>Metrohm SA | Laboratory instruments</title>";
  assertEquals(assessIdentity("METROHM SA", html, "https://www.metrohm.com/en_za/").verdict, "match");
  assertEquals(assessIdentity("Nkosi Metrohm Builders", html, "https://lab.example.org/").verdict, "weak");
});

Deno.test("identity: generic-only names are never auto-accepted", () => {
  const html = "<title>General Construction Services</title>";
  assertEquals(assessIdentity("General Construction Services", html, "https://gcs.co.za").verdict, "weak");
  assertEquals(assessIdentity("General Construction Services", "<title>Other</title>", "https://gcs.co.za").verdict, "mismatch");
});

Deno.test("phones normalise to +27 E.164 and reject invalid numbers", () => {
  assertEquals(normalizeSaPhone("011 644 4000"), "+27116444000");
  assertEquals(normalizeSaPhone("+27 (0)10 288 6912"), "+27102886912");
  assertEquals(normalizeSaPhone("060-409-6943"), "+27604096943");
  assertEquals(normalizeSaPhone("0027 82 123 4567"), "+27821234567");
  assertEquals(normalizeSaPhone("12345"), null);
  assertEquals(normalizeSaPhone("0912345678"), null);
});

Deno.test("extractContacts prefers same-domain email and tel: links", () => {
  const html = `
    <a href="mailto:designer@webagency.co.za">Site by WebAgency</a>
    <a href="mailto:info@mahika.co.za">info@mahika.co.za</a>
    <img src="logo@2x.png">
    <a href="tel:+27116444000">Call</a> or 082 999 0000`;
  const c = extractContacts(html, "https://www.mahika.co.za/");
  assertEquals(c.email, "info@mahika.co.za");
  assertEquals(c.emailConfidence, "high");
  assertEquals(c.phone, "+27116444000");
  assert(c.phoneFromTelLink);
});

Deno.test("extractContacts rejects third-party, asset and no-reply emails", () => {
  const html = `designer@webagency.co.za noreply@mahika.co.za hero@2x.png sprite@3x.webp`;
  const c = extractContacts(html, "https://mahika.co.za");
  assertEquals(c.email, null);
});

Deno.test("extractContacts accepts a published free-mail address with medium confidence", () => {
  const c = extractContacts("Email us: mahikatech@gmail.com", "https://mahika.co.za");
  assertEquals(c.email, "mahikatech@gmail.com");
  assertEquals(c.emailConfidence, "medium");
});

Deno.test("extractContacts decodes obfuscated @ and ignores numbers inside scripts", () => {
  const html = `<script>var id=0116444000123;</script><p>sales&#64;mahika.co.za</p><p>(011) 644-4000</p>`;
  const c = extractContacts(html, "https://mahika.co.za");
  assertEquals(c.email, "sales@mahika.co.za");
  assertEquals(c.phone, "+27116444000");
});

Deno.test("contactLinks returns same-host contact/about pages only", () => {
  const html = `<a href="/contact-us">Contact</a><a href="https://other.com/contact">x</a><a href="/about#team">About</a><a href="/services">s</a>`;
  assertEquals(contactLinks(html, "https://mahika.co.za/"), ["https://mahika.co.za/contact-us", "https://mahika.co.za/about"]);
});

Deno.test("robotsAllows respects wildcard disallow rules", () => {
  const robots = "User-agent: *\nDisallow: /private\nAllow: /private/contact\n\nUser-agent: BadBot\nDisallow: /";
  assert(robotsAllows(robots, "/"));
  assert(!robotsAllows(robots, "/private/data"));
  assert(robotsAllows(robots, "/private/contact"));
  assert(!robotsAllows("User-agent: *\nDisallow: /", "/contact"));
  assert(robotsAllows(null, "/anything"));
});
