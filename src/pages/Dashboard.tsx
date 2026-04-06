import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Outlet } from "react-router-dom";
import { dashboardDescriptionByRole, dashboardTitleByRole } from "@/lib/portal";

export default function Dashboard() {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-body">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const title = role ? dashboardTitleByRole[role] : "Acapolite Portal";
  const description = role ? dashboardDescriptionByRole[role] : "Secure access to your dashboard.";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="border-b border-border bg-card px-4 py-3">
            <div className="flex items-start gap-4">
              <SidebarTrigger className="mt-1 mr-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" />
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
                <p className="text-sm text-muted-foreground font-body">{description}</p>
              </div>
            </div>
          </header>
          <main className="flex-1 p-6 bg-background overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
