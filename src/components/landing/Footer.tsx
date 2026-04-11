import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export function Footer() {
  return (
    <footer className="bg-foreground py-12">
      <div className="container mx-auto px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <AcapoliteLogo className="h-12 brightness-0 invert" />
            <p className="text-sm text-background/50 font-body">Registered Tax Practitioners</p>
            <div className="space-y-2">
              <p className="text-sm text-background/50 font-body">Copyright 2026 Acapolite Consulting. All rights reserved.</p>
              <a
                href="mailto:info@acapoliteconsulting.co.za"
                className="text-sm text-primary font-body hover:underline"
              >
                info@acapoliteconsulting.co.za
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-background font-body">Company</p>
            <div className="grid gap-2 text-sm text-background/70 font-body">
              <a href="#" className="hover:text-background">About Us</a>
              <a href="#" className="hover:text-background">How Acapolite Works</a>
              <a href="#" className="hover:text-background">Our Services</a>
              <a href="#" className="hover:text-background">Become a Practitioner</a>
              <a href="#" className="hover:text-background">Contact Us</a>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-background font-body">Support</p>
            <div className="grid gap-2 text-sm text-background/70 font-body">
              <a href="#" className="hover:text-background">Help Center</a>
              <a href="#" className="hover:text-background">FAQ</a>
              <a href="#" className="hover:text-background">Trust &amp; Safety</a>
              <a href="#" className="hover:text-background">Support Request</a>
              <a href="#" className="hover:text-background">Report an Issue</a>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-background font-body">Legal</p>
            <div className="grid gap-2 text-sm text-background/70 font-body">
              <a href="#" className="hover:text-background">Terms &amp; Conditions</a>
              <a href="#" className="hover:text-background">Privacy Policy</a>
              <a href="#" className="hover:text-background">Cookie Policy</a>
              <a href="#" className="hover:text-background">Refund Policy</a>
              <a href="#" className="hover:text-background">Disclaimer</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
