import { motion } from "framer-motion";
import { Quote } from "lucide-react";

const testimonials = [
  {
    name: "Lerato M.",
    role: "Small Business Owner",
    quote: "Acapolite connected me to a practitioner who resolved my SARS compliance issues quickly and professionally.",
  },
  {
    name: "Thabo P.",
    role: "Freelance Consultant",
    quote: "The portal kept everything organized. I could track every update and upload documents securely.",
  },
  {
    name: "Nomsa K.",
    role: "Finance Manager",
    quote: "We received fast responses from verified practitioners and selected the right fit for our VAT case.",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="bg-surface-gradient py-24 scroll-mt-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14 text-center"
        >
          <span className="mb-2 block text-sm font-semibold uppercase tracking-widest text-primary font-body">Testimonials</span>
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-5xl">
            Trusted by South African Clients
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground font-body">
            Placeholder testimonials until real client feedback is available.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-card"
            >
              <Quote className="mb-4 h-6 w-6 text-primary" />
              <p className="text-sm leading-relaxed text-muted-foreground font-body">"{item.quote}"</p>
              <div className="mt-4">
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground font-body">{item.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
