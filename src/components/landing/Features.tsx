import { motion } from "framer-motion";
import { Activity, Upload, Bell, Receipt, Shield, CheckCircle, Users, Zap } from "lucide-react";

const features = [
  { icon: Activity, title: "Real-Time Case Tracking", desc: "See exactly where your tax case stands at every stage of the process." },
  { icon: Upload, title: "Secure Document Upload", desc: "Upload IRP5s, SARS letters, bank statements, and more, safely and instantly." },
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
    <section id="portal" className="bg-surface-gradient py-24 scroll-mt-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <span className="mb-2 block text-sm font-semibold uppercase tracking-widest text-primary font-body">Client Portal</span>
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-5xl">
            Manage Everything in One Secure Place
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground font-body">
            Our portal gives you real-time visibility into your tax cases, documents, invoices, and communications, all in one structured, easy-to-navigate dashboard.
          </p>
        </motion.div>

        <div className="mb-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="rounded-xl border border-border bg-card p-6 shadow-card transition-shadow duration-300 hover:shadow-elevated"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                <feature.icon className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="mb-2 font-display text-lg font-semibold text-card-foreground">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground font-body">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-4">
              <stat.icon className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm font-medium text-foreground font-body">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
