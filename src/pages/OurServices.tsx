import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export default function OurServices() {
  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Company</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Our Services — Acapolite Consulting</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            Acapolite Consulting provides access to qualified tax practitioners and accounting professionals who
            assist individuals and businesses with tax compliance, financial management, and regulatory obligations.
            Our platform ensures reliable, secure, and professional service delivery.
          </p>

          <div className="mt-8 space-y-8 text-sm text-foreground font-body">
            <section>
              <h2 className="text-lg font-semibold">Individual Tax Services</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Personal Income Tax Returns (ITR12)</li>
                <li>Late Tax Return Submissions</li>
                <li>SARS Debt Assistance</li>
                <li>Tax Clearance Certificates</li>
                <li>Tax Number Registration</li>
                <li>Objections and Disputes</li>
                <li>Correction of SARS Records</li>
                <li>Tax Compliance Status Assistance</li>
                <li>Review of SARS Notices and Letters</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                These services are designed to help individuals remain compliant with SARS and resolve any
                outstanding tax issues efficiently.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Business Tax Services</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Company Income Tax Returns (ITR14)</li>
                <li>VAT Registration</li>
                <li>VAT Returns Submission</li>
                <li>PAYE Registration</li>
                <li>PAYE Returns (EMP201 / EMP501)</li>
                <li>SARS Debt Arrangements</li>
                <li>Business Tax Compliance Support</li>
                <li>SARS Audit Assistance</li>
                <li>Company Tax Clearance Certificates</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                Business tax services are tailored to help companies meet their compliance obligations while
                reducing risk and avoiding penalties.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Accounting and Financial Services</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Bookkeeping Services</li>
                <li>Preparation of Financial Statements</li>
                <li>Management Accounts</li>
                <li>Payroll Processing</li>
                <li>Monthly Accounting Services</li>
                <li>Cash Flow Management</li>
                <li>Budget Planning</li>
                <li>Financial Reporting</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                Our accounting services support businesses in maintaining accurate records and making informed
                financial decisions.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Business Support and Compliance Services</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Company Registration (CIPC)</li>
                <li>Business Amendments and Updates</li>
                <li>Annual Returns Filing</li>
                <li>Compliance Monitoring</li>
                <li>Business Advisory Services</li>
                <li>Regulatory Compliance Support</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                These services ensure that businesses remain legally compliant and operationally efficient.
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
          </div>
        </div>
      </div>
    </div>
  );
}
