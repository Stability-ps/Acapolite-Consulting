import { Link } from "react-router-dom";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export default function HelpCenter() {
  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Support</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Help Center</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            Find answers quickly or reach the Acapolite team directly. We recommend reviewing the FAQs and Trust &amp;
            Safety policies before submitting a request.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Link
              to="/faq"
              className="rounded-2xl border border-border bg-background/60 p-4 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5"
            >
              FAQ
              <span className="mt-2 block text-xs font-normal text-muted-foreground">
                Common questions from clients and practitioners.
              </span>
            </Link>
            <Link
              to="/trust-safety"
              className="rounded-2xl border border-border bg-background/60 p-4 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5"
            >
              Trust &amp; Safety
              <span className="mt-2 block text-xs font-normal text-muted-foreground">
                Learn how we protect users and platform integrity.
              </span>
            </Link>
            <Link
              to="/contact-us"
              className="rounded-2xl border border-border bg-background/60 p-4 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5"
            >
              Contact Us
              <span className="mt-2 block text-xs font-normal text-muted-foreground">
                Submit a support request through the unified form.
              </span>
            </Link>
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-accent/20 p-5 text-sm text-muted-foreground font-body">
            <p className="font-semibold text-foreground">Support Guidance</p>
            <ul className="mt-3 list-disc pl-5">
              <li>Use the unified Contact Us form for all requests, billing, or account issues.</li>
              <li>Include screenshots or documents to speed up resolution.</li>
              <li>For urgent cases, select a higher priority level in the form.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
