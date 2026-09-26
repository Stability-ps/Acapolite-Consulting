import { Outlet } from "react-router-dom";
import { Target } from "lucide-react";

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
      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
