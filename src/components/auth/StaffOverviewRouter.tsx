import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AdminOverview from "@/pages/dashboard/admin/AdminOverview";
import PractitionerOverview from "@/pages/dashboard/admin/PractitionerOverview";

export function StaffOverviewRouter() {
  const { role } = useAuth();

  if (role === "admin") {
    return <AdminOverview />;
  }

  if (role === "consultant") {
    return <PractitionerOverview />;
  }

  return <Navigate to="/dashboard" replace />;
}
