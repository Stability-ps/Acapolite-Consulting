import {
  LayoutDashboard, FolderOpen, Upload, Receipt, MessageSquare, Bell, Settings, Users, Shield, LogOut, UserRound,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

const clientItems = [
  { title: "Overview", url: "/dashboard/client", icon: LayoutDashboard },
  { title: "My Cases", url: "/dashboard/client/cases", icon: FolderOpen },
  { title: "Documents", url: "/dashboard/client/documents", icon: Upload },
  { title: "Invoices", url: "/dashboard/client/invoices", icon: Receipt },
  { title: "Messages", url: "/dashboard/client/messages", icon: MessageSquare },
  { title: "Deadlines", url: "/dashboard/client/deadlines", icon: Bell },
  { title: "Settings", url: "/dashboard/client/settings", icon: Settings },
];

const adminItems = [
  { title: "Overview", url: "/dashboard/staff", icon: Shield },
  { title: "Clients", url: "/dashboard/staff/clients", icon: Users },
  { title: "Client 360", url: "/dashboard/staff/client-workspace", icon: UserRound },
  { title: "Cases", url: "/dashboard/staff/cases", icon: FolderOpen },
  { title: "Documents", url: "/dashboard/staff/documents", icon: Upload },
  { title: "Invoices", url: "/dashboard/staff/invoices", icon: Receipt },
  { title: "Messages", url: "/dashboard/staff/messages", icon: MessageSquare },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role, signOut, user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const navigationItems = role === "client" ? clientItems : adminItems;

  const groupLabel = role === "client" ? "Client Menu" : "Staff Tools";

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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 px-3">
            <AcapoliteLogo className={collapsed ? "h-8" : "h-10"} />
          </SidebarGroupLabel>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && groupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span>{item.title}</span>
                          {item.title === "Messages" && (unreadMessageCount ?? 0) > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
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
          <p className="text-xs text-sidebar-foreground/50 truncate mb-2 font-body">{user?.email}</p>
        )}
        <SidebarMenuButton
          onClick={handleSignOut}
          className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          disabled={signingOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && <span>{signingOut ? "Signing Out..." : "Sign Out"}</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
