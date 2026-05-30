import { ChevronDown, Menu, UserCircle2 } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { cn } from "@/lib/utils";

const primaryNavItems = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/#services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Practitioners", href: "/practitioners" },
  { label: "Contact", href: "/contact-us" },
] as const;

const resourceLinks = [
  { label: "Help Center", href: "/help-center" },
  { label: "FAQ", href: "/faq" },
  { label: "How Acapolite Works", href: "/how-acapolite-works" },
  { label: "Trust & Safety", href: "/trust-safety" },
];

function NavLink({
  href,
  label,
  isActive,
  onClick,
}: {
  href: string;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const className = cn(
    "relative px-3 py-2 text-sm font-medium text-[#1E2A3C] transition-colors hover:text-[#022D73]",
    isActive && "text-[#022D73] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-[#C49A22]",
  );

  return (
    <Link to={href} onClick={onClick} className={className}>
      {label}
    </Link>
  );
}

export function LandingHeader() {
  const { user, dashboardPath } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const isNavItemActive = (href: string) => {
    if (href === "/") {
      return location.pathname === "/" && !location.hash;
    }

    if (href.startsWith("/#")) {
      return location.pathname === "/" && location.hash === href.slice(1);
    }

    return location.pathname === href;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#E7E7E7] bg-white">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5 text-[#022D73]" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 px-0">
              <SheetTitle className="sr-only">Main navigation</SheetTitle>
              <div className="flex items-center gap-3 border-b border-[#E7E7E7] px-6 pb-5 pt-2">
                <AcapoliteLogo className="h-10" />
              </div>
              <div className="flex flex-col gap-6 px-4 py-6">
                <div className="space-y-2">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C49A22]">
                    Navigation
                  </p>
                  <div className="space-y-1">
                    {primaryNavItems.map((item) => (
                      <Link
                        key={item.label}
                        to={item.href}
                        onClick={closeMenu}
                        className={cn(
                          "flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium transition",
                          isNavItemActive(item.href)
                            ? "bg-[#FFF8E4] text-[#022D73]"
                            : "text-[#1E2A3C] hover:bg-[#F4F4F2]",
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C49A22]">
                    Resources
                  </p>
                  <div className="space-y-1">
                    {resourceLinks.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={closeMenu}
                        className="flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-[#1E2A3C] transition hover:bg-[#F4F4F2]"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {!user ? (
                  <div className="space-y-3 border-t border-[#E7E7E7] pt-6">
                    <Button asChild className="h-11 w-full rounded-full bg-[#C49A22] text-white hover:bg-[#b48a1c]">
                      <Link to="/request-tax-assistance?step=1" onClick={closeMenu}>Request Assistance</Link>
                    </Button>
                    <Button asChild variant="outline" className="h-11 w-full rounded-full border-[#D7D7D7] bg-white text-[#102B46] hover:bg-[#F4F4F2]">
                      <Link to="/register?role=consultant" onClick={closeMenu}>Join as a Professional</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex min-w-0 items-center gap-3">
            <AcapoliteLogo className="h-10 w-auto md:h-11" />
            <div className="hidden leading-none sm:block">
              <p className="text-sm font-bold tracking-[0.12em] text-[#102B46]">ACAPOLITE</p>
              <p className="mt-0.5 text-[10px] font-semibold tracking-[0.28em] text-[#C49A22]">CONSULTING</p>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.label}
              href={item.href}
              label={item.label}
              isActive={isNavItemActive(item.href)}
            />
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[#1E2A3C] transition-colors hover:text-[#022D73]">
              Resources
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[200px]">
              {resourceLinks.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link to={item.href}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          {user ? (
            <Button asChild size="sm" className="rounded-full bg-[#C49A22] text-white hover:bg-[#b48a1c]">
              <Link to={dashboardPath}>Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                size="sm"
                className="hidden rounded-full bg-[#C49A22] px-4 text-white hover:bg-[#b48a1c] sm:inline-flex"
              >
                <Link to="/request-tax-assistance?step=1">Request Assistance</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="hidden rounded-full border-[#D7D7D7] bg-white px-4 text-[#102B46] hover:bg-[#F4F4F2] md:inline-flex"
              >
                <Link to="/register?role=consultant">Join as a Professional</Link>
              </Button>
              <Button asChild size="icon" variant="outline" className="rounded-full border-[#E7E7E7]">
                <Link to="/login" aria-label="Account login">
                  <UserCircle2 className="h-5 w-5 text-[#102B46]" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
