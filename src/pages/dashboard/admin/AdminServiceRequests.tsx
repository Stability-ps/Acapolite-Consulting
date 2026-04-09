import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, File, FileText, Image, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables, Enums } from "@/integrations/supabase/types";
import {
  formatServiceRequestLabel,
  getServiceRequestIssueFlags,
  getServiceRequestRiskClass,
  getServiceRequestStatusClass,
  serviceRequestStatusOptions,
} from "@/lib/serviceRequests";

type ServiceRequestRecord = Tables<"service_requests">;
type ServiceRequestDocument = Tables<"service_request_documents">;

export default function AdminServiceRequests() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

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

  const documentMap = useMemo(() => {
    const map = new Map<string, ServiceRequestDocument[]>();

    for (const document of documents ?? []) {
      const current = map.get(document.service_request_id) ?? [];
      current.push(document);
      map.set(document.service_request_id, current);
    }

    return map;
  }, [documents]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return requests ?? [];
    }

    return (requests ?? []).filter((request) => {
      return (
        request.full_name.toLowerCase().includes(normalizedSearch)
        || request.email.toLowerCase().includes(normalizedSearch)
        || request.phone.toLowerCase().includes(normalizedSearch)
        || formatServiceRequestLabel(request.service_needed).toLowerCase().includes(normalizedSearch)
        || formatServiceRequestLabel(request.status).toLowerCase().includes(normalizedSearch)
      );
    });
  }, [requests, searchQuery]);

  const selectedRequest = (requests ?? []).find((request) => request.id === selectedRequestId) ?? null;
  const selectedDocuments = selectedRequest ? documentMap.get(selectedRequest.id) ?? [] : [];

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

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Service Requests</h1>
          <p className="text-muted-foreground font-body text-sm">Manage public tax-assistance requests and assess their risk before assignment.</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search requests..."
            className="rounded-xl pl-9"
          />
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
            const issueFlags = getServiceRequestIssueFlags(request);
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
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 xl:min-w-[220px] xl:items-end">
                    <span className="text-xs text-muted-foreground font-body">
                      Submitted {new Date(request.created_at).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground font-body">
                      Documents: {documentMap.get(request.id)?.length ?? 0}
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
            {searchQuery.trim() ? "No service requests matched your search." : "No service requests submitted yet."}
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
                  {getServiceRequestIssueFlags(selectedRequest).map((flag) => (
                    <span key={flag} className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">{flag}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
                  {selectedRequest.client_type === "individual" ? "ID Number" : "Company Registration Number"}
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
