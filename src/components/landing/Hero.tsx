import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Shield, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section id="top" className="relative flex min-h-[92vh] items-center overflow-hidden bg-hero-gradient pt-28 md:pt-32">
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 0%, transparent 50%)`,
          }}
        />
      </div>

      <div className="container relative z-10 mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-primary-foreground/80 backdrop-blur">
            Secure SARS workflow management
          </div>

          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur">
              <Shield className="h-6 w-6 text-primary-foreground/85" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-primary-foreground">
              Acapolite
            </span>
            <span className="text-lg font-body text-primary-foreground/70">Consulting</span>
          </div>

          <h1 className="mb-6 font-display text-4xl font-bold leading-tight text-primary-foreground md:text-6xl lg:text-7xl">
            Expert Tax Consulting,{" "}
            <span className="text-primary-foreground/80 italic">Simplified</span> for You
          </h1>

          <p className="mb-10 max-w-2xl text-lg font-body leading-relaxed text-primary-foreground/75 md:text-xl">
            Acapolite Consulting guides South African individuals and businesses through complex SARS
            processes, from tax returns to dispute resolution, all managed securely in one portal.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-xl bg-primary px-8 py-6 text-base font-semibold text-primary-foreground shadow-elevated hover:bg-primary/90">
              <Link to="/login">Log In to Portal</Link>
            </Button>
            <Button asChild size="lg" className="rounded-xl border border-white/70 bg-white/95 px-8 py-6 text-base font-semibold !text-foreground hover:bg-white">
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
