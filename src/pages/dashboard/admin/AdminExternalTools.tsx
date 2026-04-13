import { Activity, Building2, ClipboardCheck, FileText, Landmark, ShieldCheck } from "lucide-react";

const externalTools = [
  {
    label: "SARS eFiling",
    description: "Secure SARS eFiling access",
    href: "https://secure.sarsefiling.co.za/app/login",
    icon: ShieldCheck,
  },
  {
    label: "SARS Status Dashboard",
    description: "Live SARS system status",
    href: "https://tools.sars.gov.za/status",
    icon: Activity,
  },
  {
    label: "SARS EasyFile",
    description: "EasyFile services portal",
    href: "https://secure.sarsefiling.co.za/app/login",
    icon: FileText,
  },
  {
    label: "CIPC eServices",
    description: "Companies and IP Commission",
    href: "https://eservices.cipc.co.za/",
    icon: Building2,
  },
  {
    label: "CIPC BizPortal",
    description: "BizPortal by the CIPC",
    href: "https://bizportal.gov.za/",
    icon: Landmark,
  },
];

export default function AdminExternalTools() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <div>
            <h1 className="font-display text-3xl text-foreground">External Tools</h1>
            <p className="mt-2 text-sm text-muted-foreground font-body">
              Quick access to the government platforms used daily.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {externalTools.map((tool) => (
          <a
            key={tool.label}
            href={tool.href}
            target="_blank"
            rel="noreferrer"
            className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:border-primary/30 hover:shadow-elevated"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body font-semibold text-foreground">{tool.label}</p>
                <p className="mt-1 text-xs text-muted-foreground font-body">{tool.description}</p>
              </div>
              <tool.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Open in new tab
            </p>
          </a>
        ))}
      </section>
    </div>
  );
}
