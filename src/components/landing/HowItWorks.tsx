import { motion } from "framer-motion";
import { ClipboardList, MessagesSquare, SearchCheck } from "lucide-react";

const steps = [
  {
    title: "Submit Your Request",
    description:
      "Tell us what you need help with in a few guided steps.",
    icon: ClipboardList,
  },
  {
    title: "We Match Your Request",
    description:
      "Qualified practitioners review your request based on the services you need.",
    icon: SearchCheck,
  },
  {
    title: "Connect With Professionals",
    description:
      "Receive support, upload documents and move your request forward securely.",
    icon: MessagesSquare,
  },
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
          <h2 className="font-display text-3xl font-bold text-[#102B46] md:text-5xl">
            Simple Steps to Get the Right Support
          </h2>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="rounded-[2rem] border border-[#E7E7E7] bg-white p-8 text-center shadow-sm"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#E7E7E7] bg-[#FBF0C1] text-[#B8962E]">
                <step.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-[#102B46]">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#5F6C7B]">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
