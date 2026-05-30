import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, Handshake, Landmark, Search, ShieldAlert, ShieldCheck, TrendingUp, UserCheck } from "lucide-react";

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
    icon: BarChart3,
  },
  {
    title: "KYC & Verification",
    description: "Verify identities and businesses quickly and accurately.",
    icon: Search,
  },
  {
    title: "Compliance Solutions",
    description: "Stay compliant with POPIA, FICA and industry regulations.",
    icon: Landmark,
  },
  {
    title: "Risk Management",
    description: "Identify, assess and mitigate risk to protect your business.",
    icon: ShieldAlert,
  },
];

export function DatanamixPartner() {
  return (
    <section className="bg-[#F6F6F4] py-16 md:py-20">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-5xl"
        >
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.32em] text-[#061A36] font-body">
              <Handshake className="h-3.5 w-3.5" strokeWidth={1.8} />
              Trusted Partnership
            </div>
            <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.03em] text-[#022D73] md:text-5xl">
              Our Trusted Partner
            </h2>
          </div>

          <div className="mt-8 border border-[#E1E3E6] bg-[#F7F7F6] p-4 md:p-5">
            <div className="rounded-lg border border-[#E1E3E6] bg-white p-5 md:p-7">
              <div className="flex items-center">
                <img
                  src="/Datanamix%20Logo.png"
                  alt="Datanamix logo"
                  className="h-auto max-h-8 w-full max-w-[170px] object-contain object-left"
                />
              </div>

              <p className="mt-7 max-w-xl text-sm font-semibold leading-7 text-[#061A36] font-body md:text-base">
                A trusted provider of credit intelligence, verification and compliance solutions that support smarter
                decision-making and secure business operations.
              </p>

              <div className="mt-7 grid overflow-hidden rounded-lg border border-[#E1E3E6] sm:grid-cols-4">
                {trustBadges.map((badge) => (
                  <div
                    key={badge.label}
                    className="flex min-h-[58px] flex-col items-center justify-center gap-2 border-b border-[#E1E3E6] px-4 py-3 text-center last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
                  >
                    <div className="text-[#061A36]">
                      <badge.icon className="h-4 w-4" strokeWidth={1.8} />
                    </div>
                    <span className="text-xs font-bold text-[#061A36] font-body">{badge.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[#E1E3E6] bg-[#F7F7F6] p-6 md:p-8">
              <div className="space-y-9">
                {partnerServices.map((service) => (
                  <div key={service.title} className="flex gap-4 md:gap-5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#061A36] shadow-sm">
                      <service.icon className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-[#061A36]">{service.title}</h3>
                      <p className="mt-2 max-w-2xl text-xs leading-6 text-[#061A36]/80 font-body md:text-sm">
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
