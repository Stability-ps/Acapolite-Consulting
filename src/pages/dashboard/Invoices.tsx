import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, Eye, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useClientRecord } from "@/hooks/useClientRecord";
import { sendProofOfPaymentUploadedNotification } from "@/lib/paymentNotifications";
import { formatCaseReference } from "@/lib/practitionerAssignments";
import { openInvoicePdf } from "@/lib/invoicePdf";
import { defaultInvoiceTerms, formatCurrency } from "@/lib/invoiceUtils";

type PractitionerBankProfile = {
  profile_id: string;
  bank_account_holder_name: string | null;
  bank_name: string | null;
  bank_branch_name: string | null;
  bank_branch_code: string | null;
  bank_account_number: string | null;
  bank_account_type: string | null;
  vat_number: string | null;
  banking_verification_status: string;
  banking_verified_at: string | null;
  banking_verified_by: string | null;
  business_name?: string | null;
  tax_practitioner_number?: string | null;
  city?: string | null;
  province?: string | null;
  invoice_logo_path?: string | null;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

type InvoiceItemRecord = {
  id: string;
  invoice_id: string;
  service_item: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type InvoiceAttachmentRecord = {
  id: string;
  attachment_type: string;
  document: {
    id: string;
    title: string;
    file_name: string;
    file_path: string;
    mime_type: string | null;
    file_size: number | null;
  };
};

function getBankingVerificationLabel(status?: string | null) {
  switch (status) {
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    default:
      return "Pending Verification";
  }
}

function getBankingVerificationBadgeClass(status?: string | null) {
  switch (status) {
    case "verified":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function formatPractitionerBankDetails(profile: PractitionerBankProfile | null) {
  if (!profile) {
    return null;
  }

  const accountHolder = profile.bank_account_holder_name || profile.profiles?.full_name || "";
  const lines = [
    accountHolder && `Account Holder: ${accountHolder}`,
    profile.bank_name && `Bank: ${profile.bank_name}`,
    profile.bank_branch_name && `Branch: ${profile.bank_branch_name}`,
    profile.bank_branch_code && `Branch Code: ${profile.bank_branch_code}`,
    profile.bank_account_number && `Account Number: ${profile.bank_account_number}`,
    profile.bank_account_type && `Account Type: ${profile.bank_account_type}`,
    profile.vat_number && `VAT Number: ${profile.vat_number}`,
  ].filter(Boolean);

  return lines.length ? lines.join("\n") : null;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

async function uploadProofOfPaymentFile(file: File, userId: string, clientId: string) {
  const safeFileName = sanitizeFileName(file.name);
  const uniqueFileName = `${Date.now()}-${safeFileName}`;
  const candidatePaths = [
    `${userId}/${clientId}/payments/${uniqueFileName}`,
    `${clientId}/payments/${uniqueFileName}`,
  ];

  let lastError: string | null = null;

  for (const filePath of candidatePaths) {
    const { error } = await supabase.storage.from("documents").upload(filePath, file, {
      upsert: false,
    });

    if (!error) {
      return filePath;
    }

    lastError = error.message;
  }

  throw new Error(lastError ?? "Unable to upload proof of payment.");
}

export default function Invoices() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { data: client } = useClientRecord();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [proofReference, setProofReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", client?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*, cases(case_title, assigned_consultant_id), created_by_profile:profiles!invoices_created_by_fkey(full_name, email)")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!client,
  });

  const practitionerIds = Array.from(new Set(
    (invoices ?? [])
      .flatMap((invoice) => [invoice.created_by, invoice.cases?.assigned_consultant_id])
      .filter((value): value is string => Boolean(value)),
  ));

  const { data: practitionerProfiles } = useQuery({
    queryKey: ["invoice-practitioner-bank-profiles", practitionerIds.join(",")],
    queryFn: async () => {
      if (!practitionerIds.length) {
        return [];
      }

      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select("profile_id, bank_account_holder_name, bank_name, bank_branch_name, bank_branch_code, bank_account_number, bank_account_type, vat_number, banking_verification_status, banking_verified_at, banking_verified_by, business_name, tax_practitioner_number, city, province, invoice_logo_path, profiles!practitioner_profiles_profile_id_fkey(full_name, email, phone)")
        .in("profile_id", practitionerIds);

      if (error) {
        throw error;
      }

      return (data ?? []) as PractitionerBankProfile[];
    },
    enabled: practitionerIds.length > 0,
  });

  const practitionerProfileMap = new Map((practitionerProfiles ?? []).map((profile) => [profile.profile_id, profile]));

  const selectedInvoice = invoices?.find((invoice) => invoice.id === selectedInvoiceId) ?? null;
  const disclaimerText = "Payment is made directly to the practitioner. Acapolite Consulting is not responsible for payment processing or payment disputes.";

  const { data: selectedInvoiceItems } = useQuery({
    queryKey: ["client-invoice-items", selectedInvoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", selectedInvoiceId!)
        .order("created_at", { ascending: true });
      if (error) {
        throw error;
      }
      return (data ?? []) as InvoiceItemRecord[];
    },
    enabled: Boolean(selectedInvoiceId),
  });

  const { data: selectedInvoiceAttachments } = useQuery({
    queryKey: ["client-invoice-attachments", selectedInvoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_attachments")
        .select("id, attachment_type, document:documents!invoice_attachments_document_id_fkey(id, title, file_name, file_path, mime_type, file_size)")
        .eq("invoice_id", selectedInvoiceId!);
      if (error) {
        throw error;
      }
      return (data ?? []) as unknown as InvoiceAttachmentRecord[];
    },
    enabled: Boolean(selectedInvoiceId),
  });

  const getInvoiceBankDetails = (invoice: NonNullable<typeof selectedInvoice>) => {
    if (invoice.practitioner_bank_details?.trim()) {
      return invoice.practitioner_bank_details;
    }

    const assignedPractitionerId = invoice.cases?.assigned_consultant_id || null;
    const createdByPractitioner = invoice.created_by || null;
    const profile =
      (assignedPractitionerId ? practitionerProfileMap.get(assignedPractitionerId) : null)
      || (createdByPractitioner ? practitionerProfileMap.get(createdByPractitioner) : null)
      || null;

    return formatPractitionerBankDetails(profile);
  };

  const getInvoiceBankProfile = (invoice: NonNullable<typeof selectedInvoice>) => {
    const assignedPractitionerId = invoice.cases?.assigned_consultant_id || null;
    const createdByPractitioner = invoice.created_by || null;

    return (
      (assignedPractitionerId ? practitionerProfileMap.get(assignedPractitionerId) : null)
      || (createdByPractitioner ? practitionerProfileMap.get(createdByPractitioner) : null)
      || null
    );
  };

  const getInvoiceLogoUrl = (invoice: NonNullable<typeof selectedInvoice>) => {
    const filePath =
      invoice.practitioner_logo_path
      || getInvoiceBankProfile(invoice)?.invoice_logo_path
      || null;

    if (!filePath) {
      return null;
    }

    const { data } = supabase.storage.from("branding").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const getInvoiceAttachmentUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 60 * 10);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || "Unable to open attachment.");
    }

    return data.signedUrl;
  };

  useEffect(() => {
    setProofReference(selectedInvoice?.payment_reference || "");
    setProofFile(null);
  }, [selectedInvoice?.id, selectedInvoice?.payment_reference]);

  useEffect(() => {
    if (!selectedInvoice || selectedInvoice.viewed_at) {
      return;
    }

    void supabase
      .from("invoices")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", selectedInvoice.id)
      .is("viewed_at", null)
      .then(async ({ error }) => {
        if (!error && client?.id) {
          await queryClient.invalidateQueries({ queryKey: ["invoices", client.id] });
        }
      });
  }, [client?.id, queryClient, selectedInvoice]);

  const statusColor = (status: string) => {
    switch (status) {
      case "issued": return "bg-yellow-100 text-yellow-700";
      case "partially_paid": return "bg-orange-100 text-orange-700";
      case "paid": return "bg-green-100 text-green-700";
      case "overdue": return "bg-red-100 text-red-700";
      case "draft": return "bg-slate-100 text-slate-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const handleProofUpload = async () => {
    if (!selectedInvoice || !client || !user || !proofFile) {
      toast.error("Choose a proof of payment file first.");
      return;
    }

    setUploadingProof(true);
    let filePath = "";

    try {
      filePath = await uploadProofOfPaymentFile(proofFile, user.id, client.id);

      const title = `Proof of Payment - ${selectedInvoice.invoice_number}`;
      const { data: documentRow, error: documentError } = await supabase
        .from("documents")
        .insert({
          client_id: client.id,
          case_id: selectedInvoice.case_id,
          uploaded_by: user.id,
          sender_profile_id: user.id,
          recipient_profile_id: client.profile_id,
          visibility: selectedInvoice.case_id ? "case" : "shared",
          title,
          file_name: proofFile.name,
          file_path: filePath,
          file_size: proofFile.size,
          mime_type: proofFile.type,
          category: "Proof of Payment",
          status: "uploaded",
        })
        .select("id, uploaded_at")
        .single();

      if (documentError || !documentRow) {
        await supabase.storage.from("documents").remove([filePath]);
        throw new Error(documentError?.message || "Unable to save the uploaded proof of payment.");
      }

      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          proof_of_payment_document_id: documentRow.id,
          payment_reference: proofReference.trim() || null,
        })
        .eq("id", selectedInvoice.id);

      if (invoiceError) {
        throw new Error(invoiceError.message);
      }

      const notification = await sendProofOfPaymentUploadedNotification({
        invoiceId: selectedInvoice.id,
        invoiceNumber: selectedInvoice.invoice_number,
        clientProfileId: client.profile_id,
        clientName:
          client.company_name
          || profile?.full_name
          || [client.first_name, client.last_name].filter(Boolean).join(" ")
          || client.client_code
          || "Client",
        caseNumber: selectedInvoice.case_id ? formatCaseReference(selectedInvoice.case_id) : "General Support",
        amount: Number(selectedInvoice.total_amount || 0),
        uploadedAt: documentRow.uploaded_at,
      });

      if (notification.error) {
        console.error("Proof of payment email failed:", notification.error);
        toast.error("Proof uploaded, but the admin email notification could not be delivered.");
      } else {
        toast.success("Proof of payment uploaded successfully.");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices", client.id] }),
        queryClient.invalidateQueries({ queryKey: ["documents", client.id] }),
      ]);
      setProofFile(null);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Proof of payment upload failed.";
      const message = rawMessage.toLowerCase().includes("bucket not found")
        ? "The Supabase storage bucket 'documents' has not been created yet."
        : rawMessage;
      toast.error(message);
    } finally {
      setUploadingProof(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Invoices</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">View and manage your billing</p>

      {!client ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">Your client record is not ready yet. Acapolite staff can complete it for you.</p>
        </div>
      ) : isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : invoices && invoices.length > 0 ? (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <button
              key={invoice.id}
              type="button"
              onClick={() => setSelectedInvoiceId(invoice.id)}
              className="w-full text-left bg-card rounded-xl border border-border shadow-card p-5 hover:shadow-elevated hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">{invoice.invoice_number}</p>
                  <p className="text-sm text-muted-foreground font-body">{invoice.title || invoice.description || "Service invoice"}</p>
                  <p className="text-xs text-muted-foreground font-body mt-1">
                    Issued by {invoice.created_by_profile?.full_name || invoice.created_by_profile?.email || "Acapolite Consulting"}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full font-body ${statusColor(invoice.status)}`}>
                  {invoice.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 text-sm font-body">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-semibold text-foreground">R {Number(invoice.total_amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Balance Due</p>
                  <p className="font-semibold text-foreground">R {Number(invoice.balance_due).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-semibold text-foreground">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "-"}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">No invoices yet.</p>
        </div>
      )}

      {selectedInvoice ? (
        <section className="mt-8 overflow-hidden rounded-[28px] border border-border bg-card shadow-elevated">
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5 sm:px-7">
            <div>
              <h2 className="font-display text-2xl text-foreground">{selectedInvoice.invoice_number}</h2>
              <p className="mt-2 text-sm text-muted-foreground font-body">
                Review invoice amounts, due date, current payment status, and upload your proof of payment.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 rounded-xl"
              onClick={() => setSelectedInvoiceId(null)}
            >
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          </div>

          <div className="space-y-6 px-6 py-5 sm:px-7">
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-accent/20 p-4">
                  <div className="flex items-start gap-4">
                    {getInvoiceLogoUrl(selectedInvoice) ? (
                      <img
                        src={getInvoiceLogoUrl(selectedInvoice) || ""}
                        alt="Practitioner logo"
                        className="h-16 w-16 rounded-2xl border border-border bg-white object-contain p-2"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Invoice Summary</p>
                      <p className="mt-2 font-display text-2xl text-foreground">{selectedInvoice.title || selectedInvoice.description || "Service invoice"}</p>
                      <p className="mt-2 text-sm text-muted-foreground font-body">
                        Status: {selectedInvoice.status.replace(/_/g, " ")} · Viewed: {selectedInvoice.viewed_at ? new Date(selectedInvoice.viewed_at).toLocaleString() : "Not yet"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-border bg-accent/30 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Practitioner Details</p>
                    <p className="font-semibold text-foreground font-body">{selectedInvoice.practitioner_name || getInvoiceBankProfile(selectedInvoice)?.profiles?.full_name || "Practitioner"}</p>
                    <p className="mt-2 text-sm text-muted-foreground font-body">{selectedInvoice.practice_name || getInvoiceBankProfile(selectedInvoice)?.business_name || "Independent practitioner"}</p>
                    <p className="text-sm text-muted-foreground font-body">{selectedInvoice.practitioner_number || getInvoiceBankProfile(selectedInvoice)?.tax_practitioner_number || "Practitioner number not added"}</p>
                    <p className="text-sm text-muted-foreground font-body">{selectedInvoice.practitioner_email || getInvoiceBankProfile(selectedInvoice)?.profiles?.email || "No practitioner email"}</p>
                    <p className="text-sm text-muted-foreground font-body">{selectedInvoice.practitioner_phone || getInvoiceBankProfile(selectedInvoice)?.profiles?.phone || "No practitioner phone"}</p>
                    <p className="mt-2 text-sm text-muted-foreground font-body">
                      {selectedInvoice.practitioner_address
                        || [getInvoiceBankProfile(selectedInvoice)?.city, getInvoiceBankProfile(selectedInvoice)?.province].filter(Boolean).join(", ")
                        || "No practitioner address added"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-accent/30 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Client Details</p>
                    <p className="font-semibold text-foreground font-body">{selectedInvoice.client_name || client.company_name || profile?.full_name || "Client"}</p>
                    <p className="mt-2 text-sm text-muted-foreground font-body">{selectedInvoice.client_email || profile?.email || "No client email"}</p>
                    <p className="text-sm text-muted-foreground font-body">{selectedInvoice.client_phone || profile?.phone || "No client phone"}</p>
                    <p className="mt-2 text-sm text-muted-foreground font-body">
                      {selectedInvoice.client_address
                        || [client.address_line_1, client.address_line_2, client.city, client.province, client.postal_code, client.country].filter(Boolean).join(", ")
                        || "No client address added"}
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Issue Date</p>
                    <p className="font-body text-foreground">{new Date(selectedInvoice.issue_date).toLocaleDateString()}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Due Date</p>
                    <p className="font-body text-foreground">{selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : "Not set"}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Case Reference</p>
                    <p className="font-body text-foreground">{selectedInvoice.case_id ? formatCaseReference(selectedInvoice.case_id) : "General Support"}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-3">Invoice Line Items</p>
                  <div className="overflow-hidden rounded-2xl border border-border">
                    <div className="grid grid-cols-[minmax(0,1.9fr)_90px_140px_140px] gap-3 border-b border-border bg-accent/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <p>Service Item</p>
                      <p>Qty</p>
                      <p>Price</p>
                      <p>Total</p>
                    </div>
                    <div className="divide-y divide-border">
                      {(selectedInvoiceItems?.length
                        ? selectedInvoiceItems
                        : [{
                            id: selectedInvoice.id,
                            service_item: selectedInvoice.title || selectedInvoice.description || "Service item",
                            quantity: 1,
                            unit_price: Number(selectedInvoice.subtotal || selectedInvoice.total_amount || 0),
                            line_total: Number(selectedInvoice.subtotal || selectedInvoice.total_amount || 0),
                          }]
                      ).map((item) => (
                        <div key={item.id} className="grid grid-cols-[minmax(0,1.9fr)_90px_140px_140px] gap-3 px-4 py-4">
                          <p className="text-sm text-foreground font-body">{item.service_item}</p>
                          <p className="text-sm text-foreground font-body">{item.quantity}</p>
                          <p className="text-sm text-foreground font-body">{formatCurrency(Number(item.unit_price || 0))}</p>
                          <p className="text-sm font-semibold text-foreground font-body">{formatCurrency(Number(item.line_total || 0))}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Subtotal</p>
                    <p className="font-display text-2xl text-foreground">{formatCurrency(Number(selectedInvoice.subtotal || 0))}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Discount</p>
                    <p className="font-display text-2xl text-foreground">{formatCurrency(Number(selectedInvoice.discount_amount || 0))}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">VAT</p>
                    <p className="font-display text-2xl text-foreground">{formatCurrency(Number(selectedInvoice.tax_amount || 0))}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Final Total</p>
                    <p className="font-display text-2xl text-foreground">{formatCurrency(Number(selectedInvoice.total_amount || 0))}</p>
                  </div>
                </div>

                {selectedInvoice.notes_to_client ? (
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Notes to Client</p>
                    <p className="font-body text-foreground whitespace-pre-wrap">{selectedInvoice.notes_to_client}</p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-border p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Terms & Conditions</p>
                  <p className="font-body text-foreground whitespace-pre-wrap">{selectedInvoice.terms_and_conditions || defaultInvoiceTerms}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      openInvoicePdf(
                        {
                          invoiceNumber: selectedInvoice.invoice_number,
                          issueDate: selectedInvoice.issue_date,
                          dueDate: selectedInvoice.due_date,
                          status: selectedInvoice.status,
                          caseReference: selectedInvoice.case_id ? formatCaseReference(selectedInvoice.case_id) : "General Support",
                          logoUrl: getInvoiceLogoUrl(selectedInvoice),
                          practitioner: {
                            name: selectedInvoice.practitioner_name || getInvoiceBankProfile(selectedInvoice)?.profiles?.full_name || "Practitioner",
                            subtitle: selectedInvoice.practice_name || getInvoiceBankProfile(selectedInvoice)?.business_name || null,
                            email: selectedInvoice.practitioner_email || getInvoiceBankProfile(selectedInvoice)?.profiles?.email || null,
                            phone: selectedInvoice.practitioner_phone || getInvoiceBankProfile(selectedInvoice)?.profiles?.phone || null,
                            address: selectedInvoice.practitioner_address || [getInvoiceBankProfile(selectedInvoice)?.city, getInvoiceBankProfile(selectedInvoice)?.province].filter(Boolean).join(", ") || null,
                            registrationNumber: selectedInvoice.practitioner_number || getInvoiceBankProfile(selectedInvoice)?.tax_practitioner_number || null,
                          },
                          client: {
                            name: selectedInvoice.client_name || client.company_name || profile?.full_name || "Client",
                            email: selectedInvoice.client_email || profile?.email || null,
                            phone: selectedInvoice.client_phone || profile?.phone || null,
                            address: selectedInvoice.client_address || [client.address_line_1, client.address_line_2, client.city, client.province, client.postal_code, client.country].filter(Boolean).join(", ") || null,
                            vatNumber: client.vat_number || null,
                          },
                          serviceDescription: selectedInvoice.description || selectedInvoice.title,
                          lineItems: (selectedInvoiceItems?.length
                            ? selectedInvoiceItems
                            : [{
                                id: selectedInvoice.id,
                                service_item: selectedInvoice.title || selectedInvoice.description || "Service item",
                                quantity: 1,
                                unit_price: Number(selectedInvoice.subtotal || selectedInvoice.total_amount || 0),
                                line_total: Number(selectedInvoice.subtotal || selectedInvoice.total_amount || 0),
                              }]
                          ).map((item) => ({
                            serviceItem: item.service_item,
                            quantity: Number(item.quantity || 0),
                            unitPrice: Number(item.unit_price || 0),
                            total: Number(item.line_total || 0),
                          })),
                          subtotal: Number(selectedInvoice.subtotal || 0),
                          discountAmount: Number(selectedInvoice.discount_amount || 0),
                          vatAmount: Number(selectedInvoice.tax_amount || 0),
                          total: Number(selectedInvoice.total_amount || 0),
                          notesToClient: selectedInvoice.notes_to_client || null,
                          termsAndConditions: selectedInvoice.terms_and_conditions || defaultInvoiceTerms,
                          bankDetails: getInvoiceBankDetails(selectedInvoice),
                          attachments: (selectedInvoiceAttachments ?? []).map((attachment) => ({
                            title: attachment.document.title,
                            type: attachment.attachment_type.replace(/_/g, " "),
                          })),
                        },
                        { autoPrint: false },
                      )
                    }
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Generate PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      openInvoicePdf(
                        {
                          invoiceNumber: selectedInvoice.invoice_number,
                          issueDate: selectedInvoice.issue_date,
                          dueDate: selectedInvoice.due_date,
                          status: selectedInvoice.status,
                          caseReference: selectedInvoice.case_id ? formatCaseReference(selectedInvoice.case_id) : "General Support",
                          logoUrl: getInvoiceLogoUrl(selectedInvoice),
                          practitioner: {
                            name: selectedInvoice.practitioner_name || getInvoiceBankProfile(selectedInvoice)?.profiles?.full_name || "Practitioner",
                            subtitle: selectedInvoice.practice_name || getInvoiceBankProfile(selectedInvoice)?.business_name || null,
                            email: selectedInvoice.practitioner_email || getInvoiceBankProfile(selectedInvoice)?.profiles?.email || null,
                            phone: selectedInvoice.practitioner_phone || getInvoiceBankProfile(selectedInvoice)?.profiles?.phone || null,
                            address: selectedInvoice.practitioner_address || [getInvoiceBankProfile(selectedInvoice)?.city, getInvoiceBankProfile(selectedInvoice)?.province].filter(Boolean).join(", ") || null,
                            registrationNumber: selectedInvoice.practitioner_number || getInvoiceBankProfile(selectedInvoice)?.tax_practitioner_number || null,
                          },
                          client: {
                            name: selectedInvoice.client_name || client.company_name || profile?.full_name || "Client",
                            email: selectedInvoice.client_email || profile?.email || null,
                            phone: selectedInvoice.client_phone || profile?.phone || null,
                            address: selectedInvoice.client_address || [client.address_line_1, client.address_line_2, client.city, client.province, client.postal_code, client.country].filter(Boolean).join(", ") || null,
                          },
                          serviceDescription: selectedInvoice.description || selectedInvoice.title,
                          lineItems: (selectedInvoiceItems?.length
                            ? selectedInvoiceItems
                            : [{
                                id: selectedInvoice.id,
                                service_item: selectedInvoice.title || selectedInvoice.description || "Service item",
                                quantity: 1,
                                unit_price: Number(selectedInvoice.subtotal || selectedInvoice.total_amount || 0),
                                line_total: Number(selectedInvoice.subtotal || selectedInvoice.total_amount || 0),
                              }]
                          ).map((item) => ({
                            serviceItem: item.service_item,
                            quantity: Number(item.quantity || 0),
                            unitPrice: Number(item.unit_price || 0),
                            total: Number(item.line_total || 0),
                          })),
                          subtotal: Number(selectedInvoice.subtotal || 0),
                          discountAmount: Number(selectedInvoice.discount_amount || 0),
                          vatAmount: Number(selectedInvoice.tax_amount || 0),
                          total: Number(selectedInvoice.total_amount || 0),
                          notesToClient: selectedInvoice.notes_to_client || null,
                          termsAndConditions: selectedInvoice.terms_and_conditions || defaultInvoiceTerms,
                          bankDetails: getInvoiceBankDetails(selectedInvoice),
                          attachments: (selectedInvoiceAttachments ?? []).map((attachment) => ({
                            title: attachment.document.title,
                            type: attachment.attachment_type.replace(/_/g, " "),
                          })),
                        },
                        { autoPrint: true },
                      )
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Practitioner Banking Details</p>
                  {(() => {
                    const bankProfile = getInvoiceBankProfile(selectedInvoice);
                    if (!bankProfile) {
                      return null;
                    }

                    return (
                      <Badge className={`mb-2 rounded-full border px-3 py-1 text-xs font-semibold ${getBankingVerificationBadgeClass(bankProfile.banking_verification_status)}`}>
                        {getBankingVerificationLabel(bankProfile.banking_verification_status)}
                      </Badge>
                    );
                  })()}
                  <div className="rounded-2xl border border-border p-4">
                    <p className="font-body text-foreground whitespace-pre-wrap">
                      {getInvoiceBankDetails(selectedInvoice) || "Banking details will be provided by the practitioner."}
                    </p>
                  </div>
                </div>

                {(selectedInvoiceAttachments?.length ?? 0) > 0 ? (
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-3">Invoice Attachments</p>
                    <div className="space-y-2">
                      {(selectedInvoiceAttachments ?? []).map((attachment) => (
                        <button
                          key={attachment.id}
                          type="button"
                          onClick={() => {
                            void getInvoiceAttachmentUrl(attachment.document.file_path).then((url) => {
                              window.open(url, "_blank", "noopener,noreferrer");
                            }).catch((error) => {
                              toast.error(error instanceof Error ? error.message : "Unable to open attachment.");
                            });
                          }}
                          className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left transition hover:border-primary/30 hover:bg-accent/20"
                        >
                          <div>
                            <p className="text-sm font-semibold text-foreground font-body">{attachment.document.title}</p>
                            <p className="text-xs text-muted-foreground font-body">{attachment.attachment_type.replace(/_/g, " ")}</p>
                          </div>
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedInvoice.payment_reference ? (
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Payment Reference</p>
                    <p className="font-body text-foreground">{selectedInvoice.payment_reference}</p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-border bg-accent/20 p-4">
                  <p className="text-sm text-muted-foreground font-body">{disclaimerText}</p>
                </div>
              </div>
            </div>

            <div className="space-y-5 rounded-[24px] border border-border bg-accent/20 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Proof of Payment</p>
                <p className="text-sm text-muted-foreground font-body">
                  Upload your receipt directly here. There is no second popup anymore, so the file selector should open normally.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Payment Reference</label>
                <Input
                  value={proofReference}
                  onChange={(event) => setProofReference(event.target.value)}
                  placeholder="Optional payment reference"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Proof File</label>
                <input
                  key={selectedInvoice.id}
                  type="file"
                  className="block w-full rounded-xl border border-input/90 bg-white/92 px-3.5 py-2.5 text-sm text-foreground shadow-[0_6px_24px_-22px_rgba(15,23,42,0.28)] ring-offset-background transition-all duration-200 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90 focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                  onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
                <p className="mt-2 text-xs text-muted-foreground font-body">
                  Accepted: PDF, JPG, PNG, DOC, DOCX
                </p>
                {proofFile ? (
                  <p className="mt-2 text-sm text-foreground font-body">Selected: {proofFile.name}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={handleProofUpload}
                  disabled={uploadingProof || !proofFile}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingProof ? "Uploading..." : selectedInvoice.proof_of_payment_document_id ? "Replace Proof of Payment" : "Upload Proof of Payment"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
