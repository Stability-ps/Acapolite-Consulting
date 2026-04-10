import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useClientRecord } from "@/hooks/useClientRecord";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { RatingStars } from "@/components/dashboard/RatingStars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { serviceNeededOptions, formatServiceRequestLabel, getServiceRequestRiskClass, getServiceRequestStatusClass } from "@/lib/serviceRequests";
import { formatAvailabilityLabel, getAvailabilityBadgeClass, getResponseStatusClass } from "@/lib/practitionerMarketplace";
import { sendPractitionerAssignmentNotification } from "@/lib/practitionerAssignments";

type ServiceRequest = Tables<"service_requests">;
type ServiceRequestResponse = Tables<"service_request_responses">;
type PractitionerProfile = Tables<"practitioner_profiles">;
type Profile = Tables<"profiles">;
type PractitionerReview = Tables<"practitioner_reviews">;

export default function ClientServiceRequests() {
  const { user } = useAuth();
  const { data: client } = useClientRecord();
  const queryClient = useQueryClient();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectingResponseId, setSelectingResponseId] = useState<string | null>(null);

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

  const practitionerIds = useMemo(
    () => Array.from(new Set((responses ?? []).map((response) => response.practitioner_profile_id))),
    [responses],
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

  const selectedRequest = (requests ?? []).find((request) => request.id === selectedRequestId) ?? null;
  const selectedResponses = selectedRequest ? responsesByRequest.get(selectedRequest.id) ?? [] : [];

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
        caseType: serviceNeededOptions.find((item) => item.value === selectedRequest.service_needed)?.label || selectedRequest.service_needed,
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
                        {serviceNeededOptions.find((item) => item.value === request.service_needed)?.label || request.service_needed}
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
        title={selectedRequest ? serviceNeededOptions.find((item) => item.value === selectedRequest.service_needed)?.label || "Service Request" : "Service Request"}
        description="Review responses and choose the practitioner you want Acapolite to assign to your case."
      >
        {selectedRequest ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Request Summary</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground font-body">{selectedRequest.description}</p>
            </div>

            <div className="space-y-4">
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

                      <div className="lg:min-w-[220px]">
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
    </div>
  );
}
