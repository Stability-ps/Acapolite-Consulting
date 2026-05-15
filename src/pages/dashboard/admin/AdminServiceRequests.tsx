import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  Clock3,
  Crown,
  Ellipsis,
  ExternalLink,
  Eye,
  File,
  FileText,
  Image,
  Megaphone,
  RotateCcw,
  RefreshCcw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  TriangleAlert,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { LeadLifecycleExplainerDialog } from "@/components/dashboard/LeadLifecycleExplainerDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import PractitionerLeads from "./PractitionerLeads";
import {
  formatServiceRequestLabel,
  getServiceRequestIssueFlags,
  serviceRequestPriorityOptions,
  getServiceRequestRiskClass,
  getServiceRequestStatusClass,
  serviceRequestStatusOptions,
  serviceCategoryOptions,
  serviceNeededOptions,
} from "@/lib/serviceRequests";
import { formatAvailabilityLabel, getAvailabilityBadgeClass, getAssignmentTypeLabel, getResponseStatusClass } from "@/lib/practitionerMarketplace";
import {
  formatLifecycleStageLabel,
  getLifecycleCountdownLabel,
  getLifecycleStageBadgeClass,
} from "@/lib/serviceRequestLifecycle";
import { Cell, Pie, PieChart } from "recharts";

type ServiceRequestRecord = Tables<"service_requests">;
type ServiceRequestDocument = Tables<"service_request_documents">;
type ServiceRequestResponse = Tables<"service_request_responses">;
type ServiceRequestAssignmentHistory = Tables<"service_request_assignment_history">;
type ServiceRequestLifecycleHistory = Tables<"service_request_lifecycle_history">;
type ServiceRequestLifecycleSettings = Tables<"service_request_lifecycle_settings">;
type ServiceRequestAccessRequest = Tables<"service_request_access_requests">;
type PractitionerProfile = Tables<"practitioner_profiles">;
type PractitionerUser = Tables<"profiles">;
type DashboardDateRange = "today" | "last7" | "last30" | "all";

const STATUS_CHART_COLORS = {
  active: "#2563EB",
  reactivated: "#22C55E",
  pending: "#F59E0B",
  expired: "#8B5CF6",
  archived: "#06B6D4",
} as const;

const SUMMARY_CARD_STYLES = [
  { key: "active", title: "Active Leads", color: "bg-blue-50 text-blue-600", icon: Target },
  { key: "reactivated", title: "Reactivated Leads", color: "bg-green-50 text-green-600", icon: RefreshCcw },
  { key: "pendingConfirmation", title: "Pending Confirmation", color: "bg-orange-50 text-orange-600", icon: Clock3 },
  { key: "expired", title: "Expired Leads", color: "bg-violet-50 text-violet-600", icon: TriangleAlert },
  { key: "practitionerResponses", title: "Total Responses", color: "bg-cyan-50 text-cyan-600", icon: Megaphone },
  { key: "avgResponseTime", title: "Avg. Response Time", color: "bg-amber-50 text-amber-600", icon: Clock3 },
  { key: "activePractitioners", title: "Active Practitioners", color: "bg-emerald-50 text-emerald-600", icon: Users },
  { key: "highRisk", title: "Critical SARS Leads", color: "bg-rose-50 text-rose-600", icon: ShieldAlert },
] as const;

function formatCompactDuration(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) {
    return "—";
  }

  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function formatTrendPercentage(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function getTrendTone(delta: number) {
  return delta >= 0
    ? "text-emerald-600 bg-emerald-50 border-emerald-100"
    : "text-rose-600 bg-rose-50 border-rose-100";
}

function getInitials(value?: string | null) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!parts.length) {
    return "SM";
  }

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatStageHours(hours: number | null | undefined) {
  const safeHours = typeof hours === "number" && hours > 0 ? hours : 0;
  return safeHours === 1 ? "1 Hour" : `${safeHours} Hours`;
}

function getDashboardRangeBounds(range: DashboardDateRange) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end, comparisonDays: 1, label: `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` };
  }

  if (range === "last7") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end, comparisonDays: 7, label: `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` };
  }

  if (range === "last30") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end, comparisonDays: 30, label: `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` };
  }

  return { start: null, end, comparisonDays: 30, label: "All Time" };
}

export default function AdminServiceRequests() {
  const { role, user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [clientTypeFilter, setClientTypeFilter] = useState<string>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all");
  const [issueFilter, setIssueFilter] = useState<string>("all");
  const [leadView, setLeadView] = useState<"active" | "archived">("active");
  const [lifecycleTab, setLifecycleTab] = useState<"active" | "business" | "professional" | "open" | "reactivated" | "pending" | "expired" | "hidden" | "archived">("active");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [assigningRequestId, setAssigningRequestId] = useState<string | null>(null);
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<string>("");
  const [convertingRequestId, setConvertingRequestId] = useState<string | null>(null);
  const [revivingLeadId, setRevivingLeadId] = useState<string | null>(null);
  const [resettingTimerId, setResettingTimerId] = useState<string | null>(null);
  const [returningToMarketplaceId, setReturningToMarketplaceId] = useState<string | null>(null);
  const [openingMarketplaceId, setOpeningMarketplaceId] = useState<string | null>(null);
  const [selectedReviveStage, setSelectedReviveStage] = useState<Enums<"service_request_lifecycle_stage">>("open_marketplace");
  const [leadArchiveReason, setLeadArchiveReason] = useState<string>("inactive");
  const [leadArchiveNotes, setLeadArchiveNotes] = useState("");
  const [archivingLeadId, setArchivingLeadId] = useState<string | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [confirmDeleteLeadOpen, setConfirmDeleteLeadOpen] = useState(false);
  const [dashboardDateRange, setDashboardDateRange] = useState<DashboardDateRange>("last7");
  const [isLifecycleDialogOpen, setIsLifecycleDialogOpen] = useState(false);
  const [savingLifecycleSettings, setSavingLifecycleSettings] = useState(false);
  const [lifecycleSettingsForm, setLifecycleSettingsForm] = useState({
    businessStageHours: "48",
    professionalStageHours: "48",
    openMarketplaceHours: "72",
    pendingClientConfirmationHours: "24",
    reminderHours: "6",
    reactivationAlertThreshold: "3",
  });
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const leadIdFromQuery = searchParams.get("leadId");

  const { isFetching: isRefreshingLifecycle } = useQuery({
    queryKey: ["service-request-lifecycle-refresh", role, "staff"],
    queryFn: async () => {
      const { error } = await supabase.rpc("process_service_request_lifecycles");
      if (error) throw error;
      return true;
    },
    enabled: role !== "consultant",
    refetchOnWindowFocus: false,
  });

  const { data: lifecycleSettings } = useQuery({
    queryKey: ["service-request-lifecycle-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_lifecycle_settings")
        .select("*")
        .eq("settings_key", "default")
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as ServiceRequestLifecycleSettings | null;
    },
    enabled: role !== "consultant",
    staleTime: 60_000,
  });

  if (role === "consultant") {
    return <PractitionerLeads />;
  }

  const { data: requests, isLoading } = useQuery({
    queryKey: ["staff-service-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: role !== "consultant" && !isRefreshingLifecycle,
  });

  const { data: documents } = useQuery({
    queryKey: ["staff-service-request-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_documents")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: responses } = useQuery({
    queryKey: ["staff-service-request-responses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_responses")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ServiceRequestResponse[];
    },
  });

  const { data: assignmentHistory } = useQuery({
    queryKey: ["staff-service-request-assignment-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_assignment_history")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ServiceRequestAssignmentHistory[];
    },
  });

  const { data: accessRequests } = useQuery({
    queryKey: ["staff-service-request-access-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_access_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ServiceRequestAccessRequest[];
    },
  });

  const { data: lifecycleHistory } = useQuery({
    queryKey: ["staff-service-request-lifecycle-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_lifecycle_history")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ServiceRequestLifecycleHistory[];
    },
  });

  const { data: practitioners } = useQuery({
    queryKey: ["staff-practitioner-directory"],
    queryFn: async () => {
      const [{ data: profiles, error: profileError }, { data: practitionerProfiles, error: practitionerError }, { data: cases, error: caseError }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, phone, role, avatar_url, is_active, created_at, updated_at").eq("role", "consultant").eq("is_active", true),
        supabase.from("practitioner_profiles").select("*"),
        supabase.from("cases").select("assigned_consultant_id, status"),
      ]);

      if (profileError) throw profileError;
      if (practitionerError) throw practitionerError;
      if (caseError) throw caseError;

      const activeCaseCountByPractitioner = new Map<string, number>();
      for (const caseItem of cases ?? []) {
        if (!caseItem.assigned_consultant_id) continue;
        if (["resolved", "closed"].includes(caseItem.status)) continue;
        activeCaseCountByPractitioner.set(
          caseItem.assigned_consultant_id,
          (activeCaseCountByPractitioner.get(caseItem.assigned_consultant_id) ?? 0) + 1,
        );
      }

      return (profiles ?? []).map((profile) => ({
        user: profile as PractitionerUser,
        profile: (practitionerProfiles ?? []).find((item) => item.profile_id === profile.id) as PractitionerProfile | undefined,
        activeCaseCount: activeCaseCountByPractitioner.get(profile.id) ?? 0,
      }));
    },
  });

  const { data: practitionerSubscriptions } = useQuery({
    queryKey: ["staff-practitioner-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_subscriptions")
        .select("practitioner_profile_id, plan_code, cancelled_at")
        .eq("status", "active");

      if (error) throw error;
      return data ?? [];
    },
  });

  const documentMap = useMemo(() => {
    const map = new Map<string, ServiceRequestDocument[]>();

    for (const document of documents ?? []) {
      const current = map.get(document.service_request_id) ?? [];
      current.push(document);
      map.set(document.service_request_id, current);
    }

    return map;
  }, [documents]);

  const responsesByRequest = useMemo(() => {
    const map = new Map<string, ServiceRequestResponse[]>();

    for (const response of responses ?? []) {
      const current = map.get(response.service_request_id) ?? [];
      current.push(response);
      map.set(response.service_request_id, current);
    }

    return map;
  }, [responses]);

  const assignmentHistoryByRequest = useMemo(() => {
    const map = new Map<string, ServiceRequestAssignmentHistory[]>();

    for (const item of assignmentHistory ?? []) {
      const current = map.get(item.service_request_id) ?? [];
      current.push(item);
      map.set(item.service_request_id, current);
    }

    return map;
  }, [assignmentHistory]);

  const lifecycleHistoryByRequest = useMemo(() => {
    const map = new Map<string, ServiceRequestLifecycleHistory[]>();

    for (const item of lifecycleHistory ?? []) {
      const current = map.get(item.service_request_id) ?? [];
      current.push(item);
      map.set(item.service_request_id, current);
    }

    return map;
  }, [lifecycleHistory]);

  const practitionerMap = useMemo(
    () => new Map((practitioners ?? []).map((practitioner) => [practitioner.user.id, practitioner])),
    [practitioners],
  );

  const practitionerPlanMap = useMemo(() => {
    const map = new Map<string, string>();

    for (const subscription of practitionerSubscriptions ?? []) {
      if (subscription.cancelled_at) continue;
      map.set(subscription.practitioner_profile_id, subscription.plan_code);
    }

    return map;
  }, [practitionerSubscriptions]);

  const serviceLabelMap = useMemo(
    () => new Map(serviceNeededOptions.map((option) => [option.value, option.label])),
    [],
  );

  const categoryLabelMap = useMemo(
    () => new Map(serviceCategoryOptions.map((option) => [option.value, option.label])),
    [],
  );

  const resolveServiceList = (request: ServiceRequestRecord) => (
    request.service_needed_list?.length
      ? request.service_needed_list
      : request.service_needed
        ? [request.service_needed]
        : []
  );

  const resolveCategoryList = (request: ServiceRequestRecord) => (
    request.service_categories?.length
      ? request.service_categories
      : request.service_category
        ? [request.service_category]
        : []
  );

  const formatServiceList = (services: Enums<"service_request_service_needed">[]) =>
    services.map((service) => serviceLabelMap.get(service) || formatServiceRequestLabel(service)).join(", ");

  const formatCategoryList = (categories: Enums<"service_request_category">[]) =>
    categories.map((category) => categoryLabelMap.get(category) || formatServiceRequestLabel(category)).join(", ");

  const hasActiveFilters = [
    searchQuery.trim(),
    statusFilter,
    serviceFilter,
    riskFilter,
    priorityFilter,
    clientTypeFilter,
    assignmentFilter,
    issueFilter,
  ].some((value) => value && value !== "all");

  const selectedRequest = (requests ?? []).find((request) => request.id === selectedRequestId) ?? null;
  const selectedDocuments = selectedRequest ? documentMap.get(selectedRequest.id) ?? [] : [];
  const selectedResponses = selectedRequest ? responsesByRequest.get(selectedRequest.id) ?? [] : [];
  const selectedAssignments = selectedRequest ? assignmentHistoryByRequest.get(selectedRequest.id) ?? [] : [];
  const selectedLifecycleHistory = selectedRequest ? lifecycleHistoryByRequest.get(selectedRequest.id) ?? [] : [];
  const canResetSelectedTimer = Boolean(
    selectedRequest
    && selectedRequest.lifecycle_stage !== "expired"
    && !["closed", "converted_to_client", "expired"].includes(selectedRequest.status),
  );

  useEffect(() => {
    setSelectedPractitionerId(selectedRequest?.assigned_practitioner_id ?? "");
    setLeadArchiveReason(selectedRequest?.archive_reason ?? "inactive");
    setLeadArchiveNotes(selectedRequest?.archive_notes ?? "");
    setSelectedReviveStage("open_marketplace");
  }, [selectedRequest?.id]);

  useEffect(() => {
    if (!lifecycleSettings) {
      return;
    }

    setLifecycleSettingsForm({
      businessStageHours: String(lifecycleSettings.business_stage_hours),
      professionalStageHours: String(lifecycleSettings.professional_stage_hours),
      openMarketplaceHours: String(lifecycleSettings.open_marketplace_hours),
      pendingClientConfirmationHours: String(lifecycleSettings.pending_client_confirmation_hours),
      reminderHours: String(lifecycleSettings.reminder_hours),
      reactivationAlertThreshold: String(lifecycleSettings.reactivation_alert_threshold),
    });
  }, [lifecycleSettings]);

  useEffect(() => {
    if (!leadIdFromQuery || !(requests ?? []).some((request) => request.id === leadIdFromQuery)) {
      return;
    }

    setSelectedRequestId(leadIdFromQuery);
  }, [leadIdFromQuery, requests]);

  const dashboardRange = useMemo(
    () => getDashboardRangeBounds(dashboardDateRange),
    [dashboardDateRange],
  );

  const dashboardRequests = useMemo(() => {
    const rows = requests ?? [];
    if (!dashboardRange.start) {
      return rows;
    }

    const startTime = dashboardRange.start.getTime();
    const endTime = dashboardRange.end.getTime();
    return rows.filter((request) => {
      const createdAt = new Date(request.created_at).getTime();
      return createdAt >= startTime && createdAt <= endTime;
    });
  }, [dashboardRange.end, dashboardRange.start, requests]);

  const dashboardResponses = useMemo(() => {
    const rows = responses ?? [];
    if (!dashboardRange.start) {
      return rows;
    }

    const startTime = dashboardRange.start.getTime();
    const endTime = dashboardRange.end.getTime();
    return rows.filter((response) => {
      const createdAt = new Date(response.created_at).getTime();
      return createdAt >= startTime && createdAt <= endTime;
    });
  }, [dashboardRange.end, dashboardRange.start, responses]);

  const dashboardAccessRequests = useMemo(() => {
    const rows = accessRequests ?? [];
    if (!dashboardRange.start) {
      return rows;
    }

    const startTime = dashboardRange.start.getTime();
    const endTime = dashboardRange.end.getTime();
    return rows.filter((accessRequest) => {
      const createdAt = new Date(accessRequest.created_at).getTime();
      return createdAt >= startTime && createdAt <= endTime;
    });
  }, [accessRequests, dashboardRange.end, dashboardRange.start]);

  const dashboardApprovedAccessCountByPractitioner = useMemo(() => {
    const map = new Map<string, number>();

    for (const accessRequest of dashboardAccessRequests) {
      if (accessRequest.status !== "approved") continue;
      map.set(
        accessRequest.practitioner_profile_id,
        (map.get(accessRequest.practitioner_profile_id) ?? 0) + 1,
      );
    }

    return map;
  }, [dashboardAccessRequests]);

  function isActiveMarketplaceLead(request: ServiceRequestRecord) {
    return !request.is_archived
      && request.lifecycle_stage !== "expired"
      && request.lifecycle_stage !== "pending_client_confirmation"
      && request.status !== "closed"
      && request.status !== "converted_to_client"
      && request.status !== "expired"
      && !request.assigned_practitioner_id;
  }

  function isMarketplaceReactivatedLead(request: ServiceRequestRecord) {
    return isActiveMarketplaceLead(request)
      && request.lifecycle_reactivation_count > 0;
  }

  function getPractitionerMarketplaceVisibility(request: ServiceRequestRecord) {
    if (request.lifecycle_stage === "pending_client_confirmation") {
      return {
        visible: false,
        label: "Hidden from practitioners",
        description: "Waiting for client confirmation before the lead can return to the marketplace.",
        toneClass: "border-orange-200 bg-orange-50 text-orange-700",
        action: "return_to_marketplace" as const,
      };
    }

    if (request.lifecycle_stage === "expired" || request.status === "expired") {
      return {
        visible: false,
        label: "Hidden from practitioners",
        description: "Expired leads stay out of the marketplace until an admin restarts the cycle.",
        toneClass: "border-violet-200 bg-violet-50 text-violet-700",
        action: "restart_cycle" as const,
      };
    }

    if (request.is_archived) {
      return {
        visible: false,
        label: "Hidden from practitioners",
        description: "Archived leads are removed from practitioner visibility.",
        toneClass: "border-slate-200 bg-slate-100 text-slate-700",
        action: null,
      };
    }

    if (request.status === "closed" || request.status === "converted_to_client") {
      return {
        visible: false,
        label: "Hidden from practitioners",
        description: "Completed leads do not appear in the practitioner marketplace.",
        toneClass: "border-slate-200 bg-slate-100 text-slate-700",
        action: null,
      };
    }

    if (request.assigned_practitioner_id) {
      return {
        visible: false,
        label: "Hidden from practitioners",
        description: "Assigned leads are no longer shown in the open practitioner marketplace.",
        toneClass: "border-sky-200 bg-sky-50 text-sky-700",
        action: null,
      };
    }

    if (request.lifecycle_stage === "business_exclusive") {
      return {
        visible: true,
        label: "Visible to Business",
        description: "Only Business practitioners can currently see this lead.",
        toneClass: "border-amber-200 bg-amber-50 text-amber-700",
        action: "move_to_open_marketplace" as const,
      };
    }

    if (request.lifecycle_stage === "professional_access") {
      return {
        visible: true,
        label: "Visible to Professional+",
        description: "Professional and Business practitioners can currently see this lead.",
        toneClass: "border-sky-200 bg-sky-50 text-sky-700",
        action: "move_to_open_marketplace" as const,
      };
    }

    return {
      visible: true,
      label: "Visible to all practitioners",
      description: "This lead is currently in the open marketplace.",
      toneClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      action: null,
    };
  }

  function matchesLifecycleWorkspaceTab(
    request: ServiceRequestRecord,
    tab: typeof lifecycleTab,
  ) {
    const practitionerVisibility = getPractitionerMarketplaceVisibility(request);

    if (tab === "active") {
      return !request.is_archived
        && request.lifecycle_stage !== "expired"
        && request.status !== "expired";
    }

    if (tab === "business") {
      return request.lifecycle_stage === "business_exclusive";
    }

    if (tab === "professional") {
      return request.lifecycle_stage === "professional_access";
    }

    if (tab === "open") {
      return request.lifecycle_stage === "open_marketplace";
    }

    if (tab === "reactivated") {
      return isMarketplaceReactivatedLead(request);
    }

    if (tab === "pending") {
      return request.lifecycle_stage === "pending_client_confirmation";
    }

    if (tab === "expired") {
      return request.lifecycle_stage === "expired";
    }

    if (tab === "hidden") {
      return !practitionerVisibility.visible;
    }

    if (tab === "archived") {
      return request.is_archived;
    }

    return true;
  }

  const moveToWorkspaceTab = (tab: typeof lifecycleTab) => {
    setLeadView(tab === "archived" ? "archived" : "active");
    setLifecycleTab(tab);
    requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const workspaceBaseRequests = useMemo(() => {
    if (lifecycleTab === "hidden") {
      return dashboardRequests;
    }

    if (lifecycleTab === "archived" || leadView === "archived") {
      return dashboardRequests.filter((request) => request.is_archived);
    }

    return dashboardRequests.filter((request) => !request.is_archived);
  }, [dashboardRequests, leadView, lifecycleTab]);

  const workspaceFilteredRequests = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return workspaceBaseRequests.filter((request) => {
      const issueFlags = getServiceRequestIssueFlags({
        hasDebtFlag: request.has_debt_flag,
        missingReturnsFlag: request.missing_returns_flag,
        missingDocumentsFlag: request.missing_documents_flag,
      });
      const assignedPractitionerName = request.assigned_practitioner_id
        ? (practitionerMap.get(request.assigned_practitioner_id)?.user.full_name
          || practitionerMap.get(request.assigned_practitioner_id)?.user.email
          || "")
        : "";
      const responseCount = responsesByRequest.get(request.id)?.length ?? 0;
      const serviceLabels = formatServiceList(resolveServiceList(request));
      const categoryLabels = formatCategoryList(resolveCategoryList(request));
      const matchesSearch = !normalizedSearch || [
        request.full_name,
        request.email,
        request.phone,
        request.id_number || "",
        formatServiceRequestLabel(request.identity_document_type),
        assignedPractitionerName,
        serviceLabels,
        categoryLabels,
        formatServiceRequestLabel(request.status),
        formatServiceRequestLabel(request.priority_level),
        formatServiceRequestLabel(request.client_type),
        formatServiceRequestLabel(request.risk_indicator),
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesService = serviceFilter === "all" || resolveServiceList(request).includes(serviceFilter as Enums<"service_request_service_needed">);
      const matchesRisk = riskFilter === "all" || request.risk_indicator === riskFilter;
      const matchesPriority = priorityFilter === "all" || request.priority_level === priorityFilter;
      const matchesClientType = clientTypeFilter === "all" || request.client_type === clientTypeFilter;
      const matchesAssignment = assignmentFilter === "all"
        || (assignmentFilter === "assigned" && Boolean(request.assigned_practitioner_id))
        || (assignmentFilter === "unassigned" && !request.assigned_practitioner_id)
        || (assignmentFilter === "responded" && responseCount > 0)
        || (assignmentFilter === "no_responses" && responseCount === 0)
        || (assignmentFilter === "converted" && Boolean(request.converted_case_id));
      const matchesIssue = issueFilter === "all"
        || (issueFilter === "debt" && request.has_debt_flag)
        || (issueFilter === "returns" && request.missing_returns_flag)
        || (issueFilter === "documents" && request.missing_documents_flag)
        || (issueFilter === "clean" && issueFlags.length === 0);

      return matchesSearch
        && matchesStatus
        && matchesService
        && matchesRisk
        && matchesPriority
        && matchesClientType
        && matchesAssignment
        && matchesIssue;
    });
  }, [
    assignmentFilter,
    clientTypeFilter,
    issueFilter,
    practitionerMap,
    priorityFilter,
    responsesByRequest,
    riskFilter,
    searchQuery,
    serviceFilter,
    statusFilter,
    workspaceBaseRequests,
  ]);

  const workspaceTabCounts = useMemo(() => ({
    active: workspaceFilteredRequests.filter((request) => matchesLifecycleWorkspaceTab(request, "active")).length,
    business: workspaceFilteredRequests.filter((request) => matchesLifecycleWorkspaceTab(request, "business")).length,
    professional: workspaceFilteredRequests.filter((request) => matchesLifecycleWorkspaceTab(request, "professional")).length,
    open: workspaceFilteredRequests.filter((request) => matchesLifecycleWorkspaceTab(request, "open")).length,
    reactivated: workspaceFilteredRequests.filter((request) => matchesLifecycleWorkspaceTab(request, "reactivated")).length,
    pending: workspaceFilteredRequests.filter((request) => matchesLifecycleWorkspaceTab(request, "pending")).length,
    expired: workspaceFilteredRequests.filter((request) => matchesLifecycleWorkspaceTab(request, "expired")).length,
    hidden: workspaceFilteredRequests.filter((request) => matchesLifecycleWorkspaceTab(request, "hidden")).length,
    archived: workspaceFilteredRequests.filter((request) => matchesLifecycleWorkspaceTab(request, "archived")).length,
  }), [workspaceFilteredRequests]);

  const filteredRequests = useMemo(
    () => workspaceFilteredRequests.filter((request) => matchesLifecycleWorkspaceTab(request, lifecycleTab)),
    [lifecycleTab, workspaceFilteredRequests],
  );

  const requestMetrics = useMemo(() => {
    const rows = dashboardRequests;
    const now = Date.now();
    const comparisonMs = dashboardRange.comparisonDays * 24 * 60 * 60 * 1000;
    const currentWindowStart = now - comparisonMs;
    const previousWindowStart = currentWindowStart - comparisonMs;

    const getWindowRows = (from: number, to: number) =>
      (requests ?? []).filter((request) => {
        const createdAt = new Date(request.created_at).getTime();
        return createdAt >= from && createdAt < to;
      });

    const currentRows = getWindowRows(currentWindowStart, now);
    const previousRows = getWindowRows(previousWindowStart, currentWindowStart);
    const currentResponses = (responses ?? []).filter((response) => {
      const createdAt = new Date(response.created_at).getTime();
      return createdAt >= currentWindowStart && createdAt < now;
    });
    const previousResponses = (responses ?? []).filter((response) => {
      const createdAt = new Date(response.created_at).getTime();
      return createdAt >= previousWindowStart && createdAt < currentWindowStart;
    });

    const averageResponseTimeFor = (responseRows: ServiceRequestResponse[]) => {
      const requestById = new Map((requests ?? []).map((row) => [row.id, row]));
      const durations = responseRows
        .map((response) => {
          const request = requestById.get(response.service_request_id);
          if (!request) return null;
          return (new Date(response.created_at).getTime() - new Date(request.created_at).getTime()) / (1000 * 60);
        })
        .filter((value): value is number => value !== null && value >= 0);

      if (!durations.length) {
        return null;
      }

      return durations.reduce((sum, value) => sum + value, 0) / durations.length;
    };

    const avgResponseTime = averageResponseTimeFor(dashboardResponses);
    const previousAvgResponseTime = averageResponseTimeFor(previousResponses);

    return {
      total: rows.length,
      active: rows.filter((request) => !request.is_archived && request.lifecycle_stage !== "expired").length,
      completed: rows.filter((request) => request.status === "closed" || request.status === "converted_to_client").length,
      archived: rows.filter((request) => request.is_archived).length,
      highRisk: rows.filter((request) => request.risk_indicator === "high").length,
      deadLeads: rows.filter((request) => request.status === "dead_lead" || request.status === "expired").length,
      business: rows.filter((request) => matchesLifecycleWorkspaceTab(request, "business") && !request.is_archived).length,
      professional: rows.filter((request) => matchesLifecycleWorkspaceTab(request, "professional") && !request.is_archived).length,
      openMarketplace: rows.filter((request) => matchesLifecycleWorkspaceTab(request, "open") && !request.is_archived).length,
      reactivated: rows.filter(isMarketplaceReactivatedLead).length,
      pendingConfirmation: rows.filter((request) => request.lifecycle_stage === "pending_client_confirmation").length,
      expired: rows.filter((request) => request.lifecycle_stage === "expired").length,
      unattended: rows.filter((request) => (responsesByRequest.get(request.id)?.length ?? 0) === 0 && !request.is_archived).length,
      practitionerResponses: dashboardResponses.length,
      activePractitioners: (practitioners ?? []).filter((practitioner) => practitioner.user.is_active).length,
      avgResponseTime,
      trends: {
        active: formatTrendPercentage(
          currentRows.filter((request) => !request.is_archived && request.lifecycle_stage !== "expired").length,
          previousRows.filter((request) => !request.is_archived && request.lifecycle_stage !== "expired").length,
        ),
        reactivated: formatTrendPercentage(
          currentRows.filter(isMarketplaceReactivatedLead).length,
          previousRows.filter(isMarketplaceReactivatedLead).length,
        ),
        pendingConfirmation: formatTrendPercentage(
          currentRows.filter((request) => request.lifecycle_stage === "pending_client_confirmation").length,
          previousRows.filter((request) => request.lifecycle_stage === "pending_client_confirmation").length,
        ),
        expired: formatTrendPercentage(
          currentRows.filter((request) => request.lifecycle_stage === "expired").length,
          previousRows.filter((request) => request.lifecycle_stage === "expired").length,
        ),
        practitionerResponses: formatTrendPercentage(currentResponses.length, previousResponses.length),
        avgResponseTime: formatTrendPercentage(
          avgResponseTime === null ? 0 : Math.round(avgResponseTime),
          previousAvgResponseTime === null ? 0 : Math.round(previousAvgResponseTime),
        ),
        activePractitioners: formatTrendPercentage(
          (practitioners ?? []).filter((practitioner) => practitioner.user.is_active && new Date(practitioner.user.created_at).getTime() >= currentWindowStart).length,
          (practitioners ?? []).filter((practitioner) => practitioner.user.is_active && new Date(practitioner.user.created_at).getTime() >= previousWindowStart && new Date(practitioner.user.created_at).getTime() < currentWindowStart).length,
        ),
        highRisk: formatTrendPercentage(
          currentRows.filter((request) => request.risk_indicator === "high").length,
          previousRows.filter((request) => request.risk_indicator === "high").length,
        ),
      },
    };
  }, [dashboardRange.comparisonDays, dashboardRequests, dashboardResponses, practitioners, requests, responses, responsesByRequest]);

  const statusChartData = useMemo(() => {
    const activeLeads = dashboardRequests.filter((request) => (
      isActiveMarketplaceLead(request)
      && request.lifecycle_reactivation_count === 0
    )).length;
    const reactivatedLeads = dashboardRequests.filter(isMarketplaceReactivatedLead).length;
    const total = requestMetrics.total || 1;

    return [
      { key: "active", label: "Active Leads", value: activeLeads, fill: STATUS_CHART_COLORS.active, percentage: Math.round((activeLeads / total) * 100) },
      { key: "reactivated", label: "Reactivated Leads", value: reactivatedLeads, fill: STATUS_CHART_COLORS.reactivated, percentage: Math.round((reactivatedLeads / total) * 100) },
      { key: "pending", label: "Pending Confirmation", value: requestMetrics.pendingConfirmation, fill: STATUS_CHART_COLORS.pending, percentage: Math.round((requestMetrics.pendingConfirmation / total) * 100) },
      { key: "expired", label: "Expired Leads", value: requestMetrics.expired, fill: STATUS_CHART_COLORS.expired, percentage: Math.round((requestMetrics.expired / total) * 100) },
      { key: "archived", label: "Archived Leads", value: requestMetrics.archived, fill: STATUS_CHART_COLORS.archived, percentage: Math.round((requestMetrics.archived / total) * 100) },
      { key: "completed", label: "Completed Leads", value: requestMetrics.completed, fill: "#14B8A6", percentage: Math.round((requestMetrics.completed / total) * 100) },
    ];
  }, [dashboardRequests, requestMetrics]);

  const pendingConfirmationRows = useMemo(
    () => dashboardRequests
      .filter((request) => request.lifecycle_stage === "pending_client_confirmation")
      .sort((left, right) => {
        const leftTime = left.client_confirmation_due_at ? new Date(left.client_confirmation_due_at).getTime() : Number.MAX_SAFE_INTEGER;
        const rightTime = right.client_confirmation_due_at ? new Date(right.client_confirmation_due_at).getTime() : Number.MAX_SAFE_INTEGER;
        return leftTime - rightTime;
      })
      .slice(0, 5),
    [dashboardRequests],
  );

  const expiredLeadRows = useMemo(
    () => dashboardRequests
      .filter((request) => request.lifecycle_stage === "expired" || request.status === "expired")
      .sort((left, right) => {
        const leftTime = new Date(left.expired_at || left.updated_at || left.created_at).getTime();
        const rightTime = new Date(right.expired_at || right.updated_at || right.created_at).getTime();
        return rightTime - leftTime;
      })
      .slice(0, 5),
    [dashboardRequests],
  );

  const recentLeads = useMemo(
    () => filteredRequests
      .filter((request) => !dashboardRange.start || new Date(request.created_at).getTime() >= dashboardRange.start.getTime())
      .slice(0, 8),
    [dashboardRange.start, filteredRequests],
  );

  const practitionerActivityRows = useMemo(() => {
    const requestById = new Map((requests ?? []).map((request) => [request.id, request]));
    return (practitioners ?? [])
      .filter((practitioner) => practitionerPlanMap.has(practitioner.user.id))
      .map((practitioner) => {
        const practitionerResponses = dashboardResponses.filter((response) => response.practitioner_profile_id === practitioner.user.id);
        const viewedCount = dashboardApprovedAccessCountByPractitioner.get(practitioner.user.id) ?? 0;
        const responseDurations = practitionerResponses
          .map((response) => {
            const request = requestById.get(response.service_request_id);
            if (!request) return null;
            return (new Date(response.created_at).getTime() - new Date(request.created_at).getTime()) / (1000 * 60);
          })
          .filter((value): value is number => value !== null && value >= 0);
        const averageMinutes = responseDurations.length
          ? responseDurations.reduce((sum, value) => sum + value, 0) / responseDurations.length
          : null;

        return {
          id: practitioner.user.id,
          name: practitioner.user.full_name || practitioner.user.email || "Practitioner",
          initials: getInitials(practitioner.user.full_name || practitioner.user.email),
          plan: practitionerPlanMap.get(practitioner.user.id) ?? null,
          leadsViewed: viewedCount,
          responses: practitionerResponses.length,
          averageMinutes,
          status: practitioner.user.is_active ? "active" : "inactive",
        };
      })
      .sort((left, right) => right.responses - left.responses)
      .slice(0, 6);
  }, [dashboardApprovedAccessCountByPractitioner, dashboardResponses, practitionerPlanMap, practitioners, requests]);

  const marketplaceHealth = useMemo(() => {
    const total = requestMetrics.total || 1;
    const responseRate = Math.round(dashboardRequests.filter((request) => (responsesByRequest.get(request.id)?.length ?? 0) > 0).length / total * 100);
    const reactivationRate = Math.round((requestMetrics.reactivated / total) * 100);
    const expiryRate = Math.round((requestMetrics.expired / total) * 100);
    const conversionRate = Math.round((dashboardRequests.filter((request) => Boolean(request.converted_case_id)).length / total) * 100);

    return [
      { label: "Response Rate", value: responseRate, trend: requestMetrics.trends.practitionerResponses },
      { label: "Reactivation Rate", value: reactivationRate, trend: requestMetrics.trends.reactivated },
      { label: "Expiry Rate", value: expiryRate, trend: -Math.abs(requestMetrics.trends.expired) },
      { label: "Conversion Rate", value: conversionRate, trend: formatTrendPercentage(dashboardRequests.filter((request) => Boolean(request.converted_case_id)).length, 0) },
    ];
  }, [dashboardRequests, requestMetrics, responsesByRequest]);

  const openRequest = async (request: ServiceRequestRecord) => {
    setSelectedRequestId(request.id);

    if (request.status !== "new") {
      return;
    }

    const { error } = await supabase
      .from("service_requests")
      .update({
        status: "viewed",
        viewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["staff-service-requests"] });
  };

  const updateStatus = async (requestId: string, status: Enums<"service_request_status">) => {
    const currentRequest = (requests ?? []).find((request) => request.id === requestId);
    if (
      currentRequest
      && currentRequest.status !== status
      && currentRequest.lifecycle_stage === "pending_client_confirmation"
    ) {
      toast.error("This lead is still waiting for client confirmation. Use Return to Marketplace instead of changing status.");
      return;
    }

    if (
      currentRequest
      && currentRequest.status !== status
      && currentRequest.lifecycle_stage === "expired"
    ) {
      toast.error("This lead is expired. Use Restart cycle instead of changing status.");
      return;
    }

    setUpdatingStatus(requestId);

    const timestamp = new Date().toISOString();
    const updates: Tables<"service_requests">["Update"] & Record<string, string | null> = {
      status,
    };

    if (status === "viewed") updates.viewed_at = timestamp;
    if (status === "responded") updates.responded_at = timestamp;
    if (status === "assigned") updates.assigned_at = timestamp;
    if (status === "closed") updates.closed_at = timestamp;
    if (status === "dead_lead") {
      updates.is_archived = true;
      updates.archived_at = timestamp;
      updates.archived_by = user?.id ?? null;
    }

    const { error } = await supabase
      .from("service_requests")
      .update(updates)
      .eq("id", requestId);

    if (error) {
      toast.error(error.message);
      setUpdatingStatus(null);
      return;
    }

    toast.success("Service request updated.");
    setUpdatingStatus(null);
    await queryClient.invalidateQueries({ queryKey: ["staff-service-requests"] });
  };

  const archiveLead = async (requestId: string) => {
    setArchivingLeadId(requestId);
    const { error } = await supabase
      .from("service_requests")
      .update({
        status: "dead_lead",
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by: user?.id ?? null,
        archive_reason: leadArchiveReason,
        archive_notes: leadArchiveNotes.trim() || null,
      })
      .eq("id", requestId);

    setArchivingLeadId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Lead moved to archive.");
    await queryClient.invalidateQueries({ queryKey: ["staff-service-requests"] });
  };

  const restoreLead = async (requestId: string) => {
    setArchivingLeadId(requestId);
    const { error } = await supabase
      .from("service_requests")
      .update({
        status: "waiting_response",
        is_archived: false,
        archived_at: null,
        archived_by: null,
        archive_reason: null,
        archive_notes: null,
      })
      .eq("id", requestId);

    setArchivingLeadId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Lead restored to the active list.");
    await queryClient.invalidateQueries({ queryKey: ["staff-service-requests"] });
  };

  const deleteLead = async (requestId: string) => {
    setDeletingLeadId(requestId);
    const { data, error } = await supabase
      .from("service_requests")
      .delete()
      .eq("id", requestId)
      .select("id")
      .maybeSingle();

    setDeletingLeadId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!data?.id) {
      toast.error("Lead was not deleted. Please make sure your account has admin delete permission.");
      return;
    }

    toast.success("Lead deleted permanently.");
    setSelectedRequestId(null);
    setConfirmDeleteLeadOpen(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-service-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-service-request-documents"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-service-request-responses"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-service-request-assignment-history"] }),
    ]);
  };

  const assignPractitioner = async (requestId: string, practitionerId: string, automatic = false) => {
    if (!practitionerId && !automatic) {
      toast.error("Choose a practitioner first.");
      return;
    }

    setAssigningRequestId(requestId);

    const response = automatic
      ? await supabase.rpc("auto_assign_service_request", { p_request_id: requestId })
      : await supabase.rpc("assign_service_request", {
        p_request_id: requestId,
        p_practitioner_id: practitionerId,
        p_assignment_type: "manual",
        p_note: "Assigned from the lead management dashboard.",
      });

    setAssigningRequestId(null);

    if (response.error) {
      toast.error(response.error.message);
      return;
    }

    toast.success(automatic ? "Lead assigned automatically." : "Lead assigned successfully.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-service-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-service-request-assignment-history"] }),
    ]);
  };

  const convertToCase = async (requestId: string) => {
    setConvertingRequestId(requestId);
    const { error } = await supabase.rpc("convert_service_request_to_case", { p_request_id: requestId });
    setConvertingRequestId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Lead converted into a case.");
    await queryClient.invalidateQueries({ queryKey: ["staff-service-requests"] });
  };

  const reviveLead = async (requestId: string) => {
    setRevivingLeadId(requestId);
    const { error } = await supabase.rpc("admin_revive_service_request", {
      p_request_id: requestId,
      p_restart_stage: selectedReviveStage,
    });
    setRevivingLeadId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Lead returned to the active marketplace.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-service-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-service-request-lifecycle-history"] }),
    ]);
  };

  const returnLeadToMarketplace = async (requestId: string) => {
    setReturningToMarketplaceId(requestId);
    const { error } = await supabase.rpc("admin_return_service_request_to_marketplace", {
      p_request_id: requestId,
    });
    setReturningToMarketplaceId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Lead returned to the marketplace.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-service-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-service-request-lifecycle-history"] }),
    ]);
  };

  const moveLeadToOpenMarketplace = async (requestId: string) => {
    setOpeningMarketplaceId(requestId);
    const { error } = await supabase.rpc("admin_move_service_request_to_open_marketplace", {
      p_request_id: requestId,
    });
    setOpeningMarketplaceId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Lead moved to Open Marketplace.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-service-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-service-request-lifecycle-history"] }),
    ]);
  };

  const resetLeadTimer = async (requestId: string) => {
    setResettingTimerId(requestId);
    const { error } = await supabase.rpc("admin_reset_service_request_lifecycle_timer", {
      p_request_id: requestId,
    });
    setResettingTimerId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Lead timer reset.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-service-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-service-request-lifecycle-history"] }),
    ]);
  };

  const saveLifecycleSettings = async () => {
    const businessStageHours = Number(lifecycleSettingsForm.businessStageHours);
    const professionalStageHours = Number(lifecycleSettingsForm.professionalStageHours);
    const openMarketplaceHours = Number(lifecycleSettingsForm.openMarketplaceHours);
    const pendingClientConfirmationHours = Number(lifecycleSettingsForm.pendingClientConfirmationHours);
    const reminderHours = Number(lifecycleSettingsForm.reminderHours);
    const reactivationAlertThreshold = Number(lifecycleSettingsForm.reactivationAlertThreshold);

    if (
      [businessStageHours, professionalStageHours, openMarketplaceHours, pendingClientConfirmationHours, reactivationAlertThreshold]
        .some((value) => Number.isNaN(value) || value <= 0)
      || Number.isNaN(reminderHours)
      || reminderHours < 0
    ) {
      toast.error("Enter valid lifecycle settings before saving.");
      return;
    }

    const nextSettings = {
      business_stage_hours: businessStageHours,
      professional_stage_hours: professionalStageHours,
      open_marketplace_hours: openMarketplaceHours,
      pending_client_confirmation_hours: pendingClientConfirmationHours,
      reminder_hours: reminderHours,
      reactivation_alert_threshold: reactivationAlertThreshold,
      updated_at: new Date().toISOString(),
    };

    setSavingLifecycleSettings(true);
    const { error } = await supabase
      .from("service_request_lifecycle_settings")
      .update(nextSettings)
      .eq("settings_key", "default");

    if (error) {
      setSavingLifecycleSettings(false);
      toast.error(error.message);
      return;
    }

    const { error: applyError } = await supabase.rpc("admin_apply_service_request_lifecycle_settings");
    setSavingLifecycleSettings(false);

    if (applyError) {
      toast.error(applyError.message);
      return;
    }

    toast.success("Lifecycle settings updated.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["service-request-lifecycle-settings"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-service-requests"] }),
    ]);
  };

  const openDocument = async (document: ServiceRequestDocument) => {
    setOpeningDocumentId(document.id);

    const { data, error } = await supabase.storage.from("documents").createSignedUrl(document.file_path, 60 * 10);

    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Unable to open this file.");
      setOpeningDocumentId(null);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    setOpeningDocumentId(null);
  };

  const getFileIcon = (type?: string | null) => {
    if (type?.startsWith("image")) return Image;
    if (type?.includes("pdf")) return FileText;
    return File;
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setServiceFilter("all");
    setRiskFilter("all");
    setPriorityFilter("all");
    setClientTypeFilter("all");
    setAssignmentFilter("all");
    setIssueFilter("all");
  };

  const dateRangeLabel = dashboardRange.label;
  const comparisonLabel = dashboardDateRange === "today"
    ? "vs yesterday"
    : dashboardDateRange === "last7"
      ? "vs previous 7 days"
      : dashboardDateRange === "last30"
        ? "vs previous 30 days"
        : "vs previous 30 days";

  const summaryCards = [
    { title: "Active Leads", value: requestMetrics.active.toLocaleString(), delta: requestMetrics.trends.active, icon: Target, color: "bg-blue-50 text-blue-600" },
    { title: "Reactivated Leads", value: requestMetrics.reactivated.toLocaleString(), delta: requestMetrics.trends.reactivated, icon: RefreshCcw, color: "bg-green-50 text-green-600" },
    { title: "Pending Confirmation", value: requestMetrics.pendingConfirmation.toLocaleString(), delta: requestMetrics.trends.pendingConfirmation, icon: Clock3, color: "bg-orange-50 text-orange-600" },
    { title: "Expired Leads", value: requestMetrics.expired.toLocaleString(), delta: requestMetrics.trends.expired, icon: TriangleAlert, color: "bg-violet-50 text-violet-600" },
    { title: "Total Responses", value: requestMetrics.practitionerResponses.toLocaleString(), delta: requestMetrics.trends.practitionerResponses, icon: Megaphone, color: "bg-cyan-50 text-cyan-600" },
    { title: "Avg. Response Time", value: formatCompactDuration(requestMetrics.avgResponseTime), delta: -Math.abs(requestMetrics.trends.avgResponseTime), icon: Clock3, color: "bg-amber-50 text-amber-600" },
    { title: "Active Practitioners", value: requestMetrics.activePractitioners.toLocaleString(), delta: requestMetrics.trends.activePractitioners, icon: UserCheck, color: "bg-emerald-50 text-emerald-600" },
    { title: "Critical SARS Leads", value: requestMetrics.highRisk.toLocaleString(), delta: requestMetrics.trends.highRisk, icon: ShieldAlert, color: "bg-rose-50 text-rose-600" },
  ] as const;

  const lifecycleStages = useMemo(() => [
    {
      title: "Business Exclusive",
      time: formatStageHours(lifecycleSettings?.business_stage_hours ?? 48),
      description: "Optional Admin-Only Re-entry",
      icon: Crown,
      iconClassName: "bg-amber-50 text-amber-600",
    },
    {
      title: "Professional Access",
      time: formatStageHours(lifecycleSettings?.professional_stage_hours ?? 48),
      description: "Optional Admin-Only Re-entry",
      icon: Users,
      iconClassName: "bg-sky-50 text-sky-600",
    },
    {
      title: "Open Marketplace",
      time: formatStageHours(lifecycleSettings?.open_marketplace_hours ?? 72),
      description: "Default For New Leads",
      icon: Target,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Pending Client Confirmation",
      time: formatStageHours(lifecycleSettings?.pending_client_confirmation_hours ?? 24),
      description: "Client Response Deadline",
      icon: Clock3,
      iconClassName: "bg-orange-50 text-orange-600",
    },
  ] as const, [lifecycleSettings]);

  return (
    <div className="space-y-8 bg-[#F5F7FB] px-1 pb-8">
      <div className="sticky top-0 z-20 -mx-1 border-b border-slate-200/80 bg-[#F5F7FB]/95 px-1 py-4 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <SidebarTrigger className="mt-1 rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50" />
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">Leads Dashboard</h1>
              <p className="mt-1 text-sm text-slate-500">Overview of all leads and marketplace activity</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={dashboardDateRange} onValueChange={(value) => setDashboardDateRange(value as DashboardDateRange)}>
              <SelectTrigger className="h-11 w-auto min-w-[220px] rounded-2xl border-slate-200 bg-white px-4 text-slate-600 shadow-sm">
                <div className="inline-flex items-center">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  <SelectValue>{dateRangeLabel}</SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last7">Last 7 Days</SelectItem>
                <SelectItem value="last30">Last 30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getTrendTone(card.delta)}`}>
                  {card.delta >= 0 ? "↑" : "↓"} {Math.abs(card.delta)}%
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-500">{card.title}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{card.value}</p>
              <p className="mt-2 text-xs text-slate-400">{comparisonLabel}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 2xl:grid-cols-12">
        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] 2xl:col-span-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Lead Lifecycle Overview</h2>
              <p className="mt-1 text-sm text-slate-500">New client-submitted leads open to all practitioners automatically, with optional restricted re-entry stages for admin.</p>
            </div>
            <Button type="button" variant="outline" className="rounded-2xl border-slate-200" onClick={() => setIsLifecycleDialogOpen(true)}>
              Learn more
            </Button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {lifecycleStages.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <div key={stage.title} className="relative rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  {index < lifecycleStages.length - 1 ? (
                    <div className="absolute -right-3 top-1/2 hidden h-0.5 w-6 -translate-y-1/2 bg-slate-200 md:block" />
                  ) : null}
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${stage.iconClassName}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-900">{stage.title}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{stage.time}</p>
                  <p className="mt-3 text-sm text-slate-500">{stage.description}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            New leads now enter Open Marketplace automatically. When a stage expires, the system updates lead status, access permissions, notifications and countdown timers without admin action.
          </div>
        </div>

        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] 2xl:col-span-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Leads by Status</h2>
              <p className="mt-1 text-sm text-slate-500">A clean breakdown of every lead state, including completed leads.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tracked States</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{statusChartData.length}</p>
            </div>
          </div>
          <div className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
              <div className="relative mx-auto w-full max-w-[220px]">
              <ChartContainer
                config={{
                  active: { label: "Active Leads", color: STATUS_CHART_COLORS.active },
                  reactivated: { label: "Reactivated Leads", color: STATUS_CHART_COLORS.reactivated },
                  pending: { label: "Pending Confirmation", color: STATUS_CHART_COLORS.pending },
                  expired: { label: "Expired Leads", color: STATUS_CHART_COLORS.expired },
                  archived: { label: "Archived Leads", color: STATUS_CHART_COLORS.archived },
                  completed: { label: "Completed Leads", color: "#14B8A6" },
                }}
                className="h-[220px] w-full"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value, name) => (
                    <div className="flex items-center justify-between gap-4">
                      <span>{name}</span>
                      <span className="font-semibold text-slate-900">{value}</span>
                    </div>
                  )} />} />
                  <Pie data={statusChartData} dataKey="value" nameKey="label" innerRadius={58} outerRadius={86} paddingAngle={3}>
                    {statusChartData.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Total Leads</span>
                <span className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">{requestMetrics.total}</span>
              </div>
              </div>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                {statusChartData.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                        <span className="truncate text-sm font-medium text-slate-700">{item.label}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-slate-900">{item.value}</p>
                        <p className="text-xs text-slate-400">{item.percentage}%</p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(item.percentage, item.value > 0 ? 6 : 0)}%`, backgroundColor: item.fill }}
                      />
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] 2xl:col-span-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Pending Client Confirmation</h2>
              <p className="mt-1 text-sm text-slate-500">Leads waiting for a client decision before they return to the marketplace or expire.</p>
            </div>
            <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => moveToWorkspaceTab("pending")}>
              View all pending
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {pendingConfirmationRows.length ? pendingConfirmationRows.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => openRequest(request)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                    {getInitials(request.full_name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{request.full_name}</p>
                    <p className="text-xs text-slate-500">{formatServiceList(resolveServiceList(request))}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Expiry countdown</p>
                  <p className="mt-1 text-sm font-medium text-rose-600">{getLifecycleCountdownLabel(request) || "Expires soon"}</p>
                </div>
              </button>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                <p>No pending confirmations right now.</p>
                <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={() => moveToWorkspaceTab("pending")}>
                  Open pending tab
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] 2xl:col-span-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Expired Leads</h2>
              <p className="mt-1 text-sm text-slate-500">Revive expired leads directly from the dashboard and restart their cycle at the selected stage.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {role === "admin" ? (
                <Select value={selectedReviveStage} onValueChange={(value) => setSelectedReviveStage(value as Enums<"service_request_lifecycle_stage">)}>
                  <SelectTrigger className="min-w-[220px] rounded-2xl border-slate-200 bg-white">
                    <SelectValue placeholder="Choose re-entry stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business_exclusive">Business Exclusive</SelectItem>
                    <SelectItem value="professional_access">Professional Access</SelectItem>
                    <SelectItem value="open_marketplace">Open Marketplace</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              <Button type="button" variant="outline" className="rounded-2xl border-slate-200" onClick={() => moveToWorkspaceTab("expired")}>
                View all expired
              </Button>
            </div>
          </div>
          <div className="mt-5 max-h-[720px] space-y-3 overflow-y-auto pr-1">
            {expiredLeadRows.length ? expiredLeadRows.map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <button
                    type="button"
                    onClick={() => openRequest(request)}
                    className="min-w-0 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-sm font-semibold text-violet-700">
                        {getInitials(request.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{request.full_name}</p>
                        <p className="truncate text-xs text-slate-500">{formatServiceList(resolveServiceList(request))}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Expired {new Date(request.expired_at || request.updated_at || request.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => openRequest(request)}>
                      Review lead
                    </Button>
                    {role === "admin" ? (
                      <Button
                        type="button"
                        className="rounded-xl"
                        onClick={() => void reviveLead(request.id)}
                        disabled={revivingLeadId === request.id}
                      >
                        {revivingLeadId === request.id ? "Reviving..." : "Restart cycle"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                <p>No expired leads in the current date range.</p>
                <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={() => moveToWorkspaceTab("expired")}>
                  Open expired tab
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Lifecycle Settings</h2>
            <p className="mt-1 text-sm text-slate-500">Control the default stage timers, reminder window, and repeated reactivation threshold.</p>
          </div>
          <Button
            type="button"
            className="rounded-2xl"
            onClick={() => void saveLifecycleSettings()}
            disabled={savingLifecycleSettings || role !== "admin"}
          >
            <Save className="mr-2 h-4 w-4" />
            {savingLifecycleSettings ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Business Stage</p>
            <Input
              type="number"
              min="1"
              value={lifecycleSettingsForm.businessStageHours}
              onChange={(event) => setLifecycleSettingsForm((current) => ({ ...current, businessStageHours: event.target.value }))}
              className="mt-3 rounded-xl bg-white"
            />
            <p className="mt-2 text-xs text-slate-500">Hours before the lead opens to Professional practitioners.</p>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Professional Stage</p>
            <Input
              type="number"
              min="1"
              value={lifecycleSettingsForm.professionalStageHours}
              onChange={(event) => setLifecycleSettingsForm((current) => ({ ...current, professionalStageHours: event.target.value }))}
              className="mt-3 rounded-xl bg-white"
            />
            <p className="mt-2 text-xs text-slate-500">Hours before the lead opens to the full marketplace.</p>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Open Marketplace</p>
            <Input
              type="number"
              min="1"
              value={lifecycleSettingsForm.openMarketplaceHours}
              onChange={(event) => setLifecycleSettingsForm((current) => ({ ...current, openMarketplaceHours: event.target.value }))}
              className="mt-3 rounded-xl bg-white"
            />
            <p className="mt-2 text-xs text-slate-500">Hours before an unattended open lead expires.</p>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Client Confirmation</p>
            <Input
              type="number"
              min="1"
              value={lifecycleSettingsForm.pendingClientConfirmationHours}
              onChange={(event) => setLifecycleSettingsForm((current) => ({ ...current, pendingClientConfirmationHours: event.target.value }))}
              className="mt-3 rounded-xl bg-white"
            />
            <p className="mt-2 text-xs text-slate-500">Hours the client has to respond before the lead returns to the marketplace.</p>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reminder Window</p>
            <Input
              type="number"
              min="0"
              value={lifecycleSettingsForm.reminderHours}
              onChange={(event) => setLifecycleSettingsForm((current) => ({ ...current, reminderHours: event.target.value }))}
              className="mt-3 rounded-xl bg-white"
            />
            <p className="mt-2 text-xs text-slate-500">Hours before expiry reserved for reminder or warning workflows.</p>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reactivation Alert Threshold</p>
            <Input
              type="number"
              min="1"
              value={lifecycleSettingsForm.reactivationAlertThreshold}
              onChange={(event) => setLifecycleSettingsForm((current) => ({ ...current, reactivationAlertThreshold: event.target.value }))}
              className="mt-3 rounded-xl bg-white"
            />
            <p className="mt-2 text-xs text-slate-500">How many unsuccessful cycles a lead can go through before staff should review it.</p>
          </label>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recent Active Leads</h2>
              <p className="mt-1 text-sm text-slate-500">Latest marketplace leads with stage, priority, responses and visibility.</p>
            </div>
          </div>
          <div className="mt-5 max-h-[720px] space-y-3 overflow-y-auto pr-1">
            {recentLeads.length ? recentLeads.map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                        {getInitials(request.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{formatServiceList(resolveServiceList(request))}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{request.id}</p>
                        <p className="mt-2 text-sm font-medium text-slate-700">{request.full_name}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getLifecycleStageBadgeClass(request.lifecycle_stage)}`}>
                        {formatLifecycleStageLabel(request.lifecycle_stage)}
                      </Badge>
                      <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${request.priority_level === "high" || request.priority_level === "urgent" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                        {formatServiceRequestLabel(request.priority_level)}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Time Left</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{getLifecycleCountdownLabel(request) || "—"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Responses</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{responsesByRequest.get(request.id)?.length ?? 0}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Views</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{request.viewed_at ? 1 : 0}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Visibility</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{formatLifecycleStageLabel(request.lifecycle_stage)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => void openRequest(request)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setSelectedRequestId(request.id)}>
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                <p>No recent active leads in the selected date range.</p>
              </div>
            )}
            <Table className="hidden table-fixed">
              <TableHeader>
                <TableRow className="border-slate-200">
                  <TableHead className="w-[29%]">Lead Title</TableHead>
                  <TableHead className="w-[15%]">Client</TableHead>
                  <TableHead className="w-[14%]">Stage</TableHead>
                  <TableHead className="w-[10%]">Priority</TableHead>
                  <TableHead className="w-[12%]">Time Left</TableHead>
                  <TableHead className="w-[7%] text-center">Responses</TableHead>
                  <TableHead className="w-[5%] text-center">Views</TableHead>
                  <TableHead className="w-[8%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLeads.map((request) => (
                  <TableRow key={request.id} className="border-slate-100">
                    <TableCell className="min-w-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{formatServiceList(resolveServiceList(request))}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{request.id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="truncate font-medium text-slate-700">{request.full_name}</TableCell>
                    <TableCell>
                      <Badge className={`max-w-full truncate rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getLifecycleStageBadgeClass(request.lifecycle_stage)}`}>
                        {formatLifecycleStageLabel(request.lifecycle_stage)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${request.priority_level === "high" || request.priority_level === "urgent" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                        {formatServiceRequestLabel(request.priority_level)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-700">{getLifecycleCountdownLabel(request) || "—"}</TableCell>
                    <TableCell className="text-center font-medium text-slate-700">{responsesByRequest.get(request.id)?.length ?? 0}</TableCell>
                    <TableCell className="text-center font-medium text-slate-700">{request.viewed_at ? 1 : 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={() => void openRequest(request)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setSelectedRequestId(request.id)}>
                          <Ellipsis className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Practitioner Activity</h2>
              <p className="mt-1 text-sm text-slate-500">Recent engagement and response performance across the marketplace.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {practitionerActivityRows.length ? practitionerActivityRows.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                      {row.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{row.plan ? formatServiceRequestLabel(row.plan) : "No active plan"}</p>
                    </div>
                  </div>
                  <Badge className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${row.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                    {row.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Viewed</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{row.leadsViewed}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Responses</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{row.responses}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Avg Time</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{formatCompactDuration(row.averageMinutes)}</p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                <p>No practitioner activity in the selected date range.</p>
              </div>
            )}
            <Table className="hidden table-fixed">
              <TableHeader>
                <TableRow className="border-slate-200">
                  <TableHead className="w-[36%]">Practitioner</TableHead>
                  <TableHead className="w-[18%]">Plan</TableHead>
                  <TableHead className="w-[10%] text-center">Viewed</TableHead>
                  <TableHead className="w-[12%] text-center">Responses</TableHead>
                  <TableHead className="w-[14%]">Avg Time</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {practitionerActivityRows.map((row) => (
                  <TableRow key={row.id} className="border-slate-100">
                    <TableCell className="min-w-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
                          {row.initials}
                        </div>
                        <span className="truncate font-medium text-slate-900">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="truncate text-slate-700">{row.plan ? formatServiceRequestLabel(row.plan) : "No plan"}</TableCell>
                    <TableCell className="text-center font-medium text-slate-700">{row.leadsViewed}</TableCell>
                    <TableCell className="text-center font-medium text-slate-700">{row.responses}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-700">{formatCompactDuration(row.averageMinutes)}</TableCell>
                    <TableCell>
                      <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${row.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        {row.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

      </div>

      <div className="grid gap-6">
        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <h2 className="text-lg font-semibold text-slate-900">Marketplace Health</h2>
          <p className="mt-1 text-sm text-slate-500">High-level performance and quality signals across the marketplace.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {marketplaceHealth.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{metric.value}%</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getTrendTone(metric.trend)}`}>
                    {metric.trend >= 0 ? "↑" : "↓"} {Math.abs(metric.trend)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div ref={workspaceRef} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Lead Management Workspace</h2>
            <p className="mt-1 text-sm text-slate-500">Search, filter and manage the full marketplace lead list below.</p>
            <p className="mt-2 text-xs text-slate-400">Lifecycle filters use lead stage, not service category or lead type, and they follow the selected dashboard date range.</p>
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-border pb-4">
          <Button
            type="button"
            size="sm"
            variant={leadView === "active" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setLeadView("active")}
          >
            Active Leads
          </Button>
          <Button
            type="button"
            size="sm"
            variant={leadView === "archived" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setLeadView("archived")}
          >
            Archived Leads
          </Button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { value: "active", label: "Active Leads" },
            { value: "business", label: "Business Stage" },
            { value: "professional", label: "Professional Stage" },
            { value: "open", label: "Open Marketplace" },
            { value: "reactivated", label: "Reactivated Leads" },
            { value: "pending", label: "Pending Confirmation" },
            { value: "expired", label: "Expired Leads" },
            { value: "hidden", label: "Hidden From Practitioners" },
            { value: "archived", label: "Archived Leads" },
          ].map((tab) => (
            <Button
              key={tab.value}
              type="button"
              size="sm"
              variant={lifecycleTab === tab.value ? "default" : "outline"}
              className="rounded-full"
              onClick={() => moveToWorkspaceTab(tab.value as typeof lifecycleTab)}
            >
              {tab.label} <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-[11px]">{workspaceTabCounts[tab.value as keyof typeof workspaceTabCounts]}</span>
            </Button>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name, email, phone, practitioner, service, or status..."
              className="rounded-xl pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {serviceRequestStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All services" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {serviceNeededOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All risk levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risk levels</SelectItem>
              <SelectItem value="high">High risk</SelectItem>
              <SelectItem value="medium">Medium risk</SelectItem>
              <SelectItem value="low">Low risk</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {serviceRequestPriorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={clientTypeFilter} onValueChange={setClientTypeFilter}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All client types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All client types</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="company">Company</SelectItem>
            </SelectContent>
          </Select>

          <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All assignments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignments</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              <SelectItem value="responded">Has responses</SelectItem>
              <SelectItem value="no_responses">No responses</SelectItem>
              <SelectItem value="converted">Converted to case</SelectItem>
            </SelectContent>
          </Select>

          <Select value={issueFilter} onValueChange={setIssueFilter}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All issue flags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All issue flags</SelectItem>
              <SelectItem value="debt">Debt flagged</SelectItem>
              <SelectItem value="returns">Returns flagged</SelectItem>
              <SelectItem value="documents">Documents flagged</SelectItem>
              <SelectItem value="clean">No issue flags</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground font-body">
            Showing <span className="font-semibold text-foreground">{filteredRequests.length}</span> of <span className="font-semibold text-foreground">{workspaceFilteredRequests.length}</span> requests in <span className="font-semibold text-foreground">{dateRangeLabel}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Total Requests</p>
          <p className="font-display text-3xl text-foreground">{requestMetrics.total}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Reactivated Leads</p>
          <p className="font-display text-3xl text-violet-700">{requestMetrics.reactivated}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Pending Confirmation</p>
          <p className="font-display text-3xl text-orange-700">{requestMetrics.pendingConfirmation}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Expired Leads</p>
          <p className="font-display text-3xl text-red-700">{requestMetrics.expired}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Unattended Leads</p>
          <p className="font-display text-3xl text-foreground">{requestMetrics.unattended}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Critical SARS Leads</p>
          <p className="font-display text-3xl text-red-700">{requestMetrics.highRisk}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : filteredRequests.length > 0 ? (
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const issueFlags = getServiceRequestIssueFlags({
              hasDebtFlag: request.has_debt_flag,
              missingReturnsFlag: request.missing_returns_flag,
              missingDocumentsFlag: request.missing_documents_flag,
            });
            const practitionerVisibility = getPractitionerMarketplaceVisibility(request);
            return (
              <button
                key={request.id}
                type="button"
                onClick={() => openRequest(request)}
                className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:border-primary/30 hover:shadow-elevated"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h2 className="font-display text-lg font-semibold text-foreground">{request.full_name}</h2>
                      <Badge variant="outline" className={getServiceRequestStatusClass(request.status)}>
                        {formatServiceRequestLabel(request.status)}
                      </Badge>
                      <Badge variant="outline" className={getLifecycleStageBadgeClass(request.lifecycle_stage)}>
                        {formatLifecycleStageLabel(request.lifecycle_stage)}
                      </Badge>
                      <Badge variant="outline" className={getServiceRequestRiskClass(request.risk_indicator)}>
                        {formatServiceRequestLabel(request.risk_indicator)} Risk
                      </Badge>
                      <Badge variant="outline" className={practitionerVisibility.toneClass}>
                        {practitionerVisibility.label}
                      </Badge>
                      {request.lifecycle_reactivation_count > 0 ? (
                        <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                          Reactivated x{request.lifecycle_reactivation_count}
                        </Badge>
                      ) : null}
                    </div>

                    <p className="text-sm text-muted-foreground font-body">
                      {request.email} | {request.phone}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground font-body">
                      {formatServiceRequestLabel(request.client_type)} | {formatServiceList(resolveServiceList(request))} | Priority {formatServiceRequestLabel(request.priority_level)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground font-body">
                      {getLifecycleCountdownLabel(request) || "No active countdown"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground font-body">
                      {practitionerVisibility.description}
                      {!practitionerVisibility.visible && practitionerVisibility.action === "restart_cycle"
                        ? " Open this lead and use Restart cycle."
                        : !practitionerVisibility.visible && practitionerVisibility.action === "return_to_marketplace"
                          ? " Open this lead and use Return to Marketplace."
                          : practitionerVisibility.action === "move_to_open_marketplace"
                            ? " Open this lead and use Move to Open Marketplace if you want all practitioners to see it now."
                          : ""}
                    </p>
                    <p className="mt-3 line-clamp-2 text-sm text-foreground font-body">{request.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {issueFlags.length > 0 ? issueFlags.map((flag) => (
                        <span key={flag} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {flag}
                        </span>
                      )) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          No issue flags
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                        {responsesByRequest.get(request.id)?.length ?? 0} response{(responsesByRequest.get(request.id)?.length ?? 0) === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 xl:min-w-[220px] xl:items-end">
                    <span className="text-xs text-muted-foreground font-body">
                      Submitted {new Date(request.created_at).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground font-body">
                      Documents: {documentMap.get(request.id)?.length ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-body">
                      {request.assigned_practitioner_id
                        ? `Assigned to ${practitionerMap.get(request.assigned_practitioner_id)?.user.full_name || "practitioner"}`
                        : "Not assigned yet"}
                    </span>
                    {request.is_archived ? (
                      <span className="text-xs text-red-600 font-body">
                        Archived{request.archive_reason ? ` · ${formatServiceRequestLabel(request.archive_reason)}` : ""}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground font-body">
            {hasActiveFilters ? "No service requests matched the current filters." : "No service requests submitted yet."}
          </p>
        </div>
      )}

      <DashboardItemDialog
        open={!!selectedRequest}
        onOpenChange={(open) => {
          if (!open) setSelectedRequestId(null);
          if (!open && leadIdFromQuery) {
            const next = new URLSearchParams(searchParams);
            next.delete("leadId");
            setSearchParams(next, { replace: true });
          }
        }}
        title={selectedRequest?.full_name || "Service Request"}
        description="Review request details, issue flags, uploaded documents, and lead status."
      >
        {selectedRequest ? (
          <div className="space-y-6">
            {(() => {
              const practitionerVisibility = getPractitionerMarketplaceVisibility(selectedRequest);

              return (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Contact</p>
                <p className="font-body text-foreground">{selectedRequest.email}</p>
                <p className="font-body text-muted-foreground mt-1">{selectedRequest.phone}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Status</p>
                <Select
                  value={selectedRequest.status}
                  onValueChange={(value) => updateStatus(selectedRequest.id, value as Enums<"service_request_status">)}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceRequestStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {updatingStatus === selectedRequest.id ? (
                  <p className="mt-2 text-xs text-muted-foreground font-body">Saving status...</p>
                ) : null}
                {selectedRequest.lifecycle_stage === "pending_client_confirmation" ? (
                  <p className="mt-2 text-xs text-orange-600 font-body">
                    Use Return to Marketplace to make this lead visible again.
                  </p>
                ) : null}
                {selectedRequest.lifecycle_stage === "expired" ? (
                  <p className="mt-2 text-xs text-violet-600 font-body">
                    Use Restart cycle to make this lead visible again.
                  </p>
                ) : null}
                {selectedRequest.is_archived ? (
                  <p className="mt-2 text-xs text-red-600 font-body">
                    Archived{selectedRequest.archive_reason ? ` · ${formatServiceRequestLabel(selectedRequest.archive_reason)}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Request Type</p>
                <p className="font-body text-foreground">{formatServiceList(resolveServiceList(selectedRequest))}</p>
                <p className="mt-1 text-sm text-muted-foreground font-body">
                  Categories: {formatCategoryList(resolveCategoryList(selectedRequest)) || "Not specified"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground font-body">Priority {formatServiceRequestLabel(selectedRequest.priority_level)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Risk</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={getServiceRequestRiskClass(selectedRequest.risk_indicator)}>
                    {formatServiceRequestLabel(selectedRequest.risk_indicator)} Risk
                  </Badge>
                  {getServiceRequestIssueFlags({
                    hasDebtFlag: selectedRequest.has_debt_flag,
                    missingReturnsFlag: selectedRequest.missing_returns_flag,
                    missingDocumentsFlag: selectedRequest.missing_documents_flag,
                  }).map((flag) => (
                    <span key={flag} className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">{flag}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Lifecycle</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={getLifecycleStageBadgeClass(selectedRequest.lifecycle_stage)}>
                    {formatLifecycleStageLabel(selectedRequest.lifecycle_stage)}
                  </Badge>
                  {selectedRequest.lifecycle_reactivation_count > 0 ? (
                    <Badge className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                      Reactivated x{selectedRequest.lifecycle_reactivation_count}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-foreground font-body">
                  {getLifecycleCountdownLabel(selectedRequest) || "No active countdown"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground font-body">
                  Last client activity: {selectedRequest.lifecycle_last_client_activity_at
                    ? new Date(selectedRequest.lifecycle_last_client_activity_at).toLocaleString()
                    : "Not recorded"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Practitioner Visibility</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={practitionerVisibility.toneClass}>
                    {practitionerVisibility.label}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-foreground font-body">{practitionerVisibility.description}</p>
                {!practitionerVisibility.visible && practitionerVisibility.action === "restart_cycle" ? (
                  <p className="mt-1 text-xs text-muted-foreground font-body">Use Restart cycle to return this lead to the practitioner marketplace.</p>
                ) : null}
                {!practitionerVisibility.visible && practitionerVisibility.action === "return_to_marketplace" ? (
                  <p className="mt-1 text-xs text-muted-foreground font-body">Use Return to Marketplace to reopen this lead for practitioners.</p>
                ) : null}
                {practitionerVisibility.action === "move_to_open_marketplace" ? (
                  <p className="mt-1 text-xs text-muted-foreground font-body">Use Move to Open Marketplace if you want all practitioners to see this lead immediately.</p>
                ) : null}
              </div>
            </div>
              );
            })()}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  {selectedRequest.client_type === "individual"
                    ? formatServiceRequestLabel(selectedRequest.identity_document_type || "id_number")
                    : "Company Registration Number"}
                </p>
                <p className="font-body text-foreground">
                  {selectedRequest.client_type === "individual"
                    ? selectedRequest.id_number || "Not provided"
                    : selectedRequest.company_registration_number || "Not provided"}
                </p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">SARS Debt / Returns</p>
                <p className="font-body text-foreground">
                  Debt: R {Number(selectedRequest.sars_debt_amount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                </p>
                <p className="mt-1 text-sm text-muted-foreground font-body">
                  Returns Filed: {selectedRequest.returns_filed ? "Yes" : "No"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Issue Description</p>
              <div className="rounded-2xl border border-border p-4">
                <p className="whitespace-pre-wrap font-body text-foreground">{selectedRequest.description || "No description was provided with this request."}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-1">Lifecycle History</p>
                  <p className="text-sm text-muted-foreground font-body">
                    Track automatic stage changes, reactivations, and client confirmation outcomes.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {role === "admin" && getPractitionerMarketplaceVisibility(selectedRequest).action === "move_to_open_marketplace" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => void moveLeadToOpenMarketplace(selectedRequest.id)}
                      disabled={openingMarketplaceId === selectedRequest.id}
                    >
                      {openingMarketplaceId === selectedRequest.id ? "Opening..." : "Move to Open Marketplace"}
                    </Button>
                  ) : null}
                  {role === "admin" && selectedRequest.lifecycle_stage === "pending_client_confirmation" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => void returnLeadToMarketplace(selectedRequest.id)}
                      disabled={returningToMarketplaceId === selectedRequest.id}
                    >
                      {returningToMarketplaceId === selectedRequest.id ? "Returning..." : "Return to Marketplace"}
                    </Button>
                  ) : null}
                  {role === "admin" && canResetSelectedTimer ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => void resetLeadTimer(selectedRequest.id)}
                      disabled={resettingTimerId === selectedRequest.id}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {resettingTimerId === selectedRequest.id ? "Resetting..." : "Reset Timer"}
                    </Button>
                  ) : null}
                  {role === "admin" && selectedRequest.lifecycle_stage === "expired" ? (
                    <>
                      <Select value={selectedReviveStage} onValueChange={(value) => setSelectedReviveStage(value as Enums<"service_request_lifecycle_stage">)}>
                        <SelectTrigger className="min-w-[220px] rounded-xl">
                          <SelectValue placeholder="Choose re-entry stage" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="business_exclusive">Business Exclusive</SelectItem>
                          <SelectItem value="professional_access">Professional Access</SelectItem>
                          <SelectItem value="open_marketplace">Open Marketplace</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => void reviveLead(selectedRequest.id)}
                        disabled={revivingLeadId === selectedRequest.id}
                      >
                        {revivingLeadId === selectedRequest.id ? "Reviving..." : "Revive Lead"}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {selectedLifecycleHistory.length ? selectedLifecycleHistory.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-accent/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.lifecycle_stage ? (
                        <Badge variant="outline" className={getLifecycleStageBadgeClass(item.lifecycle_stage)}>
                          {formatLifecycleStageLabel(item.lifecycle_stage)}
                        </Badge>
                      ) : null}
                      <Badge className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        {formatServiceRequestLabel(item.event_type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-body">{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    {item.note ? <p className="mt-2 text-sm text-foreground font-body">{item.note}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground font-body">
                      <span>Reactivation count: {item.reactivation_count}</span>
                      {item.triggered_by ? <span>Triggered by: {item.triggered_by}</span> : null}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground font-body">No lifecycle history has been recorded yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-3">Lead Archive Controls</p>
              {selectedRequest.is_archived ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground font-body">
                    This lead is archived and removed from active lead management.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-accent/20 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-1">Archive Reason</p>
                      <p className="text-sm text-foreground font-body">{formatServiceRequestLabel(selectedRequest.archive_reason || "other")}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-accent/20 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-1">Archive Notes</p>
                      <p className="text-sm text-foreground font-body">{selectedRequest.archive_notes || "No notes added."}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => void restoreLead(selectedRequest.id)}
                      disabled={archivingLeadId === selectedRequest.id}
                    >
                      {archivingLeadId === selectedRequest.id ? "Restoring..." : "Restore Lead"}
                    </Button>
                    {role === "admin" ? (
                      <Button
                        type="button"
                        variant="destructive"
                        className="rounded-xl"
                        onClick={() => setConfirmDeleteLeadOpen(true)}
                        disabled={deletingLeadId === selectedRequest.id}
                      >
                        {deletingLeadId === selectedRequest.id ? "Deleting..." : "Delete Permanently"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-foreground font-body">Archive reason</p>
                      <Select value={leadArchiveReason} onValueChange={setLeadArchiveReason}>
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                          <SelectItem value="duplicate">Duplicate</SelectItem>
                          <SelectItem value="spam">Spam</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold text-foreground font-body">Archive notes</p>
                      <Textarea
                        value={leadArchiveNotes}
                        onChange={(event) => setLeadArchiveNotes(event.target.value)}
                        placeholder="Add a short note about why this lead is no longer active."
                        className="min-h-[96px] rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => void archiveLead(selectedRequest.id)}
                        disabled={archivingLeadId === selectedRequest.id}
                      >
                        {archivingLeadId === selectedRequest.id ? "Archiving..." : "Mark as Dead Lead"}
                      </Button>
                      {role === "admin" ? (
                        <Button
                          type="button"
                          variant="destructive"
                          className="rounded-xl"
                          onClick={() => setConfirmDeleteLeadOpen(true)}
                          disabled={deletingLeadId === selectedRequest.id}
                        >
                          {deletingLeadId === selectedRequest.id ? "Deleting..." : "Delete Lead"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-3">Assignment Controls</p>
                <div className="space-y-3">
                  <Select value={selectedPractitionerId || "unassigned"} onValueChange={(value) => setSelectedPractitionerId(value === "unassigned" ? "" : value)}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Choose practitioner</SelectItem>
                      {(practitioners ?? []).map((practitioner) => (
                        <SelectItem key={practitioner.user.id} value={practitioner.user.id}>
                          {(practitioner.user.full_name || practitioner.user.email || "Practitioner")} · {practitioner.activeCaseCount} active case{practitioner.activeCaseCount === 1 ? "" : "s"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      className="rounded-xl"
                      onClick={() => void assignPractitioner(selectedRequest.id, selectedPractitionerId)}
                      disabled={assigningRequestId === selectedRequest.id}
                    >
                      {assigningRequestId === selectedRequest.id ? "Assigning..." : selectedRequest.assigned_practitioner_id ? "Reassign Lead" : "Assign Lead"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => void assignPractitioner(selectedRequest.id, "", true)}
                      disabled={assigningRequestId === selectedRequest.id}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Auto Assign
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full rounded-xl"
                    onClick={() => void convertToCase(selectedRequest.id)}
                    disabled={!selectedRequest.assigned_practitioner_id || convertingRequestId === selectedRequest.id}
                  >
                    {convertingRequestId === selectedRequest.id ? "Converting..." : selectedRequest.converted_case_id ? "Case Already Created" : "Convert Request to Case"}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-3">Assignment History</p>
                <div className="space-y-3">
                  {selectedAssignments.length ? selectedAssignments.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border bg-accent/20 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                          {getAssignmentTypeLabel(item.assignment_type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-body">{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 text-sm text-foreground font-body">
                        {item.practitioner_profile_id ? practitionerMap.get(item.practitioner_profile_id)?.user.full_name || "Practitioner" : "No practitioner"}
                      </p>
                      {item.note ? <p className="mt-1 text-sm text-muted-foreground font-body">{item.note}</p> : null}
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground font-body">No assignments have been logged yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-3">Practitioner Responses</p>
              <div className="space-y-3">
                {selectedResponses.length ? selectedResponses.map((response) => {
                  const practitioner = practitionerMap.get(response.practitioner_profile_id);
                  return (
                    <div key={response.id} className="rounded-2xl border border-border bg-accent/20 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground font-body">
                              {practitioner?.user.full_name || practitioner?.user.email || "Practitioner"}
                            </p>
                            {practitioner?.profile?.is_verified ? (
                              <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                                Verified
                              </Badge>
                            ) : null}
                            <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getAvailabilityBadgeClass(practitioner?.profile?.availability_status)}`}>
                              {formatAvailabilityLabel(practitioner?.profile?.availability_status)}
                            </Badge>
                            <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getResponseStatusClass(response.response_status)}`}>
                              {formatServiceRequestLabel(response.response_status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground font-body">
                            {practitioner?.activeCaseCount ?? 0} active case{(practitioner?.activeCaseCount ?? 0) === 1 ? "" : "s"} · {practitioner?.profile?.years_of_experience ?? 0} years experience
                          </p>
                          <div className="grid gap-3">
                            <div className="rounded-2xl border border-border bg-white p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Introduction Message</p>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground font-body">
                                {response.introduction_message}
                              </p>
                            </div>
                            {response.service_pitch ? (
                              <div className="rounded-2xl border border-border bg-white p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Service Pitch</p>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground font-body">{response.service_pitch}</p>
                              </div>
                            ) : null}
                          </div>
                          {(practitioner?.profile?.services_offered ?? []).length ? (
                            <div className="flex flex-wrap gap-2">
                              {(practitioner?.profile?.services_offered ?? []).map((service) => (
                                <Badge key={service} className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                                  {serviceNeededOptions.find((option) => option.value === service)?.label || service}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground font-body">No practitioner responses have been submitted yet.</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-3">Supporting Documents</p>
              {selectedDocuments.length > 0 ? (
                <div className="space-y-3">
                  {selectedDocuments.map((document) => {
                    const Icon = getFileIcon(document.mime_type);
                    return (
                      <div key={document.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-body font-medium text-foreground">{document.file_name}</p>
                            <p className="text-xs text-muted-foreground font-body">
                              {document.file_size ? `${(document.file_size / 1024).toFixed(1)} KB | ` : ""}
                              {new Date(document.uploaded_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl shrink-0"
                          onClick={() => openDocument(document)}
                          disabled={openingDocumentId === document.id}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {openingDocumentId === document.id ? "Opening..." : "Open"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-accent/20 p-4">
                  <p className="text-sm text-muted-foreground font-body">No supporting documents were uploaded with this request.</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>

      <LeadLifecycleExplainerDialog
        open={isLifecycleDialogOpen}
        onOpenChange={setIsLifecycleDialogOpen}
      />

      <AlertDialog open={confirmDeleteLeadOpen} onOpenChange={setConfirmDeleteLeadOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lead permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the lead and its related marketplace records, including uploaded request documents, practitioner responses, access requests, and assignment history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(selectedRequest && deletingLeadId === selectedRequest.id)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (!selectedRequest) {
                  setConfirmDeleteLeadOpen(false);
                  return;
                }

                void deleteLead(selectedRequest.id);
              }}
            >
              {selectedRequest && deletingLeadId === selectedRequest.id ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
