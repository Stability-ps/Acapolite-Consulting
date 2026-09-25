// Pure helpers for public-website contact enrichment. No network or database
// access lives here so the rules can be unit-tested in isolation.
//
// Ground rules encoded below:
//  - only contact details literally present on the company's own public
//    pages are extracted; nothing is inferred or generated;
//  - an email on a different domain (e.g. the web designer's) is rejected;
//  - a website is accepted only when the company's distinctive name tokens
//    appear in the domain or page identity (title / og:site_name / h1).

export type IdentityVerdict = "match" | "weak" | "mismatch";

export type ExtractedContacts = {
  email: string | null;
  emailConfidence: "high" | "medium" | null;
  phone: string | null;
  phoneFromTelLink: boolean;
};

// Hosts that are directories, marketplaces, social media, tender portals or
// government sites. They are never accepted as a company's official website.
export const NON_OFFICIAL_HOSTS = [
  "facebook.com", "linkedin.com", "instagram.com", "twitter.com", "x.com", "youtube.com", "tiktok.com",
  "yellowpages.co.za", "yep.co.za", "brabys.com", "cylex.co.za", "snupit.co.za", "bizcommunity.com",
  "sayellow.com", "localpages.co.za", "hotfrog.co.za", "infobel.com", "opencorporates.com", "b2bhint.com",
  "bizportal.gov.za", "cipc.co.za", "etenders.gov.za", "gov.za", "google.com", "maps.google.com",
  "wikipedia.org", "zaubacorp.com", "dnb.com", "zoominfo.com", "crunchbase.com", "glassdoor.com",
  "indeed.com", "pnet.co.za", "careers24.com", "gumtree.co.za", "junkmail.co.za", "wixsite.com",
];

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "yahoo.co.za", "outlook.com", "hotmail.com", "live.com", "icloud.com",
  "mweb.co.za", "telkomsa.net", "vodamail.co.za", "webmail.co.za", "iafrica.com", "absamail.co.za", "lantic.net",
]);

const EMAIL_NOISE = /(example\.|sentry|wixpress|wordpress|cloudflare|schema\.org|domain\.com|email\.com|yourdomain|godaddy|@2x|@3x)/i;
const ASSET_SUFFIX = /\.(png|jpe?g|gif|webp|svg|bmp|ico|css|js|woff2?|ttf|mp4|pdf)$/i;
const NOREPLY = /^(no-?reply|donotreply|do-not-reply|mailer-daemon|postmaster|webmaster|abuse|privacy|popia)@/i;

const LEGAL_WORDS = new Set([
  "pty", "ltd", "limited", "proprietary", "cc", "inc", "incorporated", "npc", "soc", "rf", "co", "company",
  "the", "and", "of", "t", "a", "sa", "za", "south", "africa", "african",
]);

// Words that appear in many unrelated business names. They can support a
// match but cannot establish one on their own.
const GENERIC_WORDS = new Set([
  "construction", "constructions", "services", "service", "solutions", "trading", "enterprise", "enterprises",
  "projects", "project", "group", "holdings", "investments", "investment", "consulting", "consultants",
  "general", "civil", "engineering", "engineers", "security", "cleaning", "transport", "logistics",
  "maintenance", "catering", "technologies", "technology", "tech", "it", "systems", "supplies", "supply",
  "suppliers", "management", "development", "developments", "business", "global", "international",
  "national", "africa", "mzansi", "royal", "new", "best", "star", "stars", "one", "plus", "pro", "works",
  "building", "builders", "electrical", "plumbing", "cleaners", "protection", "security", "facilities",
  "resources", "industries", "industrial", "agency", "agencies", "network", "networks", "media", "energy",
  "properties", "property", "motors", "auto", "fleet", "freight", "express", "hygiene", "medical", "health",
]);

export function decodeHtml(s: string) {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&#0*64;|&#x0*40;|&commat;/gi, "@")
    .replace(/&#0*46;|&#x0*2e;|&period;/gi, ".")
    .replace(/&nbsp;/gi, " ")
    .replace(/%40/g, "@");
}

export function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (!parsed.hostname.includes(".")) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function hostOf(url: string | null | undefined): string | null {
  const normalized = normalizeWebsite(url ?? null);
  if (!normalized) return null;
  return new URL(normalized).hostname.toLowerCase().replace(/^www\./, "");
}

export function isNonOfficialHost(host: string | null) {
  if (!host) return true;
  return NON_OFFICIAL_HOSTS.some((blocked) => host === blocked || host.endsWith("." + blocked));
}

export function companyTokens(company: string) {
  const words = company
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 2 && !LEGAL_WORDS.has(w));
  const distinctive = words.filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w));
  return { all: words, distinctive };
}

function textOf(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function identityText(html: string) {
  const parts: string[] = [];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) parts.push(title);
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:site_name|og:title|application-name)["'][^>]*>/gi)) {
    const content = m[0].match(/content=["']([^"']*)["']/i)?.[1];
    if (content) parts.push(content);
  }
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) parts.push(h1);
  const logoAlt = html.match(/<img[^>]+alt=["']([^"']*logo[^"']*)["']/i)?.[1];
  if (logoAlt) parts.push(logoAlt);
  return textOf(parts.join(" "));
}

/**
 * Decides whether a fetched page plausibly belongs to the company.
 *  - match: a distinctive name token is in the domain, or every distinctive
 *    token appears in the page identity (title/og:site_name/h1/logo alt), or
 *    the full normalised name appears in the page text.
 *  - weak: some evidence, but not enough to accept automatically.
 *  - mismatch: no distinctive token anywhere.
 */
export function assessIdentity(company: string, html: string, pageUrl: string): { verdict: IdentityVerdict; evidence: string } {
  const { all, distinctive } = companyTokens(company);
  const host = (hostOf(pageUrl) ?? "").replace(/[^a-z0-9]/g, "");
  const identity = ` ${identityText(html)} `;
  const body = ` ${textOf(html)} `;
  const fullName = all.join(" ");

  if (!distinctive.length) {
    // Name made only of generic words ("General Construction Services"):
    // require the complete name to appear in the page identity.
    if (fullName && identity.includes(` ${fullName} `)) return { verdict: "weak", evidence: "generic name found in page title" };
    return { verdict: "mismatch", evidence: "company name has no distinctive words" };
  }

  const inHost = distinctive.filter((t) => t.length >= 4 && host.includes(t));
  if (inHost.length) return { verdict: "match", evidence: `domain contains "${inHost[0]}"` };

  const inIdentity = distinctive.filter((t) => identity.includes(` ${t} `));
  if (inIdentity.length === distinctive.length) return { verdict: "match", evidence: "company name found in page title/heading" };
  if (fullName.length >= 6 && body.includes(` ${fullName} `)) return { verdict: "match", evidence: "full company name found on page" };

  const inBody = distinctive.filter((t) => body.includes(` ${t} `));
  if (inIdentity.length || inBody.length === distinctive.length) {
    return { verdict: "weak", evidence: "partial company-name evidence on page" };
  }
  return { verdict: "mismatch", evidence: "company name not found on page" };
}

export function normalizeSaPhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("0027")) digits = digits.slice(2);
  if (digits.startsWith("27")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  else return null;
  if (digits.startsWith("0")) digits = digits.slice(1); // "+27 (0)11 ..."
  if (!/^[1-8]\d{8}$/.test(digits)) return null;
  return "+27" + digits;
}

export function extractContacts(html: string, websiteUrl: string): ExtractedContacts {
  const decoded = decodeHtml(html);
  const siteHost = hostOf(websiteUrl) ?? "";

  const mailtos = [...decoded.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) => m[1]);
  const inline = [...decoded.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((m) => m[0]);
  const emails = [...new Set([...mailtos, ...inline].map((e) => e.trim().toLowerCase().replace(/\.$/, "")))]
    .filter((e) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e))
    .filter((e) => !EMAIL_NOISE.test(e) && !ASSET_SUFFIX.test(e) && !NOREPLY.test(e));

  const sameDomain = emails.filter((e) => {
    const domain = e.split("@")[1];
    return domain === siteHost || domain.endsWith("." + siteHost) || siteHost.endsWith("." + domain);
  });
  const freeMail = emails.filter((e) => FREE_MAIL_DOMAINS.has(e.split("@")[1]));
  const rank = (e: string) => (/^(info|admin|office|enquiries|enquiry|sales|contact|hello|accounts)@/.test(e) ? 0 : 1);

  let email: string | null = null;
  let emailConfidence: ExtractedContacts["emailConfidence"] = null;
  if (sameDomain.length) {
    email = [...sameDomain].sort((a, b) => rank(a) - rank(b))[0];
    emailConfidence = "high";
  } else if (freeMail.length) {
    // Small businesses often publish a Gmail/Mweb address on their own site.
    email = [...freeMail].sort((a, b) => rank(a) - rank(b))[0];
    emailConfidence = "medium";
  }

  const telLinks = [...decoded.matchAll(/href=["']tel:([^"']+)["']/gi)].map((m) => normalizeSaPhone(m[1])).filter(Boolean) as string[];
  const inlinePhones = [...textOnlyForPhones(decoded).matchAll(/(?:(?:\+27|\b0027)[\s.-]*(?:\(0\)[\s.-]*)?|\(?\b0)[\s().-]*[1-8](?:[\s().-]*\d){8}\b/g)]
    .map((m) => normalizeSaPhone(m[0]))
    .filter(Boolean) as string[];
  const phone = telLinks[0] ?? inlinePhones[0] ?? null;

  return { email, emailConfidence, phone, phoneFromTelLink: Boolean(telLinks[0]) };
}

function textOnlyForPhones(html: string) {
  // Strip scripts/styles/attributes so tracking IDs and timestamps inside
  // code are not misread as phone numbers.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

export function contactLinks(html: string, base: string, limit = 3) {
  const baseHost = new URL(base).hostname;
  const out: string[] = [];
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = m[1].split("#")[0];
    if (!href) continue;
    if (!/(contact|about|reach-us|get-in-touch|find-us|location)/i.test(href)) continue;
    try {
      const u = new URL(href, base);
      if (!["http:", "https:"].includes(u.protocol)) continue;
      if (u.hostname !== baseHost) continue;
      u.hash = "";
      out.push(u.toString());
    } catch {
      // ignore malformed hrefs
    }
  }
  return [...new Set(out)].slice(0, limit);
}

/** Minimal robots.txt evaluation for the "*" user-agent group. */
export function robotsAllows(robotsTxt: string | null, path: string) {
  if (!robotsTxt) return true;
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
  let applies = false;
  let inAgentBlock = false;
  const disallow: string[] = [];
  const allow: string[] = [];
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!inAgentBlock) applies = false;
      inAgentBlock = true;
      if (value === "*" || /acapolite/i.test(value)) applies = true;
      continue;
    }
    inAgentBlock = false;
    if (!applies) continue;
    if (key === "disallow" && value) disallow.push(value);
    if (key === "allow" && value) allow.push(value);
  }
  const longest = (rules: string[]) => rules.filter((r) => path.startsWith(r.replace(/\*.*$/, ""))).reduce((n, r) => Math.max(n, r.length), -1);
  const d = longest(disallow);
  if (d < 0) return true;
  return longest(allow) >= d;
}
