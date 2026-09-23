// Single source of truth for Acapolite Consulting's verified public business
// identity. Every field here is sourced from content already live on the
// site (src/pages/ContactUs.tsx, src/components/landing/Footer.tsx) — none
// of it is invented. If any value changes, update it here once rather than
// in every component/schema block that needs it.
//
// Deliberately NOT included because it isn't verified anywhere in the
// codebase: a physical street address, founding date, employee count,
// awards, ratings/reviews, or specific practitioner registration numbers.
// See the PR3 report for the "business information required" list.
export const SITE_URL = "https://acapoliteconsulting.co.za";
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const BUSINESS_NAME = "Acapolite Consulting";
export const LOGO_URL = `${SITE_URL}/acapolite-logo.png`;

// From src/pages/ContactUs.tsx.
export const SUPPORT_EMAIL = "support@acapoliteconsulting.co.za";
export const SUPPORT_PHONE_DISPLAY = "+27 10 288 6912";
export const SUPPORT_PHONE_TEL = "+27102886912";

// From src/components/landing/Footer.tsx (added in commit a56cbc3, ahead of
// the original SEO audit — already live in production, not new).
export const WHATSAPP_URL = "https://wa.me/27675575506";
export const SOCIAL_LINKS = [
  "https://www.facebook.com/acapolite",
  "https://www.instagram.com/acapolite",
  "https://www.linkedin.com/company/acapolite-consulting",
] as const;

// Acapolite is a nationwide, remote/digital platform with no publicly
// disclosed physical customer-facing office anywhere in the codebase —
// see src/pages/Practitioners.tsx ("Work with clients nationwide",
// "attract clients across South Africa") and src/pages/AboutUs.tsx. Do not
// add a `address`/`geo` field to schema without a verified physical
// address from the business.
export const AREA_SERVED = "South Africa";

// Explicitly approved for public disclosure. Do not add a SAIT membership
// number, SARS tax practitioner number, years of experience, client counts,
// or any other unverified detail without separate, explicit approval.
export const LEADERSHIP_NAME = "Patric Sandiso Sibande";
export const LEADERSHIP_TITLE = "Registered Tax Practitioner (SA)™";
export const LEADERSHIP_BODY = "South African Institute of Taxation (SAIT)";
export const LEADERSHIP_ID = `${SITE_URL}/about-us#patric-sibande`;
