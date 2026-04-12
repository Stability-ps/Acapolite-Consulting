import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section id="cta" className="relative overflow-hidden bg-surface-gradient py-24 scroll-mt-32">
      <div className="absolute inset-0 opacity-100">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 18%, rgba(59,130,246,0.12) 0%, transparent 26%), radial-gradient(circle at 82% 14%, rgba(14,165,233,0.10) 0%, transparent 24%), radial-gradient(circle at 50% 100%, rgba(255,255,255,0.7) 0%, transparent 42%)",
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sky-100/70 to-transparent" />

      <div className="container relative z-10 mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="mb-3 inline-flex rounded-full border border-primary/12 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary/80 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
            Get Started
          </span>
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-5xl">
            Ready to Resolve Your SARS Matters?
          </h2>
          <p className="mx-auto max-w-2xl text-lg font-body text-muted-foreground">
            Submit a request today or create an account to start working securely with verified tax practitioners.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-xl bg-primary px-8 py-6 text-base font-semibold text-primary-foreground shadow-elevated hover:bg-primary/90">
              <Link to="/request-tax-assistance">Request Tax Assistance</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl border-primary/30 bg-white/90 px-8 py-6 text-base font-semibold text-foreground hover:bg-white">
              <Link to="/register">
                Create Account <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
