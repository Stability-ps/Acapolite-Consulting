import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface RequireStaffPermissionProps {
  permission: "can_view_overview" | "can_view_clients" | "can_view_client_workspace" | "can_view_cases" | "can_view_documents" | "can_view_invoices" | "can_view_messages";
}

export function RequireStaffPermission({ permission }: RequireStaffPermissionProps) {
  const { loading, user, role, dashboardPath, hasStaffPermission } = useAuth();

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

  if (role === "admin" || hasStaffPermission(permission)) {
    return <Outlet />;
  }

  return <Navigate to={dashboardPath} replace />;
}
