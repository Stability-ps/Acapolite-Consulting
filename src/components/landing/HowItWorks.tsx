import { motion } from "framer-motion";
import { UserPlus, ClipboardList, Upload, Handshake } from "lucide-react";

const steps = [
  { title: "Create Account", desc: "Create your secure client profile in minutes.", icon: UserPlus },
  { title: "Submit Request", desc: "Tell us what you need help with.", icon: ClipboardList },
  { title: "Upload Documents", desc: "Safely upload your supporting documents.", icon: Upload },
  { title: "Get Assistance", desc: "Connect with qualified professionals and get the help you need.", icon: Handshake },
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
          <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.32em] text-[#B8962E] font-body">
            HOW ACAPOLITE WORKS
          </span>
          <h2 className="font-display text-3xl font-bold text-[#022D73] md:text-5xl">
            Simple Steps to Get the Help You Need
          </h2>
        </motion.div>

        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 hidden md:block">
            <div className="mx-auto h-px w-full max-w-[calc(100%-4rem)] border-t border-dashed border-[#E7E7E7]" />
          </div>

          <div className="grid gap-8 md:grid-cols-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
                className="relative z-10 flex flex-col items-center gap-5 rounded-[2rem] border border-[#E7E7E7] bg-white p-8 text-center shadow-sm"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#E7E7E7] bg-[#FBF0C1] text-[#B8962E]">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-[#022D73]">{step.title}</h3>
                <p className="text-sm leading-relaxed text-[#6E7480]">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
