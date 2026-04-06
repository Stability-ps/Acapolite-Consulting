import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardHome } from "@/lib/portal";

export function DashboardIndexRedirect() {
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

  return <Navigate to={getDashboardHome(role)} replace />;
}
