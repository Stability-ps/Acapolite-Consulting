import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { dashboardDescriptionByRole, dashboardTitleByRole } from "@/lib/portal";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeft } from "lucide-react";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

export default function Dashboard() {
  const { user, loading, role } = useAuth();
  const location = useLocation();

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
      <div className="app-shell min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-white/78 px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="dashboard-page flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <SidebarTrigger className="mt-1 mr-0 h-11 w-auto gap-2 rounded-full border border-primary/30 bg-primary px-4 text-primary-foreground shadow-[0_12px_26px_rgba(15,23,42,0.25)] hover:bg-primary/95">
                  <PanelLeft className="h-5 w-5" />
                  <span className="text-sm font-semibold tracking-wide sm:hidden">Menu</span>
                </SidebarTrigger>
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
                  <p className="text-sm text-muted-foreground font-body">{description}</p>
                </div>
              </div>
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto px-4 py-5 sm:px-6 sm:py-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(3px)" }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="dashboard-page dashboard-surface min-h-full rounded-[1.75rem] border border-border/70 p-4 shadow-elevated sm:p-6 lg:p-7"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
