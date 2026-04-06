import { motion } from "framer-motion";
import { Activity, Upload, Bell, Receipt, Shield, CheckCircle, Users, Zap } from "lucide-react";

const features = [
  { icon: Activity, title: "Real-Time Case Tracking", desc: "See exactly where your tax case stands at every stage of the process." },
  { icon: Upload, title: "Secure Document Upload", desc: "Upload IRP5s, SARS letters, bank statements, and more — safely and instantly." },
  { icon: Bell, title: "Deadline Alerts", desc: "Receive timely reminders about SARS due dates, missing documents, and payment deadlines." },
  { icon: Receipt, title: "Billing & Invoicing", desc: "View your invoices and submit proof of payment directly through the portal." },
];

const stats = [
  { icon: Shield, label: "Bank-Grade Security" },
  { icon: CheckCircle, label: "SARS Registered" },
  { icon: Users, label: "500+ Clients Served" },
  { icon: Zap, label: "Fast Turnaround" },
];

export function Features() {
  return (
    <section className="py-24 bg-surface-gradient">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold tracking-widest uppercase text-primary mb-2 block font-body">Client Portal</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
            Manage Everything in One Secure Place
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-body">
            Our portal gives you real-time visibility into your tax cases, documents, invoices, and communications — all in one structured, easy-to-navigate dashboard.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-xl p-6 shadow-card hover:shadow-elevated transition-shadow duration-300 border border-border"
            >
              <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center mb-4">
                <f.icon className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold text-card-foreground mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm font-body leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3 bg-card/60 rounded-lg p-4 border border-border">
              <s.icon className="h-5 w-5 text-primary shrink-0" />
              <span className="font-body text-sm font-medium text-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
