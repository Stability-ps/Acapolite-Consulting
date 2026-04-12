import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export default function Disclaimer() {
  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Legal</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Disclaimer — Acapolite Consulting</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            This Disclaimer outlines the limitations of responsibility and liability for the use of the Acapolite
            Consulting platform. By using this platform, users acknowledge and agree to the terms described in
            this disclaimer.
          </p>

          <div className="mt-8 space-y-6 text-sm text-foreground font-body">
            <section>
              <h2 className="text-lg font-semibold">1. Platform Role</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting operates as an independent digital platform that connects clients with
                registered tax practitioners and accounting professionals.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Acapolite Consulting does not directly provide professional tax or accounting services</li>
                <li>Services are provided by independent practitioners registered on the platform</li>
                <li>Clients are responsible for selecting practitioners based on their needs</li>
                <li>Practitioners remain responsible for the advice and services they provide</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Professional Advice Disclaimer</h2>
              <p className="mt-2 text-muted-foreground">
                Information provided by practitioners through the platform is their responsibility.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Acapolite Consulting does not guarantee the accuracy of professional advice</li>
                <li>Clients should independently review practitioner qualifications</li>
                <li>Users should seek additional advice when necessary</li>
                <li>Platform administrators do not verify every professional action</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Service Outcomes</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Acapolite Consulting does not guarantee successful outcomes of services</li>
                <li>Results depend on practitioner expertise and client cooperation</li>
                <li>Clients remain responsible for providing accurate information</li>
                <li>Practitioners remain responsible for professional conduct</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. System Availability</h2>
              <p className="mt-2 text-muted-foreground">
                While efforts are made to maintain reliable service, uninterrupted access cannot be guaranteed.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>The platform may experience maintenance or technical interruptions</li>
                <li>Temporary outages may occur due to updates or security improvements</li>
                <li>Acapolite Consulting is not liable for losses caused by downtime</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Third-Party Services</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Payments may be processed through third-party providers such as PayFast</li>
                <li>Third-party services operate under their own terms and policies</li>
                <li>Acapolite Consulting is not responsible for third-party service failures</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. User Responsibility</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Users must protect their login credentials</li>
                <li>Users must provide accurate and truthful information</li>
                <li>Users must follow applicable laws and regulations</li>
                <li>Users must use the platform responsibly</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Limitation of Liability</h2>
              <p className="mt-2 text-muted-foreground">
                To the fullest extent permitted by law, Acapolite Consulting shall not be liable for indirect,
                incidental, or consequential damages arising from the use of the platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Updates to Disclaimer</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting reserves the right to update this Disclaimer when necessary. Updated versions
                will be published on the platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Contact Information</h2>
              <p className="mt-2 text-muted-foreground">
                For questions regarding this Disclaimer, please contact info@acapoliteconsulting.co.za.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
