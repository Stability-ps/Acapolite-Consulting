import { motion } from "framer-motion";
import { Link } from "react-router-dom";

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
    <section id="areas-we-serve" className="bg-[#E9ECEF] py-16 scroll-mt-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 text-center"
        >
          <h2 className="mb-2 font-display text-3xl font-bold text-[#20242A] md:text-5xl">
            Areas We Serve
          </h2>
          <p className="mx-auto max-w-4xl text-sm text-[#5F6670] font-body md:text-base">
            Acapolite offers tax, payroll, and business support across South Africa including:
          </p>
        </motion.div>

        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {serviceAreas.map((area, index) => (
            <motion.ul
              key={area.province}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.04 }}
              className="space-y-0.5 text-left font-body text-sm leading-tight text-[#2F353D]"
            >
              <li>
                <Link
                  to={`/request-tax-assistance?step=1&province=${encodeURIComponent(area.province)}`}
                  className="font-bold text-[#20242A] underline-offset-4 hover:text-primary hover:underline"
                >
                  {area.province}
                </Link>
              </li>
              {area.cities.map((city) => (
                <li key={city}>
                  <Link
                    to={`/request-tax-assistance?step=1&province=${encodeURIComponent(area.province)}&city=${encodeURIComponent(city)}`}
                    className="text-[#2F353D] underline-offset-4 hover:text-primary hover:underline"
                  >
                    {city}
                  </Link>
                </li>
              ))}
            </motion.ul>
          ))}
        </div>
      </div>
    </section>
  );
}
