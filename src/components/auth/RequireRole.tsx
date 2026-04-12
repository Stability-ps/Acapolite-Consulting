import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/portal";
import { getDashboardHome } from "@/lib/portal";

interface RequireRoleProps {
  allowedRoles: AppRole[];
}

export function RequireRole({ allowedRoles }: RequireRoleProps) {
  const { loading, user, role, profile } = useAuth();

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

  if (role === "consultant" && profile?.is_active === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-body">Verification Pending</p>
          <h1 className="mt-3 font-display text-2xl text-foreground">Your practitioner account is pending verification</h1>
          <p className="mt-3 text-sm text-muted-foreground font-body">
            Our team is reviewing your credentials and documents. You will be able to access the practitioner
            dashboard once your account is verified.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

