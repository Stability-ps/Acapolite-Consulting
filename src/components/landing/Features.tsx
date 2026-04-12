import { motion } from "framer-motion";
import { BadgeCheck, Clock, FileLock2, ShieldCheck, Workflow } from "lucide-react";

const features = [
  { icon: FileLock2, title: "Secure Document Portal", desc: "Upload sensitive SARS documents safely with encrypted storage and access controls." },
  { icon: BadgeCheck, title: "Verified Tax Practitioners", desc: "Practitioners are verified before responding to client requests." },
  { icon: Clock, title: "Fast Response Times", desc: "Qualified practitioners review requests quickly to keep your case moving." },
  { icon: ShieldCheck, title: "Built for South African Taxpayers", desc: "Tailored for SARS requirements, compliance rules, and local workflows." },
  { icon: Workflow, title: "Structured Case Tracking", desc: "Track progress, messages, and tasks from one organised client workspace." },
];

export function Features() {
  return (
    <section id="why-choose" className="bg-surface-gradient py-24 scroll-mt-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <span className="mb-2 block text-sm font-semibold uppercase tracking-widest text-primary font-body">Why Choose Acapolite</span>
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-5xl">
            Built for Secure, Fast SARS Support
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground font-body">
            Get verified professionals, secure document handling, and a structured workflow that keeps clients and practitioners aligned.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
      </div>
    </section>
  );
}
