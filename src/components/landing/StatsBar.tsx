import { Star, TimerReset, ShieldCheck, Users, MapPinned } from "lucide-react";

const stats = [
  { label: "Requests", value: "500+", icon: Users },
  { label: "Verified Professionals", value: "Verified", icon: ShieldCheck },
  { label: "Rating", value: "4.9/5", icon: Star },
  { label: "Fast Response", value: "Fast", icon: TimerReset },
  { label: "Nationwide Coverage", value: "South Africa", icon: MapPinned },
];

export function StatsBar() {
  return (
    <section className="border-y border-[#E7E7E7] bg-[#FFF8E4] py-6">
      <div className="container mx-auto px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-4 rounded-2xl border border-[#E8D39A] bg-white/90 px-4 py-4"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FBF0C1] text-[#B8962E]">
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-[#102B46]">{stat.value}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6E7480]">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
