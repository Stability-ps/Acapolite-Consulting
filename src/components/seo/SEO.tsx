import { useSeo, type SeoOptions } from "@/hooks/useSeo";

/**
 * Declarative per-route metadata. Renders nothing — sets document title,
 * meta description, canonical, Open Graph and Twitter tags for the page it's
 * mounted on. See src/hooks/useSeo.ts for pages that need the hook form
 * instead (e.g. components with early returns before any JSX).
 *
 * Usage: <SEO title="..." description="..." path="/our-services" />
 */
export function SEO(props: SeoOptions) {
  useSeo(props);
  return null;
}
