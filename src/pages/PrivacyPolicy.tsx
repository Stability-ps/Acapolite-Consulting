import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Legal</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Privacy Policy — Acapolite Consulting</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            This Privacy Policy explains how Acapolite Consulting collects, uses, stores, and protects personal
            information provided by users of our platform. By using the Acapolite platform, you agree to the
            collection and use of information in accordance with this policy.
          </p>

          <div className="mt-8 space-y-6 text-sm text-foreground font-body">
            <section>
              <h2 className="text-lg font-semibold">1. Information We Collect</h2>
              <p className="mt-2 text-muted-foreground">
                We collect information necessary to provide services and operate the platform effectively.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Personal identification information (Name, ID Number, Email, Phone Number)</li>
                <li>Business information (Company Registration Number where applicable)</li>
                <li>Tax-related and financial documents uploaded by users</li>
                <li>Communication records between clients and practitioners</li>
                <li>System usage data such as login history and activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. How We Use Your Information</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>To create and manage user accounts</li>
                <li>To match clients with suitable practitioners</li>
                <li>To process service requests</li>
                <li>To communicate updates and notifications</li>
                <li>To improve platform functionality and performance</li>
                <li>To comply with legal and regulatory obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Document and Data Storage</h2>
              <p className="mt-2 text-muted-foreground">
                Documents uploaded to the platform are securely stored and protected using appropriate security
                measures.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Encrypted document storage</li>
                <li>Role-based access control</li>
                <li>Restricted access to authorized users only</li>
                <li>Secure server infrastructure</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Sharing of Information</h2>
              <p className="mt-2 text-muted-foreground">
                Information may be shared only where necessary to provide services or comply with legal obligations.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>With assigned practitioners working on your case</li>
                <li>With authorized administrators</li>
                <li>With payment providers for transaction processing</li>
                <li>With regulatory authorities when legally required</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Data Protection and Security</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Secure login authentication systems</li>
                <li>Encrypted data transmission</li>
                <li>Regular monitoring of system activity</li>
                <li>Protection against unauthorized access</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. User Responsibilities</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Keep login details confidential</li>
                <li>Provide accurate information</li>
                <li>Notify administrators of suspicious activity</li>
                <li>Upload only authorized documents</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Data Retention</h2>
              <p className="mt-2 text-muted-foreground">
                User information and documents may be retained for operational, legal, and compliance purposes.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Records may be retained as required by tax and regulatory laws</li>
                <li>Inactive accounts may be archived</li>
                <li>Users may request account closure subject to compliance obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. User Rights</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Access your personal information</li>
                <li>Request corrections to inaccurate information</li>
                <li>Request deletion where legally permitted</li>
                <li>Request information about how data is used</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Updates to This Policy</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting reserves the right to update this Privacy Policy as required. Updated versions
                will be published on the platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Contact Information</h2>
              <p className="mt-2 text-muted-foreground">
                For privacy-related questions or requests, please contact info@acapoliteconsulting.co.za.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
