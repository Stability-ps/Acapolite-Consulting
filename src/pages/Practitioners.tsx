import { ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, CheckCircle2, Coins, FileCheck2, Globe2, ShieldCheck, Sparkles, Users2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "@/components/landing/Footer";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { ScrollToTopButton } from "@/components/landing/ScrollToTopButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CREDIT_PACKAGES, SUBSCRIPTION_PLANS } from "@/hooks/usePaystack";
import { formatZarCurrency } from "@/lib/practitionerCredits";

const practitionerSteps = [
  {
    title: "Register Your Profile",
    description: "Create your practitioner account and submit your professional details so clients can find the right expertise.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Get Verified",
    description: "Upload your credentials and verification documents for admin review before you start working on the platform.",
    icon: FileCheck2,
  },
  {
    title: "Receive Client Requests",
    description: "Browse verified service requests that match your listed services and professional strengths.",
    icon: Users2,
  },
  {
    title: "Respond Using Credits",
    description: "Use credits to unlock leads, respond professionally, and convert suitable requests into long-term client work.",
    icon: Coins,
  },
];

const practitionerBenefits = [
  "Receive verified client requests",
  "Grow your practice",
  "Secure document handling",
  "Professional profile visibility",
  "Work with clients nationwide",
];

const practitionerServices = [
  "Individual Tax Services",
  "Business Tax Services",
  "Accounting Services",
  "Business Support Services",
];

const creditPoints = [
  "Credits are used to respond to service requests.",
  "Each request requires credits before you can submit a response.",
  "Monthly plans include credits every billing cycle.",
  "Extra credits can be purchased anytime.",
  "Purchased credits do not expire.",
];

export default function Practitioners() {
  const lowestExtraCreditPrice = Math.min(...CREDIT_PACKAGES.map((pkg) => pkg.price_zar));

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <main>
        <section
          id="top"
          className="relative overflow-hidden bg-[linear-gradient(180deg,#07162e_0%,#0d2446_42%,#f8fbff_100%)] pb-16 pt-28 md:pb-24 md:pt-36"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.2),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.14),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.18),transparent_30%)]" />
          <div className="container relative mx-auto px-6">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="max-w-3xl">
                <Badge className="rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
                  For Practitioners
                </Badge>
                <h1 className="mt-5 font-display text-4xl leading-tight text-white sm:text-5xl lg:text-6xl">
                  Get Clients and Grow Your Practice With Acapolite
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-sky-50/80 sm:text-lg">
                  Receive verified client requests, build trusted visibility, and manage secure client work through one professional platform built for South African practitioners.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Button asChild size="lg" className="rounded-xl bg-white px-8 py-6 text-base font-semibold text-slate-950 hover:bg-white/95">
                    <Link to="/register?role=consultant">
                      Join as Practitioner
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="rounded-xl border-white/20 bg-white/10 px-8 py-6 text-base font-semibold text-white hover:bg-white/14 hover:text-white">
                    <a href="#how-it-works">See How It Works</a>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[28px] border border-white/15 bg-white/10 p-6 shadow-[0_18px_60px_rgba(3,7,18,0.35)] backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.18em] text-sky-100/70">What You Receive</p>
                  <div className="mt-4 space-y-4">
                    <div className="flex items-start gap-3 text-white">
                      <BadgeCheck className="mt-0.5 h-5 w-5 text-sky-300" />
                      <div>
                        <p className="font-semibold">Verified lead pipeline</p>
                        <p className="mt-1 text-sm text-sky-50/75">Focus on real client requests instead of unqualified traffic.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 text-white">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-sky-300" />
                      <div>
                        <p className="font-semibold">Secure workflow</p>
                        <p className="mt-1 text-sm text-sky-50/75">Messages, cases, and documents stay inside the platform.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 text-white">
                      <Globe2 className="mt-0.5 h-5 w-5 text-sky-300" />
                      <div>
                        <p className="font-semibold">Nationwide reach</p>
                        <p className="mt-1 text-sm text-sky-50/75">Grow beyond your immediate local network and attract clients across South Africa.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-sky-200/40 bg-white p-6 shadow-card">
                  <p className="text-xs uppercase tracking-[0.18em] text-primary/70">Plans Start At</p>
                  <p className="mt-3 font-display text-4xl text-foreground">
                    {formatZarCurrency(SUBSCRIPTION_PLANS[0]?.price_zar ?? 0)}
                    <span className="ml-2 text-base font-body text-muted-foreground">/ month</span>
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Monthly plans include credits, and extra top-ups start from {formatZarCurrency(lowestExtraCreditPrice)} when you need more responses.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-background py-20 scroll-mt-32">
          <div className="container mx-auto px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">How It Works</p>
              <h2 className="mt-3 font-display text-3xl text-foreground sm:text-5xl">
                A clean practitioner flow from signup to client engagement
              </h2>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
              {practitionerSteps.map((step, index) => (
                <div key={step.title} className="rounded-[28px] border border-border bg-card p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                      <step.icon className="h-6 w-6" />
                    </div>
                    <span className="font-display text-3xl text-primary/20">0{index + 1}</span>
                  </div>
                  <h3 className="mt-6 font-display text-2xl text-foreground">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-muted/30 py-20">
          <div className="container mx-auto px-6">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[32px] border border-border bg-card p-7 shadow-card">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">Benefits</p>
                <h2 className="mt-3 font-display text-3xl text-foreground">Why practitioners join Acapolite</h2>
                <div className="mt-6 space-y-4">
                  {practitionerBenefits.map((benefit) => (
                    <div key={benefit} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                      <p className="text-sm leading-6 text-muted-foreground">{benefit}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] border border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,246,255,0.96))] p-7 shadow-card">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">Credits</p>
                <h2 className="mt-3 font-display text-3xl text-foreground">How credits work</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {creditPoints.map((point) => (
                    <div key={point} className="rounded-2xl border border-sky-100 bg-white/80 p-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                        <p className="text-sm leading-6 text-muted-foreground">{point}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-background py-20">
          <div className="container mx-auto px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">Pricing</p>
                <h2 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">Practitioner Monthly Plans</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Choose the monthly plan that fits your lead volume. Every plan includes monthly credits and visibility benefits.
              </p>
            </div>

            <div className="mt-10 grid gap-6 xl:grid-cols-3">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div key={plan.code} className="rounded-[32px] border border-border bg-card p-6 shadow-card">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-display text-2xl text-foreground">{plan.name}</h3>
                    <Badge className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Monthly
                    </Badge>
                  </div>
                  <p className="mt-5 font-display text-4xl text-foreground">
                    {formatZarCurrency(plan.price_zar)}
                    <span className="ml-2 text-sm font-body text-muted-foreground">/ month</span>
                  </p>
                  <p className="mt-3 text-sm font-semibold text-primary">{plan.credits_per_month} credits included monthly</p>
                  <div className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <p className="text-sm leading-6 text-muted-foreground">{feature}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="services" className="bg-muted/30 py-20 scroll-mt-32">
          <div className="container mx-auto px-6">
            <div className="rounded-[36px] border border-border bg-card p-7 shadow-card sm:p-10">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">Services</p>
                <h2 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">
                  Services practitioners can respond to
                </h2>
              </div>

              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {practitionerServices.map((service) => (
                  <div key={service} className="rounded-[24px] border border-border bg-background/70 p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      {service.includes("Business") ? <Building2 className="h-5 w-5" /> : <BriefcaseBusiness className="h-5 w-5" />}
                    </div>
                    <h3 className="mt-4 font-display text-xl text-foreground">{service}</h3>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-background py-20">
          <div className="container mx-auto px-6">
            <div className="rounded-[36px] border border-sky-900/15 bg-[linear-gradient(135deg,rgba(8,47,73,0.97),rgba(15,23,42,0.97))] px-6 py-10 shadow-[0_24px_80px_rgba(2,6,23,0.28)] sm:px-10">
              <div className="mx-auto max-w-3xl text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200/80">Join Acapolite</p>
                <h2 className="mt-3 font-display text-3xl text-white sm:text-5xl">
                  Ready to grow your practice with verified client opportunities?
                </h2>
                <p className="mt-4 text-base leading-7 text-sky-50/75">
                  Build your professional presence, get verified, and start responding to client requests through one secure platform.
                </p>
                <Button asChild size="lg" className="mt-8 rounded-xl bg-white px-8 py-6 text-base font-semibold text-slate-950 hover:bg-white/95">
                  <Link to="/register?role=consultant">
                    Join as Practitioner
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ScrollToTopButton />
    </div>
  );
}
