import {
  LayoutDashboard, FolderOpen, Upload, Receipt, MessageSquare, Bell, Settings, Users, Shield, LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const clientItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Cases", url: "/dashboard/cases", icon: FolderOpen },
  { title: "Documents", url: "/dashboard/documents", icon: Upload },
  { title: "Invoices", url: "/dashboard/invoices", icon: Receipt },
  { title: "Messages", url: "/dashboard/messages", icon: MessageSquare },
  { title: "Deadlines", url: "/dashboard/deadlines", icon: Bell },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

const adminItems = [
  { title: "Admin Overview", url: "/dashboard/admin", icon: Shield },
  { title: "All Clients", url: "/dashboard/admin/clients", icon: Users },
  { title: "All Cases", url: "/dashboard/admin/cases", icon: FolderOpen },
  { title: "All Invoices", url: "/dashboard/admin/invoices", icon: Receipt },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin, signOut, user } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 px-3">
            <Shield className="h-5 w-5 text-sidebar-primary shrink-0" />
            {!collapsed && <span className="font-display font-bold text-sm">Acapolite</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {clientItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>{!collapsed && "Admin"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <p className="text-xs text-sidebar-foreground/50 truncate mb-2 font-body">{user?.email}</p>
        )}
        <SidebarMenuButton onClick={signOut} className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50">
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && <span>Sign Out</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
