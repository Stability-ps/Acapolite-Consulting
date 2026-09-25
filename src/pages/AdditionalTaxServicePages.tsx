import { Fragment } from "react";
import { ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/JsonLd";
import { useSeo } from "@/hooks/useSeo";
import { buildBreadcrumbSchema, buildServiceSchema } from "@/lib/structuredData";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Crumb = { name: string; path?: string };

type PageConfig = {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  metaDescription: string;
  intro: string;
  services: string[];
  process: string[];
  faqs: { question: string; answer: string }[];
  sources: { label: string; href: string }[];
  related: { label: string; href: string }[];
  crumbs: Crumb[];
};

const configs: Record<string, PageConfig> = {
  compliance: {
    path: "/sars-tax-compliance-status",
    eyebrow: "SARS Tax Compliance",
    title: "SARS Tax Compliance Status & TCS Assistance",
    description: "Professional assistance with SARS tax compliance status, outstanding compliance issues and Tax Compliance Status requests.",
    metaDescription: "Get help with SARS Tax Compliance Status (TCS), outstanding returns, debt and compliance issues affecting your South African tax status.",
    intro: "A tax compliance problem can arise from outstanding returns, debt or other SARS account issues. Acapolite can help review the taxpayer's position, identify the items affecting compliance and prepare the appropriate next steps.",
    services: ["Tax Compliance Status review", "Outstanding return identification", "Tax debt and arrangement review", "TCS request support", "SARS account and notice review", "Compliance follow-up after corrective action"],
    process: ["Review the taxpayer profile and the compliance issue shown by SARS.", "Identify outstanding returns, debt or other items requiring action.", "Complete the relevant return, debt, dispute or account process within the agreed scope.", "Recheck the compliance position and address any remaining SARS requirements."],
    faqs: [
      { question: "What can affect SARS tax compliance status?", answer: "SARS tax compliance depends on the taxpayer's current compliance position. Outstanding returns and tax debt are common issues that may need to be resolved or appropriately managed." },
      { question: "Can tax debt be dealt with without paying everything immediately?", answer: "Depending on the facts, SARS debt may need to be paid, placed under an approved payment arrangement, addressed through another debt process, or disputed where there is a valid basis." },
      { question: "Can Acapolite help identify why my status is not compliant?", answer: "Yes. The starting point is reviewing the SARS profile, tax types, outstanding items and relevant notices so the underlying issue can be identified." },
    ],
    sources: [{ label: "SARS — Tax Compliance Status", href: "https://www.sars.gov.za/individuals/manage-your-tax-compliance-status/" }],
    related: [{ label: "SARS Debt Help", href: "/sars-debt" }, { label: "Payment Arrangements", href: "/sars-payment-arrangements" }, { label: "Tax Returns", href: "/tax-returns" }, { label: "SARS & Tax Assistance", href: "/sars-tax-assistance" }],
    crumbs: [{ name: "Home", path: "/" }, { name: "SARS & Tax Assistance", path: "/sars-tax-assistance" }, { name: "Tax Compliance Status" }],
  },
  audit: {
    path: "/sars-audit-verification",
    eyebrow: "SARS Audit & Verification",
    title: "SARS Audit & Verification Assistance",
    description: "Professional help responding to SARS verification, audit and supporting-document requests for individuals and businesses.",
    metaDescription: "Get professional help with SARS verification, audit letters and supporting documents. Review the request, tax period, records and response before submission.",
    intro: "A SARS verification or audit should be handled according to the actual notice, tax type, period and records requested. Acapolite can help organise the response, review supporting documents and identify follow-up steps after SARS issues an outcome.",
    services: ["Review of SARS verification and audit letters", "Supporting-document preparation", "VAT verification assistance", "Income-tax verification support", "Document and period reconciliation", "Review of SARS audit or verification outcomes"],
    process: ["Read the SARS notice and confirm the tax type, period, deadline and documents requested.", "Reconcile the relevant return or assessment to the underlying records.", "Organise and review the supporting documents before submission.", "Review SARS follow-up correspondence or the outcome and determine whether further compliance or dispute action is required."],
    faqs: [
      { question: "Is a SARS verification the same as an audit?", answer: "No. SARS distinguishes verification from audit processes. The notice received and the scope of the review determine what information should be prepared." },
      { question: "What documents should I send SARS?", answer: "The response should follow the SARS notice and the transactions or amounts under review. Sending the correct records for the correct tax period is more important than using a generic document list." },
      { question: "Can you assist with VAT verification?", answer: "Yes. VAT verification support can include checking the VAT period, VAT201 information and supporting records requested by SARS." },
    ],
    sources: [{ label: "SARS — Being Audited or Selected for Verification", href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/being-audited-or-selected-for-verification/" }, { label: "SARS — Upload Supporting Documents", href: "https://www.sars.gov.za/faq/how-do-i-upload-submit-supporting-documents/" }],
    related: [{ label: "VAT Services", href: "/vat-services" }, { label: "VAT Verification Guide", href: "/tax-guides/sars-vat-verification-supporting-documents" }, { label: "SARS Objections", href: "/sars-objections" }, { label: "SARS & Tax Assistance", href: "/sars-tax-assistance" }],
    crumbs: [{ name: "Home", path: "/" }, { name: "SARS & Tax Assistance", path: "/sars-tax-assistance" }, { name: "SARS Audit & Verification" }],
  },
  paye: {
    path: "/paye-uif-sdl-services",
    eyebrow: "Payroll Taxes",
    title: "PAYE, UIF & SDL Compliance Assistance",
    description: "Professional PAYE, UIF and SDL support for South African employers, including payroll-tax compliance, returns and SARS account matters.",
    metaDescription: "PAYE, UIF and SDL assistance for South African employers. Get help with employer tax compliance, payroll records, EMP201 matters and outstanding periods.",
    intro: "Employer tax compliance depends on accurate payroll records and timely declarations and payments. Acapolite can help businesses review PAYE, UIF and SDL matters, identify affected periods and organise the records needed for the appropriate compliance work.",
    services: ["PAYE compliance review", "UIF and SDL payroll-tax support", "EMP201-related assistance", "Outstanding employer-tax period review", "Payroll record reconciliation", "SARS employer account and notice review"],
    process: ["Identify the employer tax type and periods involved.", "Review payroll records, prior declarations and the SARS account information available.", "Reconcile the relevant payroll-tax amounts and prepare the required compliance work within scope.", "Review outstanding balances, notices or follow-up items after submission."],
    faqs: [
      { question: "What does PAYE mean?", answer: "PAYE is employees' tax withheld by an employer from remuneration and paid to SARS in accordance with the applicable employer-tax rules." },
      { question: "Can you help with outstanding EMP201 periods?", answer: "Yes. The affected periods and payroll records should first be identified so the outstanding employer-tax position can be reviewed properly." },
      { question: "Do you also assist with UIF and SDL?", answer: "Yes. PAYE, UIF and SDL can be reviewed together where they form part of the employer's payroll-tax compliance matter." },
    ],
    sources: [{ label: "SARS — PAYE", href: "https://www.sars.gov.za/types-of-tax/pay-as-you-earn/" }],
    related: [{ label: "Accounting Services", href: "/accounting-services" }, { label: "Bookkeeping Services", href: "/bookkeeping-services" }, { label: "SARS & Tax Assistance", href: "/sars-tax-assistance" }, { label: "Tax Compliance Status", href: "/sars-tax-compliance-status" }],
    crumbs: [{ name: "Home", path: "/" }, { name: "SARS & Tax Assistance", path: "/sars-tax-assistance" }, { name: "PAYE, UIF & SDL" }],
  },
};

function ConfigBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb className="mb-8">
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={item.name}>
              <BreadcrumbItem>
                {isLast || !item.path ? (
                  <BreadcrumbPage>{item.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={item.path}>{item.name}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function ServicePage({ config }: { config: PageConfig }) {
  useSeo({ title: `${config.title} | Acapolite Consulting`, description: config.metaDescription, path: config.path });
  const schemaCrumbs = config.crumbs.map((crumb) => ({ name: crumb.name, path: crumb.path ?? config.path }));
  return (
    <PublicPageLayout eyebrow={config.eyebrow} title={config.title} description={config.description} maxWidthClassName="max-w-5xl" backHref="/sars-tax-assistance" backLabel="Back to SARS & Tax Assistance">
      <JsonLd data={buildBreadcrumbSchema(schemaCrumbs)} />
      <JsonLd data={buildServiceSchema({ name: config.title, description: config.metaDescription, path: config.path })} />
      <ConfigBreadcrumbs items={config.crumbs} />
      <section className="rounded-3xl border border-border bg-background p-6 sm:p-8">
        <p className="leading-7 text-muted-foreground">{config.intro}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {config.services.map((item) => <div key={item} className="flex gap-3 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span>{item}</span></div>)}
        </div>
        <Button asChild className="mt-7"><Link to={`/request-tax-assistance?step=1&intent=sars&from=${encodeURIComponent(config.path)}`}>Request assistance<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
      </section>
      <section className="mt-10"><h2 className="text-2xl font-semibold text-foreground">How we approach the matter</h2><ol className="mt-5 grid gap-4 md:grid-cols-2">{config.process.map((item, i) => <li key={item} className="rounded-2xl border border-border bg-background p-5"><span className="text-xs font-semibold text-primary">STEP {i + 1}</span><p className="mt-2 text-sm leading-6 text-muted-foreground">{item}</p></li>)}</ol></section>
      <section className="mt-10"><h2 className="text-2xl font-semibold text-foreground">Frequently asked questions</h2><div className="mt-5 space-y-4">{config.faqs.map((faq) => <details key={faq.question} className="rounded-2xl border border-border bg-background p-5"><summary className="cursor-pointer font-semibold text-foreground">{faq.question}</summary><p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.answer}</p></details>)}</div></section>
      <section className="mt-10 rounded-2xl border border-border bg-muted/30 p-6"><h2 className="text-lg font-semibold text-foreground">Official SARS sources</h2><div className="mt-3 grid gap-2">{config.sources.map((source) => <a key={source.href} href={source.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">{source.label}<ExternalLink className="h-4 w-4" /></a>)}</div></section>
      <section className="mt-8"><h2 className="text-lg font-semibold text-foreground">Related services and guidance</h2><div className="mt-4 flex flex-wrap gap-3">{config.related.map((link) => <Button key={link.href} asChild variant="outline"><Link to={link.href}>{link.label}</Link></Button>)}</div></section>
      <p className="mt-8 text-xs leading-5 text-muted-foreground">Reviewed 24 September 2026. General information only. Acapolite Consulting is independent and is not affiliated with or endorsed by SARS.</p>
    </PublicPageLayout>
  );
}

export const SarsTaxComplianceStatusPage = () => <ServicePage config={configs.compliance} />;
export const SarsAuditVerificationPage = () => <ServicePage config={configs.audit} />;
export const PayeUifSdlServicesPage = () => <ServicePage config={configs.paye} />;
