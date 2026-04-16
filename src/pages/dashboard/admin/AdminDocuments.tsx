import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, FileText, Search, ShieldCheck, Wallet } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAccessibleClientIds } from "@/hooks/useAccessibleClientIds";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Enums } from "@/integrations/supabase/types";
import { openInvoicePdf } from "@/lib/invoicePdf";
import { logSystemActivity } from "@/lib/systemActivityLog";

type DocumentStatus = Enums<"document_status">;
type InvoiceStatus = Enums<"invoice_status">;

type GroupKey = "client" | "practitioner" | "case" | "payment";
type ReviewAction = "uploaded" | "pending_review" | "approved" | "rejected";

type ClientInfo = {
  id?: string;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  client_code?: string | null;
  assigned_consultant_id?: string | null;
  profile_id?: string | null;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
} | null;

type CaseInfo = {
  id?: string;
  case_title?: string | null;
  case_number?: string | null;
  assigned_consultant_id?: string | null;
} | null;

type StaffDocumentRow = {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  client_id: string;
  case_id: string | null;
  uploaded_at: string;
  status: DocumentStatus;
  category: string | null;
  rejection_reason: string | null;
  notes: string | null;
  clients?: ClientInfo;
  linked_case?: CaseInfo;
};

type StaffInvoiceRow = {
  id: string;
  invoice_number: string;
  title: string | null;
  description: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  practitioner_bank_details: string | null;
  proof_of_payment_document_id: string | null;
  client_id: string;
  case_id: string | null;
  clients?: ClientInfo;
  linked_case?: CaseInfo;
};

type PractitionerVerificationRow = {
  profile_id: string;
  business_name: string | null;
  verification_status: string;
  verification_submitted_at: string | null;
  id_document_path: string | null;
  certificate_document_path: string | null;
  proof_of_address_path: string | null;
  bank_confirmation_document_path: string | null;
  internal_notes: string | null;
  is_verified: boolean;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type UnifiedItem = {
  id: string;
  group: GroupKey;
  sourceType: "document" | "practitioner" | "invoice";
  title: string;
  subtitle: string;
  status: ReviewAction;
  uploadedAt: string;
  clientName: string;
  caseLabel: string;
  practitionerName: string;
  reviewerNotes: string;
  rejectionReason: string;
  relatedPractitionerId: string | null;
  filePath: string | null;
  documentId: string | null;
  invoice: StaffInvoiceRow | null;
  practitionerProfileId: string | null;
  practitionerVerificationStatus: string | null;
  practitionerBusinessName: string | null;
};

const groupLabels: Record<GroupKey, string> = {
  client: "Client Documents",
  practitioner: "Practitioner Documents",
  case: "Case Documents",
  payment: "Payment Documents",
};

const statusOptions: Array<{ value: "all" | ReviewAction; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "uploaded", label: "Uploaded" },
  { value: "pending_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function getClientName(client: ClientInfo) {
  return (
    client?.company_name ||
    client?.profiles?.full_name ||
    [client?.first_name, client?.last_name].filter(Boolean).join(" ") ||
    client?.client_code ||
    "Client"
  );
}

function getCaseLabel(caseRow: CaseInfo) {
  if (!caseRow) {
    return "General / No linked case";
  }

  return caseRow.case_title || caseRow.case_number || "Linked case";
}

function formatStatusLabel(status: ReviewAction) {
  switch (status) {
    case "pending_review":
      return "Under Review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Uploaded";
  }
}

function getStatusBadgeClass(status: ReviewAction) {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    case "pending_review":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown date";
  return new Date(value).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function formatFileSize(size?: number | null) {
  if (!size || size <= 0) return "Unknown size";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function isPaymentDocument(document: StaffDocumentRow) {
  const haystack = `${document.title} ${document.file_name} ${document.category ?? ""}`.toLowerCase();
  return haystack.includes("payment") || haystack.includes("invoice") || haystack.includes("proof of payment");
}

function mapPractitionerStatus(status: string, isVerified: boolean): ReviewAction {
  if (isVerified || status === "verified" || status === "approved") {
    return "approved";
  }
  if (status === "rejected") {
    return "rejected";
  }
  if (status === "pending_review" || status === "under_review" || status === "pending") {
    return "pending_review";
  }
  return "uploaded";
}

function mapInvoiceStatus(status: InvoiceStatus): ReviewAction {
  if (status === "paid") {
    return "approved";
  }
  if (status === "cancelled") {
    return "rejected";
  }
  if (status === "partially_paid") {
    return "pending_review";
  }
  return "uploaded";
}

function buildPractitionerVerificationItems(profile: PractitionerVerificationRow): UnifiedItem[] {
  const practitionerName = profile.profiles?.full_name || profile.business_name || "Practitioner";
  const status = mapPractitionerStatus(profile.verification_status, profile.is_verified);
  const uploadedAt = profile.verification_submitted_at || new Date().toISOString();
  const base = {
    group: "practitioner" as const,
    sourceType: "practitioner" as const,
    status,
    uploadedAt,
    clientName: "N/A",
    caseLabel: "Verification documents",
    practitionerName,
    reviewerNotes: profile.internal_notes ?? "",
    rejectionReason: status === "rejected" ? profile.internal_notes ?? "" : "",
    relatedPractitionerId: profile.profile_id,
    documentId: null,
    invoice: null,
    practitionerProfileId: profile.profile_id,
    practitionerVerificationStatus: profile.verification_status,
    practitionerBusinessName: profile.business_name ?? "",
  };

  const definitions = [
    { key: "id-copy", title: "ID Copy", filePath: profile.id_document_path, subtitle: "Identity verification" },
    { key: "certificate", title: "Practitioner Certificate", filePath: profile.certificate_document_path, subtitle: "Professional certificate" },
    { key: "proof-of-address", title: "Proof of Address", filePath: profile.proof_of_address_path, subtitle: "Business or residential address" },
    { key: "bank-letter", title: "Bank Letter", filePath: profile.bank_confirmation_document_path, subtitle: "Bank confirmation letter" },
  ];

  return definitions
    .filter((item) => Boolean(item.filePath))
    .map((item) => ({
      id: `${profile.profile_id}:${item.key}`,
      title: item.title,
      subtitle: item.subtitle,
      filePath: item.filePath,
      ...base,
    }));
}

export default function AdminDocuments() {
  const queryClient = useQueryClient();
  const { user, role, hasStaffPermission } = useAuth();
  const { accessibleClientIds, hasRestrictedClientScope, isLoadingAccessibleClientIds } = useAccessibleClientIds();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<GroupKey>("client");
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewAction>("all");
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewAction>("pending_review");
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

  const canReviewDocuments = hasStaffPermission("can_review_documents");
  const practitionerIdFilter = searchParams.get("practitionerId");
  const documentStateFilter = searchParams.get("documentState");
  const accessibleClientIdsKey = accessibleClientIds?.join(",") ?? "all";

  useEffect(() => {
    if (documentStateFilter === "rejected") {
      setStatusFilter("rejected");
      return;
    }
    if (documentStateFilter === "outstanding" || documentStateFilter === "attention") {
      setStatusFilter("all");
    }
  }, [documentStateFilter]);

  const { data: documents, isLoading: loadingDocuments } = useQuery({
    queryKey: ["staff-documents", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase
        .from("documents")
        .select("id, title, file_name, file_path, mime_type, file_size, client_id, case_id, uploaded_at, status, category, rejection_reason, notes, clients(id, company_name, first_name, last_name, client_code, assigned_consultant_id, profile_id, profiles!clients_profile_id_fkey(full_name, email)), linked_case:cases!documents_case_id_fkey(id, case_title, case_number, assigned_consultant_id)")
        .order("uploaded_at", { ascending: false });

      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as StaffDocumentRow[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: practitionerProfiles, isLoading: loadingPractitionerProfiles } = useQuery({
    queryKey: ["staff-practitioner-verification-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select("profile_id, business_name, verification_status, verification_submitted_at, id_document_path, certificate_document_path, proof_of_address_path, bank_confirmation_document_path, internal_notes, is_verified, profiles!practitioner_profiles_profile_id_fkey(full_name, email)")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as PractitionerVerificationRow[];
    },
  });

  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["staff-payment-documents", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase
        .from("invoices")
        .select("id, invoice_number, title, description, subtotal, tax_amount, total_amount, issue_date, due_date, status, practitioner_bank_details, proof_of_payment_document_id, client_id, case_id, clients(id, company_name, first_name, last_name, client_code, assigned_consultant_id, profile_id, profiles!clients_profile_id_fkey(full_name, email)), linked_case:cases!invoices_case_id_fkey(id, case_title, case_number, assigned_consultant_id)")
        .order("created_at", { ascending: false });

      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as StaffInvoiceRow[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const allItems = useMemo(() => {
    const documentItems: UnifiedItem[] = (documents ?? []).map((document) => {
      const isPayment = isPaymentDocument(document);
      return {
        id: document.id,
        group: isPayment ? "payment" : document.case_id ? "case" : "client",
        sourceType: "document",
        title: document.title || document.file_name,
        subtitle: document.category || document.file_name,
        status: document.status === "requested" ? "uploaded" : document.status,
        uploadedAt: document.uploaded_at,
        clientName: getClientName(document.clients),
        caseLabel: getCaseLabel(document.linked_case),
        practitionerName: "N/A",
        reviewerNotes: document.notes ?? "",
        rejectionReason: document.rejection_reason ?? "",
        relatedPractitionerId: document.linked_case?.assigned_consultant_id ?? document.clients?.assigned_consultant_id ?? null,
        filePath: document.file_path,
        documentId: document.id,
        invoice: null,
        practitionerProfileId: null,
        practitionerVerificationStatus: null,
        practitionerBusinessName: null,
      };
    });

    const practitionerItems = (practitionerProfiles ?? []).flatMap(buildPractitionerVerificationItems);

    const invoiceItems: UnifiedItem[] = (invoices ?? []).map((invoice) => ({
      id: `invoice:${invoice.id}`,
      group: "payment",
      sourceType: "invoice",
      title: `Invoice INV-${invoice.invoice_number}`,
      subtitle: invoice.title || invoice.description || "Client invoice",
      status: mapInvoiceStatus(invoice.status),
      uploadedAt: invoice.issue_date,
      clientName: getClientName(invoice.clients),
      caseLabel: getCaseLabel(invoice.linked_case),
      practitionerName: "N/A",
      reviewerNotes: invoice.proof_of_payment_document_id ? "Proof of payment linked to this invoice." : "",
      rejectionReason: "",
      relatedPractitionerId: invoice.linked_case?.assigned_consultant_id ?? invoice.clients?.assigned_consultant_id ?? null,
      filePath: null,
      documentId: null,
      invoice,
      practitionerProfileId: null,
      practitionerVerificationStatus: null,
      practitionerBusinessName: null,
    }));

    return [...documentItems, ...practitionerItems, ...invoiceItems];
  }, [documents, invoices, practitionerProfiles]);

  const countsByGroup = useMemo(() => {
    return allItems.reduce<Record<GroupKey, number>>(
      (accumulator, item) => {
        accumulator[item.group] += 1;
        return accumulator;
      },
      { client: 0, practitioner: 0, case: 0, payment: 0 },
    );
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return allItems.filter((item) => {
      if (item.group !== activeGroup) {
        return false;
      }

      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (documentStateFilter === "outstanding" && !["uploaded", "pending_review"].includes(item.status)) {
        return false;
      }

      if (documentStateFilter === "rejected" && item.status !== "rejected") {
        return false;
      }

      if (documentStateFilter === "attention" && !["uploaded", "pending_review", "rejected"].includes(item.status)) {
        return false;
      }

      if (practitionerIdFilter) {
        const isPractitionerMatch =
          item.relatedPractitionerId === practitionerIdFilter ||
          item.practitionerProfileId === practitionerIdFilter;

        if (!isPractitionerMatch) {
          return false;
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        item.title,
        item.subtitle,
        item.clientName,
        item.caseLabel,
        item.practitionerName,
        item.practitionerBusinessName ?? "",
      ].join(" ").toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [activeGroup, allItems, documentStateFilter, practitionerIdFilter, searchQuery, statusFilter]);

  const isLoading = loadingDocuments || loadingPractitionerProfiles || loadingInvoices;

  const openStorageDocument = async (filePath: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 60 * 5);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Unable to open document.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const openItem = async (item: UnifiedItem) => {
    if (item.sourceType === "invoice" && item.invoice) {
      openInvoicePdf({
        invoiceNumber: `INV-${item.invoice.invoice_number}`,
        clientName: item.clientName,
        caseReference: item.caseLabel,
        serviceDescription: item.invoice.title || item.invoice.description || "Client invoice",
        issueDate: item.invoice.issue_date,
        dueDate: item.invoice.due_date,
        status: item.invoice.status,
        subtotal: item.invoice.subtotal,
        vatAmount: item.invoice.tax_amount,
        total: item.invoice.total_amount,
        bankDetails: item.invoice.practitioner_bank_details,
      });
      return;
    }

    if (item.filePath) {
      await openStorageDocument(item.filePath);
      return;
    }

    toast.error("This item does not have a preview available yet.");
  };

  const openReviewDialog = (item: UnifiedItem, nextStatus?: ReviewAction) => {
    setSelectedItem(item);
    setReviewStatus(nextStatus ?? item.status);
    setReviewNotes(item.reviewerNotes);
    setRejectionReason(item.rejectionReason);
    setIsReviewDialogOpen(true);
  };

  const saveReview = async () => {
    if (!selectedItem || !user || !role) {
      return;
    }

    setSavingReview(true);

    try {
      if (selectedItem.sourceType === "practitioner" && selectedItem.practitionerProfileId) {
        const nextVerificationStatus =
          reviewStatus === "approved"
            ? "verified"
            : reviewStatus === "rejected"
              ? "rejected"
              : reviewStatus === "pending_review"
                ? "pending"
                : "uploaded";

        const noteParts = [reviewNotes.trim(), reviewStatus === "rejected" ? rejectionReason.trim() : ""].filter(Boolean);

        const { error } = await supabase
          .from("practitioner_profiles")
          .update({
            verification_status: nextVerificationStatus,
            is_verified: reviewStatus === "approved",
            internal_notes: noteParts.join("\n\n") || null,
          })
          .eq("profile_id", selectedItem.practitionerProfileId);

        if (error) {
          throw error;
        }
      } else if (selectedItem.documentId) {
        const update: Database["public"]["Tables"]["documents"]["Update"] = {
          status: reviewStatus,
          notes: reviewNotes.trim() || null,
          rejection_reason: reviewStatus === "rejected" ? rejectionReason.trim() || null : null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        };

        const { error } = await supabase.from("documents").update(update).eq("id", selectedItem.documentId);
        if (error) {
          throw error;
        }

        await logSystemActivity({
          actorProfileId: user.id,
          actorRole: role,
          action:
            reviewStatus === "approved"
              ? "document_approved"
              : reviewStatus === "rejected"
                ? "document_rejected"
                : "document_missing_requested",
          targetType: "document",
          targetId: selectedItem.documentId,
          metadata: {
            title: selectedItem.title,
            status: reviewStatus,
            notes: reviewNotes.trim() || null,
            rejection_reason: reviewStatus === "rejected" ? rejectionReason.trim() || null : null,
          },
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["staff-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["staff-practitioner-verification-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["staff-payment-documents"] }),
      ]);

      toast.success("Document review updated.");
      setIsReviewDialogOpen(false);
      setSelectedItem(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save document review.");
    } finally {
      setSavingReview(false);
    }
  };

  const clearLinkedFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("practitionerId");
    next.delete("documentState");
    setSearchParams(next);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-body">Admin Documents</p>
            <h1 className="mt-2 font-display text-3xl text-foreground">Structured document management</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground font-body">
              Review client uploads, practitioner verification files, case attachments, and payment records in separate queues so the admin workspace stays manageable as volume grows.
            </p>
          </div>

          {(practitionerIdFilter || documentStateFilter) ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-foreground font-body">
              <p>
                Linked filter active
                {practitionerIdFilter ? ` • Practitioner: ${practitionerIdFilter}` : ""}
                {documentStateFilter ? ` • State: ${documentStateFilter}` : ""}
              </p>
              <Button type="button" variant="ghost" className="mt-2 h-auto px-0 text-primary" onClick={clearLinkedFilters}>
                Clear linked filters
              </Button>
            </div>
          ) : null}
        </div>
      </section>
      <DashboardItemDialog
        open={isReviewDialogOpen}
        onOpenChange={setIsReviewDialogOpen}
        title={selectedItem ? `Review ${selectedItem.title}` : "Review document"}
        description="Save an admin decision and keep review notes for future follow-up."
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Client</p>
              <p className="mt-2 text-sm text-foreground font-body">{selectedItem?.clientName || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Case / Context</p>
              <p className="mt-2 text-sm text-foreground font-body">{selectedItem?.caseLabel || "N/A"}</p>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground font-body">Decision</label>
            <Select value={reviewStatus} onValueChange={(value) => setReviewStatus(value as ReviewAction)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uploaded">Uploaded</SelectItem>
                <SelectItem value="pending_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground font-body">Admin notes</label>
            <Textarea
              value={reviewNotes}
              onChange={(event) => setReviewNotes(event.target.value)}
              placeholder="Add review context, checklist notes, or next steps"
              className="min-h-[120px] rounded-2xl"
            />
          </div>

          {reviewStatus === "rejected" ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Rejection reason</label>
              <Textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Explain what is missing or incorrect"
                className="min-h-[120px] rounded-2xl"
              />
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsReviewDialogOpen(false)} disabled={savingReview}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={() => void saveReview()} disabled={savingReview}>
              {savingReview ? "Saving..." : "Save Review"}
            </Button>
          </div>
        </div>
      </DashboardItemDialog>
    </div>
  );
}
