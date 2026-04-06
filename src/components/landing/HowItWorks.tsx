import { motion } from "framer-motion";

const steps = [
  { num: "1", title: "Create Your Account", desc: "Register on the portal or have your consultant set up your profile. Securely log in with your credentials." },
  { num: "2", title: "Upload Your Documents", desc: "Submit your tax documents through the secure portal. Your consultant will review them and update your case status." },
  { num: "3", title: "Track & Communicate", desc: "Monitor your case progress in real time, respond to document requests, and message your consultant directly." },
];

export function HowItWorks() {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold tracking-widest uppercase text-primary mb-2 block font-body">How It Works</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground">
            Get Started in Three Simple Steps
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center"
            >
              <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold font-display mx-auto mb-5">
                {step.num}
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground font-body leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
