import { FilePenLine, MessageCircle, Users } from "lucide-react";

const steps = [
  {
    number: 1,
    title: "Submit Your Request",
    description: "Tell us what help you need in a few easy steps.",
    icon: FilePenLine,
  },
  {
    number: 2,
    title: "Professionals Review",
    description: "Verified professionals review your request.",
    icon: Users,
  },
  {
    number: 3,
    title: "Get Connected",
    description: "Receive responses and choose the best professional for you.",
    icon: MessageCircle,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-[#F5F4F0] py-16 md:py-20">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="text-center text-3xl font-bold tracking-[-0.02em] text-[#102B46] md:text-4xl">
          How Acapolite Works
        </h2>

        <div className="mt-12 flex flex-col items-center gap-10 md:flex-row md:items-start md:justify-center md:gap-4">
          {steps.map((step, index) => (
            <div key={step.title} className="flex flex-col items-center md:flex-row md:items-start">
              <div className="flex max-w-[240px] flex-col items-center text-center">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#E8D9B0] bg-white text-[#C49A22] shadow-sm">
                    <step.icon className="h-7 w-7" strokeWidth={1.75} />
                  </div>
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#C49A22] text-xs font-bold text-white">
                    {step.number}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-[#102B46]">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6E7480]">{step.description}</p>
              </div>

              {index < steps.length - 1 ? (
                <div
                  aria-hidden
                  className="my-2 h-10 w-px border-l-2 border-dashed border-[#D7D7D7] md:mx-3 md:my-8 md:h-px md:w-16 md:border-l-0 md:border-t-2"
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
