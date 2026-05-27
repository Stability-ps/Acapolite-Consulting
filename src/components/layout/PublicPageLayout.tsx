import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { Footer } from "@/components/landing/Footer";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Button } from "@/components/ui/button";

type PublicPageLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  maxWidthClassName?: string;
  backHref?: string;
  backLabel?: string;
};

export function PublicPageLayout({
  eyebrow,
  title,
  description,
  children,
  maxWidthClassName = "max-w-5xl",
  backHref = "/",
  backLabel = "Back to Home",
}: PublicPageLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-gradient">
      <LandingHeader />
      <main className="px-4 py-8 sm:py-12">
        <div className={`mx-auto w-full ${maxWidthClassName}`}>
          <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <AcapoliteLogo className="h-12" />
              <Button asChild variant="outline" className="w-fit rounded-xl">
                <Link to={backHref}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {backLabel}
                </Link>
              </Button>
            </div>

            <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">{eyebrow}</p>
            <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">{title}</h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
              {description}
            </p>

            <div className="mt-8">{children}</div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
