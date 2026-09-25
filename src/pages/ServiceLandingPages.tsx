import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbSchema, buildServiceSchema } from "@/lib/structuredData";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type LandingPageConfig = {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  metaDescription: string;
  intro: string;
  services: string[];
  whyItMatters: string;
  ctaTitle: string;
  ctaBody: string;
  /**
   * Meta robots override. Defaults to indexable (see useSeo). Set to
   * "noindex, follow" for pages that exist for paid-traffic/Ads purposes
   * only and are not part of the organic content architecture — crawlers
   * must still be able to reach the page to see this directive, so it must
   * never be paired with a robots.txt Disallow for the same path.
   */
  robots?: string;
  relatedLinks?: { label: string; href: string }[];
  audience?: string[];
  process?: string[];
  faqs?: { question: string; answer: string }[];
  officialSources?: { label: string; href: string }[];
  reviewedDate?: string;
};

const requestIntentByPath: Record<string, string> = {
  "/sars-tax-assistance": "sars",
  "/accounting-services": "accounting",
  "/bookkeeping-services": "bookkeeping",
  "/cipc-company-compliance": "cipc",
  "/tax-returns": "tax-returns",
  "/vat-services": "vat",
  "/provisional-tax": "provisional-tax",
};

/** Keyed by intent, not by path - the source of truth for both the rendered pages below and the build-time raw-HTML seeding in scripts/generate-route-html.mjs. */
export const configs: Record<string, LandingPageConfig> = {
  sars: {
    path: "/sars-tax-assistance",
    eyebrow: "SARS & Tax Assistance",
    title: "Professional SARS & Tax Assistance Across South Africa",
    description:
      "Get structured professional support for SARS debt, disputes, audits, tax returns, VAT, PAYE and tax compliance matters.",
    metaDescription:
      "Professional SARS and tax assistance across South Africa for debt arrangements, compromises, objections, audits, returns, VAT, PAYE and compliance.",
    intro:
      "Acapolite Consulting connects individuals and businesses with qualified tax practitioners who can assess SARS matters, explain the available process, and assist with the documentation and submissions required for the selected service.",
    services: [
      "SARS debt payment arrangements",
      "Compromise applications, including Section 200 matters",
      "Objections, disputes and supporting submissions",
      "SARS audit and verification assistance",
      "VAT and PAYE compliance assistance",
      "Personal and company tax returns",
      "Tax compliance status support",
      "Provisional tax and IRP6 assistance",
      "Review of SARS notices, letters and account issues",
    ],
    whyItMatters:
      "SARS matters often depend on deadlines, supporting evidence and the taxpayer's current compliance position. A properly structured request helps the practitioner identify the relevant tax type, urgency and supporting documents from the start.",
    ctaTitle: "Tell us what SARS assistance you need",
    ctaBody:
      "Submit a secure service request and select the SARS or tax services relevant to your situation.",
    relatedLinks: [
      { label: "SARS & Tax Guides", href: "/tax-guides" },
      { label: "SARS Debt Help", href: "/sars-debt" },
      { label: "Payment Arrangements", href: "/sars-payment-arrangements" },
      { label: "Section 200 Compromise", href: "/sars-compromise" },
      { label: "Objections & Disputes", href: "/sars-objections" },
      { label: "Tax Compliance Status", href: "/sars-tax-compliance-status" },
      { label: "SARS Audit & Verification", href: "/sars-audit-verification" },
      { label: "PAYE, UIF & SDL", href: "/paye-uif-sdl-services" },
      { label: "Provisional Tax & IRP6", href: "/provisional-tax" },
    ],
  },
  vat: {
    path: "/vat-services",
    eyebrow: "VAT Services",
    title: "VAT Registration, Returns & SARS VAT Assistance",
    description:
      "Professional VAT support for South African businesses, including registration, VAT201 returns, compliance, SARS verification and refund matters.",
    metaDescription:
      "VAT services across South Africa for registration, VAT201 returns, compliance, SARS verification, audits and VAT refund matters.",
    intro:
      "VAT obligations depend on the nature and value of taxable supplies, the vendor's registration status and the records supporting each VAT period. Acapolite helps businesses request professional assistance for routine VAT compliance and SARS VAT matters.",
    services: [
      "Compulsory and voluntary VAT registration assistance",
      "VAT201 return preparation and submission support",
      "VAT account and compliance reviews",
      "Supporting-document preparation for SARS verification",
      "VAT audit and verification assistance",
      "VAT refund follow-up and supporting-document reviews",
      "Banking-detail and refund impediment checks",
      "Historical VAT return and compliance catch-up",
    ],
    whyItMatters:
      "From 1 April 2026, SARS applies a R2.3 million compulsory VAT registration threshold and a R120 000 voluntary threshold, subject to the applicable rules and exceptions. VAT refunds can also be affected by outstanding returns or debt, banking details, and verification or audit processes. The correct next step therefore depends on the vendor's facts and SARS account position.",
    ctaTitle: "Request VAT assistance",
    ctaBody:
      "Tell us whether you need help with VAT registration, returns, compliance, verification, an audit or a refund matter.",
    audience: [
      "Businesses approaching or exceeding the compulsory VAT registration threshold",
      "Businesses considering voluntary VAT registration",
      "VAT vendors that need help preparing or correcting VAT201 returns",
      "Vendors dealing with SARS VAT verification, audit or delayed refund matters",
    ],
    process: [
      "Identify the VAT issue, affected periods and current SARS registration or account status.",
      "Review the available VAT201 information, accounting records and supporting documents relevant to the request.",
      "Prepare the registration, return, compliance response or supporting submission within the agreed scope.",
      "Where SARS follow-up is required, review the resulting notice, verification, audit or refund status and determine the next appropriate step.",
    ],
    faqs: [
      {
        question: "What is the compulsory VAT registration threshold?",
        answer:
          "SARS states that from 1 April 2026 compulsory VAT registration generally applies when taxable supplies exceed, or in specified circumstances are expected to exceed, R2.3 million in a consecutive 12-month period. The applicable enterprise and registration rules still need to be considered.",
      },
      {
        question: "Can a business register voluntarily below R2.3 million?",
        answer:
          "Yes, in qualifying circumstances. SARS states that the voluntary registration threshold is R120 000 from 1 April 2026, subject to the VAT registration rules and exceptions.",
      },
      {
        question: "Why can a VAT refund be delayed?",
        answer:
          "SARS identifies several possible impediments, including outstanding VAT returns, outstanding tax debt that may be set off, banking-detail issues, and a refund selected for verification, inspection or audit.",
      },
      {
        question: "Can you help when SARS asks for VAT supporting documents?",
        answer:
          "Yes. The request can cover review and organisation of the available records and assistance responding to a SARS VAT verification or audit request. The documents required depend on the transaction and SARS request.",
      },
    ],
    officialSources: [
      { label: "SARS — Register for VAT", href: "https://www.sars.gov.za/types-of-tax/value-added-tax/register-for-vat/" },
      { label: "SARS — VAT Refunds for Vendors", href: "https://www.sars.gov.za/types-of-tax/value-added-tax/vat-refunds-for-vendors/" },
      { label: "SARS — Value-Added Tax", href: "https://www.sars.gov.za/types-of-tax/value-added-tax/" },
    ],
    reviewedDate: "25 September 2026",
    relatedLinks: [
      { label: "SARS & Tax Assistance", href: "/sars-tax-assistance" },
      { label: "Accounting Services", href: "/accounting-services" },
      { label: "Bookkeeping Services", href: "/bookkeeping-services" },
      { label: "SARS Objections & Disputes", href: "/sars-objections" },
    ],
  },
  accounting: {
    path: "/accounting-services",
    eyebrow: "Accounting Services",
    title: "Professional Accounting Services for South African Businesses",
    description:
      "Access accounting professionals for financial statements, management accounts, payroll, reporting and ongoing business accounting support.",
    metaDescription:
      "Professional accounting services across South Africa, including financial statements, management accounts, payroll, reporting and monthly accounting support.",
    intro:
      "Accurate financial records support tax compliance, decision-making and day-to-day business management. Acapolite helps businesses request the accounting support they need through one structured platform.",
    services: [
      "Preparation of financial statements",
      "Management accounts",
      "Monthly accounting services",
      "Payroll processing",
      "Financial reporting",
      "Cash-flow and record support",
      "Budget planning support",
      "Accounting records clean-up and review",
    ],
    whyItMatters:
      "Good accounting records make it easier to prepare tax returns, respond to compliance requests and understand the financial position of the business. The right service depends on the quality of existing records and the reporting period required.",
    ctaTitle: "Request accounting assistance",
    ctaBody:
      "Tell us what your business needs and submit a service request for professional accounting support.",
    audience: [
      "Businesses that need annual financial statements or management accounts",
      "Companies preparing records for tax, funding or compliance work",
      "Growing businesses that need recurring monthly reporting",
      "Businesses with incomplete accounting records that need clean-up before reporting",
    ],
    process: [
      "Tell us the reporting period, business type and accounting work required.",
      "A professional reviews the available records and identifies missing information.",
      "The accounting work is prepared from the records supplied and any agreed follow-up information.",
      "You receive the completed work or continue securely where further tax or compliance support is required.",
    ],
    faqs: [
      {
        question: "Is accounting the same as bookkeeping?",
        answer:
          "No. Bookkeeping focuses on maintaining transaction records and reconciliations. Accounting uses those records to prepare statements, management reports and other financial information. A business may need both.",
      },
      {
        question: "Can you help if our records are behind?",
        answer:
          "Yes. The request can include accounting record clean-up or historical work. The professional will first assess what records are available and what needs to be reconstructed or completed.",
      },
      {
        question: "Can accounting support connect to tax work?",
        answer:
          "Yes. Reliable accounting records often support company tax returns and other compliance work. Where tax assistance is also required, the relevant SARS service can be handled as a separate or connected request.",
      },
    ],
    relatedLinks: [
      { label: "Bookkeeping Services", href: "/bookkeeping-services" },
      { label: "Company Tax Returns", href: "/tax-returns" },
      { label: "CIPC & Company Compliance", href: "/cipc-company-compliance" },
      { label: "SARS & Tax Assistance", href: "/sars-tax-assistance" },
    ],
  },
  bookkeeping: {
    path: "/bookkeeping-services",
    eyebrow: "Bookkeeping Services",
    title: "Professional Bookkeeping Services Across South Africa",
    description:
      "Keep your business records accurate and up to date with professional bookkeeping and transaction-recording support.",
    metaDescription:
      "Bookkeeping services for South African businesses, including transaction recording, reconciliations, record clean-up and ongoing monthly bookkeeping support.",
    intro:
      "Consistent bookkeeping creates the foundation for reliable management accounts, financial statements and tax submissions. Acapolite connects businesses with professionals who can help maintain and organise their financial records.",
    services: [
      "Monthly bookkeeping",
      "Bank and transaction reconciliations",
      "Ledger maintenance",
      "Supplier and customer record support",
      "Historical bookkeeping clean-up",
      "Preparation of records for accountants and tax practitioners",
      "Payroll record support",
      "Ongoing bookkeeping assistance",
    ],
    whyItMatters:
      "Incomplete or inconsistent records can delay financial statements and tax submissions. Regular bookkeeping reduces catch-up work and gives the business a clearer view of income, expenses and outstanding items.",
    ctaTitle: "Get your books up to date",
    ctaBody:
      "Submit your bookkeeping request and provide the period and type of assistance you need.",
    audience: [
      "Small and growing businesses that need monthly books kept up to date",
      "Businesses preparing records for an accountant or tax practitioner",
      "Companies with unreconciled bank, customer or supplier transactions",
      "Businesses that need historical bookkeeping catch-up or clean-up",
    ],
    process: [
      "Specify the period, volume of records and whether the work is current or historical.",
      "Provide the available bank statements, invoices, receipts and accounting-system records.",
      "The professional records and reconciles transactions within the agreed scope.",
      "Outstanding items are identified so the books can support accounting, tax and management reporting.",
    ],
    faqs: [
      {
        question: "What records are normally needed for bookkeeping?",
        answer:
          "The exact list depends on the business, but it commonly starts with bank statements, sales and purchase records, invoices, receipts and any existing accounting-system data.",
      },
      {
        question: "Can you catch up several months of bookkeeping?",
        answer:
          "Yes. Historical clean-up can be requested. The scope depends on how many periods are outstanding and the quality and completeness of the available records.",
      },
      {
        question: "What happens after the books are up to date?",
        answer:
          "The records can then support management accounts, financial statements and tax work where those services are required.",
      },
    ],
    relatedLinks: [
      { label: "Accounting Services", href: "/accounting-services" },
      { label: "Tax Returns", href: "/tax-returns" },
      { label: "VAT Services", href: "/vat-services" },
      { label: "SARS & Tax Assistance", href: "/sars-tax-assistance" },
    ],
  },
  cipc: {
    path: "/cipc-company-compliance",
    eyebrow: "CIPC & Company Compliance",
    title: "CIPC & Company Compliance Support",
    description:
      "Get professional assistance with company registration, amendments, annual returns, beneficial ownership and ongoing company compliance.",
    metaDescription:
      "CIPC and company compliance support across South Africa for registrations, amendments, annual returns, beneficial ownership and business compliance.",
    intro:
      "Company compliance can involve several CIPC filings and supporting documents. Acapolite provides a structured way to request assistance with company records, statutory updates and ongoing compliance requirements.",
    services: [
      "Company registration with CIPC",
      "Company amendments and updates",
      "Annual returns filing",
      "Beneficial ownership filings",
      "Company information and record updates",
      "Business compliance support",
      "Regulatory filing assistance",
      "General company administration support",
    ],
    whyItMatters:
      "CIPC requires companies and close corporations to keep annual-return and beneficial-ownership filings current. Its current process links beneficial ownership and AFS/FAS compliance to annual-return filing, and non-compliance can lead to penalties, enforcement action or deregistration. The required process depends on the entity and the specific filing or company change involved.",
    ctaTitle: "Request CIPC or company compliance help",
    ctaBody:
      "Submit your request and select the company or business-support service that applies.",
    audience: [
      "New businesses that need company registration assistance",
      "Companies or close corporations with annual returns to file",
      "Entities that need beneficial ownership information filed or updated",
      "Businesses that need company-record amendments or compliance catch-up",
    ],
    process: [
      "Identify the entity and the CIPC filing or company change required.",
      "Review the company information and supporting records needed for that transaction.",
      "Prepare or complete the applicable CIPC filing and resolve missing information with you.",
      "Keep the filing confirmation or updated company records as evidence of the completed transaction.",
    ],
    faqs: [
      {
        question: "Do companies and close corporations need to file annual returns?",
        answer:
          "Yes. CIPC requires annual returns every year. For companies, CIPC states that annual returns must be filed within 30 business days after the anniversary date; close corporations follow the applicable annual-return filing period.",
      },
      {
        question: "How does beneficial ownership affect annual returns?",
        answer:
          "CIPC currently requires the latest beneficial ownership declaration to be submitted and up to date before the annual return can be completed. CIPC also requires the applicable AFS or FAS with the annual-return process.",
      },
      {
        question: "Can Acapolite help with more than one CIPC issue at once?",
        answer:
          "Yes. Describe all required changes or outstanding filings in the request so the professional can identify the correct sequence and supporting documents.",
      },
    ],
    officialSources: [
      { label: "CIPC — Annual Return Filing System", href: "https://annualreturns.cipc.co.za/" },
      { label: "CIPC — Beneficial Ownership", href: "https://www.cipc.co.za/?page_id=16055" },
      { label: "CIPC — Annual Returns & Beneficial Ownership Compliance", href: "https://www.cipc.co.za/?p=22211" },
    ],
    reviewedDate: "25 September 2026",
    relatedLinks: [
      { label: "Accounting Services", href: "/accounting-services" },
      { label: "Tax Returns", href: "/tax-returns" },
    ],
  },
  returns: {
    path: "/tax-returns",
    eyebrow: "Tax Returns",
    title: "Personal & Company Tax Return Assistance",
    description:
      "Get professional assistance with personal income tax returns, company tax returns, late submissions and related SARS compliance matters.",
    metaDescription:
      "Tax return assistance across South Africa for ITR12, ITR14, late returns and related SARS compliance support.",
    intro:
      "Whether you need help with a current return or have outstanding submissions from prior periods, Acapolite can connect you with a tax professional to review the position and prepare the required filing support.",
    services: [
      "Personal income tax returns (ITR12)",
      "Company income tax returns (ITR14)",
      "Late tax return submissions",
      "Review of outstanding return periods",
      "Supporting document preparation",
      "Tax compliance follow-up",
      "SARS notice and assessment review",
      "Related VAT or PAYE return support where applicable",
    ],
    whyItMatters:
      "Return requirements vary by taxpayer type and period. Outstanding returns can also affect tax compliance status and other SARS processes, so it is important to identify all affected periods before work begins.",
    ctaTitle: "Get help with your tax returns",
    ctaBody:
      "Submit your request, indicate the tax years or periods involved, and tell us whether you have access to SARS eFiling.",
    audience: [
      "Individuals who need help reviewing or submitting an ITR12",
      "Companies that need assistance preparing and submitting an ITR14",
      "Taxpayers with late or outstanding income-tax returns",
      "Taxpayers who need supporting records organised before filing",
    ],
    process: [
      "Identify the taxpayer type and the tax year or outstanding periods involved.",
      "Review the available SARS information and supporting records.",
      "Prepare the return information and resolve missing items before submission.",
      "After filing, review the resulting SARS assessment or follow-up request where further assistance is required.",
    ],
    faqs: [
      {
        question: "What is an ITR12?",
        answer:
          "SARS uses ITR12 for the Income Tax Return for Individuals. The filing requirement and information needed depend on the taxpayer's circumstances for the relevant year of assessment.",
      },
      {
        question: "What is an ITR14?",
        answer:
          "ITR14 is the SARS Income Tax Return for Companies. SARS provides the company return electronically through eFiling.",
      },
      {
        question: "Can you help with a previous year's return?",
        answer:
          "Yes. Previous-year return availability depends on the taxpayer profile and the periods SARS has made available. Tell us which years are outstanding so the practitioner can review the full filing position.",
      },
      {
        question: "What if SARS has already issued an assessment?",
        answer:
          "The assessment should be reviewed separately from preparing the return. If the issue is an assessment or decision you disagree with, the SARS objections and disputes process may be relevant.",
      },
    ],
    officialSources: [
      {
        label: "SARS — How to submit an Income Tax Return (ITR12)",
        href: "https://www.sars.gov.za/individuals/how-do-i-send-sars-my-return/how-to-submit-an-income-tax-return-itr12-in-respect-of-individuals/",
      },
      {
        label: "SARS — Guide to Complete the Company Income Tax Return (ITR14)",
        href: "https://www.sars.gov.za/guide-to-complete-the-income-tax-return-itr14-for-companies/",
      },
    ],
    reviewedDate: "23 September 2026",
    relatedLinks: [
      { label: "SARS & Tax Assistance", href: "/sars-tax-assistance" },
      { label: "SARS Objections & Disputes", href: "/sars-objections" },
      { label: "Accounting Services", href: "/accounting-services" },
      { label: "Provisional Tax & IRP6", href: "/provisional-tax" },
    ],
  },
  provisionalTax: {
    path: "/provisional-tax",
    eyebrow: "Provisional Tax & IRP6",
    title: "Provisional Tax & IRP6 Assistance",
    description:
      "Get professional help determining whether you're a provisional taxpayer, preparing accurate IRP6 estimates for both payment periods, and avoiding SARS underestimation and late-payment penalties.",
    metaDescription:
      "Professional help determining provisional taxpayer status, preparing accurate IRP6 estimates for the first and second payment periods, and avoiding SARS underestimation and late-payment penalties across South Africa.",
    intro:
      "Provisional tax is a method of paying income tax in advance rather than a separate tax - it applies to income not already taxed through PAYE, such as freelance, rental, investment or other business income, and to every company. Getting the estimate right on each IRP6 return matters, since SARS can charge a penalty where an estimate falls materially short of actual taxable income for the year.",
    services: [
      "Provisional taxpayer status assessment",
      "First and second IRP6 estimate preparation",
      "Voluntary third (top-up) payment calculations",
      "Review of income from freelance, rental, investment and directorship sources",
      "Correction of a missed or incorrect IRP6 submission",
      "Underestimation and late-payment penalty risk review",
    ],
    whyItMatters:
      "Provisional tax estimates are checked against actual taxable income once the annual return is assessed. Falling short of the required percentage - 90% of actual taxable income, or the escalated basic amount, whichever is lower, where actual taxable income is R1 million or less, or 80% of actual taxable income above that - can trigger a penalty of 20% of the tax on the shortfall, on top of any late-payment penalty and interest. Getting the estimate right the first time, for each period, avoids this.",
    ctaTitle: "Get help with your provisional tax",
    ctaBody:
      "Tell us about your income sources and the periods involved, and a practitioner will help assess your provisional taxpayer status and prepare your IRP6 estimate.",
    audience: [
      "Freelancers, consultants and sole proprietors earning income without PAYE withheld",
      "Landlords and anyone earning rental income",
      "Individuals with material investment or other non-remuneration income",
      "Directors who separately earn non-remuneration business income",
      "Companies, which are automatically provisional taxpayers",
    ],
    process: [
      "Confirm whether the taxpayer meets SARS's current provisional-taxpayer criteria, or falls within an exclusion.",
      "Review the income sources and prior assessments needed to prepare an accurate estimate.",
      "Prepare and submit the IRP6 for the applicable period via eFiling.",
      "Where useful, calculate a voluntary third top-up payment once actual figures are known, to limit interest before the annual return is assessed.",
    ],
    faqs: [
      {
        question: "Who has to pay provisional tax?",
        answer:
          "SARS treats as a provisional taxpayer any person, other than a company, who earns income other than remuneration or an allowance or advance under section 8(1), or remuneration from an employer not registered for employees' tax; every company; anyone SARS has directly notified; and certain labour brokers. Freelance, rental, investment and other non-PAYE income commonly trigger provisional status.",
      },
      {
        question: "Who is excluded from provisional tax?",
        answer:
          "A natural person is excluded if their taxable income from interest, dividends, rental and non-PAYE-employer remuneration doesn't exceed R30,000 for the year, or if their total taxable income doesn't exceed the tax threshold for their age group for the relevant year of assessment. Approved public benefit organisations, certain exempt bodies and deceased estates are also excluded.",
      },
      {
        question: "When are the first and second provisional tax payments due?",
        answer:
          "The first payment is due within six months of the start of the taxpayer's year of assessment, and the second no later than the last day of that year of assessment. These dates always follow the taxpayer's own year of assessment rather than a universal calendar date - for the common February year-end, used here only as an example, that works out to roughly end-August and end-February.",
      },
      {
        question: "What is the voluntary third (\"top-up\") payment?",
        answer:
          "It's an optional payment made after year-end, once actual figures are known but before the annual return is assessed, to correct an earlier estimate that turned out too low and reduce the interest that would otherwise accrue. It isn't itself a compliance requirement.",
      },
      {
        question: "What happens if a provisional tax estimate is too low?",
        answer:
          "Where actual taxable income is R1 million or less, the estimate must reach at least 90% of actual taxable income, or the escalated basic amount if lower, to avoid a penalty. Above R1 million, the threshold is 80% of actual taxable income. Falling short can trigger a penalty of 20% of the tax on the shortfall.",
      },
      {
        question: "What if a provisional tax payment is late?",
        answer:
          "A late first or second-period payment can attract a 10% late-payment penalty, in addition to interest at SARS's currently-prescribed rate on the outstanding amount.",
      },
    ],
    officialSources: [
      { label: "SARS — Provisional Tax", href: "https://www.sars.gov.za/types-of-tax/provisional-tax/" },
      { label: "SARS — Guide to Provisional Tax", href: "https://www.sars.gov.za/guide-to-provisional-tax/" },
      { label: "SARS — How to eFile Your Provisional Tax Return", href: "https://www.sars.gov.za/how-to-efile-your-provisional-tax-return/" },
    ],
    reviewedDate: "25 September 2026",
    relatedLinks: [
      { label: "SARS & Tax Assistance", href: "/sars-tax-assistance" },
      { label: "Tax Returns", href: "/tax-returns" },
      { label: "Provisional Tax & IRP6 Guide", href: "/tax-guides/provisional-tax-irp6-guide" },
    ],
  },
  help: {
    path: "/request-professional-help",
    eyebrow: "Professional Business Support",
    title: "Get Professional Tax, Accounting & Business Help",
    description:
      "Submit one secure request for tax, SARS, accounting, bookkeeping, CIPC or business compliance assistance.",
    metaDescription:
      "Request professional tax, SARS, accounting, bookkeeping, CIPC and business support through Acapolite Consulting across South Africa.",
    intro:
      "Acapolite Consulting brings tax, accounting and business-support requests into one structured platform. Choose the type of assistance you need and provide the information required for a professional to understand your request.",
    services: [
      "SARS and tax assistance",
      "Personal and company tax returns",
      "Accounting services",
      "Bookkeeping",
      "VAT and PAYE support",
      "CIPC and company compliance",
      "Payroll and financial reporting",
      "General business support",
    ],
    whyItMatters:
      "A structured service request helps route your matter to the right professional and gives them enough context to understand the scope, urgency and documents that may be required.",
    ctaTitle: "Submit your request",
    ctaBody:
      "Choose the services you need, provide your details and submit the request securely through Acapolite.",
    // Paid-traffic (Google Ads) landing page, not an organic SEO page — see
    // the PR4 report for the reasoning. Kept fully functional (indexable
    // routing, canonical, Ads attribution, lead submission all unchanged);
    // only excluded from organic indexation and the sitemap.
    robots: "noindex, follow",
  },
};

/**
 * The exact Service + BreadcrumbList schema a service landing page renders.
 * Exported so the build-time raw-HTML seeding step (scripts/generate-route-html.mjs)
 * calls the same function with the same config, rather than re-deriving the
 * schema from scratch - the two can never drift apart.
 */
export function buildServiceLandingPageSchemas(config: LandingPageConfig) {
  return [
    buildServiceSchema({
      name: config.title,
      description: config.metaDescription,
      path: config.path,
    }),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Our Services", path: "/our-services" },
      { name: config.eyebrow, path: config.path },
    ]),
  ];
}

function ServiceLandingPage({ config }: { config: LandingPageConfig }) {
  useSeo({
    title: `${config.title} | Acapolite Consulting`,
    description: config.metaDescription,
    path: config.path,
    ...(config.robots ? { robots: config.robots } : {}),
  });

  const schemas = buildServiceLandingPageSchemas(config);

  return (
    <>
    {schemas.map((data, index) => (
      <JsonLd key={index} data={data} />
    ))}
    <PublicPageLayout
      eyebrow={config.eyebrow}
      title={config.title}
      description={config.description}
      maxWidthClassName="max-w-6xl"
    >
      <div className="space-y-10 font-body">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/our-services">Our Services</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{config.eyebrow}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <section className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <h2 className="text-xl font-semibold text-foreground">How Acapolite can help</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
              {config.intro}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {config.services.map((service) => (
                <div
                  key={service}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-4"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm leading-6 text-foreground">{service}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[28px] border border-primary/15 bg-primary/5 p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Start here
            </p>
            <h2 className="mt-3 font-display text-2xl text-foreground">{config.ctaTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{config.ctaBody}</p>
            <Button asChild className="mt-6 w-full rounded-xl">
              <Link to={`/request-tax-assistance?step=1&intent=${requestIntentByPath[config.path] ?? "sars"}&from=${encodeURIComponent(config.path)}`}>
                Submit a Service Request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="mt-3 w-full rounded-xl">
              <Link to="/our-services">View All Services</Link>
            </Button>
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Secure &amp; confidential — your details are only shared with verified professionals who respond to your request.
            </p>
          </aside>
        </section>

        {config.audience && (
          <section>
            <h2 className="text-lg font-semibold text-foreground">Who this service is for</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {config.audience.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm leading-6 text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {config.process && (
          <section className="rounded-[28px] border border-border bg-muted/30 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-foreground">How the service works</h2>
            <ol className="mt-4 space-y-3">
              {config.process.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {config.relatedLinks && (
          <section className="rounded-[28px] border border-primary/15 bg-primary/5 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-foreground">
              {config.path === "/sars-tax-assistance" ? "SARS debt & dispute guidance" : "Related services"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose the specialist page that best matches the next part of your request.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {config.relatedLinks.map((item) => (
                <Link key={item.href} to={item.href} className="inline-flex items-center justify-between rounded-xl border border-border bg-background/70 p-4 text-sm font-semibold text-primary hover:underline">
                  {item.label}<ArrowRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[28px] border border-border bg-muted/30 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-foreground">Why the details matter</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
            {config.whyItMatters}
          </p>
        </section>

        {config.faqs && (
          <section>
            <h2 className="text-lg font-semibold text-foreground">Common questions</h2>
            <div className="mt-4 space-y-5">
              {config.faqs.map((faq) => (
                <div key={faq.question}>
                  <h3 className="font-semibold text-foreground">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {config.reviewedDate && (
          <section className="rounded-2xl border border-border bg-background/70 p-5 sm:p-6">
            <p className="text-sm font-semibold text-foreground">
              Reviewed by Registered Tax Practitioner (SA)™
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Practitioner review supports the tax-process guidance on this page.{" "}
              <Link to="/about-us" className="font-medium text-primary hover:underline">Learn about Acapolite and its leadership</Link>.
            </p>
          </section>
        )}

        {config.officialSources && (
          <section className="rounded-2xl border border-border bg-muted/30 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Official sources reviewed</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Process information on this page was checked against the following primary sources
              {config.reviewedDate ? ` on ${config.reviewedDate}` : ""}.
            </p>
            <ul className="mt-4 space-y-2">
              {config.officialSources.map((source) => (
                <li key={source.href}>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    {source.label}<ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-[28px] border border-border p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-foreground">What happens after you submit?</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              ["1", "Submit your request", "Choose the relevant services and provide the details of the matter."],
              ["2", "Professional review", "Your request can be reviewed by qualified professionals who provide the selected services."],
              ["3", "Continue securely", "Use the Acapolite platform to communicate, share documents and track the matter."],
            ].map(([number, title, body]) => (
              <div key={number} className="rounded-2xl bg-background/60 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {number}
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs leading-5 text-muted-foreground">
          Information on this page is general service information. The appropriate process depends on the facts,
          records and compliance position relevant to each request.
        </p>
      </div>
    </PublicPageLayout>
    </>
  );
}

export function SarsTaxAssistanceLandingPage() {
  return <ServiceLandingPage config={configs.sars} />;
}

export function VatServicesLandingPage() {
  return <ServiceLandingPage config={configs.vat} />;
}

export function AccountingServicesLandingPage() {
  return <ServiceLandingPage config={configs.accounting} />;
}

export function BookkeepingServicesLandingPage() {
  return <ServiceLandingPage config={configs.bookkeeping} />;
}

export function CipcComplianceLandingPage() {
  return <ServiceLandingPage config={configs.cipc} />;
}

export function TaxReturnsLandingPage() {
  return <ServiceLandingPage config={configs.returns} />;
}

export function ProfessionalHelpLandingPage() {
  return <ServiceLandingPage config={configs.help} />;
}

export function ProvisionalTaxLandingPage() {
  return <ServiceLandingPage config={configs.provisionalTax} />;
}
