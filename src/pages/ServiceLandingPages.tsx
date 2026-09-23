import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildServiceSchema } from "@/lib/structuredData";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { Button } from "@/components/ui/button";

type LandingPageConfig = {
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
};

const configs: Record<string, LandingPageConfig> = {
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
      "Review of SARS notices, letters and account issues",
    ],
    whyItMatters:
      "SARS matters often depend on deadlines, supporting evidence and the taxpayer's current compliance position. A properly structured request helps the practitioner identify the relevant tax type, urgency and supporting documents from the start.",
    ctaTitle: "Tell us what SARS assistance you need",
    ctaBody:
      "Submit a secure service request and select the SARS or tax services relevant to your situation.",
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
      "Keeping company information current helps reduce administrative delays and supports broader tax and business compliance. The required process depends on the specific CIPC filing or company change involved.",
    ctaTitle: "Request CIPC or company compliance help",
    ctaBody:
      "Submit your request and select the company or business-support service that applies.",
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

function ServiceLandingPage({ config }: { config: LandingPageConfig }) {
  useSeo({
    title: `${config.title} | Acapolite Consulting`,
    description: config.metaDescription,
    path: config.path,
    ...(config.robots ? { robots: config.robots } : {}),
  });

  return (
    <>
    <JsonLd
      data={buildServiceSchema({
        name: config.title,
        description: config.metaDescription,
        path: config.path,
      })}
    />
    <PublicPageLayout
      eyebrow={config.eyebrow}
      title={config.title}
      description={config.description}
      maxWidthClassName="max-w-6xl"
    >
      <div className="space-y-10 font-body">
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
              <Link to="/request-tax-assistance">
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

        <section className="rounded-[28px] border border-border bg-muted/30 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-foreground">Why the details matter</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
            {config.whyItMatters}
          </p>
        </section>

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
