import { Fragment } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ExternalLink, FileText, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { JsonLd } from "@/components/seo/JsonLd";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { Button } from "@/components/ui/button";
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/structuredData";
import { useSeo } from "@/hooks/useSeo";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const REVIEWED_DATE = "24 September 2026";
const ISO_DATE = "2026-09-24";

type Source = { label: string; href: string };
type Section = { heading: string; paragraphs?: string[]; bullets?: string[] };
type RelatedService = { label: string; href: string };
type Crumb = { name: string; path?: string };

type Guide = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  relatedServices: RelatedService[];
  sections: Section[];
  sources: Source[];
};

function GuideBreadcrumbs({ items }: { items: Crumb[] }) {
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

const guides: Guide[] = [
  {
    slug: "sars-suspension-of-payment-section-164",
    title: "SARS Section 164 Suspension of Payment: What a Tax Dispute Does — and Does Not — Stop",
    description: "A practitioner-reviewed guide to SARS suspension of payment under section 164, including its relationship with objections and appeals and why a dispute does not automatically stop collection.",
    intro: "A tax dispute and a request to suspend payment are related, but they are not the same process. This distinction matters when a taxpayer wants to challenge an assessment while SARS collection activity is possible.",
    relatedServices: [
      { label: "SARS objections and dispute assistance", href: "/sars-objections" },
      { label: "SARS debt assistance", href: "/sars-debt" },
    ],
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
      { label: "SARS — What if I do not agree?", href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/" },
      { label: "SARS — Tax Administration Act, 2011", href: "https://www.sars.gov.za/legal-counsel/tax-administration/" }
    ]
  },
  {
    slug: "sars-objection-deadline-guide",
    title: "SARS Objection Deadlines: The 80-Business-Day Rule and What to Check Before Filing",
    description: "Understand the current SARS objection period, requests for reasons, late objections and the records to review before submitting a notice of objection.",
    intro: "Objection deadlines are procedural and can materially affect a taxpayer's dispute rights. The correct starting point is the assessment or decision being challenged and the applicable dispute rules — not a generic calendar-day calculation.",
    relatedServices: [{ label: "Get help with a SARS objection", href: "/sars-objections" }],
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
      { label: "SARS — What if I do not agree?", href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/" },
      { label: "SARS — Dispute Resolution Process", href: "https://www.sars.gov.za/legal-counsel/dispute-resolution-judgments/dispute-resolution-process/" }
    ]
  },
  {
    slug: "sars-section-200-compromise-checklist",
    title: "SARS Section 200 Compromise: A Practical Preparation Checklist",
    description: "A practical guide to preparing for a SARS tax-debt compromise request, including the statutory purpose, financial disclosure and supporting information SARS may need.",
    intro: "A compromise is a tax-debt collection mechanism, not an objection to an assessment. It may allow SARS to accept less than the full amount of an undisputed tax debt where the statutory requirements are met and the compromise provides the highest net return from recovery of the debt.",
    relatedServices: [
      { label: "SARS compromise assistance", href: "/sars-compromise" },
      { label: "SARS debt assistance", href: "/sars-debt" },
    ],
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
      { label: "SARS — Tax Administration Act, 2011", href: "https://www.sars.gov.za/legal-counsel/tax-administration/" }
    ]
  },
  {
    slug: "sars-vat-refund-delays",
    title: "SARS VAT Refund Delays: What Vendors Should Check Before Escalating",
    description: "A practical guide for South African VAT vendors dealing with delayed refunds, including verification, banking details, outstanding returns, set-off and escalation checks.",
    intro: "A VAT201 return showing a refundable amount does not always mean the refund will immediately reach the vendor's bank account. SARS may first need to complete verification or audit processes and other account or compliance issues can affect payment.",
    relatedServices: [
      { label: "VAT refund and compliance assistance", href: "/vat-services" },
      { label: "SARS audit & verification assistance", href: "/sars-audit-verification" },
    ],
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
      { label: "SARS — Lodge a complaint", href: "https://www.sars.gov.za/contact-us/lodge-a-complaint/" }
    ]
  },
  {
    slug: "sars-payment-arrangement-documents",
    title: "SARS Payment Arrangements: Documents and Financial Information to Prepare",
    description: "Prepare for a SARS instalment payment arrangement by understanding the statutory framework, financial information, affordability evidence and ongoing compliance considerations.",
    intro: "An instalment payment arrangement can spread payment of qualifying tax debt over an agreed period. It does not reduce the underlying debt, and SARS assesses whether the taxpayer's circumstances support deferred payment.",
    relatedServices: [
      { label: "SARS payment-arrangement assistance", href: "/sars-payment-arrangements" },
      { label: "SARS debt assistance", href: "/sars-debt" },
    ],
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
      { label: "SARS — Tax Administration Act, 2011", href: "https://www.sars.gov.za/legal-counsel/tax-administration/" }
    ]
  },
  {
    slug: "sars-final-demand-third-party-appointment",
    title: "SARS Final Demand and Third-Party Appointment: What Happens When Tax Debt Is Not Addressed",
    description: "Understand SARS final demands and third-party appointments under section 179, including how banks, employers or other third parties can become part of tax-debt collection.",
    intro: "A SARS final demand is a debt-collection warning that should be treated as time-sensitive. If outstanding tax debt is not addressed, SARS has statutory recovery mechanisms that can include appointing a third party that holds or owes money for the taxpayer.",
    relatedServices: [
      { label: "SARS tax-debt assistance", href: "/sars-debt" },
      { label: "SARS payment arrangements", href: "/sars-payment-arrangements" },
    ],
    sections: [
      {
        heading: "What a third-party appointment means",
        paragraphs: [
          "Under section 179 of the Tax Administration Act, SARS may require a person who holds or owes money for or to a taxpayer to pay money to SARS in satisfaction of outstanding tax debt. SARS guidance identifies banks, employers and other third parties as examples.",
          "SARS's current Third Party Appointment guide states that this collection process follows a final demand where the taxpayer has not complied with the demand for payment. Section 179 generally requires delivery of a final demand for payment at least 10 business days before a third-party appointment, while the legislation also contains circumstances in which SARS need not issue a final demand if a senior SARS official is satisfied that doing so would prejudice collection."
        ]
      },
      {
        heading: "What to check immediately",
        bullets: [
          "Confirm the tax type, periods and balance reflected by SARS and reconcile them to the taxpayer's account.",
          "Open the final demand and other SARS correspondence immediately and note the delivery date, case references and recovery steps described; the section 179 process can turn on a 10-business-day period.",
          "Identify whether the debt is disputed, undisputed, already subject to an arrangement, or affected by returns or payments not yet correctly allocated.",
          "Consider the appropriate statutory route rather than ignoring the demand: payment, an instalment arrangement, compromise where applicable, or a dispute and separate suspension-of-payment process where there is a genuine dispute."
        ]
      },
      {
        heading: "Why early action matters",
        paragraphs: [
          "A final demand is not the point to begin guessing at the account balance. The practical first step is to establish exactly what SARS says is outstanding and what process is already under way. A taxpayer who has received a third-party appointment or whose bank has already acted should preserve the notices and transaction records for review."
        ]
      }
    ],
    sources: [
      { label: "SARS — Guide to Third Party Appointments via eFiling", href: "https://www.sars.gov.za/guide-to-third-party-appointments-via-efiling/" },
      { label: "SARS — Owing SARS Money", href: "https://www.sars.gov.za/individuals/how-do-i-pay/owing-sars-money/" },
      { label: "SARS — Tax Administration Act, 2011", href: "https://www.sars.gov.za/legal-counsel/tax-administration/" }
    ]
  },
  {
    slug: "sars-request-for-reasons",
    title: "SARS Request for Reasons: When It Fits Before an Objection",
    description: "A practitioner-reviewed guide to requesting reasons from SARS before an objection, including the current 30-business-day request period and how the process affects the objection timeline.",
    intro: "A Request for Reasons is intended to help a taxpayer understand the basis of an assessment sufficiently to formulate an objection. It is not a general SARS follow-up channel and it should be used for the assessment or account outcomes for which the process is available.",
    relatedServices: [{ label: "SARS objections and dispute assistance", href: "/sars-objections" }],
    sections: [
      {
        heading: "When reasons can help",
        paragraphs: [
          "SARS states that a taxpayer who does not understand or is aggrieved by an assessment may request reasons to enable the taxpayer to formulate an objection. The request comes before the objection and should identify the assessment or decision and the reasons that are needed.",
          "SARS's Request for Reasons page states that the request must be delivered within 30 business days from the date of the assessment or decision, subject to the applicable dispute rules and process."
        ]
      },
      {
        heading: "Do not use it for the wrong problem",
        bullets: [
          "Use Request for Correction where the issue is an error that the RFC process permits the taxpayer to correct.",
          "Do not use Request for Reasons merely to chase an outstanding refund or obtain general tax advice.",
          "For supported tax types, follow the eFiling or prescribed SARS process rather than sending an informal letter to an unrelated channel.",
          "Keep the reasons outcome because it affects how the grounds of objection are prepared and can affect the objection period."
        ]
      },
      {
        heading: "Effect on the objection timeline",
        paragraphs: [
          "SARS states that once a valid Request for Reasons for an assessment has been submitted, the period for lodging the objection is extended in accordance with the dispute-resolution rules. The taxpayer should calculate the eventual objection deadline from the actual reasons correspondence and procedural history rather than assume the original assessment date still controls."
        ]
      }
    ],
    sources: [
      { label: "SARS — Request for Reasons", href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/request-for-reasons/" },
      { label: "SARS — Objections", href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/objections/" },
      { label: "SARS — Guide to submit a dispute via eFiling", href: "https://www.sars.gov.za/guide-to-submit-a-dispute-via-efiling/" }
    ]
  },
  {
    slug: "sars-objection-disallowed-appeal-adr",
    title: "SARS Objection Disallowed: Appeal, ADR and the Next Procedural Step",
    description: "What to review after SARS disallows or partially allows an objection, including the 30-business-day appeal period and the role of Alternative Dispute Resolution.",
    intro: "A disallowed objection does not necessarily end a tax dispute. SARS provides an appeal process, and a valid appeal may in appropriate cases proceed through Alternative Dispute Resolution by mutual agreement.",
    relatedServices: [{ label: "SARS appeal and dispute assistance", href: "/sars-objections" }],
    sections: [
      {
        heading: "Start with the objection outcome",
        paragraphs: [
          "Read the SARS objection outcome against the grounds and supporting material that were actually submitted. Identify which grounds were accepted, rejected or only partly allowed, and the reasons SARS gives for its decision.",
          "SARS states that an appeal must generally be lodged within 30 business days after delivery of the objection outcome. The rules also provide limited extension mechanisms where the relevant requirements are met."
        ]
      },
      {
        heading: "Preparing the appeal",
        bullets: [
          "Identify which grounds of objection are being taken on appeal.",
          "Explain why the taxpayer disagrees with SARS's decision on those grounds.",
          "Include substantiating documents relevant to the grounds of appeal.",
          "Do not use the appeal to introduce a new objection against a part or amount of the assessment that was not previously objected to."
        ]
      },
      {
        heading: "Where ADR fits",
        paragraphs: [
          "SARS explains that after a valid appeal, SARS and the taxpayer may by mutual agreement attempt to resolve the appeal through the Alternative Dispute Resolution process. ADR is therefore part of the appeal framework; it is not a substitute for lodging a valid appeal within the applicable procedural period.",
          "The next step depends on the objection outcome, the grounds preserved in the dispute, the appeal deadline and whether ADR is suitable for the particular matter."
        ]
      }
    ],
    sources: [
      { label: "SARS — Appeals", href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/appeals/" },
      { label: "SARS — Dispute Resolution Process", href: "https://www.sars.gov.za/legal-counsel/dispute-resolution-judgments/dispute-resolution-process/" },
      { label: "SARS — What if I do not agree?", href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/" }
    ]
  },
  {
    slug: "sars-vat-verification-supporting-documents",
    title: "SARS VAT Verification: Supporting Documents and Submission Checks",
    description: "A practical guide to VAT verification supporting documents, SARS correspondence, eFiling uploads and what vendors should check before submitting relevant material.",
    intro: "VAT verification is a check of information declared in a return against supporting records and other information available to SARS. The correct document pack depends on the verification letter and the transactions SARS has asked the vendor to substantiate.",
    relatedServices: [
      { label: "VAT verification and compliance assistance", href: "/vat-services" },
      { label: "SARS audit & verification assistance", href: "/sars-audit-verification" },
    ],
    sections: [
      {
        heading: "Follow the verification letter",
        paragraphs: [
          "SARS notifies a taxpayer selected for verification and specifies the information or documents required and the applicable due date. For VAT, the supporting-document link becomes available on the VAT201 work page after the relevant SARS correspondence is issued.",
          "SARS guidance says relevant material should be uploaded when SARS has requested it. The vendor should therefore build the submission around the actual verification letter rather than upload a generic bundle that does not answer the request."
        ]
      },
      {
        heading: "Before clicking Submit to SARS",
        bullets: [
          "Read the verification letter and map each requested item to the document or reconciliation that answers it.",
          "Check that invoices, schedules, accounting records and other records are for the correct VAT period and transactions.",
          "Confirm that every intended file has uploaded successfully and is readable before final submission.",
          "Keep the SARS letter, case reference and proof or status showing that the material was submitted.",
          "If a discrepancy remains after verification and SARS issues a revised assessment, review the assessment and the available correction or dispute route."
        ]
      },
      {
        heading: "Verification and audit are different",
        paragraphs: [
          "SARS describes verification as checking information in a declaration or return against third-party data, financial and accounting records and supporting documents. An audit is a broader examination of financial statements, accounting records and supporting documents to determine whether the tax position was correctly declared.",
          "Where SARS identifies financial risk, a matter can be referred for audit. Vendors expecting a refund should also be aware that an unresolved verification or audit can affect when the refund is released."
        ]
      }
    ],
    sources: [
      { label: "SARS — Guide to Completing the VAT201 Return", href: "https://www.sars.gov.za/guide-to-completing-the-value-added-tax-vat201-return/" },
      { label: "SARS — Being Audited or Selected for Verification", href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/being-audited-or-selected-for-verification/" },
      { label: "SARS — Upload Supporting Documents", href: "https://www.sars.gov.za/faq/how-do-i-upload-submit-supporting-documents/" }
    ]
  }
];

export const guidePaths = guides.map((guide) => `/tax-guides/${guide.slug}`);

export function TaxGuidesHub() {
  useSeo({
    title: "SARS & Tax Guides South Africa | Acapolite Consulting",
    description: "Practitioner-reviewed SARS and tax guides covering objections, suspension of payment, tax debt compromises, payment arrangements and VAT refund delays.",
    path: "/tax-guides",
  });

  return (
    <PublicPageLayout
      eyebrow="Tax knowledge"
      title="SARS & Tax Guides"
      description="Practical, source-backed guidance for South African taxpayers and businesses. Each guide is reviewed by a Registered Tax Practitioner (SA)™ and links to the primary SARS or legislative material used."
      backHref="/sars-tax-assistance"
      backLabel="SARS & Tax Assistance"
      maxWidthClassName="max-w-6xl"
    >
      <JsonLd data={buildBreadcrumbSchema([{ name: "Home", path: "/" }, { name: "Tax Guides", path: "/tax-guides" }])} />
      <GuideBreadcrumbs items={[{ name: "Home", path: "/" }, { name: "Tax Guides" }]} />
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
      <section className="mt-8 rounded-2xl border border-primary/15 bg-primary/5 p-6">
        <h2 className="text-lg font-semibold text-foreground">Need professional SARS assistance?</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Use the guides to understand the process, then choose the specialist service that matches the matter.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="outline"><Link to="/sars-debt">SARS Debt</Link></Button>
          <Button asChild variant="outline"><Link to="/sars-objections">Objections &amp; Appeals</Link></Button>
          <Button asChild variant="outline"><Link to="/sars-audit-verification">Audit &amp; Verification</Link></Button>
          <Button asChild variant="outline"><Link to="/sars-tax-compliance-status">Tax Compliance Status</Link></Button>
          <Button asChild><Link to="/request-tax-assistance?step=1&intent=sars&from=%2Ftax-guides">Request Assistance</Link></Button>
        </div>
      </section>
      <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-6 text-sm leading-6 text-muted-foreground">
        These guides provide general information and do not replace advice based on a taxpayer's own assessment, correspondence, facts and deadlines. Acapolite Consulting is independent and is not affiliated with or endorsed by SARS.
      </div>
    </PublicPageLayout>
  );
}

function GuidePage({ guide }: { guide: Guide }) {
  const path = `/tax-guides/${guide.slug}`;
  useSeo({ title: `${guide.title} | Acapolite Consulting`, description: guide.description, path });
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
      <GuideBreadcrumbs items={[{ name: "Home", path: "/" }, { name: "Tax Guides", path: "/tax-guides" }, { name: guide.title }]} />

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-muted/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Reviewed by</p>
          <p className="mt-2 font-semibold text-foreground">Registered Tax Practitioner (SA)™</p>
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
              <a key={source.href} href={source.href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-sm font-medium text-primary hover:underline">
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
            <Button asChild><Link to={`/request-tax-assistance?step=1&intent=sars&from=${encodeURIComponent(path)}`}>Request assistance</Link></Button>
            {guide.relatedServices.map((service) => (
              <Button key={service.href} asChild variant="outline"><Link to={service.href}>{service.label}</Link></Button>
            ))}
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
export function SarsFinalDemandGuide() { return <GuidePage guide={guides[5]} />; }
export function SarsRequestForReasonsGuide() { return <GuidePage guide={guides[6]} />; }
export function SarsObjectionDisallowedGuide() { return <GuidePage guide={guides[7]} />; }
export function SarsVatVerificationGuide() { return <GuidePage guide={guides[8]} />; }
