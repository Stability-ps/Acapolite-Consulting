import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export default function TrustSafety() {
  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Trust &amp; Safety</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Trust &amp; Safety — Acapolite Consulting</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            Acapolite Consulting is committed to providing a secure and trusted environment for clients and
            practitioners. Our Trust &amp; Safety policies are designed to protect user data, ensure professional
            conduct, and maintain the integrity of the platform.
          </p>

          <div className="mt-8 space-y-6 text-sm text-foreground font-body">
            <section>
              <h2 className="text-lg font-semibold">Practitioner Verification</h2>
              <p className="mt-2 text-muted-foreground">
                All practitioners on the Acapolite platform undergo a verification process to confirm their
                professional status and identity.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Submission of valid identification documents</li>
                <li>Submission of professional registration number (e.g., SARS, SAIT, SAIPA)</li>
                <li>Verification of professional credentials</li>
                <li>Approval by platform administrator</li>
                <li>Issuance of Verified Practitioner Badge upon successful approval</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Client Safety</h2>
              <p className="mt-2 text-muted-foreground">
                We prioritize client safety by ensuring that only verified professionals can respond to service
                requests.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Only verified practitioners can access client requests</li>
                <li>Clients can review practitioner profiles before selection</li>
                <li>Secure messaging ensures controlled communication</li>
                <li>Case progress tracking ensures transparency</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Secure Payments</h2>
              <p className="mt-2 text-muted-foreground">
                Payments on the Acapolite platform are processed using secure payment systems to ensure financial
                safety and reliability.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Secure payment processing through approved payment gateways</li>
                <li>Encrypted transaction processing</li>
                <li>Real-time confirmation of successful payments</li>
                <li>Transparent credit usage tracking</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Data Protection &amp; Privacy</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting follows strict data protection policies to safeguard user information and
                maintain confidentiality.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Secure login and authentication systems</li>
                <li>Encrypted document storage</li>
                <li>Role-based access control</li>
                <li>Compliance with applicable data protection standards</li>
                <li>Users can only access their own data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Reporting Issues or Misconduct</h2>
              <p className="mt-2 text-muted-foreground">
                If users encounter suspicious activity or misconduct, they are encouraged to report it immediately.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Report suspicious behavior to platform administrators</li>
                <li>Flag inappropriate messages or actions</li>
                <li>Provide supporting details when submitting complaints</li>
                <li>Admin team will review and take appropriate action</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Platform Responsibility</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting acts as a platform that connects clients with independent practitioners. While
                we strive to maintain quality standards, services are delivered by independent professionals.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Practitioners remain responsible for services they provide</li>
                <li>Clients are encouraged to review practitioner credentials</li>
                <li>Platform administrators monitor compliance</li>
                <li>Users must follow platform rules and professional standards</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
