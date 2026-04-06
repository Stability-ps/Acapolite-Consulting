import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Shield, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-hero-gradient min-h-[85vh] flex items-center">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 0%, transparent 50%)`
        }} />
      </div>
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl"
        >
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-8 w-8 text-primary-foreground/80" />
            <span className="font-display text-2xl font-bold text-primary-foreground tracking-tight">
              Acapolite
            </span>
            <span className="text-primary-foreground/70 text-lg font-body">Consulting</span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground leading-tight mb-6">
            Expert Tax Consulting,{" "}
            <span className="text-primary-foreground/80 italic">Simplified</span> for You
          </h1>

          <p className="text-lg md:text-xl text-primary-foreground/75 max-w-2xl mb-10 font-body leading-relaxed">
            Acapolite Consulting guides South African individuals and businesses through complex SARS processes — from tax returns to dispute resolution — all managed securely in one portal.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg" variant="secondary" className="text-base font-semibold px-8 py-6 rounded-xl shadow-elevated">
              <Link to="/login">Log In to Portal</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base font-semibold px-8 py-6 rounded-xl border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
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
