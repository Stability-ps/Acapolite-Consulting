import { motion } from "framer-motion";

const introSections = [
  {
    title: "Access Fast, Reliable Tax, SARS and Business Help from Qualified Professionals Across South Africa",
    body: "Tax and business matters can feel overwhelming, especially when you're unsure who to trust. Acapolite gives individuals and businesses access to qualified and verified tax practitioners and accounting professionals ready to assist with SARS assistance, tax returns, SARS debt help, VAT registration, PAYE support, bookkeeping, eFiling assistance, business compliance, and accounting services across South Africa. Whether you need help with personal tax matters or business tax obligations, our platform connects you with trusted professionals who understand your situation. Submit your request, choose the service you need, and access fast, secure and reliable assistance with confidence.",
  },
  {
    title: "Save Time and Connect with Trusted Tax Practitioners and Business Professionals in One Place",
    body: "Why spend hours searching for a tax practitioner, SARS assistance, bookkeeping service, VAT support, payroll help, or business compliance expert when you can access qualified professionals through one secure platform? Acapolite simplifies the process by helping you submit your request and connect with professionals who match your needs. Compare expertise, review professional profiles, and find trusted support for tax returns, SARS debt arrangements, VAT, PAYE, bookkeeping, company registration, eFiling support, and business compliance services in South Africa. No endless calls, no uncertainty, just a professional and efficient way to access reliable assistance.",
  },
];

export function TaxSupportIntro() {
  return (
    <section className="bg-white py-20">
      <div className="container mx-auto px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          {introSections.map((section, index) => (
            <motion.article
              key={section.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="border-l-4 border-[#B8962E] pl-6"
            >
              <h2 className="font-display text-2xl font-bold leading-tight text-[#022D73] md:text-3xl">
                {section.title}
              </h2>
              <p className="mt-5 text-base leading-8 text-[#1E2A3C] md:text-lg">
                {section.body}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
