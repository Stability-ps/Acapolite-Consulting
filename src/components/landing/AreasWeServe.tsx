import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

const serviceAreas = [
  {
    province: "Western Cape",
    cities: ["Cape Town", "Bellville", "Stellenbosch", "Paarl", "George", "Somerset West"],
  },
  {
    province: "Free State",
    cities: ["Bloemfontein", "Welkom", "Bethlehem", "Sasolburg", "Kroonstad", "Virginia", "Phuthaditjhaba", "Parys", "Harrismith"],
  },
  {
    province: "KwaZulu-Natal",
    cities: ["Durban", "Pietermaritzburg", "Umhlanga", "Richards Bay", "Ballito"],
  },
  {
    province: "North West",
    cities: ["Rustenburg", "Mahikeng", "Klerksdorp", "Potchefstroom", "Brits", "Lichtenburg", "Orkney", "Vryburg", "Zeerust", "Hartbeespoort", "Taung"],
  },
  {
    province: "Mpumalanga",
    cities: ["Mbombela", "Emalahleni", "Secunda", "Middelburg", "White River"],
  },
  {
    province: "Northern Cape",
    cities: ["Kimberley", "Upington", "Kuruman", "Springbok", "De Aar", "Postmasburg", "Kathu", "Calvinia", "Colesberg"],
  },
  {
    province: "Gauteng",
    cities: ["Johannesburg", "Pretoria", "Midrand", "Centurion", "Sandton", "Randburg", "Roodepoort", "Soweto", "Kempton Park"],
  },
  {
    province: "Eastern Cape",
    cities: ["Gqeberha", "East London", "Mthatha", "Queenstown", "Grahamstown", "Port Alfred", "Jeffreys Bay", "Uitenhage", "King William's Town"],
  },
  {
    province: "Limpopo",
    cities: ["Polokwane", "Tzaneen", "Thohoyandou", "Mokopane", "Louis Trichardt", "Musina", "Bela-Bela", "Lephalale", "Modimolle"],
  },
];

export function AreasWeServe() {
  return (
    <section id="areas-we-serve" className="bg-background py-24 scroll-mt-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14 text-center"
        >
          <span className="mb-2 block text-sm font-semibold uppercase tracking-widest text-primary font-body">Areas We Serve</span>
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-5xl">
            Nationwide Tax, Payroll and Business Support
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-muted-foreground font-body">
            Acapolite offers tax, payroll, and business support across South Africa including:
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {serviceAreas.map((area, index) => (
            <motion.div
              key={area.province}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.04 }}
              className="rounded-xl border border-border bg-card p-6 shadow-card"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                  <MapPin className="h-5 w-5 text-accent-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold text-card-foreground">{area.province}</h3>
              </div>

              <div className="flex flex-wrap gap-2">
                {area.cities.map((city) => (
                  <span
                    key={city}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground font-body"
                  >
                    {city}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
