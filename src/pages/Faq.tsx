import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export default function Faq() {
  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Support</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Frequently Asked Questions (FAQ) — Acapolite Consulting</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            Quick answers to the most common questions from clients and practitioners using the Acapolite platform.
          </p>

          <div className="mt-8 space-y-8 text-sm text-foreground font-body">
            <section>
              <h2 className="text-lg font-semibold">For Clients</h2>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">How do I request assistance?</p>
                  <p className="mt-1">
                    Create a client account, select the service category you require, choose the specific service,
                    upload supporting documents if available, and submit your request. Practitioners will review
                    and respond to your request.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">How do I choose a practitioner?</p>
                  <p className="mt-1">
                    You can review practitioner profiles, experience, and verification status. Once you receive
                    responses, select the practitioner who best matches your needs.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Is my information secure?</p>
                  <p className="mt-1">
                    Yes. Acapolite uses secure login systems, encrypted document storage, and role-based
                    permissions to ensure that only authorized users access your data.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Can I upload documents securely?</p>
                  <p className="mt-1">
                    Yes. The platform allows secure document uploads directly to your case. Only your assigned
                    practitioner and admin can view your documents.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Can I track the progress of my request?</p>
                  <p className="mt-1">
                    Yes. Clients can view updates, messages, and document activity directly from their dashboard.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">What happens if I have outstanding SARS debt or missing returns?</p>
                  <p className="mt-1">
                    You can indicate your outstanding debt or missing returns when submitting a request.
                    Practitioners will assist you in resolving these issues.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">For Practitioners</h2>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">How do I join as a practitioner?</p>
                  <p className="mt-1">
                    Click "Become a Practitioner", create your account, complete your profile, upload verification
                    documents, and wait for admin approval.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">How do credits work?</p>
                  <p className="mt-1">
                    Credits are used to respond to client requests. When you unlock or respond to a request, the
                    required number of credits will be deducted.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Do credits expire?</p>
                  <p className="mt-1">
                    No. Credits on the Acapolite platform do not expire and remain available until used.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">How do I purchase credits?</p>
                  <p className="mt-1">
                    You can purchase credits through the Credits section on your dashboard using approved payment
                    methods such as PayFast.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">How do I receive clients?</p>
                  <p className="mt-1">
                    Clients submit service requests. Practitioners can view available requests that match their
                    services and respond using credits.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">What is the Verified Practitioner Badge?</p>
                  <p className="mt-1">
                    The Verified Practitioner Badge confirms that your credentials have been reviewed and approved.
                    Verified practitioners receive higher visibility and increased client trust.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">General Questions</h2>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">Who provides the services on Acapolite?</p>
                  <p className="mt-1">
                    Services are provided by independent, registered practitioners who join the platform to assist
                    clients.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Does Acapolite provide tax services directly?</p>
                  <p className="mt-1">
                    Acapolite Consulting operates as a platform that connects clients with independent
                    professionals. Services are delivered by registered practitioners.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Who can I contact for support?</p>
                  <p className="mt-1">
                    You can contact support using the Contact Us page or by emailing info@acapoliteconsulting.co.za.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
