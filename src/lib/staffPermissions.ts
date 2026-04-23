import type { Tables } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/portal";

export type StaffPermissionsRow = Tables<"staff_permissions">;

export type StaffPermissionValues = Pick<
  StaffPermissionsRow,
  | "assigned_clients_only"
  | "can_view_overview"
  | "can_view_clients"
  | "can_manage_clients"
  | "can_view_client_workspace"
  | "can_view_cases"
  | "can_manage_cases"
  | "can_view_documents"
  | "can_review_documents"
  | "can_view_invoices"
  | "can_manage_invoices"
  | "can_view_messages"
  | "can_reply_messages"
>;

export type StaffPermissionKey = Exclude<keyof StaffPermissionValues, "assigned_clients_only">;

export const fullStaffPermissions: StaffPermissionValues = {
  assigned_clients_only: false,
  can_view_overview: true,
  can_view_clients: true,
  can_manage_clients: true,
  can_view_client_workspace: true,
  can_view_cases: true,
  can_manage_cases: true,
  can_view_documents: true,
  can_review_documents: true,
  can_view_invoices: true,
  can_manage_invoices: true,
  can_view_messages: true,
  can_reply_messages: true,
};

export const defaultConsultantPermissions: StaffPermissionValues = {
  assigned_clients_only: true,
  can_view_overview: true,
  can_view_clients: true,
  can_manage_clients: true,
  can_view_client_workspace: true,
  can_view_cases: true,
  can_manage_cases: true,
  can_view_documents: true,
  can_review_documents: true,
  can_view_invoices: true,
  can_manage_invoices: false,
  can_view_messages: true,
  can_reply_messages: true,
};

export const consultantPermissionFields: Array<{
  key: keyof StaffPermissionValues;
  label: string;
  description: string;
}> = [
  {
    key: "assigned_clients_only",
    label: "Assigned Clients Only",
    description: "Limit this consultant to clients assigned to them.",
  },
  {
    key: "can_view_overview",
    label: "Overview",
    description: "Allow the consultant to access the staff overview dashboard.",
  },
  {
    key: "can_view_clients",
    label: "Clients List",
    description: "Allow access to the main clients screen.",
  },
  {
    key: "can_manage_clients",
    label: "Manage Clients",
    description: "Allow adding and editing client records.",
  },
  {
    key: "can_view_client_workspace",
    label: "Client 360",
    description: "Allow access to the full client workspace view.",
  },
  {
    key: "can_view_cases",
    label: "Cases",
    description: "Allow access to the staff cases page.",
  },
  {
    key: "can_manage_cases",
    label: "Manage Cases",
    description: "Allow creating cases and changing case statuses.",
  },
  {
    key: "can_view_documents",
    label: "Documents",
    description: "Allow access to the staff documents page.",
  },
  {
    key: "can_review_documents",
    label: "Review Documents",
    description: "Allow approving and rejecting uploaded documents.",
  },
  {
    key: "can_view_invoices",
    label: "Invoices",
    description: "Allow access to invoices and billing data.",
  },
  {
    key: "can_manage_invoices",
    label: "Manage Invoices",
    description: "Allow creating and editing invoices.",
  },
  {
    key: "can_view_messages",
    label: "Messages",
    description: "Allow access to client conversations.",
  },
  {
    key: "can_reply_messages",
    label: "Reply to Messages",
    description: "Allow sending replies to client messages.",
  },
];

export function sanitizeStaffPermissions(values: StaffPermissionValues): StaffPermissionValues {
  const next = { ...values };

  if (!next.can_view_clients) {
    next.can_manage_clients = false;
  }

  if (!next.can_view_cases) {
    next.can_manage_cases = false;
  }

  if (!next.can_view_documents) {
    next.can_review_documents = false;
  }

  if (!next.can_view_invoices) {
    next.can_manage_invoices = false;
  }

  if (!next.can_view_messages) {
    next.can_reply_messages = false;
  }

  if (next.can_manage_clients) {
    next.can_view_clients = true;
  }

  if (next.can_manage_cases) {
    next.can_view_cases = true;
  }

  if (next.can_review_documents) {
    next.can_view_documents = true;
  }

  if (next.can_manage_invoices) {
    next.can_view_invoices = true;
  }

  if (next.can_reply_messages) {
    next.can_view_messages = true;
  }

  return next;
}

export function resolveStaffPermissions(
  role: AppRole | null | undefined,
  permissions?: Partial<StaffPermissionValues> | null,
) {
  if (role === "admin") {
    return fullStaffPermissions;
  }

  if (role === "consultant") {
    return sanitizeStaffPermissions({
      ...defaultConsultantPermissions,
      ...(permissions ?? {}),
    });
  }

  return null;
}

export function hasStaffPermission(
  role: AppRole | null | undefined,
  permissions: StaffPermissionValues | null | undefined,
  permission: StaffPermissionKey,
) {
  if (role === "admin") return true;
  if (role !== "consultant") return false;
  return Boolean(resolveStaffPermissions(role, permissions)?.[permission]);
}

export function getFirstStaffRoute(permissions: StaffPermissionValues | null | undefined) {
  const resolved = resolveStaffPermissions("consultant", permissions);

  if (!resolved) return "/dashboard";
  if (resolved.can_view_overview) return "/dashboard/staff";
  if (resolved.can_view_clients) return "/dashboard/staff/clients";
  if (resolved.can_view_client_workspace) return "/dashboard/staff/client-workspace";
  if (resolved.can_view_cases) return "/dashboard/staff/cases";
  if (resolved.can_view_documents) return "/dashboard/staff/documents";
  if (resolved.can_view_invoices) return "/dashboard/staff/invoices";
  if (resolved.can_view_messages) return "/dashboard/staff/messages";
  return "/dashboard";
}
