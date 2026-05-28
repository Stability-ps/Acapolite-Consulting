import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { ScrollToTopButton } from "@/components/landing/ScrollToTopButton";
import { Hero } from "@/components/landing/Hero";
import { StatsBar } from "@/components/landing/StatsBar";
import { TaxSupportIntro } from "@/components/landing/TaxSupportIntro";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Services } from "@/components/landing/Services";
import { VerifiedPractitioners } from "@/components/landing/VerifiedPractitioners";
import { Testimonials } from "@/components/landing/Testimonials";
import { AreasWeServe } from "@/components/landing/AreasWeServe";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const element = document.querySelector(location.hash);
    if (element instanceof HTMLElement) {
      requestAnimationFrame(() => {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen">
      <LandingHeader />
      <Hero />
      <HowItWorks />
      <StatsBar />
      <TaxSupportIntro />
      <Services />
      <Features />
      <VerifiedPractitioners />
      <Testimonials />
      <AreasWeServe />
      <CTA />
      <Footer />
      <ScrollToTopButton />
    </div>
  );
};

export default Index;
