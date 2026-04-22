import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, ExternalLink, Search, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Tables, Enums } from "@/integrations/supabase/types";
import {
  formatServiceRequestLabel,
  getServiceRequestIssueFlags,
  getServiceRequestRiskClass,
  getServiceRequestStatusClass,
  serviceCategoryOptions,
  serviceNeededOptions,
} from "@/lib/serviceRequests";
import { getResponseStatusClass } from "@/lib/practitionerMarketplace";
import { getServiceRequestCreditCost, purchasePractitionerCredits } from "@/lib/practitionerCredits";
import { sendLeadUnlockedNotification } from "@/lib/leadUnlockNotifications";

type ServiceRequest = Tables<"service_requests">;
type ServiceRequestDocument = Tables<"service_request_documents">;
type ServiceRequestResponse = Tables<"service_request_responses">;
type PractitionerCreditAccount = Tables<"practitioner_credit_accounts">;
type ServiceRequestAccessRequest = Tables<"service_request_access_requests">;
const MAX_LEAD_RESPONSES = 4;

function formatLeadResponseCount(count: number) {
  const safeCount = Math.min(count, MAX_LEAD_RESPONSES);
  return `${safeCount} responded`;
}

export default function PractitionerLeads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [introductionMessage, setIntroductionMessage] = useState("");
  const [servicePitch, setServicePitch] = useState("");
  const [savingResponse, setSavingResponse] = useState(false);
  const [startingQuickPurchase, setStartingQuickPurchase] = useState(false);
  const [requestingAccessId, setRequestingAccessId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    risk: "all",
    priority: "all",
    clientType: "all",
    category: "all",
    service: "all",
    hasDocuments: false,
    hasIssueFlags: false,
    onlyMyResponses: false,
  });
  const leadIdFromQuery = searchParams.get("leadId");
  const leadAction = searchParams.get("action");

  const { data: practitionerProfile } = useQuery({
    queryKey: ["practitioner-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select("*")
        .eq("profile_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ["practitioner-visible-leads", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .neq("status", "closed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ServiceRequest[];
    },
    enabled: !!user,
  });

  const { data: documents } = useQuery({
    queryKey: ["practitioner-visible-lead-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_documents")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ServiceRequestDocument[];
    },
    enabled: !!user,
  });

  const { data: responses } = useQuery({
    queryKey: ["practitioner-own-lead-responses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_responses")
        .select("*")
        .eq("practitioner_profile_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ServiceRequestResponse[];
    },
    enabled: !!user,
  });

  const { data: allResponses } = useQuery({
    queryKey: ["practitioner-lead-response-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_responses")
        .select("id, service_request_id");

      if (error) throw error;
      return (data ?? []) as Pick<ServiceRequestResponse, "id" | "service_request_id">[];
    },
    enabled: !!user,
  });

  const { data: accessRequests } = useQuery({
    queryKey: ["practitioner-lead-access-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_access_requests")
        .select("*")
        .eq("practitioner_profile_id", user!.id)
        .order("created_at", { ascending: false });

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
        .select("*")
        .eq("profile_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as PractitionerCreditAccount | null;
    },
    enabled: !!user,
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

  const responseMap = useMemo(
    () => new Map((responses ?? []).map((response) => [response.service_request_id, response])),
    [responses],
  );

  const responseCountMap = useMemo(() => {
    const map = new Map<string, number>();

    for (const response of allResponses ?? []) {
      map.set(response.service_request_id, (map.get(response.service_request_id) ?? 0) + 1);
    }

    return map;
  }, [allResponses]);

  const accessRequestMap = useMemo(
    () => new Map((accessRequests ?? []).map((request) => [request.service_request_id, request])),
    [accessRequests],
  );

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

  const formatRequestDate = (value: string) =>
    new Date(value).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const formatRequestTime = (value: string) =>
    new Date(value).toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatFileSize = (value: number | null) => {
    if (!value || value <= 0) {
      return "Size not available";
    }

    if (value >= 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }

    if (value >= 1024) {
      return `${Math.round(value / 1024)} KB`;
    }

    return `${value} B`;
  };

  const filteredRequests = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    const servicesOffered = new Set(practitionerProfile?.services_offered ?? []);

    return (requests ?? [])
      .filter((request) => {
        const matchesService = servicesOffered.size === 0 || resolveServiceList(request).some((service) => servicesOffered.has(service));
        const visibleToPractitioner =
          request.assigned_practitioner_id === null
          || request.assigned_practitioner_id === user?.id;

        return matchesService && visibleToPractitioner;
      })
      .filter((request) => {
        if (filters.status !== "all" && request.status !== filters.status) return false;
        if (filters.risk !== "all" && request.risk_indicator !== filters.risk) return false;
        if (filters.priority !== "all" && request.priority_level !== filters.priority) return false;
        if (filters.clientType !== "all" && request.client_type !== filters.clientType) return false;
        if (filters.category !== "all" && !resolveCategoryList(request).includes(filters.category as Enums<"service_request_category">)) return false;
        if (filters.service !== "all" && !resolveServiceList(request).includes(filters.service as Enums<"service_request_service_needed">)) return false;
        if (filters.onlyMyResponses && !responseMap.has(request.id)) return false;
        if (filters.hasDocuments && !(documentMap.get(request.id)?.length ?? 0)) return false;
        if (filters.hasIssueFlags) {
          const flags = getServiceRequestIssueFlags({
            hasDebtFlag: request.has_debt_flag,
            missingReturnsFlag: request.missing_returns_flag,
            missingDocumentsFlag: request.missing_documents_flag,
          });
          if (flags.length === 0) return false;
        }
        return true;
      })
      .filter((request) => {
        if (!search) return true;
        return [
          request.full_name,
          request.email,
          request.phone,
          request.description,
          formatServiceList(resolveServiceList(request)),
          request.status,
        ].join(" ").toLowerCase().includes(search);
      });
  }, [
    documentMap,
    filters,
    practitionerProfile?.services_offered,
    requests,
    responseMap,
    searchQuery,
    user?.id,
  ]);

  const selectedRequest = filteredRequests.find((request) => request.id === selectedRequestId)
    || requests?.find((request) => request.id === selectedRequestId)
    || null;
  const selectedResponse = selectedRequest ? responseMap.get(selectedRequest.id) ?? null : null;
  const selectedResponseCount = selectedRequest ? responseCountMap.get(selectedRequest.id) ?? 0 : 0;
  const selectedResponseLimitReached = !selectedResponse && selectedResponseCount >= MAX_LEAD_RESPONSES;
  const selectedDocuments = selectedRequest ? documentMap.get(selectedRequest.id) ?? [] : [];
  const selectedAccessRequest = selectedRequest ? accessRequestMap.get(selectedRequest.id) ?? null : null;
  const availableCredits = creditAccount?.balance ?? 0;
  const hasApprovedAccess = Boolean(selectedResponse || selectedAccessRequest?.status === "approved");
  const canSendNewResponse = Boolean(selectedResponse || selectedAccessRequest?.status === "approved") && !selectedResponseLimitReached;

  useEffect(() => {
    if (!leadIdFromQuery || !(requests ?? []).some((request) => request.id === leadIdFromQuery)) {
      return;
    }

    setSelectedRequestId(leadIdFromQuery);
  }, [leadIdFromQuery, requests]);

  useEffect(() => {
    if (!selectedResponse) {
      setIntroductionMessage("");
      setServicePitch("");
      return;
    }

    setIntroductionMessage(selectedResponse.introduction_message);
    setServicePitch(selectedResponse.service_pitch || "");
  }, [selectedResponse]);

  const openDocument = async (filePath: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 300);

    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Unable to open this document.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const saveResponse = async () => {
    if (!selectedRequest || !user?.id) return;

    if (!introductionMessage.trim()) {
      toast.error("Please add an introduction message before responding.");
      return;
    }

    if (!selectedResponse && !hasApprovedAccess) {
      toast.error("Unlock this lead before you can respond.");
      return;
    }

    if (selectedResponseLimitReached) {
      toast.error("Response limit reached.");
      return;
    }

    setSavingResponse(true);

    const payload = {
      service_request_id: selectedRequest.id,
      practitioner_profile_id: user.id,
      introduction_message: introductionMessage.trim(),
      service_pitch: servicePitch.trim() || null,
      response_status: "submitted" as const,
    };

    const query = selectedResponse
      ? supabase.from("service_request_responses").update(payload).eq("id", selectedResponse.id)
      : supabase.from("service_request_responses").insert(payload);

    const { error } = await query;

    if (!error) {
      await supabase
        .from("service_requests")
        .update({
          status: "responded",
          responded_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id)
        .in("status", ["new", "viewed", "responded"]);
    }

    setSavingResponse(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(selectedResponse ? "Lead response updated." : "Lead response sent.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["practitioner-credit-account", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["practitioner-own-lead-responses", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["practitioner-lead-response-counts"] }),
      queryClient.invalidateQueries({ queryKey: ["practitioner-visible-leads", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["practitioner-lead-access-requests", user.id] }),
    ]);
    setSelectedRequestId(null);
  };

  const requestLeadAccess = async (request: ServiceRequest) => {
    if (!user?.id) return;
    const responseCount = responseCountMap.get(request.id) ?? 0;

    if (responseCount >= MAX_LEAD_RESPONSES && !responseMap.has(request.id)) {
      toast.error("Response limit reached.");
      return;
    }

    setRequestingAccessId(request.id);

    try {
      const creditCost = getServiceRequestCreditCost(request.service_needed);
      const { data, error } = await supabase.rpc("unlock_service_request_access", {
        p_request_id: request.id,
      });

      if (error) {
        throw error;
      }

      const notificationResult = await sendLeadUnlockedNotification({
        requestId: request.id,
        clientEmail: request.email,
        clientName: request.full_name,
        practitionerName: practitionerProfile?.business_name || user?.email || "Practitioner",
        serviceType: formatServiceList(resolveServiceList(request)) || request.service_needed,
      });

      if (notificationResult.error) {
        console.error("Lead unlock notification failed:", notificationResult.error);
      }

      toast.success(data === "already_unlocked" ? "Lead already unlocked." : "Lead unlocked. Credits deducted.");
      await queryClient.invalidateQueries({ queryKey: ["practitioner-lead-access-requests", user.id] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send access request.";
      toast.error(message);
    } finally {
      setRequestingAccessId(null);
    }
  };

  const quickBuyStarterCredits = async () => {
    setStartingQuickPurchase(true);

    try {
      const result = await purchasePractitionerCredits("starter");

      if (result.mode !== "fake") {
        toast.error("Quick purchase is only available while credit checkout is in test mode.");
        return;
      }

      toast.success(`Starter package added. Balance: ${result.balance ?? availableCredits}.`);
      await queryClient.invalidateQueries({ queryKey: ["practitioner-credit-account", user?.id] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to add starter credits.";
      toast.error(message);
    } finally {
      setStartingQuickPurchase(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-body">Lead Response Flow</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Marketplace Leads</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground font-body">
          Review open client requests that match your services, respond with your introduction, and follow the assignments you win.
        </p>
      </section>

      <section className="rounded-[24px] border border-border bg-card p-5 shadow-card">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search leads..."
              className="rounded-xl pl-10"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground font-body">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground font-body">Risk</label>
              <Select
                value={filters.risk}
                onValueChange={(value) => setFilters((current) => ({ ...current, risk: value }))}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground font-body">Priority</label>
              <Select
                value={filters.priority}
                onValueChange={(value) => setFilters((current) => ({ ...current, priority: value }))}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground font-body">Client Type</label>
              <Select
                value={filters.clientType}
                onValueChange={(value) => setFilters((current) => ({ ...current, clientType: value }))}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground font-body">Category</label>
              <Select
                value={filters.category}
                onValueChange={(value) => setFilters((current) => ({ ...current, category: value, service: "all" }))}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {serviceCategoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground font-body">Service</label>
              <Select
                value={filters.service}
                onValueChange={(value) => setFilters((current) => ({ ...current, service: value }))}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {serviceNeededOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground font-body">
            <Checkbox
              checked={filters.onlyMyResponses}
              onCheckedChange={(checked) => setFilters((current) => ({ ...current, onlyMyResponses: checked === true }))}
            />
            My responses only
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground font-body">
            <Checkbox
              checked={filters.hasDocuments}
              onCheckedChange={(checked) => setFilters((current) => ({ ...current, hasDocuments: checked === true }))}
            />
            Has documents
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground font-body">
            <Checkbox
              checked={filters.hasIssueFlags}
              onCheckedChange={(checked) => setFilters((current) => ({ ...current, hasIssueFlags: checked === true }))}
            />
            Issue flags only
          </label>
          <Button
            type="button"
            variant="ghost"
            className="rounded-xl text-xs uppercase tracking-[0.18em]"
            onClick={() => setFilters({
              status: "all",
              risk: "all",
              priority: "all",
              clientType: "all",
              category: "all",
              service: "all",
              hasDocuments: false,
              hasIssueFlags: false,
              onlyMyResponses: false,
            })}
          >
            Reset Filters
          </Button>
        </div>
      </section>

      <section className="rounded-[24px] border border-border bg-card p-5 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Lead Credits</p>
            <div className="mt-2 flex items-center gap-3">
              <Coins className="h-5 w-5 text-primary" />
              <p className="font-display text-3xl text-foreground">{availableCredits}</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground font-body">
              Credits are deducted immediately when you unlock a lead. Updating an existing response does not use another credit.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild type="button" variant="outline" className="rounded-xl">
              <Link to="/dashboard/staff/profile">Manage Packages</Link>
            </Button>
            {availableCredits < 1 ? (
              <Button type="button" className="rounded-xl" disabled={startingQuickPurchase} onClick={() => void quickBuyStarterCredits()}>
                {startingQuickPurchase ? "Adding..." : "Quick Buy Starter"}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground font-body">
          Loading leads...
        </div>
      ) : filteredRequests.length ? (
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const ownResponse = responseMap.get(request.id);
            const responseCount = responseCountMap.get(request.id) ?? 0;
            const responseLimitReached = !ownResponse && responseCount >= MAX_LEAD_RESPONSES;
            const flags = getServiceRequestIssueFlags({
              hasDebtFlag: request.has_debt_flag,
              missingReturnsFlag: request.missing_returns_flag,
              missingDocumentsFlag: request.missing_documents_flag,
            });
            const creditCost = getServiceRequestCreditCost(request.service_needed);
            const accessRequest = accessRequestMap.get(request.id);
            const accessApproved = Boolean(ownResponse || accessRequest?.status === "approved");
            const displayName = accessApproved ? request.full_name : "Hidden - Unlock to View";

            return (
              <button
                key={request.id}
                type="button"
                onClick={() => setSelectedRequestId(request.id)}
                className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:border-primary/30 hover:shadow-elevated"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl text-foreground">{displayName}</h2>
                      <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getServiceRequestStatusClass(request.status)}`}>
                        {formatServiceRequestLabel(request.status)}
                      </Badge>
                      <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getServiceRequestRiskClass(request.risk_indicator)}`}>
                        {formatServiceRequestLabel(request.risk_indicator)} risk
                      </Badge>
                      {ownResponse ? (
                        <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getResponseStatusClass(ownResponse.response_status)}`}>
                          {formatServiceRequestLabel(ownResponse.response_status)}
                        </Badge>
                      ) : null}
                      <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        responseLimitReached
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-sky-200 bg-sky-50 text-sky-700"
                      }`}>
                        {formatLeadResponseCount(responseCount)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-body">
                      {formatServiceList(resolveServiceList(request))}
                    </p>
                    <p className="text-xs text-muted-foreground font-body">
                      Cost: {creditCost} credit{creditCost === 1 ? "" : "s"}
                    </p>
                    <p className="line-clamp-2 text-sm text-foreground font-body">{request.description}</p>
                    {responseLimitReached ? (
                      <p className="text-sm font-semibold text-red-700 font-body">Response limit reached</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {flags.length ? flags.map((flag) => (
                        <Badge key={flag} className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                          {flag}
                        </Badge>
                      )) : (
                        <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          No active issue flags
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground font-body">
                    {(documentMap.get(request.id) ?? []).length} document{(documentMap.get(request.id) ?? []).length === 1 ? "" : "s"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground font-body">
          No leads are visible with your current filters and service setup.
        </div>
      )}

      <DashboardItemDialog
        open={!!selectedRequest}
        onOpenChange={(open) => {
          if (open) return;

          setSelectedRequestId(null);
          if (leadIdFromQuery || leadAction) {
            const next = new URLSearchParams(searchParams);
            next.delete("leadId");
            next.delete("action");
            setSearchParams(next, { replace: true });
          }
        }}
        title={selectedRequest
          ? (hasApprovedAccess ? selectedRequest.full_name : "Hidden - Unlock to View")
          : "Lead"}
        description={selectedRequest ? "Review this lead and send your practitioner introduction." : undefined}
      >
        {selectedRequest ? (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Client Details</p>
                {hasApprovedAccess ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Full Name</p>
                      <p className="mt-1 text-sm text-foreground font-body">{selectedRequest.full_name}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Client Type</p>
                      <p className="mt-1 text-sm text-foreground font-body">{formatServiceRequestLabel(selectedRequest.client_type)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Email Address</p>
                      <p className="mt-1 text-sm text-foreground font-body break-all">{selectedRequest.email}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Phone Number</p>
                      <p className="mt-1 text-sm text-foreground font-body">{selectedRequest.phone || "Not provided"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Province</p>
                      <p className="mt-1 text-sm text-foreground font-body">{selectedRequest.province || "Not provided"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-muted-foreground font-body">Full name hidden until you unlock this lead.</p>
                    <p className="text-sm text-muted-foreground font-body">Phone number, email address, and province will appear after unlock.</p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Request Details</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Request ID</p>
                    <p className="mt-1 text-sm font-mono text-foreground">{selectedRequest.id}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Credit Cost</p>
                    <p className="mt-1 text-sm text-foreground font-body">
                      {getServiceRequestCreditCost(selectedRequest.service_needed)} credit
                      {getServiceRequestCreditCost(selectedRequest.service_needed) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Responses</p>
                    <p className={`mt-1 text-sm font-semibold font-body ${
                      selectedResponseLimitReached ? "text-red-700" : "text-foreground"
                    }`}>
                      {formatLeadResponseCount(selectedResponseCount)}
                    </p>
                    {selectedResponseLimitReached ? (
                      <p className="mt-1 text-xs font-semibold text-red-700 font-body">Response limit reached</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Service Category</p>
                    <p className="mt-1 text-sm text-foreground font-body">{formatCategoryList(resolveCategoryList(selectedRequest)) || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Services Needed</p>
                    <p className="mt-1 text-sm text-foreground font-body">{formatServiceList(resolveServiceList(selectedRequest)) || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Priority Level</p>
                    <p className="mt-1 text-sm text-foreground font-body">{formatServiceRequestLabel(selectedRequest.priority_level)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Status</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getServiceRequestStatusClass(selectedRequest.status)}`}>
                        {formatServiceRequestLabel(selectedRequest.status)}
                      </Badge>
                      <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getServiceRequestRiskClass(selectedRequest.risk_indicator)}`}>
                        {formatServiceRequestLabel(selectedRequest.risk_indicator)} risk
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Date Requested</p>
                    <p className="mt-1 text-sm text-foreground font-body">{formatRequestDate(selectedRequest.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-body">Time Requested</p>
                    <p className="mt-1 text-sm text-foreground font-body">{formatRequestTime(selectedRequest.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Request Description</p>
                {hasApprovedAccess ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground font-body">
                    {selectedRequest.description || "No description was provided with this request."}
                  </p>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground font-body">
                    Unlock this lead to view the full client description and request background.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Supporting Notes</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground font-body">
                  {hasApprovedAccess
                    ? "No additional supporting notes were submitted with this request."
                    : "Unlock this lead to review the complete request profile."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                  {selectedRequest.client_type === "individual"
                    ? formatServiceRequestLabel(selectedRequest.identity_document_type || "id_number")
                    : "Company Registration Number"}
                </p>
                <p className="mt-3 text-sm text-foreground font-body">
                  {hasApprovedAccess
                    ? (selectedRequest.client_type === "individual"
                      ? selectedRequest.id_number || "Not provided"
                      : selectedRequest.company_registration_number || "Not provided")
                    : "Unlock this lead to view submitted identity or registration details."}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">SARS Debt And Returns</p>
                {hasApprovedAccess ? (
                  <>
                    <p className="mt-3 text-sm text-foreground font-body">
                      Debt: R {Number(selectedRequest.sars_debt_amount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground font-body">
                      Returns Filed: {selectedRequest.returns_filed ? "Yes" : "No"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getServiceRequestIssueFlags({
                        hasDebtFlag: selectedRequest.has_debt_flag,
                        missingReturnsFlag: selectedRequest.missing_returns_flag,
                        missingDocumentsFlag: selectedRequest.missing_documents_flag,
                      }).length ? getServiceRequestIssueFlags({
                        hasDebtFlag: selectedRequest.has_debt_flag,
                        missingReturnsFlag: selectedRequest.missing_returns_flag,
                        missingDocumentsFlag: selectedRequest.missing_documents_flag,
                      }).map((flag) => (
                        <span key={flag} className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">{flag}</span>
                      )) : (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">No active issue flags</span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground font-body">
                    Unlock this lead to view the client tax indicators, debt amount, and return status.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Supporting Documents</p>
              <div className="mt-4 space-y-3">
                {hasApprovedAccess ? (selectedDocuments.length ? selectedDocuments.map((document) => (
                  <div key={document.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground font-body">{document.title || document.file_name}</p>
                      <p className="text-xs text-muted-foreground font-body">{document.file_name}</p>
                      <p className="text-xs text-muted-foreground font-body">
                        {document.mime_type || "Unknown file type"} | {formatFileSize(document.file_size)}
                      </p>
                      <p className="text-xs text-muted-foreground font-body">
                        Uploaded {formatRequestDate(document.uploaded_at)} at {formatRequestTime(document.uploaded_at)}
                      </p>
                    </div>
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => void openDocument(document.file_path)}>
                      Open File
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground font-body">No documents were uploaded for this lead.</p>
                )) : (
                  <p className="text-sm text-muted-foreground font-body">
                    Unlock this lead to view and open any supporting documents uploaded by the client.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Credit Status</p>
                <p className="mt-2 text-sm text-foreground font-body">
                  {selectedResponseLimitReached
                    ? "Response limit reached. This lead already has the maximum number of practitioner responses."
                    : selectedResponse
                    ? "Updating this existing response will not deduct another credit."
                    : "Credits are deducted immediately when you unlock this lead."}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Assignment Changes</p>
                <p className="mt-2 text-sm text-foreground font-body">
                  Clients may request to change their assigned practitioner only after admin authorization.
                </p>
                <p className="mt-2 text-sm text-foreground font-body">
                  Once a practitioner has been selected, changes are not automatic and must be approved by the Acapolite Admin Team.
                </p>
              </div>

              {!hasApprovedAccess ? (
                <div className="rounded-2xl border border-dashed border-border bg-accent/10 p-4">
                  <p className="text-sm text-muted-foreground font-body">
                    Client contact details are hidden until you unlock this lead.
                  </p>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Introduction Message</label>
                <Textarea
                  value={introductionMessage}
                  onChange={(event) => setIntroductionMessage(event.target.value)}
                  placeholder={leadAction === "respond"
                    ? "You came here to respond to this lead. Introduce yourself, explain how you can help, and set expectations for the client."
                    : "Introduce yourself, explain how you can help, and set expectations for the client."}
                  className="min-h-[140px] rounded-xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Service Pitch</label>
                <Textarea
                  value={servicePitch}
                  onChange={(event) => setServicePitch(event.target.value)}
                  placeholder="Optional service summary, expertise fit, or next-step outline."
                  className="min-h-[100px] rounded-xl"
                />
              </div>
              <div className="flex justify-end">
                {hasApprovedAccess ? (
                  <Button type="button" className="rounded-xl" onClick={saveResponse} disabled={savingResponse || !canSendNewResponse}>
                    <SendHorizonal className="mr-2 h-4 w-4" />
                    {savingResponse
                      ? "Saving..."
                      : selectedResponseLimitReached
                        ? "Response limit reached"
                      : selectedResponse
                        ? "Update Response"
                        : "Respond to Lead"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="rounded-xl"
                    onClick={() => void requestLeadAccess(selectedRequest)}
                    disabled={selectedResponseLimitReached || requestingAccessId === selectedRequest.id || selectedAccessRequest?.status === "approved"}
                  >
                    {selectedResponseLimitReached
                      ? "Response limit reached"
                      : selectedAccessRequest?.status === "approved"
                      ? "Unlocked"
                      : requestingAccessId === selectedRequest.id
                        ? "Unlocking..."
                        : "Unlock to View & Respond (Use Credits)"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}
