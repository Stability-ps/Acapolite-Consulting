import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

const trustIndicators = [
  "SARS Registered Tax Practitioners",
  "Secure Client Portal",
  "Trusted by South African Individuals & Businesses",
  "Confidential & POPIA-Compliant",
];

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex items-center overflow-hidden bg-hero-gradient pb-8 pt-20 md:pt-24"
      style={{ aspectRatio: "16 / 9" }}
    >
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 0%, transparent 50%)`,
          }}
        />
      </div>
      <div className="absolute inset-0">
        <img
          src="/MASS.png"
          alt="Professional tax assistance"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1f3a]/95 via-[#0b1f3a]/70 to-[#0b1f3a]/30" />
      </div>

      <div className="container relative z-10 mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl"
        >
          <AcapoliteLogo className="mb-4 h-14 sm:h-16" />

          <h1 className="mb-3 font-display text-4xl font-bold leading-tight text-primary-foreground md:text-6xl lg:text-7xl">
            Professional SARS Tax Assistance for Individuals and Businesses
          </h1>

          <p className="mb-4 max-w-2xl text-lg font-body leading-relaxed text-primary-foreground/75 md:text-xl">
            We help South African individuals and businesses resolve SARS issues, submit tax returns, manage compliance,
            and work securely through one platform.
          </p>

          <div className="mb-4 flex flex-wrap gap-3">
            {trustIndicators.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/14 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/80"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-xl bg-primary px-8 py-6 text-base font-semibold text-primary-foreground shadow-elevated hover:bg-primary/90">
              <Link to="/request-tax-assistance">Request Tax Assistance</Link>
            </Button>
            <Button asChild size="lg" className="rounded-xl border border-white/70 bg-white/95 px-8 py-6 text-base font-semibold !text-foreground hover:bg-white">
              <Link to="/login">Log In to Portal</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl border border-white/18 bg-transparent px-8 py-6 text-base font-semibold text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
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
