import {
  LayoutDashboard,
  FolderOpen,
  Upload,
  Receipt,
  MessageSquare,
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  Settings,
  Users,
  Shield,
  LogOut,
  UserRound,
  UserPlus,
  ClipboardList,
  BriefcaseBusiness,
  Coins,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePractitionerVerificationGate } from "@/hooks/usePractitionerVerificationGate";
import type { StaffPermissionKey } from "@/lib/staffPermissions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar,
} from "@/components/ui/sidebar";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { getWhatsAppLeadQuality } from "@/lib/whatsappLeadQuality";

const QA_FEED_URL = import.meta.env.VITE_WHATSAPP_QA_FEED_URL || "/api/whatsapp-qa-feed";

type WhatsAppSidebarSection = "inbox" | "leads" | "ai" | "actions" | "review" | "reports" | "settings";

type WhatsAppSidebarConversation = {
  id: string;
  status?: string | null;
  service_request_id?: string | null;
  intake_ready?: boolean | null;
  intake_payload?: Record<string, unknown> | null;
  display_name?: string | null;
  wa_id?: string | null;
  ai_summary?: string | null;
  intake_missing_fields?: string[] | null;
};

type WhatsAppSidebarMessage = {
  conversation_id?: string | null;
  direction?: string | null;
  attachment_url?: string | null;
  media_storage_path?: string | null;
};

const whatsappSidebarSections: Array<{
  key: WhatsAppSidebarSection;
  title: string;
  detail: string;
  icon: typeof MessageSquare;
  url: string;
}> = [
  { key: "inbox", title: "Inbox", detail: "Live chats", icon: MessageSquare, url: "/dashboard/staff/whatsapp-qa?section=inbox" },
  { key: "leads", title: "Leads", detail: "Intake quality", icon: ClipboardList, url: "/dashboard/staff/whatsapp-qa?section=leads" },
  { key: "ai", title: "AI Control", detail: "Handoff and replies", icon: Bot, url: "/dashboard/staff/whatsapp-qa?section=ai" },
  { key: "actions", title: "Actions & AI", detail: "Conversation controls", icon: UserRoundCheck, url: "/dashboard/staff/whatsapp-qa?section=actions" },
  { key: "review", title: "Review", detail: "QA and CRM detail", icon: ShieldCheck, url: "/dashboard/staff/whatsapp-qa?section=review" },
  { key: "reports", title: "Reports", detail: "Performance", icon: BarChart3, url: "/dashboard/staff/whatsapp-qa?section=reports" },
  { key: "settings", title: "Settings", detail: "Templates and rules", icon: Settings, url: "/dashboard/staff/whatsapp-qa?section=settings" },
];

const clientItems = [
  { title: "Overview", url: "/dashboard/client", icon: LayoutDashboard },
  { title: "Notifications", url: "/dashboard/client/notifications", icon: Bell },
  { title: "Requests", url: "/dashboard/client/requests", icon: ClipboardList },
  { title: "My Cases", url: "/dashboard/client/cases", icon: FolderOpen },
  { title: "Documents", url: "/dashboard/client/documents", icon: Upload },
  { title: "Invoices", url: "/dashboard/client/invoices", icon: Receipt },
  { title: "Messages", url: "/dashboard/client/messages", icon: MessageSquare },
  { title: "Deadlines", url: "/dashboard/client/deadlines", icon: Bell },
  { title: "Tax Coach AI", url: "/dashboard/client/tax-coach-ai", icon: Sparkles },
  { title: "Settings", url: "/dashboard/client/settings", icon: Settings },
];

const adminItems = [
  { title: "Overview", url: "/dashboard/staff", icon: Shield, permission: "can_view_overview" as StaffPermissionKey },
  { title: "Notifications", url: "/dashboard/staff/notifications", icon: Bell, permission: "can_view_overview" as StaffPermissionKey },
  { title: "Staff Users", url: "/dashboard/staff/users", icon: UserPlus },
  { title: "Clients", url: "/dashboard/staff/clients", icon: Users, permission: "can_view_clients" as StaffPermissionKey },
  { title: "Service Requests", url: "/dashboard/staff/service-requests", icon: ClipboardList, permission: "can_view_clients" as StaffPermissionKey },
  { title: "Client 360", url: "/dashboard/staff/client-workspace", icon: UserRound, permission: "can_view_client_workspace" as StaffPermissionKey },
  { title: "Cases", url: "/dashboard/staff/cases", icon: FolderOpen, permission: "can_view_cases" as StaffPermissionKey },
  { title: "Documents", url: "/dashboard/staff/documents", icon: Upload, permission: "can_view_documents" as StaffPermissionKey },
  { title: "Invoices", url: "/dashboard/staff/invoices", icon: Receipt, permission: "can_view_invoices" as StaffPermissionKey },
  { title: "Messages", url: "/dashboard/staff/messages", icon: MessageSquare, permission: "can_view_messages" as StaffPermissionKey },
  { title: "External Tool", url: "/dashboard/staff/external-tools", icon: ExternalLink, permission: "can_view_overview" as StaffPermissionKey },
  { title: "Tax Coach AI", url: "/dashboard/staff/tax-coach-ai", icon: Sparkles, permission: "can_use_tax_coach_ai" as StaffPermissionKey },
  { title: "WhatsApp QA", url: "/dashboard/staff/whatsapp-qa", icon: ShieldCheck, permission: "can_view_overview" as StaffPermissionKey },
  { title: "System Activity Log", url: "/dashboard/staff/activity-log", icon: ClipboardList, permission: "can_view_overview" as StaffPermissionKey },
];

const consultantItems = [
  { title: "Overview", url: "/dashboard/staff", icon: Shield, permission: "can_view_overview" as StaffPermissionKey },
  { title: "Notifications", url: "/dashboard/staff/notifications", icon: Bell, permission: "can_view_overview" as StaffPermissionKey },
  { title: "My Profile", url: "/dashboard/staff/profile", icon: BriefcaseBusiness },
  { title: "Verification Docs", url: "/dashboard/staff/verification-documents", icon: Upload },
  { title: "Credits & Billing", url: "/dashboard/staff/credits", icon: Coins },
  { title: "Clients", url: "/dashboard/staff/clients", icon: Users, permission: "can_view_clients" as StaffPermissionKey },
  { title: "Service Requests", url: "/dashboard/staff/service-requests", icon: ClipboardList, permission: "can_view_clients" as StaffPermissionKey },
  { title: "Client 360", url: "/dashboard/staff/client-workspace", icon: UserRound, permission: "can_view_client_workspace" as StaffPermissionKey },
  { title: "Cases", url: "/dashboard/staff/cases", icon: FolderOpen, permission: "can_view_cases" as StaffPermissionKey },
  { title: "Documents", url: "/dashboard/staff/documents", icon: Upload, permission: "can_view_documents" as StaffPermissionKey },
  { title: "Invoices", url: "/dashboard/staff/invoices", icon: Receipt, permission: "can_view_invoices" as StaffPermissionKey },
  { title: "Messages", url: "/dashboard/staff/messages", icon: MessageSquare, permission: "can_view_messages" as StaffPermissionKey },
  { title: "External Tool", url: "/dashboard/staff/external-tools", icon: ExternalLink, permission: "can_view_overview" as StaffPermissionKey },
  { title: "Tax Coach AI", url: "/dashboard/staff/tax-coach-ai", icon: Sparkles, permission: "can_use_tax_coach_ai" as StaffPermissionKey },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { role, signOut, user, session, hasStaffPermission } = useAuth();
  const { isPendingVerification } = usePractitionerVerificationGate();
  const [signingOut, setSigningOut] = useState(false);
  const [whatsAppMenuOpen, setWhatsAppMenuOpen] = useState(false);
  const { unreadBySection } = useNotifications();
  const { data: practitionerAccess } = useQuery({
    queryKey: ["sidebar-practitioner-lead-access", user?.id, role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select("lead_access_enabled")
        .eq("profile_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: role === "consultant" && !!user,
  });
  const canViewWhatsAppQA = role === "admin" && hasStaffPermission("can_view_overview");
  const { data: whatsAppCounts } = useQuery({
    queryKey: ["sidebar-whatsapp-qa-counts", user?.id],
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error("Staff session is unavailable");

      const response = await fetch(QA_FEED_URL, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("WhatsApp QA feed failed");

      const payload = await response.json();
      const conversations = (payload.conversations || []) as WhatsAppSidebarConversation[];
      const messages = (payload.messages || []) as WhatsAppSidebarMessage[];
      const messagesByConversation = messages.reduce<Map<string, WhatsAppSidebarMessage[]>>((groups, message) => {
        if (!message.conversation_id) return groups;
        const current = groups.get(message.conversation_id) || [];
        current.push(message);
        groups.set(message.conversation_id, current);
        return groups;
      }, new Map());
      const qualityLeads = conversations.filter((conversation) => {
        const conversationMessages = messagesByConversation.get(conversation.id) || [];
        return getWhatsAppLeadQuality({
          intakePayload: conversation.intake_payload,
          displayName: conversation.display_name,
          waId: conversation.wa_id,
          aiSummary: conversation.ai_summary,
          intakeReady: conversation.intake_ready,
          missingFields: conversation.intake_missing_fields,
          hasAttachments: conversationMessages.some((message) => message.direction === "inbound" && Boolean(message.media_storage_path || message.attachment_url)),
        }).status === "ready";
      }).length;

      return {
        inbox: conversations.length,
        leads: qualityLeads,
        ai: conversations.filter((conversation) => conversation.status === "human_handoff").length,
        reports: conversations.filter((conversation) => conversation.service_request_id).length,
      } satisfies Partial<Record<WhatsAppSidebarSection, number>>;
    },
    enabled: canViewWhatsAppQA && Boolean(session?.access_token),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const isWhatsAppQAActive = location.pathname === "/dashboard/staff/whatsapp-qa";
  const sectionParam = new URLSearchParams(location.search).get("section");
  const activeWhatsAppSection = whatsappSidebarSections.some((section) => section.key === sectionParam)
    ? sectionParam as WhatsAppSidebarSection
    : "inbox";

  useEffect(() => {
    if (isWhatsAppQAActive && !collapsed) {
      setWhatsAppMenuOpen(true);
    }
  }, [collapsed, isWhatsAppQAActive]);

  const consultantNavigation = consultantItems
    .filter((item) => !item.permission || hasStaffPermission(item.permission))
    .filter((item) => (
      item.url !== "/dashboard/staff/service-requests"
      || practitionerAccess?.lead_access_enabled !== false
    ));

  const navigationItems = role === "client"
    ? clientItems
    : role === "admin"
      ? adminItems
      : isPendingVerification
        ? consultantItems.filter((item) => item.url === "/dashboard/staff/profile" || item.url === "/dashboard/staff/verification-documents")
        : consultantNavigation;

  const groupLabel = role === "client" ? "Client Menu" : role === "consultant" ? "Practitioner Tools" : "Staff Tools";

  const getUnreadCountForItem = (title: string) => {
    if (title === "Notifications") {
      return Object.values(unreadBySection).reduce((total, value) => total + value, 0);
    }

    if (title === "Messages") {
      return unreadBySection.messages ?? 0;
    }

    if (title === "Requests" || title === "Service Requests") {
      return unreadBySection.requests ?? 0;
    }

    if (title === "My Cases" || title === "Cases") {
      return unreadBySection.cases ?? 0;
    }

    if (title === "Documents") {
      return unreadBySection.documents ?? 0;
    }

    return 0;
  };

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
      <SidebarContent className="pt-3">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 pt-4">
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
              {navigationItems.map((item) => {
                const unreadCount = getUnreadCountForItem(item.title);

                if (item.title === "WhatsApp QA") {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <div className="flex items-center gap-1">
                        <SidebarMenuButton asChild tooltip={item.title}>
                          <NavLink
                            to="/dashboard/staff/whatsapp-qa?section=inbox"
                            end
                            onClick={() => {
                              setWhatsAppMenuOpen(true);
                              if (isMobile) {
                                setOpenMobile(false);
                              }
                            }}
                            className={cn(
                              "rounded-xl hover:bg-sidebar-accent/80",
                              isWhatsAppQAActive && "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-[0_10px_24px_rgba(184,150,46,0.22)]",
                            )}
                          >
                            <item.icon className="mr-2 h-4 w-4 shrink-0" />
                            {!collapsed && (
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                <span className="truncate">{item.title}</span>
                                {typeof whatsAppCounts?.inbox === "number" ? (
                                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-[10px] font-semibold text-sidebar-primary-foreground shadow-sm">
                                    {whatsAppCounts.inbox > 99 ? "99+" : whatsAppCounts.inbox}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                        {!collapsed ? (
                          <button
                            type="button"
                            onClick={() => setWhatsAppMenuOpen((open) => !open)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
                            aria-label={whatsAppMenuOpen ? "Collapse WhatsApp QA modules" : "Expand WhatsApp QA modules"}
                            aria-expanded={whatsAppMenuOpen}
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform ${whatsAppMenuOpen ? "rotate-180" : ""}`} />
                          </button>
                        ) : null}
                      </div>

                      {!collapsed && whatsAppMenuOpen ? (
                        <SidebarMenuSub className="mt-1">
                          {whatsappSidebarSections.map((section) => {
                            const SectionIcon = section.icon;
                            const count = whatsAppCounts?.[section.key];
                            const active = isWhatsAppQAActive && activeWhatsAppSection === section.key;

                            return (
                              <SidebarMenuSubItem key={section.key}>
                                <SidebarMenuSubButton asChild size="sm" isActive={active} className="h-auto items-start py-2">
                                  <NavLink
                                    to={section.url}
                                    end
                                    onClick={() => {
                                      if (isMobile) {
                                        setOpenMobile(false);
                                      }
                                    }}
                                  >
                                    <SectionIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span className="min-w-0 flex-1">
                                      <span className="flex items-center justify-between gap-2">
                                        <span className="truncate font-medium">{section.title}</span>
                                        {typeof count === "number" ? (
                                          <span className="shrink-0 text-[10px] font-semibold">{count > 99 ? "99+" : count}</span>
                                        ) : null}
                                      </span>
                                      <span className="block truncate text-[10px] text-sidebar-foreground/50">{section.detail}</span>
                                    </span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        onClick={() => {
                          if (isMobile) {
                            setOpenMobile(false);
                          }
                        }}
                        className="rounded-xl hover:bg-sidebar-accent/80"
                        activeClassName="rounded-xl bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-[0_10px_24px_rgba(184,150,46,0.22)]"
                      >
                        <item.icon className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span>{item.title}</span>
                            {unreadCount > 0 ? (
                              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-[10px] font-semibold text-sidebar-primary-foreground shadow-sm">
                                {unreadCount > 99 ? "99+" : unreadCount}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
