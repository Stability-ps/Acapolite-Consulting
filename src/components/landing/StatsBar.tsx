import { CheckCircle2, Users, Star, Clock, MapPin } from "lucide-react";

const stats = [
  { label: "500+ Requests Submitted", icon: CheckCircle2 },
  { label: "Verified Professionals", icon: Users },
  { label: "4.9/5 Average Rating", icon: Star },
  { label: "Fast Response Times", icon: Clock },
  { label: "Nationwide Coverage", icon: MapPin },
];

export function StatsBar() {
  return (
    <section className="bg-[#F4F4F2] py-14">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#1E2A3C]/70">
            Trusted by individuals and businesses across South Africa
          </p>
        </div>

        <div className="mt-10 grid gap-3 rounded-[2rem] border border-[#E7E7E7] bg-white p-4 shadow-card sm:grid-cols-5 sm:p-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center justify-center gap-3 border-t border-[#E7E7E7] pt-4 first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0 sm:pt-0 sm:pl-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FBF0C1] text-[#B8962E]">
                <stat.icon className="h-5 w-5" />
              </div>
              <p className="text-center text-sm font-semibold text-[#1E2A3C]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
