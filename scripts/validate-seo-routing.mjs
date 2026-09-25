#!/usr/bin/env node
// Run via `vite-node` (see package.json's "postbuild") - the body-content
// re-check below imports seo-body-content.mjs, which needs Vite's alias
// resolution and JSX/TS transforms.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { publicRoutes, rawHtmlSeoRoutes } from "./public-seo-routes.mjs";
import { getBodyContentByPath } from "./seo-body-content.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");
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

for (const route of ["/login", "/register", "/reset-password", "/dashboard", "/dashboard/(.*)"]) {
  if (rewriteMap.get(route) !== "/index.html") {
    throw new Error(`SEO routing validation failed: expected SPA deep-link rewrite for ${route}`);
  }
}

// /request-professional-help is a paid-traffic-only landing page: it must
// never be organically discoverable (excluded from the sitemap) and must
// never be indexable (its raw-HTML shell, like every other route's, must
// declare noindex before any JavaScript runs). It's deliberately allowed
// to have a shell now (SEO PR-B) - a shell is no longer synonymous with
// "organically indexable" now that a route can override its own robots
// directive; what actually matters is checked explicitly below.
const paidLandingPageRoute = publicRoutes.find((route) => route.path === "/request-professional-help");
if (!paidLandingPageRoute?.excludeFromSitemap) {
  throw new Error("SEO routing validation failed: /request-professional-help must be excluded from the sitemap");
}
const paidLandingPageShell = rawHtmlSeoRoutes.find((route) => route.path === "/request-professional-help");
if (paidLandingPageShell && paidLandingPageShell.robots !== "noindex, follow") {
  throw new Error("SEO routing validation failed: /request-professional-help's shell must be noindex, follow");
}

// Finding H2: independently re-derive each route's expected H1/JSON-LD from
// source (the same seo-body-content.mjs module generate-route-html.mjs
// used) and re-check the ACTUAL generated dist/ file against it - this
// re-verifies what was written, it doesn't just trust the writer.
const bodyContentByPath = await getBodyContentByPath();

const PRIVATE_PATH_PREFIXES = ["/dashboard", "/login", "/register", "/reset-password"];
for (const path of bodyContentByPath.keys()) {
  if (PRIVATE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    throw new Error(`SEO routing validation failed: body content must never be seeded for a private/auth route (${path})`);
  }
}

function readDistHtml(path) {
  const file = path === "/" ? resolve(DIST, "index.html") : resolve(DIST, path.slice(1), "index.html");
  return readFileSync(file, "utf8");
}

function jsonLdEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

let bodyCheckedCount = 0;
for (const [path, content] of bodyContentByPath) {
  const html = readDistHtml(path);
  const dom = new JSDOM(html);
  const { document } = dom.window;

  const h1s = document.querySelectorAll("#root h1");
  if (h1s.length === 0) {
    throw new Error(`SEO routing validation failed for ${path}: no seeded <h1> found`);
  }
  if (h1s.length > 1) {
    throw new Error(`SEO routing validation failed for ${path}: expected exactly one seeded <h1>, found ${h1s.length}`);
  }
  if (h1s[0].textContent !== content.h1) {
    throw new Error(
      `SEO routing validation failed for ${path}: seeded <h1> text "${h1s[0].textContent}" does not match the real page's H1 "${content.h1}"`,
    );
  }

  const scripts = document.querySelectorAll('#root script[type="application/ld+json"]');
  if (scripts.length !== content.jsonLd.length) {
    throw new Error(
      `SEO routing validation failed for ${path}: expected ${content.jsonLd.length} JSON-LD block(s), found ${scripts.length}`,
    );
  }
  for (let i = 0; i < scripts.length; i += 1) {
    let parsed;
    try {
      parsed = JSON.parse(scripts[i].textContent);
    } catch (error) {
      throw new Error(`SEO routing validation failed for ${path}: JSON-LD block ${i} does not parse as JSON (${error.message})`);
    }
    if (!jsonLdEquals(parsed, content.jsonLd[i])) {
      throw new Error(`SEO routing validation failed for ${path}: JSON-LD block ${i} does not match the schema structuredData.ts builds for this route`);
    }
  }

  bodyCheckedCount += 1;
}

console.log(
  `SEO routing validated for ${rawHtmlSeoRoutes.length} route-specific HTML rewrites`,
);
console.log(`Body content (H1 + JSON-LD) independently re-verified for ${bodyCheckedCount} routes`);
