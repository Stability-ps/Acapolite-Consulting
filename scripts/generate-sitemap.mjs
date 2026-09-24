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
//   - /request-professional-help (SEO PR4: paid-traffic/Ads landing page,
//     set to noindex,follow in src/pages/ServiceLandingPages.tsx — not part
//     of the organic architecture, so it does not belong in the sitemap.
//     The route itself, its canonical tag and its Ads/lead functionality
//     are unchanged — only sitemap + indexation status moved.)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SITE_URL = "https://acapoliteconsulting.co.za";

import { publicRoutes as routes } from "./public-seo-routes.mjs";


const urls = routes
  .map(
    (r) =>
      `  <url>\n    <loc>${SITE_URL}${r.path}</loc>${r.lastmod ? `\n    <lastmod>${r.lastmod}</lastmod>` : ""}\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/sitemap.xml");
writeFileSync(outPath, xml, "utf8");
console.log(`sitemap.xml written with ${routes.length} URLs -> ${outPath}`);
