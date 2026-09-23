import { motion } from "framer-motion";
import { BookOpen, Building2, Calculator, FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const services = [
  { icon: FileText, title: "Tax Returns", desc: "Personal (ITR12) and company (ITR14) tax returns, including late and outstanding submissions.", href: "/tax-returns" },
  { icon: ShieldCheck, title: "SARS & Tax Assistance", desc: "SARS debt, payment arrangements, objections and disputes, audits, and general SARS compliance matters.", href: "/sars-tax-assistance" },
  { icon: Calculator, title: "Accounting Services", desc: "Financial statements, management accounts, payroll processing, and financial reporting.", href: "/accounting-services" },
  { icon: BookOpen, title: "Bookkeeping", desc: "Monthly bookkeeping, reconciliations, and ledger maintenance to keep your records accurate.", href: "/bookkeeping-services" },
  { icon: Building2, title: "CIPC & Company Compliance", desc: "Company registration, amendments, annual returns, and beneficial ownership filings.", href: "/cipc-company-compliance" },
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
            Browse our core categories or visit the{" "}
            <Link to="/our-services" className="font-semibold text-primary hover:underline">
              full services page
            </Link>{" "}
            for detailed coverage and specialist support.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
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
              <Link to={service.href} className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">
                View services
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
