import type { StaffPermissionValues } from "@/lib/staffPermissions";
import { getFirstStaffRoute } from "@/lib/staffPermissions";

export type AppRole = "admin" | "consultant" | "client";

export const dashboardHomeByRole: Record<AppRole, string> = {
  admin: "/dashboard/staff",
  consultant: "/dashboard/staff",
  client: "/dashboard/client",
};

export const dashboardTitleByRole: Record<AppRole, string> = {
  admin: "Acapolite Staff",
  consultant: "Practitioner Workspace",
  client: "Client Portal",
};

export const dashboardDescriptionByRole: Record<AppRole, string> = {
  admin: "Manage Acapolite operations across every client account.",
  consultant: "Manage practitioner profile setup, lead responses, assigned clients, and workload from one place.",
  client: "Track your cases, invoices, messages, and documents in one place.",
};

export function getDashboardHome(role: AppRole | null | undefined, permissions?: StaffPermissionValues | null) {
  if (!role) return "/dashboard";
  if (role === "consultant") {
    return getFirstStaffRoute(permissions);
  }
  return dashboardHomeByRole[role];
}
