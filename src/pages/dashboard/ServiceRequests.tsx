import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, CheckCircle2, Clock, Flag } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useClientRecord } from "@/hooks/useClientRecord";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { RatingStars } from "@/components/dashboard/RatingStars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { serviceCategoryOptions, serviceNeededOptions, formatServiceRequestLabel, getServiceRequestRiskClass, getServiceRequestStatusClass } from "@/lib/serviceRequests";
import { formatAvailabilityLabel, getAvailabilityBadgeClass, getResponseStatusClass } from "@/lib/practitionerMarketplace";
import { sendPractitionerAssignmentNotification } from "@/lib/practitionerAssignments";

type ServiceRequest = Tables<"service_requests">;
type ServiceRequestResponse = Tables<"service_request_responses">;
type PractitionerProfile = Tables<"practitioner_profiles">;
type Profile = Tables<"profiles">;
type PractitionerReview = Tables<"practitioner_reviews">;
type ServiceRequestAccessRequest = Tables<"service_request_access_requests">;

export default function ClientServiceRequests() {
  const { user } = useAuth();
  const { data: client } = useClientRecord();
  const queryClient = useQueryClient();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectingResponseId, setSelectingResponseId] = useState<string | null>(null);
  const [respondingAccessId, setRespondingAccessId] = useState<string | null>(null);
  const [showProfileId, setShowProfileId] = useState<string | null>(null);
  const [reportPractitionerId, setReportPractitionerId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("poor_communication");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [isChangePractitionerOpen, setIsChangePractitionerOpen] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [changingPractitioner, setChangingPractitioner] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["client-service-requests", user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("email", user!.email!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ServiceRequest[];
    },
    enabled: !!user?.email,
  });

  const requestIds = useMemo(() => (requests ?? []).map((request) => request.id), [requests]);

  const { data: responses } = useQuery({
    queryKey: ["client-service-request-responses", requestIds],
    queryFn: async () => {
      if (!requestIds.length) return [] as ServiceRequestResponse[];

      const { data, error } = await supabase
        .from("service_request_responses")
        .select("*")
        .in("service_request_id", requestIds)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ServiceRequestResponse[];
    },
    enabled: requestIds.length > 0,
  });

  const { data: accessRequests } = useQuery({
    queryKey: ["client-service-request-access-requests", requestIds],
    queryFn: async () => {
      if (!requestIds.length) return [] as ServiceRequestAccessRequest[];

      const { data, error } = await supabase
        .from("service_request_access_requests")
        .select("*")
        .in("service_request_id", requestIds)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ServiceRequestAccessRequest[];
    },
    enabled: requestIds.length > 0,
  });

  const practitionerIds = useMemo(
    () => Array.from(new Set([
      ...(responses ?? []).map((response) => response.practitioner_profile_id),
      ...(accessRequests ?? []).map((request) => request.practitioner_profile_id),
    ])),
    [accessRequests, responses],
  );
  const practitionerIdsKey = practitionerIds.join(",");

  const { data: practitionerProfiles } = useQuery({
    queryKey: ["client-practitioner-profiles", practitionerIds],
    queryFn: async () => {
      if (!practitionerIds.length) return [] as PractitionerProfile[];

      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select("*")
        .in("profile_id", practitionerIds);

      if (error) throw error;
      return (data ?? []) as PractitionerProfile[];
    },
    enabled: practitionerIds.length > 0,
  });

  const { data: practitionerUsers } = useQuery({
    queryKey: ["client-practitioner-users", practitionerIds],
    queryFn: async () => {
      if (!practitionerIds.length) return [] as Profile[];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, avatar_url, is_active, created_at, updated_at")
        .in("id", practitionerIds);

      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: practitionerIds.length > 0,
  });

  const { data: practitionerReviews } = useQuery({
    queryKey: ["client-practitioner-reviews", practitionerIdsKey],
    queryFn: async () => {
      if (!practitionerIds.length) return [] as PractitionerReview[];

      const { data, error } = await supabase
        .from("practitioner_reviews")
        .select("practitioner_profile_id, rating")
        .in("practitioner_profile_id", practitionerIds);

      if (error) throw error;
      return (data ?? []) as PractitionerReview[];
    },
    enabled: practitionerIds.length > 0,
  });

  const responsesByRequest = useMemo(() => {
    const map = new Map<string, ServiceRequestResponse[]>();

    for (const response of responses ?? []) {
      const current = map.get(response.service_request_id) ?? [];
      current.push(response);
      map.set(response.service_request_id, current);
    }

    return map;
  }, [responses]);

  const accessRequestsByRequest = useMemo(() => {
    const map = new Map<string, ServiceRequestAccessRequest[]>();

    for (const request of accessRequests ?? []) {
      const current = map.get(request.service_request_id) ?? [];
      current.push(request);
      map.set(request.service_request_id, current);
    }

    return map;
  }, [accessRequests]);

  const practitionerProfileMap = useMemo(
    () => new Map((practitionerProfiles ?? []).map((profile) => [profile.profile_id, profile])),
    [practitionerProfiles],
  );

  const practitionerUserMap = useMemo(
    () => new Map((practitionerUsers ?? []).map((profile) => [profile.id, profile])),
    [practitionerUsers],
  );
  const practitionerRatingSummaryMap = useMemo(() => {
    const accumulator = new Map<string, { total: number; count: number }>();

    for (const review of practitionerReviews ?? []) {
      const current = accumulator.get(review.practitioner_profile_id) ?? { total: 0, count: 0 };
      current.total += review.rating;
      current.count += 1;
      accumulator.set(review.practitioner_profile_id, current);
    }

    return new Map(
      Array.from(accumulator.entries()).map(([practitionerId, summary]) => [
        practitionerId,
        {
          average: summary.count ? summary.total / summary.count : 0,
          count: summary.count,
        },
      ]),
    );
  }, [practitionerReviews]);

  const serviceLabelMap = useMemo(
    () => new Map(serviceNeededOptions.map((option) => [option.value, option.label])),
    [],
  );

  const categoryLabelMap = useMemo(
    () => new Map(serviceCategoryOptions.map((option) => [option.value, option.label])),
    [],
  );

  const resolveServiceList = (request: ServiceRequest) => (
    request.service_needed_list?.length
      ? request.service_needed_list
      : request.service_needed
        ? [request.service_needed]
        : []
  );

  const resolveCategoryList = (request: ServiceRequest) => (
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

  const selectedRequest = (requests ?? []).find((request) => request.id === selectedRequestId) ?? null;
  const selectedResponses = selectedRequest ? responsesByRequest.get(selectedRequest.id) ?? [] : [];
  const selectedServiceLabel = selectedRequest
    ? formatServiceList(resolveServiceList(selectedRequest))
    : null;
  const selectedCategoryLabel = selectedRequest
    ? formatCategoryList(resolveCategoryList(selectedRequest))
    : null;
  const formattedSubmittedAt = selectedRequest?.created_at
    ? new Date(selectedRequest.created_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })
    : "N/A";
  const changeWindowHours = 24;
  const changeWindowMs = changeWindowHours * 60 * 60 * 1000;
  const canChangePractitioner = Boolean(
    selectedRequest?.assigned_practitioner_id
    && selectedRequest?.assigned_at
    && Date.now() - new Date(selectedRequest.assigned_at).getTime() <= changeWindowMs,
  );
  const changeWindowLabel = selectedRequest?.assigned_at
    ? new Date(new Date(selectedRequest.assigned_at).getTime() + changeWindowMs).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })
    : null;

  const responseTimeLabel = (profile?: PractitionerProfile | null) => {
    if (!profile?.availability_status) return "Responds within 24 hours";
    if (profile.availability_status === "available") return "Responds within 2 hours";
    if (profile.availability_status === "limited") return "Responds within 24 hours";
    return "Responds within 48 hours";
  };

  const selectPractitioner = async (responseId: string) => {
    if (!client) {
      toast.error("You need an active client portal profile before selecting a practitioner.");
      return;
    }

    const selectedResponse = (responses ?? []).find((response) => response.id === responseId);
    const selectedRequest = (requests ?? []).find((request) => request.id === selectedResponse?.service_request_id);

    setSelectingResponseId(responseId);
    const { data, error } = await supabase.rpc("accept_service_request_response", {
      p_response_id: responseId,
    });
    setSelectingResponseId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Practitioner selected and case created successfully.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["client-service-requests", user?.email] }),
      queryClient.invalidateQueries({ queryKey: ["client-service-request-responses", requestIds] }),
      queryClient.invalidateQueries({ queryKey: ["overview-active-cases", client.id] }),
    ]);

    if (data && selectedResponse && selectedRequest) {
      const practitionerUser = practitionerUserMap.get(selectedResponse.practitioner_profile_id);
      const practitionerProfile = practitionerProfileMap.get(selectedResponse.practitioner_profile_id);

      const notificationResult = await sendPractitionerAssignmentNotification({
        caseId: data,
        practitionerProfileId: selectedResponse.practitioner_profile_id,
        practitionerEmail: practitionerUser?.email,
        practitionerName: practitionerUser?.full_name || practitionerProfile?.business_name || "Practitioner",
        clientName: client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || selectedRequest.full_name,
        caseType: formatServiceList(resolveServiceList(selectedRequest)),
        priority: selectedRequest.priority_level === "urgent" || selectedRequest.priority_level === "high"
          ? 1
          : selectedRequest.priority_level === "low"
            ? 3
            : 2,
      });

      if (notificationResult.error) {
        console.error("Practitioner assignment notification failed.", notificationResult.error);
      }
    }

    if (data) {
      window.location.assign("/dashboard/client/cases");
    }
  };

  const respondToAccessRequest = async (accessRequestId: string, action: "approve" | "decline") => {
    setRespondingAccessId(accessRequestId);
    const { error } = await supabase.rpc("respond_to_service_request_access", {
      p_access_request_id: accessRequestId,
      p_action: action,
    });
    setRespondingAccessId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(action === "approve" ? "Access approved." : "Access declined.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["client-service-request-access-requests", requestIds] }),
      queryClient.invalidateQueries({ queryKey: ["client-service-request-responses", requestIds] }),
    ]);
  };

  const submitPractitionerReport = async () => {
    if (!selectedRequest || !user?.id || !reportPractitionerId) {
      return;
    }

    if (!reportReason) {
      toast.error("Select a report reason first.");
      return;
    }

    setSubmittingReport(true);
    const { error } = await supabase.from("practitioner_reports").insert({
      service_request_id: selectedRequest.id,
      practitioner_profile_id: reportPractitionerId,
      client_profile_id: user.id,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });
    setSubmittingReport(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Report submitted. Our admin team will review it.");
    setReportPractitionerId(null);
    setReportReason("poor_communication");
    setReportDetails("");
  };

  const requestPractitionerChange = async () => {
    if (!selectedRequest) return;

    setChangingPractitioner(true);
    const { error } = await supabase.rpc("request_practitioner_change", {
      p_request_id: selectedRequest.id,
      p_reason: changeReason.trim() || null,
    });
    setChangingPractitioner(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Practitioner unassigned. You can now select another response.");
    setIsChangePractitionerOpen(false);
    setChangeReason("");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["client-service-requests", user?.email] }),
      queryClient.invalidateQueries({ queryKey: ["client-service-request-responses", requestIds] }),
    ]);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-body">Marketplace Requests</p>
            <h1 className="mt-2 font-display text-3xl text-foreground">My Service Requests</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground font-body">
              Track tax assistance requests you submitted, review practitioner responses, and select the practitioner you want to work with.
            </p>
          </div>

          <Button asChild className="rounded-xl">
            <Link to="/request-tax-assistance" state={{ fromPortal: true, fromPath: "/dashboard/client/requests" }}>
              New Service Request
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {!client ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <p className="text-sm text-muted-foreground font-body">
            You can view responses once your client portal record is ready. If your account was created after submitting a public request,
            make sure you are signed in with the same email used on the request form.
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground font-body">
          Loading your requests...
        </div>
      ) : (requests ?? []).length ? (
        <div className="space-y-4">
          {(requests ?? []).map((request) => {
            const responseCount = (responsesByRequest.get(request.id) ?? []).length;

            return (
              <button
                key={request.id}
                type="button"
                onClick={() => setSelectedRequestId(request.id)}
                className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:border-primary/30 hover:shadow-elevated"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl text-foreground">
                        {formatServiceList(resolveServiceList(request))}
                      </h2>
                      <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getServiceRequestStatusClass(request.status)}`}>
                        {formatServiceRequestLabel(request.status)}
                      </Badge>
                      <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getServiceRequestRiskClass(request.risk_indicator)}`}>
                        {formatServiceRequestLabel(request.risk_indicator)} risk
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-body">{request.description}</p>
                  </div>
                  <div className="text-sm text-muted-foreground font-body">
                    {responseCount} practitioner response{responseCount === 1 ? "" : "s"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-card">
          <p className="text-sm text-muted-foreground font-body">
            No service requests are linked to this email yet.
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link to="/request-tax-assistance" state={{ fromPortal: true, fromPath: "/dashboard/client/requests" }}>
              Submit a Request
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      <DashboardItemDialog
        open={!!selectedRequest}
        onOpenChange={(open) => setSelectedRequestId(open ? selectedRequestId : null)}
        title={selectedServiceLabel || "Service Request"}
        description="Review responses and choose the practitioner you want Acapolite to assign to your case."
      >
        {selectedRequest ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Request Details</p>
              <div className="mt-4 grid gap-3 text-sm text-foreground font-body sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Request ID</p>
                  <p className="mt-1 font-mono text-xs">{selectedRequest.id}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Submitted</p>
                  <p className="mt-1">{formattedSubmittedAt}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Service Category</p>
                  <p className="mt-1">{selectedCategoryLabel || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Service Needed</p>
                  <p className="mt-1">{selectedServiceLabel || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                  <p className="mt-1">{formatServiceRequestLabel(selectedRequest.status)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Priority</p>
                  <p className="mt-1">{formatServiceRequestLabel(selectedRequest.priority_level)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Risk</p>
                  <p className="mt-1">{formatServiceRequestLabel(selectedRequest.risk_indicator)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Client Type</p>
                  <p className="mt-1">{formatServiceRequestLabel(selectedRequest.client_type)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Contact Email</p>
                  <p className="mt-1">{selectedRequest.email}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Contact Phone</p>
                  <p className="mt-1">{selectedRequest.phone}</p>
                </div>
                {selectedRequest.client_type === "individual" ? (
                  <>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">ID Type</p>
                      <p className="mt-1">{formatServiceRequestLabel(selectedRequest.identity_document_type || "id_number")}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">ID Number</p>
                      <p className="mt-1">{selectedRequest.id_number || "Not provided"}</p>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Company Registration</p>
                    <p className="mt-1">{selectedRequest.company_registration_number || "Not provided"}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">SARS Debt Amount</p>
                  <p className="mt-1">R {selectedRequest.sars_debt_amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Returns Filed</p>
                  <p className="mt-1">{selectedRequest.returns_filed ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Debt Flag</p>
                  <p className="mt-1">{selectedRequest.has_debt_flag ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Missing Returns</p>
                  <p className="mt-1">{selectedRequest.missing_returns_flag ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Missing Documents</p>
                  <p className="mt-1">{selectedRequest.missing_documents_flag ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Request Summary</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground font-body">{selectedRequest.description}</p>
            </div>

            <div className="rounded-2xl border border-border bg-accent/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Messaging Policy</p>
              <p className="mt-2 text-sm text-muted-foreground font-body">
                Please keep all communication inside the Acapolite portal. This protects your case history and helps resolve disputes quickly.
              </p>
            </div>

            {selectedRequest.selected_response_id ? (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Assignment Controls</p>
                    <p className="mt-2 text-sm text-muted-foreground font-body">
                      You can change practitioners within {changeWindowHours} hours of assignment, before major work begins.
                    </p>
                    {changeWindowLabel ? (
                      <p className="mt-1 text-xs text-muted-foreground font-body">
                        Change window ends {changeWindowLabel}.
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setIsChangePractitionerOpen(true)}
                    disabled={!canChangePractitioner}
                  >
                    Change Practitioner
                  </Button>
                </div>
                {!canChangePractitioner ? (
                  <p className="mt-3 text-xs text-muted-foreground font-body">
                    This request is past the change window or already in progress. Contact support if you still need help.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-4">
              {(accessRequestsByRequest.get(selectedRequest.id) ?? []).length ? (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Access Requests</p>
                  <div className="mt-4 space-y-3">
                    {(accessRequestsByRequest.get(selectedRequest.id) ?? []).map((accessRequest) => {
                      const practitionerProfile = practitionerProfileMap.get(accessRequest.practitioner_profile_id);
                      const practitionerUser = practitionerUserMap.get(accessRequest.practitioner_profile_id);
                      const statusLabel = formatServiceRequestLabel(accessRequest.status);

                      return (
                        <div key={accessRequest.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-body font-semibold text-foreground">
                              {practitionerUser?.full_name || practitionerProfile?.business_name || "Practitioner"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground font-body">
                              Status: {statusLabel}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {accessRequest.status === "pending" ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-xl"
                                  disabled={respondingAccessId === accessRequest.id}
                                  onClick={() => void respondToAccessRequest(accessRequest.id, "decline")}
                                >
                                  {respondingAccessId === accessRequest.id ? "Processing..." : "Decline"}
                                </Button>
                                <Button
                                  type="button"
                                  className="rounded-xl"
                                  disabled={respondingAccessId === accessRequest.id}
                                  onClick={() => void respondToAccessRequest(accessRequest.id, "approve")}
                                >
                                  {respondingAccessId === accessRequest.id ? "Processing..." : "Approve"}
                                </Button>
                              </>
                            ) : (
                              <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${accessRequest.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                                {statusLabel}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {selectedResponses.length ? selectedResponses.map((response) => {
                const practitionerProfile = practitionerProfileMap.get(response.practitioner_profile_id);
                const practitionerUser = practitionerUserMap.get(response.practitioner_profile_id);
                const ratingSummary = practitionerRatingSummaryMap.get(response.practitioner_profile_id);
                const isSelected = selectedRequest.selected_response_id === response.id;

                return (
                  <div key={response.id} className="rounded-[24px] border border-border bg-background/70 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-xl text-foreground">
                            {practitionerUser?.full_name || practitionerProfile?.business_name || "Practitioner"}
                          </h3>
                          {practitionerProfile?.is_verified ? (
                            <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                              Verified Practitioner
                            </Badge>
                          ) : null}
                          <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getAvailabilityBadgeClass(practitionerProfile?.availability_status)}`}>
                            {formatAvailabilityLabel(practitionerProfile?.availability_status)}
                          </Badge>
                          <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getResponseStatusClass(response.response_status)}`}>
                            {formatServiceRequestLabel(response.response_status)}
                          </Badge>
                          {isSelected ? (
                            <Badge className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                              Selected
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground font-body">
                          <span className="inline-flex items-center gap-2">
                            <BriefcaseBusiness className="h-4 w-4" />
                            {practitionerProfile?.business_name || "Independent Practitioner"}
                          </span>
                          <span>{practitionerProfile?.years_of_experience ?? 0} years experience</span>
                          <span className="inline-flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {responseTimeLabel(practitionerProfile)}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <RatingStars value={ratingSummary?.average ?? 0} readOnly className="gap-0.5" />
                            {ratingSummary?.count
                              ? `${ratingSummary.average.toFixed(1)} (${ratingSummary.count} review${ratingSummary.count === 1 ? "" : "s"})`
                              : "No reviews yet"}
                          </span>
                        </div>

                        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground font-body">
                          {response.introduction_message}
                        </p>

                        {response.service_pitch ? (
                          <div className="rounded-2xl border border-border bg-card p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Service Pitch</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground font-body">{response.service_pitch}</p>
                          </div>
                        ) : null}

                        {(practitionerProfile?.services_offered ?? []).length ? (
                          <div className="flex flex-wrap gap-2">
                            {(practitionerProfile?.services_offered ?? []).map((service) => (
                              <Badge key={service} className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                                {serviceNeededOptions.find((item) => item.value === service)?.label || service}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="lg:min-w-[220px] space-y-3">
                        <Button
                          type="button"
                          className="w-full rounded-xl"
                          disabled={!!selectedRequest.selected_response_id || selectingResponseId === response.id}
                          onClick={() => void selectPractitioner(response.id)}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Practitioner Selected
                            </>
                          ) : selectingResponseId === response.id ? "Selecting..." : "Select Practitioner"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full rounded-xl"
                          onClick={() => setShowProfileId(response.practitioner_profile_id)}
                        >
                          View Full Profile
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full rounded-xl text-rose-600 hover:text-rose-600"
                          onClick={() => setReportPractitionerId(response.practitioner_profile_id)}
                        >
                          <Flag className="mr-2 h-4 w-4" />
                          Report Practitioner
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground font-body">
                  No practitioner responses have been submitted for this request yet.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>

      <DashboardItemDialog
        open={!!showProfileId}
        onOpenChange={(open) => setShowProfileId(open ? showProfileId : null)}
        title="Practitioner Profile"
        description="Review credentials, services, and verification details."
      >
        {showProfileId ? (() => {
          const practitionerProfile = practitionerProfileMap.get(showProfileId);
          const practitionerUser = practitionerUserMap.get(showProfileId);
          const ratingSummary = practitionerRatingSummaryMap.get(showProfileId);

          return (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Practitioner</p>
                    <h3 className="mt-2 font-display text-2xl text-foreground">
                      {practitionerUser?.full_name || practitionerProfile?.business_name || "Practitioner"}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground font-body">
                      {practitionerProfile?.business_name || "Independent Practitioner"}
                    </p>
                  </div>
                  <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${practitionerProfile?.is_verified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                    {practitionerProfile?.is_verified ? "Verified" : "Verification Pending"}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-accent/20 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Experience</p>
                  <p className="mt-2 text-sm text-foreground font-body">{practitionerProfile?.years_of_experience ?? 0} years</p>
                </div>
                <div className="rounded-2xl border border-border bg-accent/20 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Typical Response</p>
                  <p className="mt-2 text-sm text-foreground font-body">{responseTimeLabel(practitionerProfile)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-accent/20 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Professional Body</p>
                  <p className="mt-2 text-sm text-foreground font-body">{practitionerProfile?.professional_body || "Not specified"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-accent/20 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Location</p>
                  <p className="mt-2 text-sm text-foreground font-body">
                    {[practitionerProfile?.city, practitionerProfile?.province].filter(Boolean).join(", ") || "Not specified"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Credentials & Verification</p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground font-body">
                  <p>Verification status: {practitionerProfile?.verification_status || "pending"}</p>
                  <p>Tax practitioner number: {practitionerProfile?.tax_practitioner_number || "On file with admin"}</p>
                  <div className="flex items-center gap-2 text-foreground">
                    <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    {practitionerProfile?.is_verified ? "Verified documents and credentials" : "Verification in progress"}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Services Offered</p>
                {(practitionerProfile?.services_offered ?? []).length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(practitionerProfile?.services_offered ?? []).map((service) => (
                      <Badge key={service} className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        {serviceNeededOptions.find((item) => item.value === service)?.label || service}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground font-body">No services listed.</p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Client Ratings</p>
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground font-body">
                  <RatingStars value={ratingSummary?.average ?? 0} readOnly className="gap-0.5" />
                  {ratingSummary?.count
                    ? `${ratingSummary.average.toFixed(1)} (${ratingSummary.count} review${ratingSummary.count === 1 ? "" : "s"})`
                    : "No reviews yet"}
                </div>
              </div>
            </div>
          );
        })() : null}
      </DashboardItemDialog>

      <DashboardItemDialog
        open={!!reportPractitionerId}
        onOpenChange={(open) => setReportPractitionerId(open ? reportPractitionerId : null)}
        title="Report Practitioner"
        description="Tell us what went wrong so we can review the practitioner for compliance."
      >
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground font-body">Reason</label>
            <Select value={reportReason} onValueChange={setReportReason}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="poor_communication">Poor communication</SelectItem>
                <SelectItem value="unprofessional_behavior">Unprofessional behavior</SelectItem>
                <SelectItem value="suspicious_behavior">Suspicious or dishonest behavior</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground font-body">Details</label>
            <Textarea
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
              placeholder="Share any details or dates that will help the admin team investigate."
              className="min-h-[120px] rounded-xl"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setReportPractitionerId(null)} disabled={submittingReport}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={submitPractitionerReport} disabled={submittingReport}>
              {submittingReport ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </div>
      </DashboardItemDialog>

      <DashboardItemDialog
        open={isChangePractitionerOpen}
        onOpenChange={setIsChangePractitionerOpen}
        title="Change Practitioner"
        description="Confirm that you want to unassign the current practitioner and return this request to the marketplace."
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-accent/20 p-4">
            <p className="text-sm text-muted-foreground font-body">
              This will remove the current practitioner and reopen the request so you can select another response. Please share a brief reason for the change.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground font-body">Reason (optional)</label>
            <Input
              value={changeReason}
              onChange={(event) => setChangeReason(event.target.value)}
              placeholder="Example: Need a faster response time"
              className="rounded-xl"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsChangePractitionerOpen(false)} disabled={changingPractitioner}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={requestPractitionerChange} disabled={changingPractitioner || !canChangePractitioner}>
              {changingPractitioner ? "Processing..." : "Confirm Change"}
            </Button>
          </div>
        </div>
      </DashboardItemDialog>
    </div>
  );
}
