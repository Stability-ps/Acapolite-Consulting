import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export function Footer() {
  return (
    <footer className="bg-foreground py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <AcapoliteLogo className="h-12 brightness-0 invert" />
          <p className="text-sm text-background/50 font-body">Registered Tax Practitioners</p>
          <div className="text-center md:text-right">
            <p className="text-sm text-background/50 font-body">© 2026 Acapolite Consulting. All rights reserved.</p>
            <a
              href="mailto:info@acapoliteconsulting.co.za"
              className="text-sm text-primary font-body hover:underline"
            >
              info@acapoliteconsulting.co.za
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
