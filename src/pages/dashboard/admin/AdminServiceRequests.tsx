import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, ExternalLink, File, FileText, Image, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import PractitionerLeads from "./PractitionerLeads";
import {
  formatServiceRequestLabel,
  getServiceRequestIssueFlags,
  serviceRequestPriorityOptions,
  getServiceRequestRiskClass,
  getServiceRequestStatusClass,
  serviceRequestStatusOptions,
  serviceNeededOptions,
} from "@/lib/serviceRequests";
import { formatAvailabilityLabel, getAvailabilityBadgeClass, getAssignmentTypeLabel, getResponseStatusClass } from "@/lib/practitionerMarketplace";

type ServiceRequestRecord = Tables<"service_requests">;
type ServiceRequestDocument = Tables<"service_request_documents">;
type ServiceRequestResponse = Tables<"service_request_responses">;
type ServiceRequestAssignmentHistory = Tables<"service_request_assignment_history">;
type PractitionerProfile = Tables<"practitioner_profiles">;
type PractitionerUser = Tables<"profiles">;

export default function AdminServiceRequests() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [clientTypeFilter, setClientTypeFilter] = useState<string>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all");
  const [issueFilter, setIssueFilter] = useState<string>("all");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [assigningRequestId, setAssigningRequestId] = useState<string | null>(null);
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<string>("");
  const [convertingRequestId, setConvertingRequestId] = useState<string | null>(null);

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

  const practitionerMap = useMemo(
    () => new Map((practitioners ?? []).map((practitioner) => [practitioner.user.id, practitioner])),
    [practitioners],
  );

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

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return (requests ?? []).filter((request) => {
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
      const matchesSearch = !normalizedSearch || [
        request.full_name,
        request.email,
        request.phone,
        request.id_number || "",
        formatServiceRequestLabel(request.identity_document_type),
        assignedPractitionerName,
        formatServiceRequestLabel(request.service_needed),
        formatServiceRequestLabel(request.status),
        formatServiceRequestLabel(request.priority_level),
        formatServiceRequestLabel(request.client_type),
        formatServiceRequestLabel(request.risk_indicator),
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesService = serviceFilter === "all" || request.service_needed === serviceFilter;
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
    requests,
    responsesByRequest,
    riskFilter,
    searchQuery,
    serviceFilter,
    statusFilter,
  ]);

  const selectedRequest = (requests ?? []).find((request) => request.id === selectedRequestId) ?? null;
  const selectedDocuments = selectedRequest ? documentMap.get(selectedRequest.id) ?? [] : [];
  const selectedResponses = selectedRequest ? responsesByRequest.get(selectedRequest.id) ?? [] : [];
  const selectedAssignments = selectedRequest ? assignmentHistoryByRequest.get(selectedRequest.id) ?? [] : [];

  useEffect(() => {
    setSelectedPractitionerId(selectedRequest?.assigned_practitioner_id ?? "");
  }, [selectedRequest?.assigned_practitioner_id]);

  const requestMetrics = useMemo(() => {
    const rows = requests ?? [];

    return {
      total: rows.length,
      open: rows.filter((request) => request.status !== "closed").length,
      highRisk: rows.filter((request) => request.risk_indicator === "high").length,
      assigned: rows.filter((request) => request.status === "assigned").length,
    };
  }, [requests]);

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
    setUpdatingStatus(requestId);

    const timestamp = new Date().toISOString();
    const updates: Tables<"service_requests">["Update"] & Record<string, string | null> = {
      status,
    };

    if (status === "viewed") updates.viewed_at = timestamp;
    if (status === "responded") updates.responded_at = timestamp;
    if (status === "assigned") updates.assigned_at = timestamp;
    if (status === "closed") updates.closed_at = timestamp;

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

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Service Requests</h1>
          <p className="text-muted-foreground font-body text-sm">Manage public tax-assistance requests and assess their risk before assignment.</p>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-card">
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
            Showing <span className="font-semibold text-foreground">{filteredRequests.length}</span> of <span className="font-semibold text-foreground">{requests?.length ?? 0}</span> requests
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

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Total Requests</p>
          <p className="font-display text-3xl text-foreground">{requestMetrics.total}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Open Leads</p>
          <p className="font-display text-3xl text-foreground">{requestMetrics.open}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">High Risk</p>
          <p className="font-display text-3xl text-red-700">{requestMetrics.highRisk}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Assigned</p>
          <p className="font-display text-3xl text-foreground">{requestMetrics.assigned}</p>
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
                      <Badge variant="outline" className={getServiceRequestRiskClass(request.risk_indicator)}>
                        {formatServiceRequestLabel(request.risk_indicator)} Risk
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground font-body">
                      {request.email} | {request.phone}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground font-body">
                      {formatServiceRequestLabel(request.client_type)} | {formatServiceRequestLabel(request.service_needed)} | Priority {formatServiceRequestLabel(request.priority_level)}
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
        }}
        title={selectedRequest?.full_name || "Service Request"}
        description="Review request details, issue flags, uploaded documents, and lead status."
      >
        {selectedRequest ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Request Type</p>
                <p className="font-body text-foreground">{formatServiceRequestLabel(selectedRequest.service_needed)}</p>
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
            </div>

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
                <p className="whitespace-pre-wrap font-body text-foreground">{selectedRequest.description}</p>
              </div>
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
                          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground font-body">{response.introduction_message}</p>
                          {response.service_pitch ? (
                            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground font-body">{response.service_pitch}</p>
                          ) : null}
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
    </div>
  );
}
