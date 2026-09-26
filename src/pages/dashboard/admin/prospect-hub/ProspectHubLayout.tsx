import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, CalendarClock, FileText, LayoutDashboard, Mail, Radar, Settings, Target, Database, UserCheck, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  { to: "", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "discover", label: "Discover", icon: Radar },
  { to: "prospects", label: "Prospects", icon: Building2 },
  { to: "leads", label: "Leads", icon: UserCheck },
  { to: "follow-ups", label: "Follow-ups", icon: CalendarClock },
  { to: "campaigns", label: "Campaigns", icon: Mail },
  { to: "templates", label: "Email Templates", icon: FileText },
  { to: "sources", label: "Sources", icon: Database },
  { to: "analytics", label: "Analytics", icon: BarChart3 },
  { to: "settings", label: "Settings", icon: Settings },
];

export default function ProspectHubLayout() {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Prospect Hub</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground font-body">
          Discover, enrich, qualify and contact businesses, then convert interested prospects into Acapolite clients.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <nav aria-label="Prospect Hub sections" className="rounded-2xl border bg-card p-2 shadow-sm">
            <div className="mb-2 hidden px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:block">
              Prospect Hub
            </div>
            <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {sections.map((s) => (
                <li key={s.label} className="shrink-0 lg:w-full">
                  <NavLink
                    to={s.to}
                    end={s.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:w-full",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )
                    }
                  >
                    <s.icon className="h-4 w-4 shrink-0" />
                    <span>{s.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
