import { LandingHeader } from "@/components/landing/LandingHeader";
import { ScrollToTopButton } from "@/components/landing/ScrollToTopButton";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Services } from "@/components/landing/Services";
import { VerifiedPractitioners } from "@/components/landing/VerifiedPractitioners";
import { Testimonials } from "@/components/landing/Testimonials";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <LandingHeader />
      <Hero />
      <HowItWorks />
      <Services />
      <Features />
      <VerifiedPractitioners />
      <Testimonials />
      <CTA />
      <Footer />
      <ScrollToTopButton />
    </div>
  );
};

export default Index;
