import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SEO } from "@/components/seo/SEO";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { Button } from "@/components/ui/button";

type ServiceCategory = {
  title: string;
  body: string;
  href: string;
  linkLabel: string;
};

const categories: ServiceCategory[] = [
  {
    title: "SARS & Tax Assistance",
    body: "Get support with SARS matters affecting individuals and businesses, including tax debt, payment arrangements, compromise applications, objections and disputes. Start with the SARS hub for the appropriate specialist guidance and assistance route.",
    href: "/sars-tax-assistance",
    linkLabel: "View SARS & Tax Assistance",
  },
  {
    title: "SARS Tax Compliance Status",
    body: "Get help identifying and resolving issues affecting SARS Tax Compliance Status, including outstanding returns, debt and related account matters.",
    href: "/sars-tax-compliance-status",
    linkLabel: "View Tax Compliance Support",
  },
  {
    title: "SARS Audit & Verification",
    body: "Get professional assistance reviewing SARS verification or audit letters, organising supporting documents and responding to the tax period under review.",
    href: "/sars-audit-verification",
    linkLabel: "View Audit & Verification Support",
  },
  {
    title: "PAYE, UIF & SDL",
    body: "Get employer payroll-tax support for PAYE, UIF, SDL, EMP201-related matters, outstanding periods and payroll record reconciliation.",
    href: "/paye-uif-sdl-services",
    linkLabel: "View PAYE, UIF & SDL Services",
  },
  {
    title: "VAT Services",
    body: "Get professional assistance with VAT registration, VAT201 returns, compliance, SARS verification and audit requests, and VAT refund matters.",
    href: "/vat-services",
    linkLabel: "View VAT Services",
  },
  {
    title: "Tax Returns",
    body: "Get help preparing and submitting personal income tax returns (ITR12) and company tax returns (ITR14), including late or outstanding submissions from prior years.",
    href: "/tax-returns",
    linkLabel: "View Tax Returns",
  },
  {
    title: "Accounting Services",
    body: "Get professional support turning your business records into financial statements, management accounts, payroll and reporting you can use for decisions, funding or compliance.",
    href: "/accounting-services",
    linkLabel: "View Accounting Services",
  },
  {
    title: "Bookkeeping",
    body: "Get help keeping day-to-day transactions, reconciliations and ledgers accurate and up to date. Bookkeeping maintains the records; accounting turns those records into statements and reports — most businesses need both, often from the same practitioner.",
    href: "/bookkeeping-services",
    linkLabel: "View Bookkeeping",
  },
  {
    title: "CIPC & Company Compliance",
    body: "Get assistance with company registration, amendments, annual returns and beneficial ownership filings, and other CIPC and company compliance requirements.",
    href: "/cipc-company-compliance",
    linkLabel: "View CIPC & Company Compliance",
  },
];

/** The page's real H1 text - shared with the build-time raw-HTML seeding in scripts/generate-route-html.mjs so the two can never drift apart. */
export const OUR_SERVICES_H1 = "Our Services — Acapolite Consulting";

export default function OurServices() {
  return (
    <>
      <SEO
        title="Our Services | Acapolite Consulting"
        description="Browse Acapolite Consulting's tax, SARS, accounting, bookkeeping and company compliance services and find the right specialist page for your request."
        path="/our-services"
      />
      <PublicPageLayout
        eyebrow="Company"
        title={OUR_SERVICES_H1}
        description="Acapolite Consulting connects individuals and businesses with qualified tax practitioners and accounting professionals. Browse the categories below and go to the specialist page for the service you need, or submit a request and let a professional confirm the best fit."
      >
        <div className="space-y-10 text-sm text-foreground font-body">
          <section className="grid gap-5 sm:grid-cols-2">
            {categories.map((category) => (
              <div
                key={category.href}
                className="flex flex-col rounded-2xl border border-border bg-background/60 p-5"
              >
                <h2 className="text-base font-semibold text-foreground">{category.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{category.body}</p>
                <Link
                  to={category.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  {category.linkLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-border bg-muted/30 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Business Support</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              If your request doesn't fit neatly into one category above — for example, a business that needs
              more than one service at once, or a general compliance question — submit a service request and
              describe what you need. Your request can be routed to a practitioner who covers the relevant
              area(s).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">How to Request a Service</h2>
            <ul className="mt-3 list-disc pl-5 text-muted-foreground">
              <li>Create your client account</li>
              <li>Select the service you require</li>
              <li>Submit your service request</li>
              <li>Upload required documents</li>
              <li>Choose a qualified practitioner</li>
              <li>Track your case progress</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Why Choose Acapolite Consulting</h2>
            <ul className="mt-3 list-disc pl-5 text-muted-foreground">
              <li>Access qualified and verified tax practitioners</li>
              <li>Secure communication and document handling</li>
              <li>Real-time case tracking</li>
              <li>Reliable support for individuals and businesses</li>
              <li>Professional service delivery standards</li>
            </ul>
          </section>

          <section className="rounded-[28px] border border-primary/15 bg-primary/5 p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Start here</p>
            <h2 className="mt-3 font-display text-xl text-foreground sm:text-2xl">
              Not sure which service you need?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Choose a category above, or submit a service request directly and a practitioner will confirm
              the best fit for your matter.
            </p>
            <Button asChild className="mt-6 w-full rounded-xl sm:w-auto">
              <Link to="/request-tax-assistance">
                Submit a Service Request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </section>
        </div>
      </PublicPageLayout>
    </>
  );
}
