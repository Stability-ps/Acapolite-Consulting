import { motion } from "framer-motion";
import { BadgeCheck, FileCheck2, ShieldCheck } from "lucide-react";

export function VerifiedPractitioners() {
  return (
    <section className="bg-background py-24">
      <div className="container mx-auto px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <BadgeCheck className="h-4 w-4" />
              Verified Practitioner
            </span>
            <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-5xl">
              Work with Verified Tax Practitioners
            </h2>
            <p className="max-w-2xl text-lg text-muted-foreground font-body">
              Practitioners are verified before assisting clients, including document and credential checks for
              professional registration. This ensures you receive trusted guidance at every step.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid gap-4"
          >
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
                <FileCheck2 className="h-5 w-5 text-primary" />
              </div>
              <p className="font-semibold text-foreground">Document Verification</p>
              <p className="mt-2 text-sm text-muted-foreground font-body">
                Registration numbers and supporting documents are reviewed before approval.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <p className="font-semibold text-foreground">Credential Checks</p>
              <p className="mt-2 text-sm text-muted-foreground font-body">
                Only verified practitioners can respond to your service request.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
