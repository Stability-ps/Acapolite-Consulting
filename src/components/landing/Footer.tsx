import { Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-foreground py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold text-background">Acapolite Consulting</span>
          </div>
          <p className="text-sm text-background/50 font-body">Registered Tax Practitioners</p>
          <div className="text-center md:text-right">
            <p className="text-sm text-background/50 font-body">© 2026 Acapolite Consulting. All rights reserved.</p>
            <a href="mailto:info@acapolite.co.za" className="text-sm text-primary font-body hover:underline">
              info@acapolite.co.za
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
