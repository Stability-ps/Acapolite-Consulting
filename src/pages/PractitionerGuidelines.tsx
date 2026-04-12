import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export default function PractitionerGuidelines() {
  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Guidelines</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Practitioner Guidelines — Acapolite Consulting</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            This Practitioner Guidelines document outlines the standards, responsibilities, and expectations for
            professionals using the Acapolite Consulting platform. All practitioners must follow these guidelines
            to maintain quality service delivery and protect the reputation of the platform.
          </p>

          <div className="mt-8 space-y-6 text-sm text-foreground font-body">
            <section>
              <h2 className="text-lg font-semibold">1. Professional Conduct</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Maintain professional behavior at all times</li>
                <li>Communicate respectfully with clients and administrators</li>
                <li>Provide accurate and truthful information</li>
                <li>Act in accordance with professional standards and ethics</li>
                <li>Deliver services within your area of expertise</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Profile Accuracy</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Ensure all profile details are accurate and up to date</li>
                <li>Provide correct professional registration numbers</li>
                <li>List only services you are qualified to perform</li>
                <li>Update profile information when changes occur</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Communication Standards</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Respond to client messages in a timely manner</li>
                <li>Maintain clear and professional communication</li>
                <li>Avoid sharing misleading or false information</li>
                <li>Keep communication within the platform where possible</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Response to Client Requests</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Respond only to service requests relevant to your expertise</li>
                <li>Use credits responsibly when unlocking client requests</li>
                <li>Provide honest and clear introductions to clients</li>
                <li>Avoid responding to requests you cannot complete</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Document Handling</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Treat all client documents as confidential</li>
                <li>Use platform tools to securely upload and download documents</li>
                <li>Do not share client information without authorization</li>
                <li>Follow data protection and confidentiality requirements</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Service Delivery Standards</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Deliver services professionally and on time</li>
                <li>Inform clients about expected timelines</li>
                <li>Notify clients of any delays or issues</li>
                <li>Ensure accurate submission of documents and reports</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Credit Usage Responsibility</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Use credits only for legitimate service responses</li>
                <li>Do not attempt to manipulate credit usage</li>
                <li>Ensure sufficient credit balance before responding</li>
                <li>Report system errors related to credits immediately</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Compliance and Legal Responsibilities</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Follow all applicable tax and financial regulations</li>
                <li>Maintain valid professional registration</li>
                <li>Operate within legal and regulatory frameworks</li>
                <li>Provide services in accordance with national standards</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Misconduct and Violations</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Fraudulent activity may result in suspension</li>
                <li>Providing false credentials may lead to account removal</li>
                <li>Inappropriate communication is not permitted</li>
                <li>Repeated violations may result in permanent account termination</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Platform Monitoring and Enforcement</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting administrators monitor platform usage to ensure compliance with guidelines
                and maintain service quality.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Admin may review practitioner activities</li>
                <li>Warnings may be issued for minor violations</li>
                <li>Serious violations may lead to suspension or removal</li>
                <li>Compliance helps maintain platform trust</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">11. Updates to Guidelines</h2>
              <p className="mt-2 text-muted-foreground">
                These Practitioner Guidelines may be updated periodically. Practitioners will be notified of
                significant changes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">12. Contact Information</h2>
              <p className="mt-2 text-muted-foreground">
                For questions regarding Practitioner Guidelines, contact info@acapoliteconsulting.co.za.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
