import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/portal";
import { getDashboardHome } from "@/lib/portal";

interface RequireRoleProps {
  allowedRoles: AppRole[];
}

export function RequireRole({ allowedRoles }: RequireRoleProps) {
  const { loading, user, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-body">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={getDashboardHome(role)} replace />;
  }

  return <Outlet />;
}

