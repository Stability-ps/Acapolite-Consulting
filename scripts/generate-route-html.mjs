#!/usr/bin/env node
// Run via `vite-node` (see package.json's "postbuild"), not plain `node` -
// seo-body-content.mjs (imported below) needs Vite's alias resolution and
// JSX/TS transforms to read each route's real H1/JSON-LD from source.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rawHtmlSeoRoutes } from "./public-seo-routes.mjs";
import { getBodyContentByPath } from "./seo-body-content.mjs";

// React (createRoot, not hydrateRoot - see src/main.tsx) replaces the
// seeded content below the instant the real bundle executes; it never
// attempts to reconcile against it, so there's no hydration-mismatch risk
// from the seed not matching pixel-for-pixel.
const bodyContentByPath = await getBodyContentByPath();

const SITE_URL = "https://acapoliteconsulting.co.za";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");
const template = readFileSync(resolve(DIST, "index.html"), "utf8");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceMeta(html, attr, key, value) {
  const pattern = new RegExp(
    `<meta\\s+${attr}=["']${key}["']\\s+content=["'][^"']*["']\\s*\\/?>`,
    "i",
  );
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function replaceTitle(html, title) {
  return html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}

function replaceCanonical(html, href) {
  const tag = `<link rel="canonical" href="${href}" />`;
  const pattern = /<link\s+rel=["']canonical["'][^>]*>/i;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

// Same escaping JsonLd.tsx uses when it renders this exact data client-side
// (src/components/seo/JsonLd.tsx): prevents a stray "</script" substring in
// a string value from prematurely closing the tag.
function jsonLdScriptTag(data) {
  const json = JSON.stringify(data).replaceAll("<", "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function seedBody(html, content) {
  if (!content) {
    return html;
  }
  const seeds = [`<h1>${escapeHtml(content.h1)}</h1>`, ...content.jsonLd.map(jsonLdScriptTag)].join("\n    ");
  const pattern = /<div id="root"><\/div>/;
  if (!pattern.test(html)) {
    throw new Error(`Body seeding failed: no empty <div id="root"></div> found to seed (already seeded, or template changed?)`);
  }
  return html.replace(pattern, `<div id="root">\n    ${seeds}\n  </div>`);
}

for (const route of rawHtmlSeoRoutes) {
  const canonical = `${SITE_URL}${route.path}`;
  // Most routes are indexable; a route may override this (e.g. a paid-
  // traffic-only landing page that must never be indexed but still needs
  // its own raw-HTML shell so the noindex directive is visible to a
  // crawler before any JavaScript runs - see the /request-professional-help
  // entry in public-seo-routes.mjs).
  const robots = route.robots ?? "index, follow";
  let html = replaceTitle(template, route.title);
  html = replaceMeta(html, "name", "description", route.description);
  html = replaceMeta(html, "name", "robots", robots);
  html = replaceMeta(html, "property", "og:title", route.title);
  html = replaceMeta(html, "property", "og:description", route.description);
  html = replaceMeta(html, "property", "og:url", canonical);
  html = replaceMeta(html, "name", "twitter:title", route.title);
  html = replaceMeta(html, "name", "twitter:description", route.description);
  html = replaceCanonical(html, canonical);
  html = seedBody(html, bodyContentByPath.get(route.path));

  const outDir = resolve(DIST, route.path.slice(1));
  mkdirSync(outDir, { recursive: true });
  const expected = [
    `<title>${escapeHtml(route.title)}</title>`,
    `content="${escapeHtml(route.description)}"`,
    `<link rel="canonical" href="${canonical}" />`,
    `meta name="robots" content="${robots}"`,
  ];

  for (const marker of expected) {
    if (!html.includes(marker)) {
      throw new Error(`Generated raw HTML validation failed for ${route.path}: missing ${marker}`);
    }
  }

  const seededContent = bodyContentByPath.get(route.path);
  if (seededContent && !html.includes(`<h1>${escapeHtml(seededContent.h1)}</h1>`)) {
    throw new Error(`Generated raw HTML validation failed for ${route.path}: missing seeded <h1>`);
  }

  writeFileSync(resolve(outDir, "index.html"), html, "utf8");
}

// The homepage isn't in rawHtmlSeoRoutes (its <head> tags live directly in
// the root index.html, already correct since PR B) - seed its body here,
// writing back to dist/index.html itself rather than a route subdirectory.
const homepageContent = bodyContentByPath.get("/");
const homepageHtml = seedBody(template, homepageContent);
if (homepageContent && !homepageHtml.includes(`<h1>${escapeHtml(homepageContent.h1)}</h1>`)) {
  throw new Error("Generated raw HTML validation failed for /: missing seeded <h1>");
}
writeFileSync(resolve(DIST, "index.html"), homepageHtml, "utf8");

console.log(`route-specific raw HTML written for ${rawHtmlSeoRoutes.length} commercial routes`);
console.log(`body content (H1 + JSON-LD where applicable) seeded for ${bodyContentByPath.size} routes`);
