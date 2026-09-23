import { Building2, Clock3, ShieldCheck } from "lucide-react";

// Only qualitative, verifiable claims — no invented request counts, ratings,
// or other statistics that would need real data behind them.
const stats = [
  { value: "Verified", label: "Practitioners", icon: ShieldCheck },
  { value: "Fast", label: "Response Times", icon: Clock3 },
  { value: "Nationwide", label: "Coverage", icon: Building2 },
];

export function StatsBar() {
  return (
    <section className="border-y border-[#E7E7E7] bg-white py-8 md:py-10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-0">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center px-4 text-center ${
                index > 0 ? "sm:border-l sm:border-[#E7E7E7]" : ""
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#E8D9B0] text-[#C49A22]">
                <stat.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <p className="mt-4 text-xl font-bold text-[#102B46]">{stat.value}</p>
              <p className="mt-1 text-sm text-[#6E7480]">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
