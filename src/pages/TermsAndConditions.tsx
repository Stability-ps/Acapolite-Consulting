import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Legal</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">
            Terms &amp; Conditions — Acapolite Consulting
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            These Terms and Conditions govern the use of the Acapolite Consulting platform. By accessing or using
            the platform, users agree to comply with these terms.
          </p>

          <div className="mt-8 space-y-6 text-sm text-foreground font-body">
            <section>
              <h2 className="text-lg font-semibold">1. Platform Overview</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting operates as an online platform that connects clients with independent tax
                practitioners and accounting professionals.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Clients submit service requests</li>
                <li>Practitioners respond using credits</li>
                <li>Admin oversees platform operations</li>
                <li>Services are provided by independent practitioners</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. User Accounts</h2>
              <p className="mt-2 text-muted-foreground">
                Users must create an account to access certain platform features.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Users must provide accurate information</li>
                <li>Users are responsible for protecting login credentials</li>
                <li>Unauthorized account use must be reported immediately</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Practitioner Responsibilities</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Practitioners must provide accurate credentials</li>
                <li>Practitioners must act professionally</li>
                <li>Practitioners remain responsible for services delivered</li>
                <li>Practitioners must comply with applicable laws</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Client Responsibilities</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Clients must provide accurate request details</li>
                <li>Clients must upload valid documents where required</li>
                <li>Clients must communicate respectfully with practitioners</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Payments and Credits</h2>
              <p className="mt-2 text-muted-foreground">
                Practitioners use credits to respond to client requests.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Credits may be purchased using approved payment methods</li>
                <li>Credits are deducted when responding to requests</li>
                <li>Credits are non-refundable once used</li>
                <li>Pricing may change with notice</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Verification and Security</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Practitioner verification may be required</li>
                <li>Admin may approve or reject verification requests</li>
                <li>Security measures protect user data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Limitation of Liability</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting is a platform provider and does not directly deliver professional services.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Practitioners are responsible for services provided</li>
                <li>Clients are responsible for selecting practitioners</li>
                <li>The platform is not liable for practitioner performance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Termination of Accounts</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Accounts may be suspended for policy violations</li>
                <li>Fraudulent activity may result in account removal</li>
                <li>Users may request account closure</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Updates to Terms</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting reserves the right to update these Terms and Conditions as required. Users
                will be notified of significant changes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Contact Information</h2>
              <p className="mt-2 text-muted-foreground">
                For questions regarding these Terms and Conditions, please contact info@acapoliteconsulting.co.za.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
