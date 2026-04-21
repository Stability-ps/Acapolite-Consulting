import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  ExternalLink,
  FileWarning,
  FolderOpen,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Enums, Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WebPushPrompt } from "@/components/dashboard/WebPushPrompt";
import { getClientWarningSummary } from "@/lib/clientRisk";
import {
  formatServiceRequestLabel,
  getServiceRequestRiskClass,
  getServiceRequestStatusClass,
  serviceNeededOptions,
} from "@/lib/serviceRequests";
import { formatAvailabilityLabel, getAvailabilityBadgeClass } from "@/lib/practitionerMarketplace";

type PractitionerProfile = Tables<"practitioner_profiles">;
type ServiceRequest = Tables<"service_requests">;
type ServiceRequestResponse = Tables<"service_request_responses">;
type ServiceRequestAccessRequest = Tables<"service_request_access_requests">;

type ClientRecord = {
  id: string;
  client_type: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  client_code: string | null;
  sars_outstanding_debt: number;
  returns_filed: boolean;
};

type CaseRecord = {
  id: string;
  client_id: string;
  case_title: string;
  case_type: Enums<"case_type">;
  status: Enums<"case_status">;
  priority: number;
  due_date: string | null;
  last_activity_at: string;
  clients?: ClientRecord | null;
};

type DocumentRecord = {
  id: string;
  client_id: string;
  title: string;
  category: string | null;
  status: Enums<"document_status">;
  uploaded_at: string;
  rejection_reason: string | null;
};

type DocumentRequestRecord = {
  id: string;
  client_id: string;
  title: string;
  due_date: string | null;
  is_required: boolean;
  is_fulfilled: boolean;
};

type InvoiceRecord = {
  client_id: string;
  status: string;
  balance_due: number;
};

function getClientName(client?: Partial<ClientRecord> | null) {
  return (
    client?.company_name ||
    [client?.first_name, client?.last_name].filter(Boolean).join(" ") ||
    client?.client_code ||
    "Client"
  );
}

function formatCaseType(value: string) {
  return value.replace(/_/g, " ");
}

function formatPriority(priority: number) {
  if (priority === 1) return "High";
  if (priority === 3) return "Low";
  return "Normal";
}

function getCaseStatusClass(status: string) {
  switch (status) {
    case "resolved":
    case "closed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "awaiting_client_documents":
    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "new":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function getProfileCompletion(profile?: PractitionerProfile | null) {
  if (!profile) {
    return 0;
  }

  const isRegisteredCompany = profile.business_type === "company";
  const checks = [
    !isRegisteredCompany || Boolean(profile.business_name?.trim()),
    !isRegisteredCompany || Boolean(profile.registration_number?.trim()),
    Number(profile.years_of_experience || 0) > 0,
    Boolean(profile.services_offered?.length),
    !profile.is_vat_registered || Boolean(profile.vat_number?.trim()),
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function PractitionerOverview() {
  const { user, profile, hasStaffPermission } = useAuth();

  const { data: practitionerProfile } = useQuery({
    queryKey: ["practitioner-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select("*")
        .eq("profile_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as PractitionerProfile | null;
    },
    enabled: !!user,
  });

  const { data: directAssignedClients } = useQuery({
    queryKey: ["practitioner-overview-direct-clients", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, client_type, company_name, first_name, last_name, client_code, sars_outstanding_debt, returns_filed")
        .eq("assigned_consultant_id", user!.id);

      if (error) throw error;
      return (data ?? []) as ClientRecord[];
    },
    enabled: !!user,
  });

  const { data: assignedCases } = useQuery({
    queryKey: ["practitioner-overview-cases", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, client_id, case_title, case_type, status, priority, due_date, last_activity_at, clients(id, client_type, company_name, first_name, last_name, client_code, sars_outstanding_debt, returns_filed)")
        .eq("assigned_consultant_id", user!.id)
        .order("last_activity_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as CaseRecord[];
    },
    enabled: !!user,
  });

  const clientIds = useMemo(() => {
    const ids = new Set<string>();

    for (const client of directAssignedClients ?? []) {
      ids.add(client.id);
    }

    for (const caseItem of assignedCases ?? []) {
      ids.add(caseItem.client_id);
    }

    return Array.from(ids);
  }, [assignedCases, directAssignedClients]);

  const clientIdsKey = clientIds.join(",");

  const { data: documents } = useQuery({
    queryKey: ["practitioner-overview-documents", clientIdsKey],
    queryFn: async () => {
      if (!clientIds.length) return [] as DocumentRecord[];

      const { data, error } = await supabase
        .from("documents")
        .select("id, client_id, title, category, status, uploaded_at, rejection_reason")
        .in("client_id", clientIds)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as DocumentRecord[];
    },
    enabled: clientIds.length > 0,
  });

  const { data: documentRequests } = useQuery({
    queryKey: ["practitioner-overview-document-requests", clientIdsKey],
    queryFn: async () => {
      if (!clientIds.length) return [] as DocumentRequestRecord[];

      const { data, error } = await supabase
        .from("document_requests")
        .select("id, client_id, title, due_date, is_required, is_fulfilled")
        .in("client_id", clientIds);

      if (error) throw error;
      return (data ?? []) as DocumentRequestRecord[];
    },
    enabled: clientIds.length > 0,
  });

  const { data: invoices } = useQuery({
    queryKey: ["practitioner-overview-invoices", clientIdsKey],
    queryFn: async () => {
      if (!clientIds.length) return [] as InvoiceRecord[];

      const { data, error } = await supabase
        .from("invoices")
        .select("client_id, status, balance_due")
        .in("client_id", clientIds);

      if (error) throw error;
      return (data ?? []) as InvoiceRecord[];
    },
    enabled: clientIds.length > 0,
  });

  const { data: overviewLeads } = useQuery({
    queryKey: ["practitioner-overview-leads", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id, full_name, service_needed, service_needed_list, service_categories, priority_level, risk_indicator, status, assigned_practitioner_id, description, created_at")
        .neq("status", "closed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ServiceRequest[];
    },
    enabled: !!user,
  });

  const { data: responses } = useQuery({
    queryKey: ["practitioner-own-lead-responses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_responses")
        .select("*")
        .eq("practitioner_profile_id", user!.id);

      if (error) throw error;
      return (data ?? []) as ServiceRequestResponse[];
    },
    enabled: !!user,
  });

  const { data: accessRequests } = useQuery({
    queryKey: ["practitioner-overview-access-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_access_requests")
        .select("*")
        .eq("practitioner_profile_id", user!.id);

      if (error) throw error;
      return (data ?? []) as ServiceRequestAccessRequest[];
    },
    enabled: !!user,
  });

  const { data: creditAccount } = useQuery({
    queryKey: ["practitioner-credit-account", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_credit_accounts")
        .select("balance")
        .eq("profile_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as { balance: number } | null;
    },
    enabled: !!user,
  });

  const clientMap = useMemo(() => {
    const map = new Map<string, ClientRecord>();

    for (const client of directAssignedClients ?? []) {
      map.set(client.id, client);
    }

    for (const caseItem of assignedCases ?? []) {
      if (caseItem.clients && !map.has(caseItem.client_id)) {
        map.set(caseItem.client_id, caseItem.clients);
      }
    }

    return map;
  }, [assignedCases, directAssignedClients]);

  const responseMap = useMemo(
    () => new Map((responses ?? []).map((response) => [response.service_request_id, response])),
    [responses],
  );

  const accessRequestMap = useMemo(
    () => new Map((accessRequests ?? []).map((request) => [request.service_request_id, request])),
    [accessRequests],
  );

  const serviceLabelMap = useMemo(
    () => new Map(serviceNeededOptions.map((option) => [option.value, option.label])),
    [],
  );

  const resolveServiceList = (lead: ServiceRequest) => (
    lead.service_needed_list?.length
      ? lead.service_needed_list
      : lead.service_needed
        ? [lead.service_needed]
        : []
  );

  const formatServiceList = (services: Enums<"service_request_service_needed">[]) =>
    services.map((service) => serviceLabelMap.get(service) || formatServiceRequestLabel(service)).join(", ");

  const visibleLeads = useMemo(() => {
    const servicesOffered = new Set(practitionerProfile?.services_offered ?? []);

    return (overviewLeads ?? [])
      .filter((lead) => {
        const matchesService = servicesOffered.size === 0 || resolveServiceList(lead).some((service) => servicesOffered.has(service));
        const visibleToPractitioner =
          lead.assigned_practitioner_id === null
          || lead.assigned_practitioner_id === user?.id;

        return matchesService && visibleToPractitioner;
      })
      .slice(0, 5);
  }, [overviewLeads, practitionerProfile?.services_offered, user?.id]);

  const activeCases = useMemo(
    () => (assignedCases ?? []).filter((caseItem) => !["resolved", "closed"].includes(caseItem.status)),
    [assignedCases],
  );

  const completedCasesCount = useMemo(
    () => (assignedCases ?? []).filter((caseItem) => ["resolved", "closed"].includes(caseItem.status)).length,
    [assignedCases],
  );

  const pendingDocuments = useMemo(
    () => (documents ?? []).filter((document) => ["uploaded", "pending_review"].includes(document.status)),
    [documents],
  );

  const rejectedDocuments = useMemo(
    () => (documents ?? []).filter((document) => document.status === "rejected"),
    [documents],
  );

  const missingDocumentRequests = useMemo(
    () => (documentRequests ?? []).filter((request) => request.is_required && !request.is_fulfilled),
    [documentRequests],
  );

  const urgentCases = useMemo(() => {
    const now = Date.now();
    const threeDaysFromNow = now + (3 * 24 * 60 * 60 * 1000);

    return activeCases.filter((caseItem) => {
      if (caseItem.priority === 1) return true;
      if (!caseItem.due_date) return false;
      const due = new Date(caseItem.due_date).getTime();
      return Number.isFinite(due) && due <= threeDaysFromNow;
    });
  }, [activeCases]);

  const outstandingInvoicesByClient = useMemo(() => {
    const map = new Map<string, number>();

    for (const invoice of invoices ?? []) {
      const isOutstanding = ["issued", "partially_paid", "overdue"].includes(invoice.status) && Number(invoice.balance_due || 0) > 0;
      if (!isOutstanding) continue;
      map.set(invoice.client_id, (map.get(invoice.client_id) ?? 0) + 1);
    }

    return map;
  }, [invoices]);

  const outstandingRequestsByClient = useMemo(() => {
    const map = new Map<string, number>();

    for (const request of missingDocumentRequests) {
      map.set(request.client_id, (map.get(request.client_id) ?? 0) + 1);
    }

    return map;
  }, [missingDocumentRequests]);

  const highRiskClients = useMemo(() => {
    return Array.from(clientMap.values())
      .map((client) => {
        const summary = getClientWarningSummary(client, {
          outstandingInvoices: outstandingInvoicesByClient.get(client.id) ?? 0,
          outstandingDocumentRequests: outstandingRequestsByClient.get(client.id) ?? 0,
        });

        return { client, summary };
      })
      .filter(({ summary }) => summary.debtAmount > 0 || summary.issueCount >= 2);
  }, [clientMap, outstandingInvoicesByClient, outstandingRequestsByClient]);

  const leadsNeedingResponse = useMemo(
    () => visibleLeads.filter((lead) => !responseMap.has(lead.id)),
    [responseMap, visibleLeads],
  );

  const pendingTasksCount = useMemo(
    () => leadsNeedingResponse.length + pendingDocuments.length + missingDocumentRequests.length + rejectedDocuments.length + urgentCases.length,
    [leadsNeedingResponse.length, missingDocumentRequests.length, pendingDocuments.length, rejectedDocuments.length, urgentCases.length],
  );

  const alerts = useMemo(() => {
    const urgentCaseAlerts = urgentCases.map((caseItem) => ({
      id: `case-${caseItem.id}`,
      kind: "Urgent case",
      title: caseItem.case_title,
      description: `${getClientName(caseItem.clients)} | ${formatPriority(caseItem.priority)} priority`,
      href: "/dashboard/staff/cases",
      icon: ShieldAlert,
      tone: "border-red-200 bg-red-50 text-red-700",
    }));

    const missingDocumentAlerts = missingDocumentRequests.map((request) => ({
      id: `request-${request.id}`,
      kind: "Missing documents",
      title: request.title,
      description: `${getClientName(clientMap.get(request.client_id))}${request.due_date ? ` | Due ${new Date(request.due_date).toLocaleDateString()}` : ""}`,
      href: `/dashboard/staff/documents?practitionerId=${user?.id || ""}&documentState=outstanding`,
      icon: FileWarning,
      tone: "border-amber-200 bg-amber-50 text-amber-700",
    }));

    const rejectedFileAlerts = rejectedDocuments.map((document) => ({
      id: `document-${document.id}`,
      kind: "Rejected file",
      title: document.category || document.title,
      description: `${getClientName(clientMap.get(document.client_id))}${document.rejection_reason ? ` | ${document.rejection_reason}` : ""}`,
      href: `/dashboard/staff/documents?practitionerId=${user?.id || ""}&documentState=rejected`,
      icon: AlertTriangle,
      tone: "border-rose-200 bg-rose-50 text-rose-700",
    }));

    return [...urgentCaseAlerts, ...missingDocumentAlerts, ...rejectedFileAlerts].slice(0, 6);
  }, [clientMap, missingDocumentRequests, rejectedDocuments, urgentCases, user?.id]);

  const profileCompletion = useMemo(
    () => getProfileCompletion(practitionerProfile),
    [practitionerProfile],
  );

  const summaryCards = [
    {
      title: "Assigned Cases",
      value: activeCases.length,
      description: "Active matters you own today",
      icon: FolderOpen,
      href: "/dashboard/staff/cases",
      visible: hasStaffPermission("can_view_cases"),
    },
    {
      title: "New Leads",
      value: leadsNeedingResponse.length,
      description: "Open requests waiting for your reply",
      icon: ClipboardList,
      href: "/dashboard/staff/service-requests",
      visible: hasStaffPermission("can_view_clients"),
    },
    {
      title: "Pending Documents",
      value: pendingDocuments.length,
      description: "Uploads needing review or follow-up",
      icon: Upload,
      href: `/dashboard/staff/documents?practitionerId=${user?.id || ""}&documentState=outstanding`,
      visible: hasStaffPermission("can_view_documents"),
    },
    {
      title: "High-Risk Clients",
      value: highRiskClients.length,
      description: "Accounts with debt, returns, or billing pressure",
      icon: ShieldAlert,
      href: hasStaffPermission("can_view_clients") ? "/dashboard/staff/clients" : "/dashboard/staff/client-workspace",
      visible: hasStaffPermission("can_view_client_workspace") || hasStaffPermission("can_view_clients"),
    },
  ].filter((card) => card.visible);


  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-body">Practitioner Dashboard</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">
          Welcome back, {profile?.full_name?.split(/\s+/)[0] || "Practitioner"}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground font-body">
          Focus on the work queue for today: new leads, active matters, document issues, and client risks that need attention.
        </p>
        <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
          Credit Balance: {creditAccount?.balance ?? 0} Credits
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Link
            key={card.title}
            to={card.href}
            className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated"
          >
            <div className="flex items-center justify-between">
              <card.icon className="h-5 w-5 text-primary" />
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">{card.title}</p>
            <p className="mt-2 font-display text-3xl text-foreground">{card.value}</p>
            <p className="mt-2 text-sm text-muted-foreground font-body">{card.description}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-foreground">Recent Leads</h2>
              <p className="mt-2 text-sm text-muted-foreground font-body">
                Latest client requests matched to your marketplace visibility and service coverage.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/dashboard/staff/service-requests">Lead Inbox</Link>
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {visibleLeads.length ? (
              visibleLeads.map((lead) => {
                const hasResponse = responseMap.has(lead.id);
                const accessRequest = accessRequestMap.get(lead.id);
                const accessApproved = Boolean(hasResponse || accessRequest?.status === "approved");
                const displayName = accessApproved ? lead.full_name : "Hidden - Unlock to View";

                return (
                  <div key={lead.id} className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-body font-semibold text-foreground">{displayName}</p>
                          <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getServiceRequestStatusClass(lead.status)}`}>
                            {formatServiceRequestLabel(lead.status)}
                          </Badge>
                          <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getServiceRequestRiskClass(lead.risk_indicator)}`}>
                            {formatServiceRequestLabel(lead.risk_indicator)} risk
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground font-body">
                          {formatServiceList(resolveServiceList(lead))} | Priority {formatServiceRequestLabel(lead.priority_level)}
                        </p>
                        <p className="line-clamp-2 text-sm text-foreground font-body">{lead.description}</p>
                        <p className="text-xs text-muted-foreground font-body">
                          Submitted {new Date(lead.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-3">
                        <Button asChild className="rounded-xl">
                          <Link to={`/dashboard/staff/service-requests?leadId=${lead.id}&action=respond`}>
                            {hasResponse ? "Update Response" : "Unlock to View & Respond (Use Credits)"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground font-body">
                No current leads are visible yet.
              </div>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <WebPushPrompt profileLink="/dashboard/staff/profile" />

          <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-2xl text-foreground">Workload Summary</h2>
            <p className="mt-2 text-sm text-muted-foreground font-body">A quick view of what is on your plate.</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Active Cases</p>
                <p className="mt-2 font-display text-2xl text-foreground">{activeCases.length}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Pending Tasks</p>
                <p className="mt-2 font-display text-2xl text-foreground">{pendingTasksCount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Completed Cases</p>
                <p className="mt-2 font-display text-2xl text-foreground">{completedCasesCount}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-foreground">Profile Status</h2>
                <p className="mt-2 text-sm text-muted-foreground font-body">Keep your marketplace setup healthy and current.</p>
              </div>
              <Badge className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {profileCompletion}% complete
              </Badge>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-accent/20 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Verification</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {practitionerProfile?.is_verified ? "Verified practitioner" : "Pending verification"}
                  </p>
                </div>
                <BadgeCheck className="h-5 w-5 text-primary" />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border bg-accent/20 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Availability</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {formatAvailabilityLabel(practitionerProfile?.availability_status)}
                  </p>
                </div>
                <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getAvailabilityBadgeClass(practitionerProfile?.availability_status)}`}>
                  {practitionerProfile?.is_verified ? "Verified" : "Pending"}
                </Badge>
              </div>

              <Button asChild variant="outline" className="w-full rounded-xl">
                <Link to="/dashboard/staff/profile">Go to My Profile</Link>
              </Button>
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-foreground">My Active Cases</h2>
              <p className="mt-2 text-sm text-muted-foreground font-body">Assigned client matters that need progress today.</p>
            </div>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/dashboard/staff/cases">View Cases</Link>
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {activeCases.length ? (
              activeCases.slice(0, 5).map((caseItem) => (
                <div key={caseItem.id} className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-body font-semibold text-foreground">{caseItem.case_title}</p>
                      <p className="mt-1 text-sm text-muted-foreground font-body">
                        {getClientName(caseItem.clients)} | {formatCaseType(caseItem.case_type)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground font-body">
                        Priority {formatPriority(caseItem.priority)}
                        {caseItem.due_date ? ` | Due ${new Date(caseItem.due_date).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getCaseStatusClass(caseItem.status)}`}>
                      {formatServiceRequestLabel(caseItem.status)}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground font-body">
                No active cases are assigned to you yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
          <h2 className="font-display text-2xl text-foreground">Alerts & Warnings</h2>
          <p className="mt-2 text-sm text-muted-foreground font-body">Missing documents, rejected files, and urgent matters that need attention.</p>

          <div className="mt-5 space-y-3">
            {alerts.length ? (
              alerts.map((alert) => (
                <Link
                  key={alert.id}
                  to={alert.href}
                  className="block rounded-2xl border border-border bg-background/60 p-4 transition-all hover:border-primary/30"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${alert.tone}`}>
                      <alert.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-body font-semibold text-foreground">{alert.title}</p>
                        <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${alert.tone}`}>
                          {alert.kind}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground font-body">{alert.description}</p>
                    </div>
                    <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground font-body">
                No urgent warnings are active right now.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
