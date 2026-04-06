import { motion } from "framer-motion";
import { Building2, Scale, FileCheck, FileText, CalendarClock, Headset } from "lucide-react";

const services = [
  { icon: Building2, title: "Corporate Tax and VAT", desc: "Comprehensive corporate tax returns, VAT registration, and provisional tax management for businesses of all sizes." },
  { icon: Scale, title: "SARS Disputes and Objections", desc: "Expert representation and dispute resolution for SARS objections, audits, and tax clearance certificate applications." },
  { icon: FileCheck, title: "Tax Clearance Certificates", desc: "Prompt processing of tax clearance certificates for tenders, emigration, foreign investment, and compliance purposes." },
  { icon: FileText, title: "Individual Tax Returns", desc: "Accurate and timely submission of your personal income tax returns with full SARS compliance and maximum deduction optimisation." },
  { icon: CalendarClock, title: "Provisional Tax Planning", desc: "Strategic provisional tax submissions and planning to ensure you never miss a deadline or face unnecessary penalties." },
  { icon: Headset, title: "Dedicated Consultant Support", desc: "Direct communication with your assigned consultant through our secure portal, no emails, no delays, no confusion." },
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
            Everything You Need for Tax Compliance
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-muted-foreground font-body">
            From individual tax returns to corporate compliance, our consultants handle every aspect of your tax obligations with precision and care.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
