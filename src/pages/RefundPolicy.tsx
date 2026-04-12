import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Legal</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Refund Policy — Acapolite Consulting</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            This Refund Policy outlines the conditions under which refunds may be granted on the Acapolite
            Consulting platform. By purchasing credits or subscriptions, users agree to this Refund Policy.
          </p>

          <div className="mt-8 space-y-6 text-sm text-foreground font-body">
            <section>
              <h2 className="text-lg font-semibold">1. Credit Purchases</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Credits purchased are non-refundable once used</li>
                <li>Unused credits may be reviewed for refund eligibility within a limited time</li>
                <li>Refund requests must include valid supporting reasons</li>
                <li>Refund decisions remain subject to administrative review</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Subscription Payments</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Subscriptions are billed on a recurring basis</li>
                <li>Users may cancel subscriptions before the next billing date</li>
                <li>No refunds are issued for partially used subscription periods</li>
                <li>Credits already issued remain non-refundable once used</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Duplicate Payments</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Duplicate payments caused by system error may qualify for refunds</li>
                <li>Proof of duplicate payment must be provided</li>
                <li>Refunds will be processed after verification</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Failed Transactions</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>If payment is successful but credits are not received, the issue will be investigated</li>
                <li>Credits may be added manually after verification</li>
                <li>Refunds may be issued if credit allocation cannot be completed</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Refund Request Procedure</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Submit refund request via official support channels</li>
                <li>Provide proof of payment</li>
                <li>Describe reason for refund request</li>
                <li>Allow time for investigation</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Processing Time</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Approved refunds may take several business days</li>
                <li>Processing time depends on payment provider</li>
                <li>Users will receive confirmation once processed</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Policy Updates</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting reserves the right to update this Refund Policy when necessary.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Contact Information</h2>
              <p className="mt-2 text-muted-foreground">
                For refund-related questions, contact info@acapoliteconsulting.co.za.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
