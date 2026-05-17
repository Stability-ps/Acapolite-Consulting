import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Lock, MapPin, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";

const trustItems = [
  { label: "Qualified Practitioners", icon: ShieldCheck },
  { label: "Secure Documents", icon: Lock },
  { label: "Nationwide Support", icon: MapPin },
  { label: "Professional Service", icon: Briefcase },
];

export function Hero() {
  return (
    <section id="top" className="bg-background py-24 mt-12 md:mt-16">
      <div className="container mx-auto grid items-center gap-12 px-6 md:grid-cols-[1.05fr_0.95fr]">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <span className="inline-flex rounded-full bg-[#F4F4F2] px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-[#B8962E]">
            ACAPOLITE CONSULTING
          </span>

          <h1 className="mt-6 text-4xl font-black leading-tight tracking-[-0.03em] text-[#022D73] sm:text-5xl md:text-6xl">
            Professional Tax, SARS & Business Assistance Across South Africa
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-[#1E2A3C]">
            Access qualified tax practitioners and accounting professionals for SARS matters, tax returns, bookkeeping,
            company compliance and business support across South Africa.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Button asChild className="rounded-full bg-[#B8962E] px-7 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-[#A88633]">
              <Link to="/request-tax-assistance">Request Assistance</Link>
            </Button>
            <Button asChild className="rounded-full border border-[#B8962E] bg-white px-7 py-4 text-base font-semibold text-[#022D73] transition hover:bg-[#F4F4F2]">
              <Link to="/register?role=consultant">Join as a Professional</Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {trustItems.map((item) => (
              <div key={item.label} className="flex items-center gap-4 rounded-[2rem] border border-[#E7E7E7] bg-white p-5 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FBF0C1] text-[#B8962E]">
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="font-semibold text-[#1E2A3C]">{item.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="relative"
        >
          <div className="overflow-hidden rounded-[2rem] border border-[#E7E7E7] bg-white shadow-card">
            <img
              src="/oui.png"
              alt="Professional woman working on a laptop"
              className="h-[520px] w-full object-cover object-center sm:h-[680px]"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
