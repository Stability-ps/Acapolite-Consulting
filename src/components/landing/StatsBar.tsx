import { BarChart3, CheckCircle2, Handshake, ShieldCheck, Users, SearchCheck, Scale, TriangleAlert } from "lucide-react";

const partnerBadges = [
  { label: "Secure", icon: ShieldCheck },
  { label: "Reliable", icon: Users },
  { label: "Compliant", icon: CheckCircle2 },
  { label: "Data-Driven", icon: BarChart3 },
];

const partnerFeatures = [
  {
    title: "Credit Intelligence",
    description: "Access comprehensive credit data and insights to make informed decisions.",
    icon: BarChart3,
  },
  {
    title: "KYC & Verification",
    description: "Verify identities and businesses quickly and accurately.",
    icon: SearchCheck,
  },
  {
    title: "Compliance Solutions",
    description: "Stay compliant with POPIA, FICA and industry regulations.",
    icon: Scale,
  },
  {
    title: "Risk Management",
    description: "Identify, assess and mitigate risk to protect your business.",
    icon: TriangleAlert,
  },
];

export function StatsBar() {
  return (
    <section className="bg-[#F4F4F2] py-16">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center gap-4">
          <span className="h-px w-12 bg-[#087C89]/35 sm:w-20" />
          <p className="inline-flex items-center gap-2 text-center text-sm font-semibold uppercase tracking-[0.22em] text-[#087C89] font-body">
            <Handshake className="h-4 w-4" />
            Trusted Partnership
          </p>
          <span className="h-px w-12 bg-[#087C89]/35 sm:w-20" />
        </div>
        <h2 className="mt-3 text-center font-display text-3xl font-bold text-[#022D73] md:text-5xl">
          Our Trusted Partner
        </h2>

        <div className="mt-8 rounded-[1.5rem] border border-[#DCE5EA] bg-white/85 p-4 shadow-card sm:p-5 lg:p-6">
          <div className="grid gap-4 md:grid-cols-[0.98fr_1.02fr]">
            <div className="flex flex-col justify-between rounded-xl border border-[#E3E8EC] bg-white p-5 sm:p-6">
              <div>
                <img
                  src="/Datanamix Logo.png"
                  alt="Datanamix"
                  className="h-11 w-auto max-w-full object-contain sm:h-12"
                />
                <p className="mt-6 max-w-xl text-base font-semibold leading-7 text-[#102B46] sm:text-lg sm:leading-8">
                  A trusted provider of credit intelligence, verification and compliance solutions that support smarter
                  decision-making and secure business operations.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 overflow-hidden rounded-xl border border-[#E3E8EC] bg-[#F9FBFC] sm:grid-cols-4">
                {partnerBadges.map((badge) => (
                  <div
                    key={badge.label}
                    className="flex min-h-20 flex-col items-center justify-center gap-2 border-t border-[#E3E8EC] px-3 py-3 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0"
                  >
                    <badge.icon className="h-5 w-5 text-[#087C89]" />
                    <span className="text-sm font-bold text-[#102B46]">{badge.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#D8E5EE] bg-[#EEF3F9] p-5 sm:p-6">
              <div className="grid gap-4">
                {partnerFeatures.map((feature) => (
                  <div key={feature.title} className="flex gap-4 rounded-xl bg-white/65 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#087C89] shadow-sm">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold tracking-normal text-[#102B46]">
                        {feature.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[#526475]">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
