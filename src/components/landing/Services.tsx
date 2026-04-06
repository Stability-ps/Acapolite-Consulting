import { motion } from "framer-motion";
import { Building2, Scale, FileCheck, FileText, CalendarClock, Headset } from "lucide-react";

const services = [
  { icon: Building2, title: "Corporate Tax & VAT", desc: "Comprehensive corporate tax returns, VAT registration, and provisional tax management for businesses of all sizes." },
  { icon: Scale, title: "SARS Disputes & Objections", desc: "Expert representation and dispute resolution for SARS objections, audits, and tax clearance certificate applications." },
  { icon: FileCheck, title: "Tax Clearance Certificates", desc: "Prompt processing of tax clearance certificates for tenders, emigration, foreign investment, and compliance purposes." },
  { icon: FileText, title: "Individual Tax Returns", desc: "Accurate and timely submission of your personal income tax returns with full SARS compliance and maximum deduction optimisation." },
  { icon: CalendarClock, title: "Provisional Tax Planning", desc: "Strategic provisional tax submissions and planning to ensure you never miss a deadline or face unnecessary penalties." },
  { icon: Headset, title: "Dedicated Consultant Support", desc: "Direct communication with your assigned consultant through our secure portal — no emails, no delays, no confusion." },
];

export function Services() {
  return (
    <section className="py-24 bg-surface-gradient">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold tracking-widest uppercase text-primary mb-2 block font-body">Our Services</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
            Everything You Need for Tax Compliance
          </h2>
          <p className="text-muted-foreground text-lg max-w-3xl mx-auto font-body">
            From individual tax returns to corporate compliance, our consultants handle every aspect of your tax obligations with precision and care.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-card rounded-xl p-7 shadow-card hover:shadow-elevated transition-all duration-300 border border-border group"
            >
              <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                <s.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold text-card-foreground mb-2">{s.title}</h3>
              <p className="text-muted-foreground text-sm font-body leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
