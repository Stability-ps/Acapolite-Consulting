import { motion } from "framer-motion";
import { ChevronDown, Menu, UserCircle2 } from "lucide-react";
import { useState } from "react";
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
  { label: "Practitioners", href: "/practitioners" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "/contact-us" },
];

export function LandingHeader() {
  const { user, dashboardPath } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-40"
    >
      <div className="container mx-auto px-6 pt-3 md:pt-4">
        <div className="relative flex w-full flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-[#E7E7E7] bg-white/95 px-4 py-3 shadow-sm backdrop-blur-xl md:flex-nowrap md:px-6 md:py-4">
          <div className="flex items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 gap-2 rounded-full border border-[#E7E7E7] bg-white px-4 text-[#022D73] shadow-sm hover:bg-[#F4F4F2] lg:hidden"
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
                      onClick={closeMenu}
                      className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
                <div className="mt-6 grid gap-3">
                  {user ? (
                    <Button asChild className="w-full rounded-xl bg-white text-slate-950">
                      <Link to={dashboardPath} onClick={closeMenu}>Dashboard</Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild className="w-full rounded-xl bg-white text-slate-950">
                        <Link to="/request-tax-assistance" onClick={closeMenu}>Request Tax Assistance</Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full rounded-xl border-white/30 bg-white/90 !text-slate-950 hover:bg-white">
                        <Link to="/register" onClick={closeMenu}>Create Account (Client)</Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full rounded-xl border-white/30 bg-white/90 !text-slate-950 hover:bg-white">
                        <Link to="/register?role=consultant" onClick={closeMenu}>Join as Practitioner</Link>
                      </Button>
                      <Button asChild variant="ghost" className="w-full rounded-xl border border-white/15 text-white">
                        <Link to="/login" onClick={closeMenu}>Log In</Link>
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <a href="#top" className="flex min-w-0 items-center gap-3">
              <AcapoliteLogo className="relative z-10 h-10 transition-transform duration-300 hover:scale-[1.02] md:h-12" />
              <span className="hidden text-sm font-semibold uppercase tracking-[0.34em] text-[#022D73] xl:inline">
                ACAPOLITE CONSULTING
              </span>
            </a>
          </div>

          {navItems.length ? (
            <nav className="relative z-10 hidden flex-wrap items-center justify-center gap-1 lg:flex lg:px-2">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-[#1E2A3C] transition-colors duration-200 hover:bg-[#F4F4F2] hover:text-[#022D73] lg:px-3 lg:py-2 xl:px-4 xl:text-sm"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}

          <div className="relative z-10 flex items-center gap-2 xl:hidden">
            {user ? (
              <Button asChild size="sm" className="rounded-full bg-[#022D73] text-white hover:bg-[#05265c]">
                <Link to={dashboardPath}>Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="rounded-full border border-[#D8E5EE] bg-white text-[#022D73] hover:bg-[#F4F4F2] hover:text-[#022D73]"
                >
                  <Link to="/login">Login</Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="rounded-full bg-[#022D73] text-white hover:bg-[#05265c]">
                      Join
                      <ChevronDown className="h-3.5 w-3.5" />
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
              </>
            )}
          </div>

          <div className="relative z-10 hidden items-center gap-3 xl:flex">
            <Button asChild className="rounded-full bg-[#B8962E] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#A88633]">
              <Link to="/request-tax-assistance">Request Assistance</Link>
            </Button>
            <Button asChild className="rounded-full border border-[#B8962E] bg-white px-5 py-3 text-sm font-semibold text-[#022D73] transition hover:bg-[#F4F4F2]">
              <Link to="/register?role=consultant">Join as a Professional</Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full border border-[#E7E7E7] bg-white p-3 text-[#022D73] transition hover:bg-[#F4F4F2]">
              <Link to="/login">
                <UserCircle2 className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>

      </div>
    </motion.header>
  );
}
