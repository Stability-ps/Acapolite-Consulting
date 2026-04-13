import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AdminExternalTools from "@/pages/dashboard/admin/AdminExternalTools";
import PractitionerExternalTools from "@/pages/dashboard/admin/PractitionerExternalTools";

export function StaffExternalToolsRouter() {
  const { role } = useAuth();

  if (role === "admin") {
    return <AdminExternalTools />;
  }

  if (role === "consultant") {
    return <PractitionerExternalTools />;
  }

  return <Navigate to="/dashboard" replace />;
}
