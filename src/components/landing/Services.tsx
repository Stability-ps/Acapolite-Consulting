import { motion } from "framer-motion";
import { BriefcaseBusiness, Building2, Calculator, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

const services = [
  { icon: UserRound, title: "Individual Tax Services", desc: "Personal income tax returns, SARS issues, compliance checks, and dispute support." },
  { icon: Building2, title: "Business Tax Services", desc: "Company tax returns, VAT registration/returns, PAYE compliance, and audit support." },
  { icon: Calculator, title: "Accounting Services", desc: "Bookkeeping, financial statements, management accounts, and payroll processing." },
  { icon: BriefcaseBusiness, title: "Business Support Services", desc: "Company registration, amendments, annual returns, and compliance monitoring." },
];

export function Services() {
  return (
    <section id="services" className="bg-surface-gradient py-24 scroll-mt-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <span className="mb-2 block text-sm font-semibold uppercase tracking-widest text-primary font-body">Our Services</span>
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-5xl">
            Get Help Across Every SARS Need
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-muted-foreground font-body">
            Browse our core categories or visit the full services page for detailed coverage and specialist support.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="group rounded-xl border border-border bg-card p-7 shadow-card transition-all duration-300 hover:shadow-elevated"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent transition-colors group-hover:bg-primary/10">
                <service.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-lg font-semibold text-card-foreground">{service.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground font-body">{service.desc}</p>
              <Link to="/our-services" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">
                View services
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
