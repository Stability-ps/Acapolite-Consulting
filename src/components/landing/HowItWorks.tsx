import { motion } from "framer-motion";
import { FileText, BadgeCheck, ShieldCheck } from "lucide-react";

const steps = [
  { num: "1", title: "Submit Request", desc: "Client submits a service request.", icon: FileText },
  { num: "2", title: "Get Matched", desc: "Verified practitioners review the request.", icon: BadgeCheck },
  { num: "3", title: "Get Assistance", desc: "Client works securely through the portal.", icon: ShieldCheck },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-background py-24 scroll-mt-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <span className="mb-2 block text-sm font-semibold uppercase tracking-widest text-primary font-body">How It Works</span>
          <h2 className="font-display text-3xl font-bold text-foreground md:text-5xl">
            Get Started in Three Simple Steps
          </h2>
        </motion.div>

        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="text-center"
            >
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground font-display">
                <step.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-3 font-display text-xl font-semibold text-foreground">{step.title}</h3>
              <p className="leading-relaxed text-muted-foreground font-body">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
