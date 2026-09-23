#!/usr/bin/env node
// Generates dist/sitemap.xml after `vite build` (wired via package.json's
// "postbuild" script, which npm runs automatically after "build").
//
// This list is the sitemap's source of truth. It must be kept in sync by
// hand with the public <Route> entries in src/App.tsx — there is no
// automated extraction from App.tsx, so any new public page needs an entry
// added here as part of the same change.
//
// Deliberately excluded:
//   - /login, /register, /reset-password (functional, not content — noindex)
//   - /dashboard/* (private, authenticated — noindex)
//   - the request-tax-assistance wizard's query-string states (the wizard
//     always canonicalises to the bare path; only that bare path is listed)
//   - the SPA's catch-all 404 route
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SITE_URL = "https://acapoliteconsulting.co.za";

const routes = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/our-services", priority: "0.9", changefreq: "monthly" },
  { path: "/sars-tax-assistance", priority: "0.9", changefreq: "monthly" },
  { path: "/accounting-services", priority: "0.9", changefreq: "monthly" },
  { path: "/bookkeeping-services", priority: "0.9", changefreq: "monthly" },
  { path: "/cipc-company-compliance", priority: "0.9", changefreq: "monthly" },
  { path: "/tax-returns", priority: "0.9", changefreq: "monthly" },
  { path: "/request-professional-help", priority: "0.8", changefreq: "monthly" },
  { path: "/request-tax-assistance", priority: "0.9", changefreq: "monthly" },
  { path: "/how-acapolite-works", priority: "0.7", changefreq: "monthly" },
  { path: "/practitioners", priority: "0.7", changefreq: "monthly" },
  { path: "/about-us", priority: "0.6", changefreq: "yearly" },
  { path: "/contact-us", priority: "0.6", changefreq: "yearly" },
  { path: "/help-center", priority: "0.5", changefreq: "monthly" },
  { path: "/faq", priority: "0.5", changefreq: "monthly" },
  { path: "/trust-safety", priority: "0.4", changefreq: "yearly" },
  { path: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
  { path: "/terms-and-conditions", priority: "0.3", changefreq: "yearly" },
  { path: "/cookie-policy", priority: "0.3", changefreq: "yearly" },
  { path: "/refund-policy", priority: "0.3", changefreq: "yearly" },
  { path: "/disclaimer", priority: "0.3", changefreq: "yearly" },
  { path: "/practitioner-guidelines", priority: "0.3", changefreq: "yearly" },
  { path: "/data-deletion", priority: "0.2", changefreq: "yearly" },
];

const urls = routes
  .map(
    (r) =>
      `  <url>\n    <loc>${SITE_URL}${r.path}</loc>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/sitemap.xml");
writeFileSync(outPath, xml, "utf8");
console.log(`sitemap.xml written with ${routes.length} URLs -> ${outPath}`);
