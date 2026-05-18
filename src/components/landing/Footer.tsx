import { Link } from "react-router-dom";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { Facebook, Instagram, Linkedin } from "lucide-react";

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
                href="mailto:support@acapoliteconsulting.co.za"
                className="block text-sm font-body text-background/80 transition hover:text-background hover:underline"
              >
                support@acapoliteconsulting.co.za
              </a>
              <div className="space-y-3 pt-4">
                <p className="text-sm font-semibold text-background font-body">Connect with us</p>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="https://www.facebook.com/acapolite"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-background/70 transition hover:bg-white/10 hover:text-white"
                    aria-label="Facebook"
                  >
                    <Facebook className="h-5 w-5" />
                  </a>
                  <a
                    href="https://www.instagram.com/acapolite"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-background/70 transition hover:bg-white/10 hover:text-white"
                    aria-label="Instagram"
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                  <a
                    href="https://www.linkedin.com/company/acapolite-consulting"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-background/70 transition hover:bg-white/10 hover:text-white"
                    aria-label="LinkedIn"
                  >
                    <Linkedin className="h-5 w-5" />
                  </a>
                  <a
                    href="https://wa.me/27675575506"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-background/70 transition hover:bg-white/10 hover:text-white"
                    aria-label="WhatsApp"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.149-.672.149s-.771.967-.944 1.168c-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.387-1.475-.883-.79-1.48-1.766-1.653-2.063-.173-.297-.018-.458.13-.606.134-.133.298-.347.447-.52.149-.173.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.672-1.611-.92-2.21-.242-.579-.487-.5-.672-.51l-.572-.01c-.198 0-.52.074-.792.372s-1.04 1.015-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.078 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 2.04C6.48 2.04 2.04 6.48 2.04 12c0 2.12.63 4.08 1.71 5.74L2 22l4.46-1.17A9.94 9.94 0 0012 21.96c5.52 0 9.96-4.44 9.96-9.96S17.52 2.04 12 2.04zm0 17.92c-1.72 0-3.33-.5-4.72-1.35l-.34-.2-2.64.69.7-2.57-.22-.35A8.006 8.006 0 013.96 12c0-4.42 3.58-8 8-8 4.42 0 8 3.58 8 8s-3.58 8-8 8z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-background font-body">Company</p>
            <div className="grid gap-2 text-sm text-background/70 font-body">
              <Link to="/about-us" className="hover:text-background">About Us</Link>
              <Link to="/how-acapolite-works" className="hover:text-background">How Acapolite Works</Link>
              <Link to="/our-services" className="hover:text-background">Our Services</Link>
              <Link to="/practitioners" className="hover:text-background">For Practitioners</Link>
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
