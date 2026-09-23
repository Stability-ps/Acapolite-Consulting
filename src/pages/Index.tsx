import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SEO } from "@/components/seo/SEO";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildOrganizationSchema, buildWebsiteSchema } from "@/lib/structuredData";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { ScrollToTopButton } from "@/components/landing/ScrollToTopButton";
import { Hero } from "@/components/landing/Hero";
import { DatanamixPartner } from "@/components/landing/DatanamixPartner";
import { StatsBar } from "@/components/landing/StatsBar";
import { TaxSupportIntro } from "@/components/landing/TaxSupportIntro";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Services } from "@/components/landing/Services";
import { VerifiedPractitioners } from "@/components/landing/VerifiedPractitioners";
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
      <SEO
        title="Acapolite Consulting | Tax, Accounting & SARS Support South Africa"
        description="Access trusted tax, accounting and business professionals for SARS matters, bookkeeping, CIPC, company compliance and business support, all through one professional platform across South Africa."
        path="/"
      />
      <JsonLd data={buildOrganizationSchema()} />
      <JsonLd data={buildWebsiteSchema()} />
      <LandingHeader />
      <Hero />
      <HowItWorks />
      <StatsBar />
      <TaxSupportIntro />
      <Services />
      <Features />
      <VerifiedPractitioners />
      <AreasWeServe />
      <DatanamixPartner />
      <CTA />
      <Footer />
      <ScrollToTopButton />
    </div>
  );
};

export default Index;
