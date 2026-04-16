import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useClientRecord } from "@/hooks/useClientRecord";
import { sendProofOfPaymentUploadedNotification } from "@/lib/paymentNotifications";
import { formatCaseReference } from "@/lib/practitionerAssignments";
import { openInvoicePdf } from "@/lib/invoicePdf";

type PractitionerBankProfile = {
  profile_id: string;
  bank_account_holder_name: string | null;
  bank_name: string | null;
  bank_branch_name: string | null;
  bank_branch_code: string | null;
  bank_account_number: string | null;
  bank_account_type: string | null;
  vat_number: string | null;
  profiles?: {
    full_name?: string | null;
  } | null;
};

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
        .select("profile_id, bank_account_holder_name, bank_name, bank_branch_name, bank_branch_code, bank_account_number, bank_account_type, vat_number, profiles!practitioner_profiles_profile_id_fkey(full_name)")
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

  useEffect(() => {
    setProofReference(selectedInvoice?.payment_reference || "");
    setProofFile(null);
  }, [selectedInvoice?.id, selectedInvoice?.payment_reference]);

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
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Title</p>
                <p className="font-body text-foreground">{selectedInvoice.title || selectedInvoice.description || "Service invoice"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Status</p>
                <p className="font-body text-foreground">{selectedInvoice.status.replace(/_/g, " ")}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Case Reference</p>
                <p className="font-body text-foreground">{selectedInvoice.case_id ? formatCaseReference(selectedInvoice.case_id) : "General Support"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Issue Date</p>
                <p className="font-body text-foreground">{new Date(selectedInvoice.issue_date).toLocaleDateString()}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Issued By</p>
                <p className="font-body text-foreground">
                  {selectedInvoice.created_by_profile?.full_name || selectedInvoice.created_by_profile?.email || "Acapolite Consulting"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Due Date</p>
                <p className="font-body text-foreground">{selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : "Not set"}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Amount</p>
                <p className="font-display text-2xl text-foreground">R {Number(selectedInvoice.subtotal).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">VAT</p>
                <p className="font-display text-2xl text-foreground">R {Number(selectedInvoice.tax_amount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Total</p>
                <p className="font-display text-2xl text-foreground">R {Number(selectedInvoice.total_amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Amount Paid</p>
                <p className="font-display text-2xl text-foreground">R {Number(selectedInvoice.amount_paid).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Balance Due</p>
                <p className="font-display text-2xl text-foreground">R {Number(selectedInvoice.balance_due).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Practitioner Banking Details</p>
              <div className="rounded-2xl border border-border p-4">
                <p className="font-body text-foreground whitespace-pre-wrap">
                  {getInvoiceBankDetails(selectedInvoice) || "Banking details will be provided by the practitioner."}
                </p>
              </div>
            </div>

            {selectedInvoice.payment_reference ? (
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Payment Reference</p>
                <div className="rounded-2xl border border-border p-4">
                  <p className="font-body text-foreground">{selectedInvoice.payment_reference}</p>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-accent/20 p-4">
              <p className="text-sm text-muted-foreground font-body">{disclaimerText}</p>
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
