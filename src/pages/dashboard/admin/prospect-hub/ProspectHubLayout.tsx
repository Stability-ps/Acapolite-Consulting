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
      <nav aria-label="Prospect Hub sections" className="-mx-1 overflow-x-auto pb-1">
        <ul className="flex min-w-max gap-1 px-1">
          {sections.map((s) => (
            <li key={s.label}>
              <NavLink
                to={s.to}
                end={s.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                    isActive ? "border-primary bg-primary text-primary-foreground" : "border-transparent bg-card text-muted-foreground hover:border-border hover:text-foreground",
                  )
                }
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
