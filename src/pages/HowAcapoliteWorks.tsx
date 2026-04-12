import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export default function HowAcapoliteWorks() {
  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Company</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">How Acapolite Works</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            Acapolite Consulting is a professional digital platform designed to connect individuals, businesses,
            and organizations with qualified tax practitioners. Our goal is to simplify access to trusted financial
            and tax services while ensuring secure communication, document handling, and case tracking.
          </p>

          <div className="mt-8 space-y-8 text-sm text-foreground font-body">
            <section>
              <h2 className="text-lg font-semibold">How It Works — For Clients</h2>
              <div className="mt-4 space-y-5 text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">Step 1 — Submit a Service Request</p>
                  <ul className="mt-2 list-disc pl-5">
                    <li>Complete a simple request form describing your tax or accounting needs</li>
                    <li>Select whether you are an Individual or Company</li>
                    <li>Provide required details such as ID Number or Company Registration Number</li>
                    <li>Indicate any SARS outstanding returns or debt amounts</li>
                    <li>Upload supporting documents if available</li>
                  </ul>
                  <p className="mt-2">
                    Once submitted, your request is securely stored and made available to qualified practitioners who
                    provide the services you selected.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-foreground">Step 2 — Receive Responses from Practitioners</p>
                  <ul className="mt-2 list-disc pl-5">
                    <li>Qualified practitioners review your request</li>
                    <li>Interested practitioners respond with an introduction</li>
                    <li>You may receive multiple responses depending on availability</li>
                    <li>You can compare experience, credentials, and communication style</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-foreground">Step 3 — Select Your Practitioner</p>
                  <ul className="mt-2 list-disc pl-5">
                    <li>Review practitioner profiles</li>
                    <li>Check verified status and professional experience</li>
                    <li>Select the practitioner best suited for your needs</li>
                    <li>Your request automatically becomes an active case</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-foreground">Step 4 — Start Working Securely</p>
                  <ul className="mt-2 list-disc pl-5">
                    <li>Communicate directly through the platform messaging system</li>
                    <li>Upload and share documents securely</li>
                    <li>Track case progress and updates</li>
                    <li>Receive notifications when actions are completed</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">How It Works — For Practitioners</h2>
              <div className="mt-4 space-y-5 text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">Step 1 — Register as a Practitioner</p>
                  <ul className="mt-2 list-disc pl-5">
                    <li>Create your professional practitioner account</li>
                    <li>Complete your profile with services and credentials</li>
                    <li>Upload verification documents if required</li>
                    <li>Wait for approval by the platform administrator</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-foreground">Step 2 — Receive Free Credits</p>
                  <ul className="mt-2 list-disc pl-5">
                    <li>New practitioners receive 10 FREE Credits upon registration</li>
                    <li>Credits allow practitioners to respond to client service requests</li>
                    <li>Additional credits can be purchased when needed</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-foreground">Step 3 — Respond to Client Requests</p>
                  <ul className="mt-2 list-disc pl-5">
                    <li>Browse available service requests</li>
                    <li>Select requests that match your expertise</li>
                    <li>Use credits to unlock and respond to requests</li>
                    <li>Send professional introductions to clients</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-foreground">Step 4 — Manage Cases and Clients</p>
                  <ul className="mt-2 list-disc pl-5">
                    <li>Once selected by a client, the request becomes an active case</li>
                    <li>Communicate directly with assigned clients</li>
                    <li>Upload documents and manage tasks</li>
                    <li>Track progress and close completed cases</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Security and Data Protection</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting uses secure technologies to protect user data and maintain confidentiality.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Secure login and user authentication</li>
                <li>Role-based access control for clients and practitioners</li>
                <li>Encrypted document storage</li>
                <li>Strict privacy controls to ensure users only see their own data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Why Use Acapolite Consulting</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Access trusted tax practitioners</li>
                <li>Manage tax and accounting services in one platform</li>
                <li>Track progress of your requests in real-time</li>
                <li>Communicate securely with professionals</li>
                <li>Improve efficiency and reduce administrative delays</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
