import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Search, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/integrations/supabase/types";
import {
  formatServiceRequestLabel,
  getServiceRequestIssueFlags,
  getServiceRequestRiskClass,
  getServiceRequestStatusClass,
  serviceNeededOptions,
} from "@/lib/serviceRequests";
import { getResponseStatusClass } from "@/lib/practitionerMarketplace";

type ServiceRequest = Tables<"service_requests">;
type ServiceRequestDocument = Tables<"service_request_documents">;
type ServiceRequestResponse = Tables<"service_request_responses">;

export default function PractitionerLeads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [introductionMessage, setIntroductionMessage] = useState("");
  const [servicePitch, setServicePitch] = useState("");
  const [savingResponse, setSavingResponse] = useState(false);

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

  const filteredRequests = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    const servicesOffered = new Set(practitionerProfile?.services_offered ?? []);

    return (requests ?? [])
      .filter((request) => {
        const matchesService = servicesOffered.size === 0 || servicesOffered.has(request.service_needed);
        const visibleToPractitioner =
          request.assigned_practitioner_id === null
          || request.assigned_practitioner_id === user?.id
          || responseMap.has(request.id);

        return matchesService && visibleToPractitioner;
      })
      .filter((request) => {
        if (!search) return true;
        return [
          request.full_name,
          request.email,
          request.phone,
          request.description,
          request.service_needed,
          request.status,
        ].join(" ").toLowerCase().includes(search);
      });
  }, [practitionerProfile?.services_offered, requests, responseMap, searchQuery, user?.id]);

  const selectedRequest = filteredRequests.find((request) => request.id === selectedRequestId)
    || requests?.find((request) => request.id === selectedRequestId)
    || null;
  const selectedResponse = selectedRequest ? responseMap.get(selectedRequest.id) ?? null : null;
  const selectedDocuments = selectedRequest ? documentMap.get(selectedRequest.id) ?? [] : [];

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
      queryClient.invalidateQueries({ queryKey: ["practitioner-own-lead-responses", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["practitioner-visible-leads", user.id] }),
    ]);
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

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search leads..."
          className="rounded-xl pl-10"
        />
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground font-body">
          Loading leads...
        </div>
      ) : filteredRequests.length ? (
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const ownResponse = responseMap.get(request.id);
            const flags = getServiceRequestIssueFlags({
              hasDebtFlag: request.has_debt_flag,
              missingReturnsFlag: request.missing_returns_flag,
              missingDocumentsFlag: request.missing_documents_flag,
            });

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
                      <h2 className="font-display text-xl text-foreground">{request.full_name}</h2>
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
                    </div>
                    <p className="text-sm text-muted-foreground font-body">
                      {serviceNeededOptions.find((item) => item.value === request.service_needed)?.label || request.service_needed}
                    </p>
                    <p className="line-clamp-2 text-sm text-foreground font-body">{request.description}</p>
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
        onOpenChange={(open) => setSelectedRequestId(open ? selectedRequestId : null)}
        title={selectedRequest ? selectedRequest.full_name : "Lead"}
        description={selectedRequest ? "Review this lead and send your practitioner introduction." : undefined}
      >
        {selectedRequest ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Service Needed</p>
                <p className="mt-2 text-sm text-foreground font-body">
                  {serviceNeededOptions.find((item) => item.value === selectedRequest.service_needed)?.label || selectedRequest.service_needed}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Contact</p>
                <p className="mt-2 text-sm text-foreground font-body">{selectedRequest.email}</p>
                <p className="mt-1 text-sm text-muted-foreground font-body">{selectedRequest.phone}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Client Description</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground font-body">{selectedRequest.description}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Supporting Documents</p>
              <div className="mt-4 space-y-3">
                {selectedDocuments.length ? selectedDocuments.map((document) => (
                  <div key={document.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground font-body">{document.file_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground font-body">{document.mime_type || "Unknown file type"}</p>
                    </div>
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => void openDocument(document.file_path)}>
                      Open File
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground font-body">No documents were uploaded for this lead.</p>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Introduction Message</label>
                <Textarea
                  value={introductionMessage}
                  onChange={(event) => setIntroductionMessage(event.target.value)}
                  placeholder="Introduce yourself, explain how you can help, and set expectations for the client."
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
                <Button type="button" className="rounded-xl" onClick={saveResponse} disabled={savingResponse}>
                  <SendHorizonal className="mr-2 h-4 w-4" />
                  {savingResponse ? "Saving..." : selectedResponse ? "Update Response" : "Respond to Lead"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}
