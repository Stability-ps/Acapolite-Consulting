import {
  LayoutDashboard, FolderOpen, Upload, Receipt, MessageSquare, Bell, Settings, Users, Shield, LogOut, UserRound, UserPlus, ClipboardList, BriefcaseBusiness, Coins,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import type { StaffPermissionKey } from "@/lib/staffPermissions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

const clientItems = [
  { title: "Overview", url: "/dashboard/client", icon: LayoutDashboard },
  { title: "Requests", url: "/dashboard/client/requests", icon: ClipboardList },
  { title: "My Cases", url: "/dashboard/client/cases", icon: FolderOpen },
  { title: "Documents", url: "/dashboard/client/documents", icon: Upload },
  { title: "Invoices", url: "/dashboard/client/invoices", icon: Receipt },
  { title: "Messages", url: "/dashboard/client/messages", icon: MessageSquare },
  { title: "Deadlines", url: "/dashboard/client/deadlines", icon: Bell },
  { title: "Settings", url: "/dashboard/client/settings", icon: Settings },
];

const adminItems = [
  { title: "Overview", url: "/dashboard/staff", icon: Shield, permission: "can_view_overview" as StaffPermissionKey },
  { title: "Staff Users", url: "/dashboard/staff/users", icon: UserPlus },
  { title: "Clients", url: "/dashboard/staff/clients", icon: Users, permission: "can_view_clients" as StaffPermissionKey },
  { title: "Service Requests", url: "/dashboard/staff/service-requests", icon: ClipboardList, permission: "can_view_clients" as StaffPermissionKey },
  { title: "Client 360", url: "/dashboard/staff/client-workspace", icon: UserRound, permission: "can_view_client_workspace" as StaffPermissionKey },
  { title: "Cases", url: "/dashboard/staff/cases", icon: FolderOpen, permission: "can_view_cases" as StaffPermissionKey },
  { title: "Documents", url: "/dashboard/staff/documents", icon: Upload, permission: "can_view_documents" as StaffPermissionKey },
  { title: "Invoices", url: "/dashboard/staff/invoices", icon: Receipt, permission: "can_view_invoices" as StaffPermissionKey },
  { title: "Messages", url: "/dashboard/staff/messages", icon: MessageSquare, permission: "can_view_messages" as StaffPermissionKey },
  { title: "System Activity Log", url: "/dashboard/staff/activity-log", icon: ClipboardList, permission: "can_view_overview" as StaffPermissionKey },
];

const consultantItems = [
  { title: "Overview", url: "/dashboard/staff", icon: Shield, permission: "can_view_overview" as StaffPermissionKey },
  { title: "My Profile", url: "/dashboard/staff/profile", icon: BriefcaseBusiness },
  { title: "Credits", url: "/dashboard/staff/credits", icon: Coins },
  { title: "Clients", url: "/dashboard/staff/clients", icon: Users, permission: "can_view_clients" as StaffPermissionKey },
  { title: "Service Requests", url: "/dashboard/staff/service-requests", icon: ClipboardList, permission: "can_view_clients" as StaffPermissionKey },
  { title: "Client 360", url: "/dashboard/staff/client-workspace", icon: UserRound, permission: "can_view_client_workspace" as StaffPermissionKey },
  { title: "Cases", url: "/dashboard/staff/cases", icon: FolderOpen, permission: "can_view_cases" as StaffPermissionKey },
  { title: "Documents", url: "/dashboard/staff/documents", icon: Upload, permission: "can_view_documents" as StaffPermissionKey },
  { title: "Invoices", url: "/dashboard/staff/invoices", icon: Receipt, permission: "can_view_invoices" as StaffPermissionKey },
  { title: "Messages", url: "/dashboard/staff/messages", icon: MessageSquare, permission: "can_view_messages" as StaffPermissionKey },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role, signOut, user, hasStaffPermission } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const navigationItems = role === "client"
    ? clientItems
    : role === "admin"
      ? adminItems
      : consultantItems.filter((item) => !item.permission || hasStaffPermission(item.permission));

  const groupLabel = role === "client" ? "Client Menu" : role === "consultant" ? "Practitioner Tools" : "Staff Tools";

  const { data: unreadMessageCount } = useQuery({
    queryKey: ["sidebar-unread-messages", role, user?.id],
    queryFn: async () => {
      if (!user || !role) return 0;

      if (role === "client") {
        const { data } = await supabase
          .from("client_dashboard_summary")
          .select("unread_messages")
          .eq("profile_id", user.id)
          .maybeSingle();

        return data?.unread_messages ?? 0;
      }

      const { data } = await supabase
        .from("admin_dashboard_summary")
        .select("unread_messages")
        .maybeSingle();

      return data?.unread_messages ?? 0;
    },
    enabled: !!user && !!role,
  });

  const handleSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);

    const { error } = await signOut();

    if (error) {
      toast.error(error.message);
      setSigningOut(false);
      return;
    }

    window.location.replace("/login");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/80">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 pt-3">
            <div className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <AcapoliteLogo className={collapsed ? "h-8" : "h-10"} />
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">Acapolite Consulting</p>
                  <p className="truncate text-xs text-sidebar-foreground/60">{role === "client" ? "Client portal" : "Staff workspace"}</p>
                </div>
              ) : null}
            </div>
          </SidebarGroupLabel>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && groupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="rounded-xl hover:bg-sidebar-accent/80" activeClassName="rounded-xl bg-white/10 text-sidebar-primary font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span>{item.title}</span>
                          {item.title === "Messages" && (unreadMessageCount ?? 0) > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-primary-foreground shadow-sm">
                              {unreadMessageCount}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <p className="mb-2 truncate px-2 text-xs text-sidebar-foreground/50 font-body">{user?.email}</p>
        )}
        <SidebarMenuButton
          onClick={handleSignOut}
          className="rounded-xl border border-white/8 bg-white/5 text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/80"
          disabled={signingOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && <span>{signingOut ? "Signing Out..." : "Sign Out"}</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
