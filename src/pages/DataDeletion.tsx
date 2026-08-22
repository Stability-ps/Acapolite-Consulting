import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

const PAGE_TITLE = "Data Deletion Request | Acapolite Consulting";
const PAGE_DESCRIPTION = "Information on how to request deletion of eligible personal data associated with Acapolite Consulting services, including WhatsApp communications.";

export default function DataDeletion() {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionTag?.getAttribute("content") ?? null;

    document.title = PAGE_TITLE;
    descriptionTag?.setAttribute("content", PAGE_DESCRIPTION);

    return () => {
      document.title = previousTitle;
      if (previousDescription !== null) descriptionTag?.setAttribute("content", previousDescription);
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Legal</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">
            Data Deletion Request — Acapolite Consulting
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            Acapolite Consulting respects an individual&apos;s right to request deletion of eligible personal
            information associated with its digital services, including information processed through WhatsApp
            and Meta integrations.
          </p>

          <div className="mt-8 space-y-6 text-sm text-foreground font-body">
            <section>
              <h2 className="text-lg font-semibold">1. How to Request Deletion</h2>
              <p className="mt-2 text-muted-foreground">
                To request deletion of your personal information, please email{" "}
                <a href="mailto:support@acapoliteconsulting.co.za" className="text-primary underline underline-offset-2">
                  support@acapoliteconsulting.co.za
                </a>{" "}
                with the following details:
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Your full name</li>
                <li>The WhatsApp number and/or email address associated with your account or service</li>
                <li>Enough information for us to identify the relevant records</li>
                <li>A clear statement that you are requesting deletion of your personal information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Verifying Your Request</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite may verify the identity of the requester before actioning a deletion request. This helps
                protect your information from being deleted or disclosed to someone who is not entitled to make
                the request.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. How We Handle Eligible Data</h2>
              <p className="mt-2 text-muted-foreground">
                Following verification, Acapolite will delete, anonymise, restrict or otherwise appropriately
                handle eligible personal data, subject to applicable law and our legal retention obligations. We
                cannot promise that every record will always be deleted immediately, as certain records may need
                to be retained where required or permitted for:
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Tax obligations</li>
                <li>Accounting records</li>
                <li>Regulatory obligations</li>
                <li>Fraud prevention</li>
                <li>Dispute handling</li>
                <li>Legal claims</li>
                <li>Contractual obligations</li>
                <li>Statutory record-retention requirements</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                Where retention is legally required, access to that data is restricted and it is kept only for
                the period required.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. WhatsApp and Meta Data</h2>
              <p className="mt-2 text-muted-foreground">
                Deleting information from Acapolite&apos;s own systems does not automatically delete information
                that WhatsApp or Meta Platforms, Inc. independently retain under their own policies. Where data is
                controlled independently by WhatsApp or Meta, you may need to separately use WhatsApp&apos;s and
                Meta&apos;s own privacy and data-management mechanisms to manage that information.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. What Happens After a Request</h2>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Your request is received.</li>
                <li>Your identity and the details of your request are verified where necessary.</li>
                <li>Acapolite identifies the applicable data.</li>
                <li>Eligible data is deleted, anonymised or restricted.</li>
                <li>Any legally required records are retained only for as long as necessary.</li>
                <li>You receive confirmation where appropriate.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Related Policies</h2>
              <p className="mt-2 text-muted-foreground">
                See our{" "}
                <Link to="/privacy-policy" className="text-primary underline underline-offset-2">Privacy Policy</Link>{" "}
                for more detail on how we collect, use and protect personal information, including information
                shared through WhatsApp.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Contact</h2>
              <p className="mt-2 text-muted-foreground">Acapolite Consulting</p>
              <p className="text-muted-foreground">
                <a href="mailto:support@acapoliteconsulting.co.za" className="text-primary underline underline-offset-2">
                  support@acapoliteconsulting.co.za
                </a>
              </p>
              <p className="text-muted-foreground">
                <a href="https://acapoliteconsulting.co.za" className="text-primary underline underline-offset-2">
                  https://acapoliteconsulting.co.za
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
