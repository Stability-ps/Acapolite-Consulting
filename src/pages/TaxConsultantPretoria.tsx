import { ArrowRight, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/JsonLd";
import { useSeo } from "@/hooks/useSeo";
import { buildBreadcrumbSchema } from "@/lib/structuredData";

const services = [
  ["SARS debt assistance", "/sars-debt"],
  ["Payment arrangements", "/sars-payment-arrangements"],
  ["Tax debt compromise", "/sars-compromise"],
  ["Objections and appeals", "/sars-objections"],
  ["VAT services", "/vat-services"],
  ["Tax returns", "/tax-returns"],
  ["Accounting services", "/accounting-services"],
  ["Bookkeeping", "/bookkeeping-services"],
];

const faqs = [
  {
    question: "Do I need to visit an office in Pretoria?",
    answer: "No. Acapolite can assist Pretoria clients remotely through the platform, email, phone and secure document sharing. If a SARS process requires a branch interaction, the appropriate SARS process is identified for the specific case.",
  },
  {
    question: "Can you help with SARS debt in Pretoria?",
    answer: "Yes. Assistance can include account review, payment arrangements, compromise preparation where appropriate, and identifying whether a dispute or suspension-of-payment process is relevant.",
  },
  {
    question: "Do you assist businesses as well as individuals?",
    answer: "Yes. Acapolite supports individuals and businesses with SARS, tax, VAT, accounting, bookkeeping and company-compliance matters.",
  },
  {
    question: "Are services limited to Pretoria?",
    answer: "No. This page is for Pretoria clients, but Acapolite serves clients across South Africa.",
  },
];

/** The page's real H1 text - shared with the build-time raw-HTML seeding in scripts/generate-route-html.mjs so the two can never drift apart. */
export const TAX_CONSULTANT_PRETORIA_H1 = "Tax Consultant Pretoria";

/** Exported so scripts/generate-route-html.mjs seeds the identical breadcrumb schema. */
export function buildTaxConsultantPretoriaSchemas() {
  return [
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Tax Consultant Pretoria", path: "/tax-consultant-pretoria" },
    ]),
  ];
}

export default function TaxConsultantPretoria() {
  useSeo({
    title: "Tax Consultant Pretoria | SARS, Tax & Accounting Support | Acapolite",
    description: "Tax consultant support for Pretoria individuals and businesses. Get help with SARS debt, objections, VAT, tax returns, accounting and bookkeeping from a Registered Tax Practitioner (SA)™.",
    path: "/tax-consultant-pretoria",
  });

  return (
    <PublicPageLayout
      eyebrow="Pretoria tax support"
      title={TAX_CONSULTANT_PRETORIA_H1}
      description="Professional tax, SARS and accounting support for individuals and businesses in Pretoria, with secure remote service available across South Africa."
      maxWidthClassName="max-w-5xl"
    >
      {buildTaxConsultantPretoriaSchemas().map((data, index) => (
        <JsonLd key={index} data={data} />
      ))}

      <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border border-border bg-background p-6 sm:p-8">
          <div className="flex items-center gap-2 text-primary">
            <MapPin className="h-5 w-5" />
            <span className="text-sm font-semibold">Pretoria, Gauteng</span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-foreground">Tax and SARS assistance built around the actual issue</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Acapolite helps Pretoria taxpayers and businesses understand what SARS is asking for, what process applies, and what documents are needed before a submission is prepared. The service is remote-first, so support is not limited by travel or branch appointments.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              "Registered Tax Practitioner (SA)™ review",
              "SARS debt and dispute support",
              "VAT, returns and compliance assistance",
              "Secure document and case workflow",
            ].map((item) => (
              <div key={item} className="flex gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild><Link to="/request-tax-assistance?step=1">Request tax assistance</Link></Button>
            <Button asChild variant="outline"><Link to="/sars-tax-assistance">View SARS services</Link></Button>
          </div>
        </div>

        <aside className="rounded-3xl border border-border bg-muted/30 p-6 sm:p-8">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">What Pretoria clients can get help with</h2>
          <div className="mt-5 grid gap-3">
            {services.map(([label, href]) => (
              <Link key={href} to={href} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:border-primary/30 hover:text-primary">
                {label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-foreground">When to speak to a tax consultant</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {[
            ["You owe SARS and cannot pay in full", "The right next step may be payment, a payment arrangement, a compromise application, or a dispute-related process depending on the debt and facts."],
            ["You disagree with an assessment", "The assessment, reasons process, objection deadline and supporting records should be reviewed before a dispute is submitted."],
            ["A VAT refund is delayed", "Check the VAT return, verification or audit correspondence, banking details, outstanding returns, debt set-off and prior SARS case references."],
            ["Your tax or accounting records are behind", "Bookkeeping, tax returns, VAT, payroll and accounting records can be brought into a structured compliance workflow rather than treated as isolated tasks."],
          ].map(([heading, body]) => (
            <article key={heading} className="rounded-2xl border border-border bg-background p-6">
              <h3 className="font-semibold text-foreground">{heading}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-3xl border border-border bg-muted/30 p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-foreground">Pretoria service area, nationwide capability</h2>
        <p className="mt-3 leading-7 text-muted-foreground">
          Acapolite assists clients in Pretoria, including Pretoria East, Centurion and surrounding areas, while the platform also serves taxpayers and businesses elsewhere in South Africa. We do not rely on city-specific duplicated pages; this page exists to make the Pretoria service area clear while keeping the same national professional standards and service process.
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          For SARS process guidance and detailed educational material, visit the <Link to="/tax-guides" className="font-medium text-primary hover:underline">SARS &amp; Tax Guides</Link>.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-foreground">Frequently asked questions</h2>
        <div className="mt-5 space-y-4">
          {faqs.map((faq) => (
            <details key={faq.question} className="rounded-2xl border border-border bg-background p-5">
              <summary className="cursor-pointer font-semibold text-foreground">{faq.question}</summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-3xl border border-primary/20 bg-primary/5 p-6 text-center sm:p-8">
        <h2 className="text-2xl font-semibold text-foreground">Need tax help in Pretoria?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Start with the issue, tax type and SARS correspondence you have. Acapolite can then route the matter to the appropriate professional workflow.
        </p>
        <Button asChild className="mt-5"><Link to="/request-tax-assistance?step=1">Request assistance</Link></Button>
      </section>

      <p className="mt-8 text-xs leading-5 text-muted-foreground">
        General information only. Acapolite Consulting is an independent professional services platform and is not affiliated with or endorsed by SARS.
      </p>
    </PublicPageLayout>
  );
}
