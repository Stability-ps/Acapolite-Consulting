import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

const navItems: { label: string; href: string }[] = [
  { label: "Portal", href: "/login" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "/contact-us" },
];

export function LandingHeader() {
  const { user, dashboardPath } = useAuth();

  return (
    <motion.header
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-40"
    >
      <div className="container mx-auto px-6 pt-4">
        <div className="relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-[1.75rem] border border-sky-900/45 bg-[linear-gradient(135deg,rgba(59,130,246,0.24),rgba(30,64,175,0.22),rgba(15,23,42,0.30))] px-4 py-3 shadow-glow backdrop-blur-xl md:px-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(125,211,252,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />
          <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-200/20 to-transparent" />
          <a href="#top" className="flex min-w-0 items-center gap-3">
            <AcapoliteLogo className="relative z-10 h-12 transition-transform duration-300 hover:scale-[1.02]" />
          </a>

          {navItems.length ? (
            <nav className="relative z-10 hidden items-center gap-1 rounded-full border border-sky-300/12 bg-slate-950/18 p-1 md:flex">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-4 py-2 text-sm font-medium text-white !text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/14 hover:text-white hover:shadow-[0_8px_24px_rgba(255,255,255,0.10)]"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}

          <div className="relative z-10 flex items-center gap-2">
            {user ? (
              <Button
                asChild
                className="rounded-full border border-sky-300/18 bg-white/95 px-5 text-slate-950 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_30px_rgba(255,255,255,0.18)]"
              >
                <Link to={dashboardPath}>
                  Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="hidden rounded-full border border-sky-300/16 bg-sky-100/12 px-5 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-100/18 hover:text-white hover:shadow-[0_8px_24px_rgba(125,211,252,0.16)] lg:inline-flex"
                >
                  <Link to="/request-tax-assistance">Request Tax Assistance</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="hidden rounded-full border border-sky-300/16 bg-sky-100/12 px-5 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-100/18 hover:text-white hover:shadow-[0_8px_24px_rgba(125,211,252,0.16)] sm:inline-flex"
                >
                  <Link to="/contact-us">Request Demo</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="hidden rounded-full border border-sky-300/12 bg-slate-950/18 px-5 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/14 hover:text-white hover:shadow-[0_8px_24px_rgba(255,255,255,0.10)] sm:inline-flex"
                >
                  <Link to="/login">Log In</Link>
                </Button>
                <Button
                  asChild
                  className="rounded-full border border-sky-300/18 bg-white/95 px-5 text-slate-950 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_30px_rgba(255,255,255,0.18)]"
                >
                  <Link to="/register">
                    Create Account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
