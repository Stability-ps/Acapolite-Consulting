import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen, Building2, Calculator, ChevronRight, CircleHelp, FileText,
  Home, Landmark, Menu, MessageCircle, ReceiptText, ShieldCheck, UserCircle2, Users
} from "lucide-react";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";

const services = [
  { title: "SARS & Tax", subtitle: "Debt, objections, audits and compliance", icon: Landmark, href: "/sars-tax-assistance" },
  { title: "Tax Returns", subtitle: "Personal and business tax returns", icon: FileText, href: "/tax-returns" },
  { title: "VAT", subtitle: "VAT returns, reviews and support", icon: ReceiptText, href: "/vat-services" },
  { title: "Accounting", subtitle: "Accounting and bookkeeping support", icon: Calculator, href: "/accounting-services" },
  { title: "CIPC", subtitle: "Company and compliance services", icon: Building2, href: "/cipc-company-compliance" },
  { title: "Practitioners", subtitle: "Find professional assistance", icon: Users, href: "/practitioners" },
];

const moreLinks = [
  ["All Services", "/our-services"], ["Tax Guides", "/tax-guides"], ["How Acapolite Works", "/how-acapolite-works"],
  ["Help Centre", "/help-center"], ["FAQ", "/faq"], ["Trust & Safety", "/trust-safety"],
  ["About Acapolite", "/about-us"], ["Contact Support", "/contact-us"], ["Privacy Policy", "/privacy-policy"],
  ["Terms & Conditions", "/terms-and-conditions"], ["Data Deletion", "/data-deletion"], ["Disclaimer", "/disclaimer"],
] as const;

export function NativeHome() {
  const { user, dashboardPath } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-[#f6f5f1] pb-[calc(88px+env(safe-area-inset-bottom))] text-[#102B46]">
      <header className="native-safe-top sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-5">
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="rounded-full"><Menu className="h-5 w-5" /></Button></SheetTrigger>
            <SheetContent side="left" className="native-sheet-safe w-[86vw] max-w-sm overflow-y-auto px-5">
              <SheetTitle className="mb-6 flex items-center gap-3"><AcapoliteLogo className="h-10" /><span>Acapolite</span></SheetTitle>
              <div className="grid gap-1">
                {moreLinks.map(([label, href]) => <Link key={href} to={href} onClick={() => setMoreOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-3.5 text-sm font-medium hover:bg-muted"><span>{label}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>)}
              </div>
            </SheetContent>
          </Sheet>
          <Link to="/" aria-label="Acapolite home"><AcapoliteLogo className="h-10 w-auto" /></Link>
          <Button asChild variant="ghost" size="icon" className="rounded-full border border-black/5">
            <Link to={user ? dashboardPath : "/login"} aria-label={user ? "Dashboard" : "Sign in"}><UserCircle2 className="h-5 w-5" /></Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 pt-7">
        <section className="mb-7">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#C49A22]">Acapolite Consulting</p>
          <h1 className="text-3xl font-bold leading-tight">What can we help you with?</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Choose a service or start a request. We’ll connect you to the right professional support.</p>
        </section>

        <Button asChild className="mb-7 h-14 w-full rounded-2xl bg-[#C49A22] text-base font-semibold text-white shadow-sm hover:bg-[#b48a1c]">
          <Link to="/request-tax-assistance?step=1">Request professional assistance <ChevronRight className="ml-2 h-5 w-5" /></Link>
        </Button>

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Services</h2><Link to="/our-services" className="text-sm font-semibold text-[#C49A22]">See all</Link></div>
          <div className="grid grid-cols-2 gap-3">
            {services.map(({ title, subtitle, icon: Icon, href }) => (
              <Link key={title} to={href} className="min-h-36 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition active:scale-[0.98]">
                <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF7DD] text-[#A77B00]"><Icon className="h-5 w-5" /></span>
                <h3 className="font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-7 grid gap-3">
          <Link to="/tax-guides" className="flex items-center gap-4 rounded-2xl bg-[#102B46] p-4 text-white"><BookOpen className="h-6 w-6 text-[#E7C45C]" /><div className="flex-1"><p className="font-bold">SARS & Tax Guides</p><p className="text-xs text-white/65">Practical tax information and guidance</p></div><ChevronRight className="h-5 w-5" /></Link>
          <Link to="/trust-safety" className="flex items-center gap-4 rounded-2xl border border-black/5 bg-white p-4"><ShieldCheck className="h-6 w-6 text-[#C49A22]" /><div className="flex-1"><p className="font-bold">Trust & Safety</p><p className="text-xs text-slate-500">How Acapolite protects clients and professionals</p></div><ChevronRight className="h-5 w-5" /></Link>
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid h-[68px] max-w-xl grid-cols-4">
          <Link to="/" className="flex flex-col items-center justify-center gap-1 text-[#C49A22]"><Home className="h-5 w-5" /><span className="text-[10px] font-semibold">Home</span></Link>
          <Link to="/request-tax-assistance?step=1" className="flex flex-col items-center justify-center gap-1 text-slate-500"><MessageCircle className="h-5 w-5" /><span className="text-[10px] font-semibold">Request</span></Link>
          <Link to="/tax-guides" className="flex flex-col items-center justify-center gap-1 text-slate-500"><BookOpen className="h-5 w-5" /><span className="text-[10px] font-semibold">Guides</span></Link>
          <button type="button" onClick={() => setMoreOpen(true)} className="flex flex-col items-center justify-center gap-1 text-slate-500"><CircleHelp className="h-5 w-5" /><span className="text-[10px] font-semibold">More</span></button>
        </div>
      </nav>
    </div>
  );
}
