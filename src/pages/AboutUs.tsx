import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Company</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">About Us — Acapolite Consulting</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            Acapolite Consulting is a professional digital platform that connects individuals and businesses with
            qualified tax practitioners, accountants, and compliance professionals across South Africa. Our mission
            is to simplify access to reliable tax and financial services while maintaining high standards of
            professionalism, security, and transparency.
          </p>

          <div className="mt-8 space-y-8 text-sm text-foreground font-body">
            <section>
              <h2 className="text-lg font-semibold">Who We Are</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting was established to address the growing need for accessible tax and compliance
                support. Many individuals and businesses struggle to find trusted professionals who can assist with
                SARS matters, accounting services, and regulatory compliance. Our platform bridges this gap by
                providing a structured and secure environment where clients and practitioners can connect efficiently.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Our Mission</h2>
              <p className="mt-2 text-muted-foreground">
                Our mission is to make professional tax and accounting services accessible, efficient, and secure for
                every individual and business. We aim to support financial compliance and empower businesses to
                operate confidently within regulatory frameworks.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Our Vision</h2>
              <p className="mt-2 text-muted-foreground">
                Our vision is to become one of South Africa’s leading digital platforms for tax and financial service
                connections, known for reliability, trust, and innovation in professional service delivery.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">What We Do</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Connect clients with verified tax practitioners and accountants</li>
                <li>Provide structured service request and case management tools</li>
                <li>Enable secure communication between clients and practitioners</li>
                <li>Support compliance with SARS and financial regulations</li>
                <li>Offer a reliable marketplace for professional services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Why Choose Acapolite Consulting</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Access to verified and qualified professionals</li>
                <li>Secure handling of sensitive financial documents</li>
                <li>Transparent communication and service tracking</li>
                <li>Reliable platform designed for efficiency</li>
                <li>Professional tools for both clients and practitioners</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Our Commitment to Quality</h2>
              <p className="mt-2 text-muted-foreground">
                At Acapolite Consulting, we are committed to maintaining high standards of service delivery. We
                continuously improve our platform to ensure security, reliability, and professional excellence. Our
                goal is to build long-term trust with clients and practitioners by delivering dependable solutions
                that support financial success.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
