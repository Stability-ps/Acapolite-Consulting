import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, Handshake, Search, ShieldCheck, TrendingUp, UserCheck } from "lucide-react";

const trustBadges = [
  { label: "Secure", icon: ShieldCheck },
  { label: "Reliable", icon: UserCheck },
  { label: "Compliant", icon: CheckCircle2 },
  { label: "Data-Driven", icon: TrendingUp },
];

const partnerServices = [
  {
    title: "Credit Intelligence",
    description: "Access comprehensive credit data and insights to make informed decisions.",
    icon: Search,
  },
  {
    title: "KYC & Verification",
    description: "Verify identities and businesses quickly and accurately.",
    icon: UserCheck,
  },
  {
    title: "Compliance Solutions",
    description: "Stay compliant with POPIA, FICA and industry regulations.",
    icon: CheckCircle2,
  },
  {
    title: "Risk Management",
    description: "Identify, assess and mitigate risk to protect your business.",
    icon: BarChart3,
  },
];

export function DatanamixPartner() {
  return (
    <section className="bg-background py-16 md:py-20">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-elevated"
        >
          <div className="px-6 pt-7 text-center md:px-10">
            <div className="flex items-center justify-center gap-4">
              <span className="h-px w-20 bg-gradient-to-r from-transparent to-border" />
              <span className="text-xs font-bold uppercase tracking-[0.24em] text-primary font-body">
                Our Trusted Partner
              </span>
              <span className="h-px w-20 bg-gradient-to-l from-transparent to-border" />
            </div>

            <div className="mt-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Handshake className="h-6 w-6" strokeWidth={1.8} />
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 pt-4 md:grid-cols-2 md:p-10 md:pt-5">
            <div className="flex flex-col justify-between gap-8">
              <div>
                <div className="flex items-center">
                  <img
                    src="/Datanamix%20Logo.png"
                    alt="Datanamix logo"
                    className="h-auto max-h-20 w-full max-w-[360px] object-contain object-left"
                  />
                </div>

                <p className="mt-6 max-w-md text-sm font-semibold leading-7 text-foreground font-body md:text-base">
                  A trusted provider of credit intelligence, verification and compliance solutions that support smarter
                  decision-making and secure business operations.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
                {trustBadges.map((badge) => (
                  <div key={badge.label} className="flex flex-col items-center gap-2 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <badge.icon className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground font-body">{badge.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-5 md:p-6">
              <div className="divide-y divide-primary/15">
                {partnerServices.map((service) => (
                  <div key={service.title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-sm">
                      <service.icon className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-bold text-foreground">{service.title}</h3>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground font-body md:text-sm">
                        {service.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
