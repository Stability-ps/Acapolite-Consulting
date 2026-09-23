import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, CheckCircle2 } from "lucide-react";
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

type Crumb = { name: string; path?: string };
type Source = { label: string; href: string };

const REVIEWED_DATE = "23 September 2026";

const sources = {
  debt: {
    label: "SARS — What if I owe SARS money?",
    href: "https://www.sars.gov.za/individuals/how-do-i-pay/owing-sars-money/",
  },
  arrangements: {
    label: "SARS — Guide to Deferral of Payment Arrangements on eFiling",
    href: "https://www.sars.gov.za/guide-to-deferral-of-payment-arrangements-on-efiling/",
  },
  arrangementsFaq: {
    label: "SARS — How do I make payment arrangements?",
    href: "https://www.sars.gov.za/faq/how-do-i-make-payment-arrangements/",
  },
  objections: {
    label: "SARS — Objections",
    href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/objections/",
  },
  appeals: {
    label: "SARS — Appeals",
    href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/appeals/",
  },
  disputeGuide: {
    label: "SARS — Guide to submit a dispute via eFiling",
    href: "https://www.sars.gov.za/guide-to-submit-a-dispute-via-efiling/",
  },
  reasons: {
    label: "SARS — Request for Reasons",
    href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/request-for-reasons/",
  },
  correction: {
    label: "SARS — Request for Corrections",
    href: "https://www.sars.gov.za/individuals/what-if-i-do-not-agree/request-for-corrections/",
  },
  taa: {
    label: "South African Government — Tax Administration Act 28 of 2011",
    href: "https://www.gov.za/documents/tax-administration-act",
  },
};

function SarsBreadcrumbs({ items }: { items: Crumb[] }) {
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

function OfficialSources({ items }: { items: Source[] }) {
  return (
    <section className="rounded-2xl border border-border bg-muted/30 p-5 sm:p-6">
      <h2 className="text-base font-semibold text-foreground">Official sources reviewed</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        This page is general information, not a guarantee of SARS approval or a substitute for advice on your facts.
        The process information below was reviewed against these primary sources on {REVIEWED_DATE}.
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((source) => (
          <li key={source.href}>
            <a
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {source.label}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AssistanceCta({ title, intent, from }: { title: string; intent: string; from: string }) {
  return (
    <section className="rounded-[28px] border border-primary/15 bg-primary/5 p-6 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Professional assistance</p>
      <h2 className="mt-3 font-display text-xl text-foreground sm:text-2xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Submit the SARS matter securely so a practitioner can review the debt, assessment, correspondence and
        available supporting records before recommending the appropriate process.
      </p>
      <Button asChild className="mt-6 w-full rounded-xl sm:w-auto">
        <Link to={`/request-tax-assistance?step=1&intent=${intent}&from=${encodeURIComponent(from)}`}>
          Request SARS Assistance
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </section>
  );
}

function OptionCard({
  title,
  body,
  href,
  linkLabel,
}: {
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-5">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      {href && linkLabel && (
        <Link to={href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          {linkLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span className="text-sm leading-6 text-foreground">{item}</span>
        </div>
      ))}
    </div>
  );
}

function PageShell({
  path,
  title,
  description,
  metaDescription,
  eyebrow,
  crumbs,
  sources: pageSources,
  children,
}: {
  path: string;
  title: string;
  description: string;
  metaDescription: string;
  eyebrow: string;
  crumbs: Crumb[];
  sources: Source[];
  children: ReactNode;
}) {
  useSeo({
    title: `${title} | Acapolite Consulting`,
    description: metaDescription,
    path,
  });

  const schemaCrumbs = crumbs.map((crumb) => ({
    name: crumb.name,
    path: crumb.path ?? path,
  }));

  return (
    <>
      <JsonLd data={buildServiceSchema({ name: title, description: metaDescription, path })} />
      <JsonLd data={buildBreadcrumbSchema(schemaCrumbs)} />
      <PublicPageLayout
        eyebrow={eyebrow}
        title={title}
        description={description}
        maxWidthClassName="max-w-6xl"
        backHref="/sars-tax-assistance"
        backLabel="Back to SARS & Tax Assistance"
      >
        <div className="space-y-10 font-body">
          <SarsBreadcrumbs items={crumbs} />
          {children}
          <OfficialSources items={pageSources} />
          <p className="text-xs leading-5 text-muted-foreground">
            Last reviewed: {REVIEWED_DATE}. Acapolite Consulting is an independent professional services platform
            and is not affiliated with or endorsed by SARS. Outcomes depend on the taxpayer's facts, compliance
            position, evidence and SARS's decision.
          </p>
        </div>
      </PublicPageLayout>
    </>
  );
}

export function SarsDebtPage() {
  const path = "/sars-debt";
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Our Services", path: "/our-services" },
    { name: "SARS & Tax Assistance", path: "/sars-tax-assistance" },
    { name: "SARS Debt" },
  ];

  return (
    <PageShell
      path={path}
      eyebrow="SARS Debt Assistance"
      title="SARS Debt Help & Tax Debt Assistance"
      description="Understand the main SARS debt-resolution routes and get professional help assessing whether payment, an arrangement, compromise or a dispute process fits your situation."
      metaDescription="Get SARS debt help in South Africa. Understand payment arrangements, Section 200 compromise, disputes and professional tax debt assistance through Acapolite Consulting."
      crumbs={crumbs}
      sources={[sources.debt, sources.taa]}
    >
      <section>
        <h2 className="text-xl font-semibold text-foreground">If you owe SARS money, the right route depends on why</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
          SARS's current debt guidance separates an unpaid debt from a debt you intend to dispute. It lists paying
          the balance, requesting instalments under section 167 of the Tax Administration Act, requesting a
          compromise under sections 200–202, and requesting suspension of payment under section 164 where the debt
          is disputed or will be disputed. These are different processes with different requirements.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Main ways a SARS debt may be addressed</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <OptionCard
            title="Pay the outstanding balance"
            body="Where the amount is correct and funds are available, settling the debt is the most direct route. SARS warns that unpaid debt can continue to attract applicable interest."
          />
          <OptionCard
            title="Request a payment arrangement"
            body="A deferment or instalment arrangement can spread qualifying outstanding debt over time. SARS applies qualifying criteria and may require supporting financial information."
            href="/sars-payment-arrangements"
            linkLabel="Payment arrangement guidance"
          />
          <OptionCard
            title="Request a compromise of tax debt"
            body="A compromise is a different debt-relief mechanism. Under section 200, a senior SARS official may authorise compromise of part of a tax debt where the statutory requirements are met."
            href="/sars-compromise"
            linkLabel="Section 200 compromise guidance"
          />
          <OptionCard
            title="Dispute an assessment or decision"
            body="If the problem is that the assessment or SARS decision is wrong, the dispute process may be relevant. An objection or appeal does not automatically mean payment is suspended."
            href="/sars-objections"
            linkLabel="Objections and disputes guidance"
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-muted/30 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">What can happen if SARS debt remains unresolved?</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
          SARS states that collection measures can include third-party appointments, civil judgment, attachment of
          assets, preservation measures and, in appropriate circumstances, sequestration or liquidation. The exact
          step depends on the taxpayer and the debt. The purpose of this information is to explain why early
          engagement matters, not to suggest that every debt follows the same enforcement path.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">How Acapolite can assist</h2>
        <Checklist
          items={[
            "Review SARS statements, notices and the composition of the debt",
            "Identify whether the matter is payment difficulty, compromise or a dispute",
            "Prepare payment-arrangement or compromise supporting packs",
            "Assist with objections, appeals and supporting evidence where appropriate",
            "Help assemble financial records and SARS correspondence",
            "Support practitioner correspondence and follow-up with SARS",
          ]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Common questions</h2>
        <div className="mt-4 space-y-5">
          <div>
            <h3 className="font-semibold text-foreground">Does owing SARS automatically mean I qualify for a payment plan?</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              No. SARS says payment arrangements are subject to qualifying criteria and it may decline a request.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Is a compromise the same as a payment arrangement?</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              No. An arrangement deals with paying the outstanding debt over time. A compromise is a statutory
              process under which SARS may accept less than the full tax debt where the requirements are met.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">If I dispute the assessment, can I stop paying automatically?</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              No. SARS says the obligation to pay generally remains while a dispute is being dealt with. A separate
              suspension-of-payment request may be available.
            </p>
          </div>
        </div>
      </section>

      <AssistanceCta title="Get help choosing the right SARS debt process" intent="sars-debt" from="/sars-debt" />
    </PageShell>
  );
}

export function SarsPaymentArrangementsPage() {
  const path = "/sars-payment-arrangements";
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Our Services", path: "/our-services" },
    { name: "SARS & Tax Assistance", path: "/sars-tax-assistance" },
    { name: "SARS Debt", path: "/sars-debt" },
    { name: "Payment Arrangements" },
  ];

  return (
    <PageShell
      path={path}
      eyebrow="SARS Payment Arrangements"
      title="SARS Payment Arrangements & Instalment Plans"
      description="Get professional help preparing a SARS deferred-payment or instalment-arrangement request and the financial information that may be needed to support it."
      metaDescription="Need a SARS payment arrangement? Learn how SARS instalment plans work, current eFiling requirements, supporting documents, interest and professional assistance."
      crumbs={crumbs}
      sources={[sources.arrangementsFaq, sources.arrangements, sources.debt, sources.taa]}
    >
      <section>
        <h2 className="text-xl font-semibold text-foreground">What is a SARS payment arrangement?</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
          SARS provides for deferment or instalment arrangements for outstanding tax debt. The arrangement is meant
          to settle the debt, including applicable interest, over an agreed period. SARS may decline a request and
          says an arrangement is subject to qualifying criteria.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">What SARS considers</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          SARS's current guidance says it may enter into a payment agreement where circumstances such as temporary
          liquidity constraints, expected future income, poor immediate collection prospects or hardship support a
          deferral and tax collection is not prejudiced. SARS may require security. It also states that outstanding
          returns and reconciliations must be submitted before the request can be considered.
        </p>
      </section>

      <section className="rounded-[28px] border border-border bg-muted/30 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">How the current eFiling process works</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>The request can be initiated where assessed debt is outstanding.</li>
          <li>SARS's eFiling guide allows only one tax type per payment-arrangement request.</li>
          <li>The system initially presents an auto-simulated plan defaulted to six months.</li>
          <li>You may accept the simulation or propose different terms; the guide currently allows a proposed term from 1 to 36 months.</li>
          <li>The six-month simulation is a system starting point, not a promise that SARS will approve six months for every taxpayer.</li>
          <li>Supporting documents may be required before the request can be finalised.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Supporting information SARS may request</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          The exact request depends on taxpayer type and circumstances. SARS's current eFiling guide says supporting
          documents can include the following.
        </p>
        <Checklist
          items={[
            "Company or business bank statements for the recent period requested by SARS",
            "A forward-looking cash-flow statement where required",
            "Financial statements and current management accounts where applicable",
            "Asset information and debtor/creditor analyses for business taxpayers",
            "For salary-earning individuals, bank statements, a recent payslip and proof of outstanding accounts",
            "A clear reason for requesting the payment arrangement",
          ]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Interest, approval and default</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          SARS states that interest continues to accrue on unpaid debt. If an approved arrangement is not adhered to,
          SARS may terminate it and resume normal collection proceedings. A prior default can also affect a new
          request, and SARS says valid reasons for the earlier default should be provided.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <OptionCard
          title="Payment arrangement"
          body="Designed to pay the outstanding debt over time, subject to SARS approval and the agreed terms."
        />
        <OptionCard
          title="Section 200 compromise"
          body="A separate statutory process in which SARS may accept a compromise of part of a tax debt where the legal requirements are met."
          href="/sars-compromise"
          linkLabel="Compare with compromise"
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">How Acapolite can assist</h2>
        <Checklist
          items={[
            "Review the debt by tax type and outstanding period",
            "Identify compliance issues that need to be corrected first",
            "Prepare a motivated proposed repayment plan",
            "Assemble the financial records SARS requests",
            "Submit or support the arrangement request through the appropriate channel",
            "Track SARS correspondence and help respond to follow-up requests",
          ]}
        />
      </section>

      <AssistanceCta title="Prepare a SARS payment-arrangement request" intent="payment-arrangement" from="/sars-payment-arrangements" />
    </PageShell>
  );
}

export function SarsCompromisePage() {
  const path = "/sars-compromise";
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Our Services", path: "/our-services" },
    { name: "SARS & Tax Assistance", path: "/sars-tax-assistance" },
    { name: "SARS Debt", path: "/sars-debt" },
    { name: "Section 200 Compromise" },
  ];

  return (
    <PageShell
      path={path}
      eyebrow="Section 200 Tax Debt Compromise"
      title="SARS Section 200 Compromise Assistance"
      description="Understand the SARS tax-debt compromise process and get professional help preparing the financial disclosure, motivation and offer required for a Section 200 request."
      metaDescription="Professional SARS Section 200 compromise assistance in South Africa. Understand the statutory test, supporting financial records, offer and tax debt compromise process."
      crumbs={crumbs}
      sources={[sources.debt, sources.taa]}
    >
      <section>
        <h2 className="text-xl font-semibold text-foreground">What is a compromise of tax debt?</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
          Section 200 of the Tax Administration Act allows a senior SARS official to authorise compromise of a
          portion of a tax debt on request where the section 201 requirements are met, the compromise is aimed at
          securing the highest net recovery from the debt, and it is consistent with sound tax-system management and
          administrative efficiency. It is not an automatic write-off.
        </p>
      </section>

      <section className="rounded-[28px] border border-border bg-muted/30 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">A compromise requires full financial disclosure</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          SARS's current debt guidance says compromise applications must include comprehensive supporting
          information. Its published examples include the items below, while also making clear that the list is not
          exhaustive.
        </p>
        <Checklist
          items={[
            "Latest annual financial statements, where applicable",
            "Recent bank statements",
            "A 12-month cash-flow forecast",
            "A list of assets and liabilities",
            "A debtors age analysis where relevant",
            "A motivated offer explaining the proposed amount and source of funds",
            "A completed Collection Information Statement (CIS)",
          ]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">What SARS is assessing</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          The statutory question is not simply whether the taxpayer cannot pay in full. SARS must consider the
          compromise within the framework in Part D of Chapter 14 of the Tax Administration Act. The taxpayer's
          financial position, assets, liabilities, expected recovery and the quality and completeness of the
          disclosure all matter. Current SARS operational guidance may also apply additional screening conditions,
          so eligibility should be checked against the facts and the latest SARS material at the time of application.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <OptionCard
          title="Payment arrangement"
          body="The taxpayer remains liable for the debt and seeks time to settle it under an approved instalment or deferred-payment agreement."
          href="/sars-payment-arrangements"
          linkLabel="View payment arrangements"
        />
        <OptionCard
          title="Compromise"
          body="SARS considers accepting less than the full tax debt under the statutory compromise framework. The financial disclosure and legal test are materially different."
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Typical process</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
          <li><strong className="text-foreground">1. Confirm the debt and compliance position.</strong> Identify the tax types, periods, assessments and any outstanding returns or disputes.</li>
          <li><strong className="text-foreground">2. Assess whether compromise is the appropriate route.</strong> Compare it with payment arrangements and dispute remedies.</li>
          <li><strong className="text-foreground">3. Build the financial disclosure.</strong> Assemble the CIS and supporting financial records SARS requires for the case.</li>
          <li><strong className="text-foreground">4. Motivate the offer.</strong> Explain the proposed amount, source of funds and why the proposal should be considered under the statutory framework.</li>
          <li><strong className="text-foreground">5. Respond to SARS follow-up.</strong> SARS may request clarification or further documents before deciding the application.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">How Acapolite can assist</h2>
        <Checklist
          items={[
            "Review the debt, compliance position and alternative resolution routes",
            "Prepare the CIS and financial-document checklist",
            "Draft the compromise motivation and offer narrative",
            "Organise bank statements, financial statements, cash-flow and asset/liability information",
            "Prepare practitioner correspondence and respond to SARS follow-up",
            "Track the application without promising an outcome or processing time",
          ]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Common questions</h2>
        <div className="mt-4 space-y-5">
          <div>
            <h3 className="font-semibold text-foreground">Does Section 200 mean SARS must reduce my debt?</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              No. The Act gives a senior SARS official authority to approve a compromise when the statutory
              requirements are met. Approval is not automatic.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Is a compromise suitable when I dispute the assessment itself?</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A compromise addresses collection of tax debt. If the underlying assessment or decision is wrong, the
              objection and appeal process may be the more relevant route and should be assessed separately.
            </p>
          </div>
        </div>
      </section>

      <AssistanceCta title="Prepare a properly supported Section 200 submission" intent="compromise" from="/sars-compromise" />
    </PageShell>
  );
}

export function SarsObjectionsPage() {
  const path = "/sars-objections";
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Our Services", path: "/our-services" },
    { name: "SARS & Tax Assistance", path: "/sars-tax-assistance" },
    { name: "SARS Objections & Disputes" },
  ];

  return (
    <PageShell
      path={path}
      eyebrow="SARS Objections, Appeals & ADR"
      title="SARS Objections, Appeals & Dispute Assistance"
      description="Get professional help assessing a SARS assessment or decision, preparing an objection, handling an appeal or ADR process, and considering suspension of payment where appropriate."
      metaDescription="Need help objecting to SARS? Understand the current objection deadline, appeals, ADR, Request for Reasons, Request for Correction and suspension of payment."
      crumbs={crumbs}
      sources={[
        sources.objections,
        sources.appeals,
        sources.disputeGuide,
        sources.reasons,
        sources.correction,
        sources.debt,
        sources.taa,
      ]}
    >
      <section>
        <h2 className="text-xl font-semibold text-foreground">Start by identifying what is actually wrong</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
          Not every problem requires the same dispute step. A mistake in a submitted return may sometimes be corrected
          through Request for Correction. If SARS's reasons are not sufficient to formulate an objection, a Request
          for Reasons may be relevant. Where the taxpayer is aggrieved by an assessment or an objectionable decision,
          the formal objection and appeal process applies.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <OptionCard
          title="Request for Correction"
          body="SARS provides an eFiling Request for Correction process for certain previously submitted returns or declarations. If the correction option is unavailable, a formal objection may be required."
        />
        <OptionCard
          title="Request for Reasons"
          body="A taxpayer may request reasons where the assessment does not give enough information to understand the basis and formulate an objection. SARS currently says this request must generally be made within 30 business days of the assessment or decision."
        />
        <OptionCard
          title="Notice of Objection"
          body="SARS's current objections page states that an objection must generally be submitted within 80 business days, subject to the rules that apply where reasons were requested or where a late objection is sought."
        />
      </section>

      <section className="rounded-[28px] border border-border bg-muted/30 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">The objection and appeal journey</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
          <li><strong className="text-foreground">1. Review the assessment or decision.</strong> Confirm the tax type, period, issue, reasons and evidence.</li>
          <li><strong className="text-foreground">2. Lodge the objection in the prescribed manner.</strong> SARS provides an automated dispute process on eFiling for major tax types and branch submission where applicable.</li>
          <li><strong className="text-foreground">3. Consider the SARS objection outcome.</strong> If the objection is disallowed or partly allowed, the taxpayer may appeal.</li>
          <li><strong className="text-foreground">4. Lodge the appeal on time.</strong> SARS currently states that an appeal must generally be lodged within 30 business days after delivery of the objection outcome.</li>
          <li><strong className="text-foreground">5. ADR may be considered.</strong> The taxpayer can indicate willingness to use Alternative Dispute Resolution in the appeal process, but SARS determines whether the matter is appropriate for ADR.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Late objections require grounds</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          SARS says that where an objection is submitted after the prescribed period, the taxpayer must provide
          reasons for the delay. SARS will only consider the merits if the late filing is condoned under the
          applicable rules. Because the extension rules depend on the circumstances, a late objection should be
          assessed promptly rather than treated as automatically recoverable.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">A dispute does not automatically suspend payment</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          SARS's debt guidance states that the obligation to pay generally remains while a dispute is being handled.
          A taxpayer may separately request suspension of payment under section 164. SARS's current eFiling dispute
          guide includes suspension-of-payment functionality for supported tax types and periods. Whether a
          suspension should be requested depends on the facts and the relevant debt.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Evidence and supporting documents</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          A strong dispute identifies the exact assessment item or decision challenged, states clear grounds and
          connects those grounds to the supporting records. The appropriate evidence depends on the tax type and the
          issue rather than on a generic checklist.
        </p>
        <Checklist
          items={[
            "The assessment, decision or SARS notice being challenged",
            "A clear chronology of the relevant facts and submissions",
            "Supporting tax records, calculations and source documents",
            "SARS correspondence, verification or audit material relevant to the disputed item",
            "Reasons for lateness where the prescribed dispute period has passed",
            "Separate motivation for suspension of payment where that relief is sought",
          ]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">How Acapolite can assist</h2>
        <Checklist
          items={[
            "Assess whether correction, reasons, objection or another route is appropriate",
            "Review the assessment and identify the disputed items",
            "Prepare grounds of objection and organise supporting evidence",
            "Assist with appeal and ADR preparation after an objection outcome",
            "Prepare a separate suspension-of-payment request where appropriate",
            "Track deadlines, SARS correspondence and follow-up requirements",
          ]}
        />
      </section>

      <AssistanceCta title="Get help with a SARS objection or dispute" intent="objections" from="/sars-objections" />
    </PageShell>
  );
}
