#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rawHtmlSeoRoutes } from "./public-seo-routes.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vercel = JSON.parse(readFileSync(resolve(ROOT, "vercel.json"), "utf8"));

const rewriteMap = new Map(
  (vercel.rewrites || []).map((rewrite) => [rewrite.source, rewrite.destination]),
);

for (const route of rawHtmlSeoRoutes) {
  const expectedDestination = `${route.path}/index.html`;
  const actualDestination = rewriteMap.get(route.path);

  if (actualDestination !== expectedDestination) {
    throw new Error(
      `SEO routing validation failed for ${route.path}: expected rewrite to ${expectedDestination}, got ${actualDestination ?? "none"}`,
    );
  }
}

const exactSeoRewriteSources = [...rewriteMap.keys()].filter((source) =>
  rawHtmlSeoRoutes.some((route) => route.path === source),
);

if (exactSeoRewriteSources.length !== rawHtmlSeoRoutes.length) {
  throw new Error(
    `SEO routing validation failed: expected ${rawHtmlSeoRoutes.length} exact SEO rewrites, found ${exactSeoRewriteSources.length}`,
  );
}


const redirects = vercel.redirects || [];
const legacyServicesRedirect = redirects.find((redirect) => redirect.source === "/services");
if (
  !legacyServicesRedirect ||
  legacyServicesRedirect.destination !== "/our-services" ||
  legacyServicesRedirect.permanent !== true
) {
  throw new Error("SEO routing validation failed: /services must permanently redirect to /our-services");
}

if (rewriteMap.has("/(.*)")) {
  throw new Error("SEO routing validation failed: blanket SPA rewrite would turn unknown URLs into soft 404s");
}

for (const route of ["/login", "/register", "/reset-password", "/privacy-policy", "/data-deletion", "/refund-policy", "/disclaimer", "/practitioner-guidelines", "/cookie-policy", "/terms-and-conditions", "/request-professional-help", "/dashboard", "/dashboard/(.*)"]) {
  if (rewriteMap.get(route) !== "/index.html") {
    throw new Error(`SEO routing validation failed: expected SPA deep-link rewrite for ${route}`);
  }
}

if (rawHtmlSeoRoutes.some((route) => route.path === "/request-professional-help")) {
  throw new Error("SEO routing validation failed: paid landing page must not be part of raw organic SEO routes");
}

console.log(
  `SEO routing validated for ${rawHtmlSeoRoutes.length} route-specific HTML rewrites`,
);
