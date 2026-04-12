import { Link } from "react-router-dom";
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
              <Link to="/about-us" className="hover:text-background">About Us</Link>
              <Link to="/how-acapolite-works" className="hover:text-background">How Acapolite Works</Link>
              <Link to="/our-services" className="hover:text-background">Our Services</Link>
              <a href="#" className="hover:text-background">Become a Practitioner</a>
              <Link to="/practitioner-guidelines" className="hover:text-background">Practitioner Guidelines</Link>
              <Link to="/contact-us" className="hover:text-background">Contact Us</Link>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-background font-body">Support</p>
            <div className="grid gap-2 text-sm text-background/70 font-body">
              <Link to="/help-center" className="hover:text-background">Help Center</Link>
              <Link to="/faq" className="hover:text-background">FAQ</Link>
              <Link to="/trust-safety" className="hover:text-background">Trust &amp; Safety</Link>
              <Link to="/contact-us" className="hover:text-background">Support Request</Link>
              <Link to="/contact-us" className="hover:text-background">Report an Issue</Link>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-background font-body">Legal</p>
            <div className="grid gap-2 text-sm text-background/70 font-body">
              <Link to="/terms-and-conditions" className="hover:text-background">Terms &amp; Conditions</Link>
              <Link to="/privacy-policy" className="hover:text-background">Privacy Policy</Link>
              <Link to="/cookie-policy" className="hover:text-background">Cookie Policy</Link>
              <Link to="/refund-policy" className="hover:text-background">Refund Policy</Link>
              <Link to="/disclaimer" className="hover:text-background">Disclaimer</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
