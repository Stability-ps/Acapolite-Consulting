import { ArrowRight, BookOpen, CheckCircle2, ExternalLink, FileText, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { JsonLd } from "@/components/seo/JsonLd";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { Button } from "@/components/ui/button";
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/structuredData";
import { useSeo } from "@/hooks/useSeo";

const REVIEWED_DATE = "24 September 2026";
const ISO_DATE = "2026-09-24";

type Source = { label: string; href: string };
type Section = { heading: string; paragraphs?: string[]; bullets?: string[] };

type Guide = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  serviceHref: string;
  serviceLabel: string;
  sections: Section[];
  sources: Source[];
};

const guides: Guide[] = [
  {
    slug: "sars-suspension-of-payment-section-164",
    title: "SARS Section 164 Suspension of Payment: What a Tax Dispute Does — and Does Not — Stop",
    description: "A practitioner-reviewed guide to SARS suspension of payment under section 164, including its relationship with objections and appeals and why a dispute does not automatically stop collection.",
    intro: "A tax dispute and a request to suspend payment are related, but they are not the same process. This distinction matters when a taxpayer wants to challenge an assessment while SARS collection activity is possible.",
    serviceHref: "/sars-objections",
    serviceLabel: "SARS objections and dispute assistance",
    sections: [
      {
        heading: "The key distinction",
        paragraphs: [
          "Lodging an objection or appeal does not, by itself, suspend the obligation to pay tax or SARS's right to recover it. Section 164 of the Tax Administration Act provides a separate mechanism through which a taxpayer may request that a senior SARS official suspend payment of disputed tax, or a portion of it, while the dispute is dealt with.",
          "This is why a dispute strategy should consider both tracks: the merits and deadlines of the objection or appeal, and whether a separate suspension-of-payment request is appropriate on the facts."
        ]
      },
      {
        heading: "What SARS considers",
        bullets: [
          "Whether recovery of the disputed tax would be in jeopardy or there is a risk of dissipation of assets.",
          "The taxpayer's compliance history and whether fraud is involved in the origin of the dispute.",
          "Whether payment would result in irreparable financial hardship that is not justified by the prejudice to SARS or the fiscus.",
          "Whether security has been tendered and whether payment has already been made in certain circumstances."
        ]
      },
      {
        heading: "Practical preparation",
        paragraphs: [
          "A request should be fact-specific. The taxpayer should be able to identify the disputed assessment or decision, explain the status of the dispute, and support financial or hardship assertions with documents where those assertions form part of the request.",
          "A suspension is not the same as cancelling the tax debt, compromising it, or obtaining an instalment arrangement. Those mechanisms have different statutory purposes and requirements."
        ]
      }
    ],
    sources: [
      { label: "SARS — Dispute a Tax Assessment or Decision", href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/dispute-a-tax-assessment-or-decision/" },
      { label: "Tax Administration Act 28 of 2011 — section 164", href: "https://www.sars.gov.za/wp-content/uploads/Legal/Acts/LAPD-LPrim-Act-2012-01-Tax-Administration-Act-2011.pdf" }
    ]
  },
  {
    slug: "sars-objection-deadline-guide",
    title: "SARS Objection Deadlines: The 80-Business-Day Rule and What to Check Before Filing",
    description: "Understand the current SARS objection period, requests for reasons, late objections and the records to review before submitting a notice of objection.",
    intro: "Objection deadlines are procedural and can materially affect a taxpayer's dispute rights. The correct starting point is the assessment or decision being challenged and the applicable dispute rules — not a generic calendar-day calculation.",
    serviceHref: "/sars-objections",
    serviceLabel: "Get help with a SARS objection",
    sections: [
      {
        heading: "The current objection period",
        paragraphs: [
          "SARS states that a taxpayer who is dissatisfied with an assessment or certain decisions may object within 80 business days after the date of assessment, or within the period determined under the dispute rules where reasons have been requested.",
          "The exact deadline should be calculated from the taxpayer's own assessment, reasons process and procedural history. Do not rely on an old 30-day rule or on a generic date calculator without checking the current dispute rules."
        ]
      },
      {
        heading: "Before filing the objection",
        bullets: [
          "Identify the assessment or decision and confirm the tax period and assessment reference.",
          "Check whether a Request for Correction is the appropriate first step for the issue.",
          "Determine whether reasons are needed to formulate the grounds of objection.",
          "Set out the grounds clearly and attach the documents that support those grounds.",
          "Consider collection separately: an objection does not automatically suspend payment."
        ]
      },
      {
        heading: "If the ordinary period has passed",
        paragraphs: [
          "The dispute rules and Tax Administration Act contain provisions dealing with late objections. Whether an extension is available depends on the length of the delay and the reasons for it. A late-objection request should therefore explain the delay accurately and address the applicable requirements rather than treating condonation as automatic."
        ]
      }
    ],
    sources: [
      { label: "SARS — Dispute a Tax Assessment or Decision", href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/dispute-a-tax-assessment-or-decision/" },
      { label: "SARS — Dispute Resolution", href: "https://www.sars.gov.za/legal-counsel/dispute-resolution-judgments/dispute-resolution/" }
    ]
  },
  {
    slug: "sars-section-200-compromise-checklist",
    title: "SARS Section 200 Compromise: A Practical Preparation Checklist",
    description: "A practical guide to preparing for a SARS tax-debt compromise request, including the statutory purpose, financial disclosure and supporting information SARS may need.",
    intro: "A compromise is a tax-debt collection mechanism, not an objection to an assessment. It may allow SARS to accept less than the full amount of an undisputed tax debt where the statutory requirements are met and the compromise provides the highest net return from recovery of the debt.",
    serviceHref: "/sars-compromise",
    serviceLabel: "SARS compromise assistance",
    sections: [
      {
        heading: "Start with the right debt",
        paragraphs: [
          "A compromise under Chapter 14 of the Tax Administration Act concerns tax debt and is distinct from the dispute process. Before preparing an offer, reconcile the taxpayer's SARS accounts and identify whether amounts are undisputed, under objection or appeal, subject to audit, or affected by outstanding returns.",
          "The proposed compromise should be based on the taxpayer's actual financial position rather than an unsupported settlement figure."
        ]
      },
      {
        heading: "Financial information to prepare",
        bullets: [
          "A complete picture of assets and liabilities, including encumbered assets.",
          "Income, expenditure and available cash-flow information appropriate to the taxpayer.",
          "Current and expected financial resources and material interests in other entities where relevant.",
          "The source and timing of any proposed lump-sum or instalment payments.",
          "Supporting records that allow SARS to test the financial disclosures and the proposed recovery."
        ]
      },
      {
        heading: "Why completeness matters",
        paragraphs: [
          "The Tax Administration Act requires detailed disclosure for a compromise request. SARS may require additional information before deciding the request. Material non-disclosure can undermine the application and can have consequences after a compromise is concluded.",
          "A well-prepared submission should therefore reconcile the debt, financial disclosure, supporting documents and offer into one consistent factual case."
        ]
      }
    ],
    sources: [
      { label: "SARS — Owing SARS Money", href: "https://www.sars.gov.za/individuals/how-do-i-pay/owing-sars-money/" },
      { label: "Tax Administration Act 28 of 2011 — sections 200–207", href: "https://www.sars.gov.za/wp-content/uploads/Legal/Acts/LAPD-LPrim-Act-2012-01-Tax-Administration-Act-2011.pdf" }
    ]
  },
  {
    slug: "sars-vat-refund-delays",
    title: "SARS VAT Refund Delays: What Vendors Should Check Before Escalating",
    description: "A practical guide for South African VAT vendors dealing with delayed refunds, including verification, banking details, outstanding returns, set-off and escalation checks.",
    intro: "A VAT201 return showing a refundable amount does not always mean the refund will immediately reach the vendor's bank account. SARS may first need to complete verification or audit processes and other account or compliance issues can affect payment.",
    serviceHref: "/vat-services",
    serviceLabel: "VAT refund and compliance assistance",
    sections: [
      {
        heading: "Check the refund status before escalating",
        bullets: [
          "Confirm that the VAT201 return was successfully submitted and that the refund is reflected on the VAT account.",
          "Check for verification or audit correspondence and respond to SARS requests within the required process.",
          "Confirm that registered banking details are valid and have completed any required verification.",
          "Check whether outstanding returns, debt or other account issues may affect the refund or result in set-off.",
          "Keep the SARS case numbers, letters and supporting-document submission records together for follow-up."
        ]
      },
      {
        heading: "Verification and audit",
        paragraphs: [
          "SARS states that refunds may be subject to verification, inspection or audit. Where supporting documents are requested, the refund process can depend on completion of that review. The correct response is to deal with the specific SARS request and retain proof of submission rather than repeatedly resubmitting the VAT return."
        ]
      },
      {
        heading: "When escalation becomes appropriate",
        paragraphs: [
          "If the vendor has complied with requests and the matter remains unresolved, use the SARS service and complaint channels that fit the case and preserve the reference numbers. An escalation should state the affected periods, amounts, prior interactions and the specific unresolved impediment as clearly as possible."
        ]
      }
    ],
    sources: [
      { label: "SARS — VAT Refunds for Vendors", href: "https://www.sars.gov.za/types-of-tax/value-added-tax/vat-refunds-for-vendors/" },
      { label: "SARS — Complaints", href: "https://www.sars.gov.za/contact-us/complaints/" }
    ]
  },
  {
    slug: "sars-payment-arrangement-documents",
    title: "SARS Payment Arrangements: Documents and Financial Information to Prepare",
    description: "Prepare for a SARS instalment payment arrangement by understanding the statutory framework, financial information, affordability evidence and ongoing compliance considerations.",
    intro: "An instalment payment arrangement can spread payment of qualifying tax debt over an agreed period. It does not reduce the underlying debt, and SARS assesses whether the taxpayer's circumstances support deferred payment.",
    serviceHref: "/sars-payment-arrangements",
    serviceLabel: "SARS payment-arrangement assistance",
    sections: [
      {
        heading: "What an instalment arrangement does",
        paragraphs: [
          "Sections 167 and 168 of the Tax Administration Act allow SARS to enter into an instalment payment agreement in prescribed circumstances. The arrangement concerns payment timing; it is different from a compromise, which can involve settling qualifying tax debt for less than the full amount.",
          "Interest generally remains relevant while tax debt is outstanding, so affordability should be assessed realistically rather than using only the principal balance."
        ]
      },
      {
        heading: "Information commonly needed to support affordability",
        bullets: [
          "A reconciled statement of the tax debt and tax types to be included.",
          "Current income and expenditure or management information appropriate to the taxpayer.",
          "Assets, liabilities and available cash resources where SARS requests financial disclosure.",
          "A proposed monthly amount that can be maintained together with current tax obligations.",
          "Supporting bank or financial records where needed to substantiate the taxpayer's position."
        ]
      },
      {
        heading: "Current compliance still matters",
        paragraphs: [
          "A payment arrangement should not be treated as permission to stop filing current returns or ignore new liabilities. The taxpayer should plan for both the agreed debt instalment and current compliance obligations. If circumstances change materially, the arrangement may need to be addressed with SARS rather than simply allowing payments to fail."
        ]
      }
    ],
    sources: [
      { label: "SARS — Owing SARS Money", href: "https://www.sars.gov.za/individuals/how-do-i-pay/owing-sars-money/" },
      { label: "Tax Administration Act 28 of 2011 — sections 167–168", href: "https://www.sars.gov.za/wp-content/uploads/Legal/Acts/LAPD-LPrim-Act-2012-01-Tax-Administration-Act-2011.pdf" }
    ]
  }
];

export const guidePaths = guides.map((guide) => `/tax-guides/${guide.slug}`);

export function TaxGuidesHub() {
  useSeo({
    title: "SARS & Tax Guides South Africa | Acapolite Consulting",
    description: "Practitioner-reviewed SARS and tax guides covering objections, suspension of payment, tax debt compromises, payment arrangements and VAT refund delays.",
    canonicalPath: "/tax-guides",
  });

  return (
    <PublicPageLayout
      eyebrow="Tax knowledge"
      title="SARS & Tax Guides"
      description="Practical, source-backed guidance for South African taxpayers and businesses. Each guide is reviewed by Patric Sandiso Sibande, Registered Tax Practitioner (SA)™, and links to the primary SARS or legislative material used."
      backHref="/sars-tax-assistance"
      backLabel="SARS & Tax Assistance"
      maxWidthClassName="max-w-6xl"
    >
      <JsonLd data={buildBreadcrumbSchema([{ name: "Home", path: "/" }, { name: "Tax Guides", path: "/tax-guides" }])} />
      <div className="grid gap-5 md:grid-cols-2">
        {guides.map((guide) => (
          <article key={guide.slug} className="rounded-2xl border border-border bg-background p-6">
            <BookOpen className="h-6 w-6 text-primary" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">{guide.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{guide.description}</p>
            <Link to={`/tax-guides/${guide.slug}`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              Read guide <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        ))}
      </div>
      <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-6 text-sm leading-6 text-muted-foreground">
        These guides provide general information and do not replace advice based on a taxpayer's own assessment, correspondence, facts and deadlines. Acapolite Consulting is independent and is not affiliated with or endorsed by SARS.
      </div>
    </PublicPageLayout>
  );
}

function GuidePage({ guide }: { guide: Guide }) {
  const path = `/tax-guides/${guide.slug}`;
  useSeo({ title: `${guide.title} | Acapolite Consulting`, description: guide.description, canonicalPath: path });
  return (
    <PublicPageLayout
      eyebrow="Practitioner-reviewed tax guide"
      title={guide.title}
      description={guide.intro}
      backHref="/tax-guides"
      backLabel="All Tax Guides"
      maxWidthClassName="max-w-4xl"
    >
      <JsonLd data={buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Tax Guides", path: "/tax-guides" },
        { name: guide.title, path },
      ])} />
      <JsonLd data={buildArticleSchema({
        headline: guide.title,
        description: guide.description,
        path,
        datePublished: ISO_DATE,
        dateModified: ISO_DATE,
      })} />

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-muted/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Reviewed by</p>
          <p className="mt-2 font-semibold text-foreground">Patric Sandiso Sibande</p>
          <p className="text-sm text-muted-foreground">Registered Tax Practitioner (SA)™</p>
          <Link to="/about-us" className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">About the reviewer</Link>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Last reviewed</p>
          <p className="mt-2 font-semibold text-foreground">{REVIEWED_DATE}</p>
          <p className="mt-1 text-sm text-muted-foreground">Primary SARS and legislative sources are listed below.</p>
        </div>
      </div>

      <div className="space-y-8">
        {guide.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-2xl font-semibold text-foreground">{section.heading}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-base leading-7 text-muted-foreground">{paragraph}</p>
            ))}
            {section.bullets && (
              <ul className="mt-4 space-y-3">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className="rounded-2xl border border-border bg-muted/30 p-6">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Primary sources reviewed</h2>
          </div>
          <div className="mt-4 grid gap-3">
            {guide.sources.map((source) => (
              <a key={source.href} href={source.href} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-sm font-medium text-primary hover:underline">
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                {source.label}
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Need help with your own SARS matter?</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your assessment, correspondence, compliance position and deadlines determine the appropriate next step. Acapolite can review the matter before a submission is prepared.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild><Link to="/request-tax-assistance?step=1">Request assistance</Link></Button>
            <Button asChild variant="outline"><Link to={guide.serviceHref}>{guide.serviceLabel}</Link></Button>
          </div>
        </section>

        <p className="text-xs leading-5 text-muted-foreground">
          General information only. This guide is not a SARS publication and does not guarantee any outcome. Acapolite Consulting is an independent professional services platform and is not affiliated with or endorsed by SARS.
        </p>
      </div>
    </PublicPageLayout>
  );
}

export function SarsSuspensionPaymentGuide() { return <GuidePage guide={guides[0]} />; }
export function SarsObjectionDeadlineGuide() { return <GuidePage guide={guides[1]} />; }
export function SarsCompromiseChecklistGuide() { return <GuidePage guide={guides[2]} />; }
export function SarsVatRefundDelayGuide() { return <GuidePage guide={guides[3]} />; }
export function SarsPaymentArrangementDocumentsGuide() { return <GuidePage guide={guides[4]} />; }
