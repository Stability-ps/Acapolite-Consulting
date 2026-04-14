import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
      <div className="container mx-auto px-6 pt-3 md:pt-4">
        <div className="relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-[1.75rem] border border-sky-900/45 bg-[linear-gradient(135deg,rgba(59,130,246,0.24),rgba(30,64,175,0.22),rgba(15,23,42,0.30))] px-3 py-2 shadow-glow backdrop-blur-xl md:gap-4 md:px-6 md:py-3">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(125,211,252,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />
          <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-200/20 to-transparent" />
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="md:hidden h-11 gap-2 rounded-full border border-sky-200/45 bg-slate-950/80 px-4 text-white shadow-[0_12px_26px_rgba(15,23,42,0.6)] ring-1 ring-white/40 hover:bg-slate-900/85"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                  <span className="text-sm font-semibold tracking-wide">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 bg-slate-950 text-white">
                <div className="flex items-center gap-3 pb-6">
                  <AcapoliteLogo className="h-10" />
                  <span className="text-sm font-semibold tracking-[0.2em] text-white/70">MENU</span>
                </div>
                <div className="space-y-2">
                  {navItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
                <div className="mt-6 grid gap-3">
                  {user ? (
                    <Button asChild className="w-full rounded-xl bg-white text-slate-950">
                      <Link to={dashboardPath}>Dashboard</Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild className="w-full rounded-xl bg-white text-slate-950">
                        <Link to="/request-tax-assistance">Request Tax Assistance</Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full rounded-xl border-white/30 bg-white/90 !text-slate-950 hover:bg-white">
                        <Link to="/register">Create Account (Client)</Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full rounded-xl border-white/30 bg-white/90 !text-slate-950 hover:bg-white">
                        <Link to="/register?role=consultant">Join as Practitioner</Link>
                      </Button>
                      <Button asChild variant="ghost" className="w-full rounded-xl border border-white/15 text-white">
                        <Link to="/login">Log In</Link>
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <a href="#top" className="flex min-w-0 items-center gap-2 md:gap-3">
              <AcapoliteLogo className="relative z-10 h-10 transition-transform duration-300 hover:scale-[1.02] md:h-12" />
            </a>
          </div>

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

          <div className="relative z-10 hidden items-center gap-2 md:flex">
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
                  className="rounded-full border border-sky-300/12 bg-slate-950/22 px-5 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/14 hover:text-white hover:shadow-[0_8px_24px_rgba(255,255,255,0.10)]"
                >
                  <Link to="/login">Login</Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="rounded-full border border-sky-300/18 bg-white/95 px-5 text-slate-950 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_30px_rgba(255,255,255,0.18)]">
                      Join
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="min-w-[220px]">
                    <DropdownMenuItem asChild>
                      <Link to="/register">Create Account (Client)</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/register?role=consultant">Join as Practitioner</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  asChild
                  variant="ghost"
                  className="hidden rounded-full border border-sky-300/16 bg-sky-100/12 px-5 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-100/18 hover:text-white hover:shadow-[0_8px_24px_rgba(125,211,252,0.16)] sm:inline-flex"
                >
                  <Link to="/contact-us">Request Demo</Link>
                </Button>
              </>
            )}
          </div>
        </div>

      </div>
    </motion.header>
  );
}
