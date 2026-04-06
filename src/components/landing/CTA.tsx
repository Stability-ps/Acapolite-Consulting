import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function CTA() {
  return (
    <section id="contact" className="relative overflow-hidden bg-hero-gradient py-24 scroll-mt-32">
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 70%)",
          }}
        />
      </div>
      <div className="container relative z-10 mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="mb-6 font-display text-3xl font-bold text-primary-foreground md:text-5xl">
            Ready to Take Control of Your Tax Obligations?
          </h2>
          <p className="mb-10 text-lg text-primary-foreground/75 font-body">
            Join hundreds of South African clients who trust Acapolite Consulting to handle their tax matters with precision, confidentiality, and care.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-xl bg-primary px-8 py-6 text-base font-semibold text-primary-foreground shadow-elevated hover:bg-primary/90">
              <Link to="/register">
                Get Started Today <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" className="rounded-xl border border-white/70 bg-white/95 px-8 py-6 text-base font-semibold !text-foreground hover:bg-white">
              <Link to="/login">Sign In to Portal</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
