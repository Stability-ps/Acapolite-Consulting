#!/usr/bin/env node
// Must be imported via `vite-node`, not plain `node` - it imports real .tsx
// source modules and needs Vite's alias resolution (the "@/..." imports)
// and JSX/TS transforms. Used by both generate-route-html.mjs (to write
// the seeded content) and validate-seo-routing.mjs (to independently
// re-derive the same content and check what actually got written) - one
// place builds the path -> { h1, jsonLd } map, so the two scripts can never
// disagree about what a route's real content is.
//
// Finding H2 (post-deployment SEO audit): every route's real <h1> and
// JSON-LD are written into the DOM by React after the JS bundle runs, so a
// crawler that fetches raw HTML without executing JavaScript sees an empty
// <div id="root"></div> - no heading, no structured data. The map below is
// read directly from the same exported config objects/constants and
// structuredData.ts-backed schema functions the React app itself renders
// from - zero duplicated content, so if a page's H1 or schema changes,
// this reads the new value automatically.

// Importing a page's .tsx module below pulls in its whole component tree,
// which eventually reaches src/integrations/supabase/client.ts - it reads
// `localStorage` at import time (module-level, not inside a function) to
// configure its auth storage. That's a real browser global we don't
// otherwise have here; nothing in this script renders anything or invokes
// React, so it's never actually called - stub it so the import graph loads.
globalThis.localStorage ??= {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
};

export async function getBodyContentByPath() {
  const { buildOrganizationSchema, buildWebsiteSchema } = await import("@/lib/structuredData");
  const { HOMEPAGE_H1 } = await import("@/components/landing/Hero");
  const { configs: serviceLandingConfigs, buildServiceLandingPageSchemas } = await import("@/pages/ServiceLandingPages");
  const { sarsMoneyPageConfigs, buildSarsMoneyPageSchemas } = await import("@/pages/SarsMoneyPages");
  const { configs: additionalTaxConfigs, buildAdditionalTaxServiceSchemas } = await import("@/pages/AdditionalTaxServicePages");
  const { guides, TAX_GUIDES_HUB_H1, buildTaxGuidesHubSchemas, buildGuidePageSchemas } = await import("@/pages/TaxGuides");
  const { OUR_SERVICES_H1 } = await import("@/pages/OurServices");
  const { CONTACT_US_H1 } = await import("@/pages/ContactUs");
  const { HELP_CENTER_H1 } = await import("@/pages/HelpCenter");
  const { FAQ_H1 } = await import("@/pages/Faq");
  const { TRUST_SAFETY_H1 } = await import("@/pages/TrustSafety");
  const { HOW_ACAPOLITE_WORKS_H1 } = await import("@/pages/HowAcapoliteWorks");
  const { TAX_CONSULTANT_PRETORIA_H1, buildTaxConsultantPretoriaSchemas } = await import("@/pages/TaxConsultantPretoria");
  const { ABOUT_US_H1 } = await import("@/pages/AboutUs");
  const { PRACTITIONERS_H1 } = await import("@/pages/Practitioners");
  const { REQUEST_TAX_ASSISTANCE_H1 } = await import("@/pages/RequestTaxAssistance");

  // path -> { h1, jsonLd } - the only routes eligible are ones already in
  // rawHtmlSeoRoutes (checked by both consumers of this map); this never
  // reaches an authenticated/private route because those routes have no
  // manifest entry to begin with.
  const bodyContentByPath = new Map();

  bodyContentByPath.set("/", { h1: HOMEPAGE_H1, jsonLd: [buildOrganizationSchema(), buildWebsiteSchema()] });

  for (const config of Object.values(serviceLandingConfigs)) {
    bodyContentByPath.set(config.path, { h1: config.title, jsonLd: buildServiceLandingPageSchemas(config) });
  }
  for (const config of sarsMoneyPageConfigs) {
    bodyContentByPath.set(config.path, { h1: config.title, jsonLd: buildSarsMoneyPageSchemas(config) });
  }
  for (const config of Object.values(additionalTaxConfigs)) {
    bodyContentByPath.set(config.path, { h1: config.title, jsonLd: buildAdditionalTaxServiceSchemas(config) });
  }
  bodyContentByPath.set("/tax-guides", { h1: TAX_GUIDES_HUB_H1, jsonLd: buildTaxGuidesHubSchemas() });
  for (const guide of guides) {
    bodyContentByPath.set(`/tax-guides/${guide.slug}`, { h1: guide.title, jsonLd: buildGuidePageSchemas(guide) });
  }
  // Tier C/D pages below have no JSON-LD in the real React app today - per
  // the approved H2 scope, this surfaces existing content into raw HTML,
  // it does not add new schema to pages that don't already have any.
  bodyContentByPath.set("/our-services", { h1: OUR_SERVICES_H1, jsonLd: [] });
  bodyContentByPath.set("/contact-us", { h1: CONTACT_US_H1, jsonLd: [] });
  bodyContentByPath.set("/help-center", { h1: HELP_CENTER_H1, jsonLd: [] });
  bodyContentByPath.set("/faq", { h1: FAQ_H1, jsonLd: [] });
  bodyContentByPath.set("/trust-safety", { h1: TRUST_SAFETY_H1, jsonLd: [] });
  bodyContentByPath.set("/how-acapolite-works", { h1: HOW_ACAPOLITE_WORKS_H1, jsonLd: [] });
  bodyContentByPath.set("/tax-consultant-pretoria", { h1: TAX_CONSULTANT_PRETORIA_H1, jsonLd: buildTaxConsultantPretoriaSchemas() });
  bodyContentByPath.set("/about-us", { h1: ABOUT_US_H1, jsonLd: [] });
  bodyContentByPath.set("/practitioners", { h1: PRACTITIONERS_H1, jsonLd: [] });
  // The wizard's stable, purpose-representing H1 only - never the post-
  // submission "Request Submitted Successfully" state, which depends on
  // what the visitor just submitted (see RequestTaxAssistance.tsx).
  bodyContentByPath.set("/request-tax-assistance", { h1: REQUEST_TAX_ASSISTANCE_H1, jsonLd: [] });

  return bodyContentByPath;
}
