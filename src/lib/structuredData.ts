// JSON-LD builder functions. Each returns a plain object graph — nothing
// here touches the DOM; src/components/seo/JsonLd.tsx handles rendering.
//
// Architecture: Organization + WebSite are defined once, in full, on the
// homepage only (src/pages/Index.tsx) — they describe the site/entity as a
// whole, not any one page, and repeating the same global block on all 23
// public routes would be exactly the duplicated-JSON-LD-everywhere pattern
// this PR was told to avoid. Per-page schema (Service) that needs to point
// back at the organization embeds a minimal, self-contained reference
// (buildOrganizationRef) rather than a bare @id — Google's structured-data
// parser evaluates each page independently and does not resolve @id
// references across separate page fetches, so a bare reference with no
// inline identifying fields would be meaningless on any page other than
// the homepage.
import {
  AREA_SERVED,
  BUSINESS_NAME,
  LEADERSHIP_BODY,
  LEADERSHIP_ID,
  LEADERSHIP_NAME,
  LEADERSHIP_TITLE,
  LOGO_URL,
  ORGANIZATION_ID,
  SITE_URL,
  SOCIAL_LINKS,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_TEL,
  WEBSITE_ID,
} from "@/lib/businessInfo";

/** Minimal, self-contained reference to the Organization entity, for embedding in other schema (e.g. Service.provider). */
export function buildOrganizationRef() {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: BUSINESS_NAME,
    url: SITE_URL,
  };
}

/**
 * Full Organization definition. Render once, on the homepage.
 * Modelled as Organization + ProfessionalService (a South-Africa-wide
 * remote/digital platform, per businessInfo.ts) rather than LocalBusiness —
 * there is no verified physical customer-facing address anywhere in the
 * codebase, so no `address`/`geo` field is included. Fabricating one to
 * qualify for richer LocalBusiness markup would be inaccurate schema.
 */
export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService"],
    "@id": ORGANIZATION_ID,
    name: BUSINESS_NAME,
    url: SITE_URL,
    logo: LOGO_URL,
    image: LOGO_URL,
    areaServed: AREA_SERVED,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: SUPPORT_PHONE_TEL,
      email: SUPPORT_EMAIL,
      areaServed: "ZA",
      availableLanguage: ["English"],
    },
    sameAs: [...SOCIAL_LINKS],
  };
}

/** WebSite definition. Render once, on the homepage, alongside Organization. */
export function buildWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: BUSINESS_NAME,
    publisher: { "@id": ORGANIZATION_ID },
    // No SearchAction: the public site has no site-search feature
    // (confirmed by repo search — only authenticated dashboard search UIs
    // exist). Do not add one without a real search endpoint.
  };
}

/**
 * Person definition for approved leadership shown on /about-us. Contains
 * only explicitly approved fields (name, designation, professional-body
 * membership) — no registration/membership numbers, no years of
 * experience, no client counts, no private contact details. Rendered only
 * on /about-us, where the name is actually visible on the page.
 */
export function buildPersonSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": LEADERSHIP_ID,
    name: LEADERSHIP_NAME,
    jobTitle: LEADERSHIP_TITLE,
    memberOf: {
      "@type": "Organization",
      name: LEADERSHIP_BODY,
    },
    worksFor: { "@id": ORGANIZATION_ID },
  };
}

export type ServiceSchemaInput = {
  name: string;
  description: string;
  path: string;
};

/** Service definition for a genuine, visible service landing page. */
export function buildServiceSchema({ name, description, path }: ServiceSchemaInput) {
  const url = `${SITE_URL}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name,
    description,
    url,
    areaServed: AREA_SERVED,
    provider: buildOrganizationRef(),
  };
}


export type BreadcrumbSchemaItem = {
  name: string;
  path: string;
};

/** BreadcrumbList for pages that render the same visible navigation hierarchy. */
export function buildBreadcrumbSchema(items: BreadcrumbSchemaItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
