import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Image, File, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccessibleClientIds } from "@/hooks/useAccessibleClientIds";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import type { Enums, TablesUpdate } from "@/integrations/supabase/types";

type StaffDocument = {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  client_id: string;
  case_id: string | null;
  uploaded_at: string;
  status: Enums<"document_status">;
  category: string | null;
  rejection_reason: string | null;
  notes: string | null;
  clients?: {
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    client_code?: string | null;
    assigned_consultant_id?: string | null;
  } | null;
  linked_case?: {
    assigned_consultant_id?: string | null;
  } | null;
};

function getClientName(document: StaffDocument) {
  return (
    document.clients?.company_name ||
    [document.clients?.first_name, document.clients?.last_name].filter(Boolean).join(" ") ||
    document.clients?.client_code ||
    "Client"
  );
}

export default function AdminDocuments() {
  const { user, hasStaffPermission } = useAuth();
  const { accessibleClientIds, hasRestrictedClientScope, isLoadingAccessibleClientIds } = useAccessibleClientIds();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | "open" | "request" | null>(null);

  const accessibleClientIdsKey = accessibleClientIds?.join(",") ?? "all";
  const canReviewDocuments = hasStaffPermission("can_review_documents");
  const practitionerFilterId = searchParams.get("practitionerId") ?? "";
  const documentStateFilter = searchParams.get("documentState") ?? "";
  const documentStatusFilter = searchParams.get("documentStatus") ?? "";

  const { data: documents, isLoading } = useQuery({
    queryKey: ["staff-documents", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase
        .from("documents")
        .select("*, clients(company_name, first_name, last_name, client_code, assigned_consultant_id), linked_case:cases!documents_case_id_fkey(assigned_consultant_id)")
        .order("uploaded_at", { ascending: false });

      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }

      const { data } = await query;
      return (data ?? []) as StaffDocument[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return (documents ?? []).filter((document) => {
        const assignedPractitionerId = document.linked_case?.assigned_consultant_id || document.clients?.assigned_consultant_id || "";
        const matchesPractitioner = !practitionerFilterId || assignedPractitionerId === practitionerFilterId;
        const matchesStatus = !documentStatusFilter || document.status === documentStatusFilter;
        const matchesState = !documentStateFilter
          || (documentStateFilter === "outstanding" && ["uploaded", "pending_review"].includes(document.status))
          || (documentStateFilter === "rejected" && document.status === "rejected")
          || (documentStateFilter === "attention" && ["uploaded", "pending_review", "rejected"].includes(document.status));

        return matchesPractitioner && matchesStatus && matchesState;
      });
    }

    return (documents ?? []).filter((document) => {
      const title = (document.category || document.title || "").toLowerCase();
      const fileName = document.file_name.toLowerCase();
      const clientName = getClientName(document).toLowerCase();
      const clientCode = (document.clients?.client_code || "").toLowerCase();
      const assignedPractitionerId = document.linked_case?.assigned_consultant_id || document.clients?.assigned_consultant_id || "";
      const matchesPractitioner = !practitionerFilterId || assignedPractitionerId === practitionerFilterId;
      const matchesStatus = !documentStatusFilter || document.status === documentStatusFilter;
      const matchesState = !documentStateFilter
        || (documentStateFilter === "outstanding" && ["uploaded", "pending_review"].includes(document.status))
        || (documentStateFilter === "rejected" && document.status === "rejected")
        || (documentStateFilter === "attention" && ["uploaded", "pending_review", "rejected"].includes(document.status));

      return (
        matchesPractitioner
        && matchesStatus
        && matchesState
        && (
          title.includes(normalizedSearch) ||
          fileName.includes(normalizedSearch) ||
          clientName.includes(normalizedSearch) ||
          clientCode.includes(normalizedSearch)
        )
      );
    });
  }, [documentStateFilter, documentStatusFilter, documents, practitionerFilterId, searchQuery]);

  const selectedDocument = filteredDocuments.find((document) => document.id === selectedDocumentId)
    || documents?.find((document) => document.id === selectedDocumentId)
    || null;

  const clearQuickFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("practitionerId");
    next.delete("documentState");
    next.delete("documentStatus");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    setReviewNotes(selectedDocument?.notes || "");
    setRejectionReason(selectedDocument?.rejection_reason || "");
  }, [selectedDocument]);

  const getIcon = (type?: string | null) => {
    if (type?.startsWith("image")) return Image;
    if (type?.includes("pdf")) return FileText;
    return File;
  };

  const openDocument = async () => {
    if (!selectedDocument) return;

    setActionLoading("open");
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(selectedDocument.file_path, 60 * 10);

    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Unable to open this file.");
      setActionLoading(null);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    setActionLoading(null);
  };

  const reviewDocument = async (nextStatus: "approved" | "rejected") => {
    if (!selectedDocument || !user) return;
    if (!canReviewDocuments) {
      toast.error("This consultant profile cannot review documents.");
      return;
    }

    if (nextStatus === "rejected" && !rejectionReason.trim()) {
      toast.error("Enter a rejection reason before rejecting the document.");
      return;
    }

    setActionLoading(nextStatus === "approved" ? "approve" : "reject");

    const updates: TablesUpdate<"documents"> = {
      status: nextStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      notes: reviewNotes.trim() || null,
      rejection_reason: nextStatus === "rejected" ? rejectionReason.trim() : null,
    };

    const { error } = await supabase.from("documents").update(updates).eq("id", selectedDocument.id);

    if (error) {
      toast.error(error.message);
      setActionLoading(null);
      return;
    }

    toast.success(nextStatus === "approved" ? "Document approved." : "Document rejected.");
    setActionLoading(null);
    await queryClient.invalidateQueries({ queryKey: ["staff-documents"] });
    setSelectedDocumentId(null);
  };

  const requestMissingDocument = async () => {
    if (!selectedDocument || !user) return;
    if (!canReviewDocuments) {
      toast.error("This consultant profile cannot request documents.");
      return;
    }

    setActionLoading("request");

    const updates: TablesUpdate<"documents"> = {
      status: "requested",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      notes: reviewNotes.trim() || null,
      rejection_reason: null,
    };

    const { error } = await supabase.from("documents").update(updates).eq("id", selectedDocument.id);

    if (error) {
      toast.error(error.message);
      setActionLoading(null);
      return;
    }

    toast.success("Missing document requested.");
    setActionLoading(null);
    await queryClient.invalidateQueries({ queryKey: ["staff-documents"] });
    setSelectedDocumentId(null);
  };

  const setStatusFilter = (status: string) => {
    const next = new URLSearchParams(searchParams);
    if (!status) {
      next.delete("documentStatus");
    } else {
      next.set("documentStatus", status);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">All Documents</h1>
          <p className="text-muted-foreground font-body text-sm">Review uploaded files across every client account</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search documents or clients..."
            className="rounded-xl pl-9"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-body">Document Status</span>
        <Button
          type="button"
          size="sm"
          variant={documentStatusFilter ? "outline" : "default"}
          className="rounded-full"
          onClick={() => setStatusFilter("")}
        >
          All
        </Button>
        <Button
          type="button"
          size="sm"
          variant={documentStatusFilter === "uploaded" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setStatusFilter("uploaded")}
        >
          Uploaded
        </Button>
        <Button
          type="button"
          size="sm"
          variant={documentStatusFilter === "pending_review" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setStatusFilter("pending_review")}
        >
          Under Review
        </Button>
        <Button
          type="button"
          size="sm"
          variant={documentStatusFilter === "approved" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setStatusFilter("approved")}
        >
          Approved
        </Button>
        <Button
          type="button"
          size="sm"
          variant={documentStatusFilter === "rejected" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setStatusFilter("rejected")}
        >
          Rejected
        </Button>
      </div>

      {practitionerFilterId || documentStateFilter || documentStatusFilter ? (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground font-body">
            Showing the practitioner document queue
            {documentStatusFilter ? ` | ${documentStatusFilter.replace(/_/g, " ")}` : ""}
            {documentStateFilter ? ` | ${documentStateFilter.replace(/_/g, " ")}` : ""}.
          </p>
          <Button type="button" variant="outline" className="rounded-xl" onClick={clearQuickFilters}>
            Clear Document Filter
          </Button>
        </div>
      ) : null}

      {isLoading || isLoadingAccessibleClientIds ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : filteredDocuments.length > 0 ? (
        <div className="grid gap-3">
          {filteredDocuments.map((document) => {
            const Icon = getIcon(document.mime_type);
            return (
              <button
                key={document.id}
                type="button"
                onClick={() => setSelectedDocumentId(document.id)}
                className="w-full text-left bg-card rounded-xl border border-border shadow-card p-4 flex items-center gap-4 hover:shadow-elevated hover:border-primary/30 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body font-medium text-foreground truncate">{document.category || document.title}</p>
                  <p className="text-xs text-muted-foreground font-body truncate">
                    {getClientName(document)} | {document.file_size ? `${(document.file_size / 1024).toFixed(1)} KB | ` : ""}
                    {new Date(document.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full font-body ${
                  document.status === "approved" ? "bg-green-100 text-green-700" :
                  document.status === "rejected" ? "bg-red-100 text-red-700" :
                  document.status === "pending_review" ? "bg-yellow-100 text-yellow-700" :
                  document.status === "requested" ? "bg-blue-100 text-blue-700" :
                  "bg-accent text-accent-foreground"
                }`}>
                  {document.status.replace(/_/g, " ")}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">
            {searchQuery.trim() ? "No documents matched your search." : "No documents uploaded yet."}
          </p>
        </div>
      )}

      <DashboardItemDialog
        open={!!selectedDocument}
        onOpenChange={(open) => {
          if (!open) setSelectedDocumentId(null);
        }}
        title={selectedDocument?.category || selectedDocument?.title || "Document Review"}
        description={canReviewDocuments ? "Open the file, review the upload details, and approve or reject it." : "Open the file and review the upload details in view-only mode."}
      >
        {selectedDocument ? (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Client</p>
                <p className="font-body text-foreground">{getClientName(selectedDocument)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Status</p>
                <p className="font-body text-foreground">{selectedDocument.status.replace(/_/g, " ")}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">File Name</p>
                <p className="font-body text-foreground break-all">{selectedDocument.file_name}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Uploaded</p>
                <p className="font-body text-foreground">{new Date(selectedDocument.uploaded_at).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="rounded-xl" onClick={openDocument} disabled={actionLoading === "open"}>
                <ExternalLink className="h-4 w-4 mr-2" />
                {actionLoading === "open" ? "Opening..." : "Open File"}
              </Button>
            </div>

            {canReviewDocuments ? (
              <>
                <div>
                  <label className="block text-sm font-semibold text-foreground font-body mb-2">Review Notes</label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    placeholder="Add internal notes or a short review summary."
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground font-body mb-2">Rejection Reason</label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Required only if you reject this document."
                    className="rounded-xl"
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={requestMissingDocument}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "request" ? "Requesting..." : "Request Missing Document"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="rounded-xl"
                    onClick={() => reviewDocument("rejected")}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "reject" ? "Rejecting..." : "Reject"}
                  </Button>
                  <Button
                    type="button"
                    className="rounded-xl"
                    onClick={() => reviewDocument("approved")}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "approve" ? "Approving..." : "Approve"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-sm text-muted-foreground font-body">This consultant profile has view-only access to document records.</p>
              </div>
            )}
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}
