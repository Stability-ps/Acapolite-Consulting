import { useEffect } from "react";

/**
 * Canonical host for all public pages. Deliberately hardcoded rather than
 * derived from window.location — canonical/OG URLs must always point at the
 * apex domain even when a page is loaded from the www. host, per the SEO
 * audit (Finding 5.5: www and apex both resolve, with nothing to prefer one).
 */
export const SITE_URL = "https://acapoliteconsulting.co.za";

const DEFAULT_OG_IMAGE = "/acapolite-logo.png";

export type SeoOptions = {
  /** Full, final <title> text, e.g. "Our Services | Acapolite Consulting". */
  title: string;
  /** Full, final meta description — should describe this page's real content. */
  description: string;
  /**
   * Route path this page is canonically reachable at, e.g. "/our-services".
   * Query strings must never be included — canonical/og:url always resolve
   * to this clean path regardless of the URL actually being viewed.
   */
  path: string;
  /** Relative or absolute path to a social share image. Defaults to the brand logo. */
  ogImage?: string;
  ogType?: "website" | "article";
  /** Meta robots directive. Defaults to indexable — override for edge cases only. */
  robots?: string;
};

function absoluteUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

function upsertMetaByAttr(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Sets document title, meta description, canonical, Open Graph and Twitter
 * card tags for the currently mounted public page. Every value is set fresh
 * on mount — there is no "restore previous" step, because every public route
 * renders through this hook and the next page's mount always runs before the
 * next paint (see AppRoutes' key={location.pathname} remount-per-route
 * pattern in App.tsx).
 *
 * Client-side only: this updates the DOM after React mounts/hydrates. Raw,
 * pre-JavaScript HTML (what non-JS crawlers and unfurlers receive) still
 * shows index.html's static fallback tags — see the PR1 report for the
 * raw-vs-rendered distinction.
 */
export function useSeo({ title, description, path, ogImage = DEFAULT_OG_IMAGE, ogType = "website", robots = "index, follow" }: SeoOptions) {
  useEffect(() => {
    const canonicalUrl = absoluteUrl(path);
    const absoluteImage = /^https?:\/\//.test(ogImage) ? ogImage : absoluteUrl(ogImage);

    document.title = title;
    upsertMetaByAttr("name", "description", description);
    upsertMetaByAttr("name", "robots", robots);
    upsertCanonical(canonicalUrl);

    upsertMetaByAttr("property", "og:title", title);
    upsertMetaByAttr("property", "og:description", description);
    upsertMetaByAttr("property", "og:url", canonicalUrl);
    upsertMetaByAttr("property", "og:image", absoluteImage);
    upsertMetaByAttr("property", "og:type", ogType);

    upsertMetaByAttr("name", "twitter:card", "summary_large_image");
    upsertMetaByAttr("name", "twitter:title", title);
    upsertMetaByAttr("name", "twitter:description", description);
    upsertMetaByAttr("name", "twitter:image", absoluteImage);
  }, [title, description, path, ogImage, ogType, robots]);
}
