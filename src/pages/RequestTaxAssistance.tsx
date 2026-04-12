import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Upload, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import {
  formatServiceRequestLabel,
  getServicesForCategory,
  serviceCategoryOptions,
  serviceNeededOptions,
  serviceRequestPriorityOptions,
  uploadServiceRequestFile,
} from "@/lib/serviceRequests";

type ClientType = Enums<"service_request_client_type">;
type IdentityDocumentType = Enums<"service_request_identity_document_type">;

export default function RequestTaxAssistance() {
  const { user, profile, dashboardPath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [completedRequestId, setCompletedRequestId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    client_type: "individual" as ClientType,
    identity_document_type: "id_number" as IdentityDocumentType,
    id_number: "",
    company_registration_number: "",
    service_category: "individual_tax" as Enums<"service_request_category">,
    service_needed: "individual_personal_income_tax_returns" as Enums<"service_request_service_needed">,
    priority_level: "medium" as Enums<"service_request_priority">,
    description: "",
    sars_debt_amount: "",
    returns_filed: true,
  });
  const portalFallbackPath = "/dashboard/client";
  const resolvedAccountFullName = profile?.full_name
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || "";

  const resetFormToAccount = () => {
    setForm({
      full_name: resolvedAccountFullName,
      email: user?.email || "",
      phone: profile?.phone || "",
      client_type: "individual",
      identity_document_type: "id_number",
      id_number: "",
      company_registration_number: "",
      service_category: "individual_tax",
      service_needed: "individual_personal_income_tax_returns",
      priority_level: "medium",
      description: "",
      sars_debt_amount: "",
      returns_filed: true,
    });
  };

  useEffect(() => {
    if (!user) return;

    setForm((current) => ({
      ...current,
      full_name: current.full_name || resolvedAccountFullName,
      email: user.email || current.email,
      phone: current.phone || profile?.phone || "",
    }));
  }, [profile?.phone, resolvedAccountFullName, user]);

  const selectedService = useMemo(
    () => serviceNeededOptions.find((option) => option.value === form.service_needed),
    [form.service_needed],
  );

  const availableServices = useMemo(() => {
    const services = getServicesForCategory(form.service_category);
    const labelMap = new Map(serviceNeededOptions.map((option) => [option.value, option.label]));
    return services.map((service) => ({ value: service, label: labelMap.get(service) || formatServiceRequestLabel(service) }));
  }, [form.service_category]);

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []);

    if (!nextFiles.length) {
      return;
    }

    setFiles((current) => {
      const existingKeys = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const dedupedIncoming = nextFiles.filter((file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`));
      return [...current, ...dedupedIncoming];
    });

    event.target.value = "";
  };

  const removeSelectedFile = (fileToRemove: File) => {
    setFiles((current) => current.filter((file) => (
      `${file.name}-${file.size}-${file.lastModified}` !== `${fileToRemove.name}-${fileToRemove.size}-${fileToRemove.lastModified}`
    )));
  };

  const clearSelectedFiles = () => {
    setFiles([]);
  };

  const goBackInsidePortal = () => {
    const state = location.state as { fromPortal?: boolean; fromPath?: string } | null;
    const fallbackPath = state?.fromPath || dashboardPath || portalFallbackPath;

    if (state?.fromPortal && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(fallbackPath, { replace: true });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user?.email) {
      toast.error("You must be signed in to submit a service request.");
      navigate("/login", { replace: true });
      return;
    }

    if (
      !form.full_name.trim()
      || !form.phone.trim()
      || !form.service_category
      || !form.service_needed
      || !form.priority_level
    ) {
      toast.error("Please complete all required fields.");
      return;
    }

    if (form.client_type === "individual" && !form.id_number.trim()) {
      toast.error(`Please enter the ${form.identity_document_type === "passport_number" ? "passport number" : "ID number"} for the individual request.`);
      return;
    }

    if (form.client_type === "individual" && form.identity_document_type === "id_number" && form.id_number.trim().length !== 13) {
      toast.error("ID number must be exactly 13 digits.");
      return;
    }

    if (form.client_type === "company" && !form.company_registration_number.trim()) {
      toast.error("Please enter the company registration number.");
      return;
    }

    setSubmitting(true);

    try {
      const debtAmount = form.sars_debt_amount.trim() === ""
        ? 0
        : Number(form.sars_debt_amount);

      if (Number.isNaN(debtAmount) || debtAmount < 0) {
        throw new Error("Please enter a valid SARS debt amount.");
      }

      const { data: serviceRequest, error: requestError } = await supabase
        .from("service_requests")
        .insert({
          full_name: form.full_name.trim(),
          email: user.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          client_type: form.client_type,
          identity_document_type: form.client_type === "individual" ? form.identity_document_type : null,
          id_number: form.client_type === "individual" ? form.id_number.trim() : null,
          company_registration_number: form.client_type === "company" ? form.company_registration_number.trim() : null,
          service_category: form.service_category,
          service_needed: form.service_needed,
          priority_level: form.priority_level,
          description: form.description.trim() || "",
          sars_debt_amount: debtAmount,
          returns_filed: form.returns_filed,
        })
        .select("id")
        .single();

      if (requestError || !serviceRequest) {
        throw new Error(requestError?.message || "Unable to save your request.");
      }

      if (files.length > 0) {
        const uploadResults = await Promise.allSettled(
          files.map(async (file) => {
            const filePath = await uploadServiceRequestFile(file, serviceRequest.id);

            const { error } = await supabase.from("service_request_documents").insert({
              service_request_id: serviceRequest.id,
              title: file.name,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              mime_type: file.type,
            });

            if (error) {
              throw new Error(error.message);
            }
          }),
        );

        const failedUploads = uploadResults.filter((result) => result.status === "rejected");

        if (failedUploads.length > 0) {
          const firstReason = failedUploads[0];
          const details = firstReason?.status === "rejected" && firstReason.reason instanceof Error
            ? firstReason.reason.message
            : "One or more document uploads failed.";

          toast.error(`Your request was submitted, but one or more documents could not be uploaded. ${details}`);
        } else {
          toast.success("Your service request was submitted successfully.");
        }
      } else {
        toast.success("Your service request was submitted successfully.");
      }

      setCompletedRequestId(serviceRequest.id);
      setFiles([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit your request.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (completedRequestId) {
    return (
      <div className="min-h-screen bg-surface-gradient px-4 py-16">
        <div className="mx-auto w-full max-w-3xl">
          <button
            type="button"
            onClick={goBackInsidePortal}
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-body"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to portal
          </button>

          <div className="rounded-[32px] border border-border bg-card p-8 shadow-elevated sm:p-10">
            <AcapoliteLogo className="mb-8 h-14" />
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-6 font-display text-3xl text-foreground">Request Submitted</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground font-body">
              Your tax assistance request is now in the Acapolite pipeline. The team can review your request, documents,
              and risk profile from the staff dashboard.
            </p>

            <div className="mt-8 rounded-2xl border border-border bg-accent/20 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Reference</p>
              <p className="font-mono text-sm text-foreground">{completedRequestId}</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button type="button" className="rounded-xl" onClick={goBackInsidePortal}>
                Return to Portal
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setCompletedRequestId(null);
                  resetFormToAccount();
                }}
              >
                Submit Another Request
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <button
          type="button"
          onClick={goBackInsidePortal}
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-body"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to portal
        </button>

        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-8 h-14" />
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-accent/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Client Service Form
            </p>
            <h1 className="font-display text-3xl text-foreground sm:text-4xl">Request Tax Assistance</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground font-body sm:text-base">
              Tell Acapolite what you need help with, attach any supporting documents, and submit the request from your logged-in client account so it stays linked to your portal profile.
            </p>
          </div>

          <form className="mt-10 space-y-8" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Full Name</label>
                <Input
                  value={form.full_name}
                  onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                  placeholder="Full name"
                  className="rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Email Address</label>
                <Input
                  type="email"
                  value={form.email}
                  readOnly
                  placeholder="Linked to your portal account"
                  className="rounded-xl"
                />
                <p className="mt-2 text-xs text-muted-foreground font-body">
                  This request will be submitted using your logged-in portal email.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Phone Number</label>
                <Input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+27 ..."
                  className="rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Individual or Company</label>
                <Select
                  value={form.client_type}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      client_type: value as ClientType,
                      identity_document_type: value === "individual" ? current.identity_document_type : "id_number",
                      id_number: value === "individual" ? current.id_number : "",
                      company_registration_number: value === "company" ? current.company_registration_number : "",
                    }))
                  }
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.client_type === "individual" ? (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground font-body">Identity Document Type</label>
                    <Select
                      value={form.identity_document_type}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          identity_document_type: value as IdentityDocumentType,
                          id_number: "",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="id_number">ID Number</SelectItem>
                        <SelectItem value="passport_number">Passport Number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground font-body">
                      {form.identity_document_type === "passport_number" ? "Passport Number" : "ID Number"}
                    </label>
                    <Input
                      value={form.id_number}
                      onChange={(event) => {
                        const nextValue = form.identity_document_type === "id_number"
                          ? event.target.value.replace(/\D/g, "").slice(0, 13)
                          : event.target.value.toUpperCase();

                        setForm((current) => ({ ...current, id_number: nextValue }));
                      }}
                      placeholder={form.identity_document_type === "passport_number" ? "Passport number" : "13-digit South African ID number"}
                      className="rounded-xl"
                      inputMode={form.identity_document_type === "id_number" ? "numeric" : "text"}
                      maxLength={form.identity_document_type === "id_number" ? 13 : 20}
                      required
                    />
                    <p className="mt-2 text-xs text-muted-foreground font-body">
                      {form.identity_document_type === "id_number"
                        ? `${form.id_number.length}/13 digits`
                        : "Enter the passport number exactly as it appears on the document."}
                    </p>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Company Registration Number</label>
                  <Input
                    value={form.company_registration_number}
                    onChange={(event) => setForm((current) => ({ ...current, company_registration_number: event.target.value }))}
                    placeholder="Company Registration Number"
                    className="rounded-xl"
                    required
                  />
                </div>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Service Category</label>
                <Select
                  value={form.service_category}
                  onValueChange={(value) => {
                    const nextCategory = value as Enums<"service_request_category">;
                    const nextServices = getServicesForCategory(nextCategory);
                    const nextService = nextServices[0] || form.service_needed;

                    setForm((current) => ({
                      ...current,
                      service_category: nextCategory,
                      service_needed: nextService,
                    }));
                  }}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceCategoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Service Needed</label>
                <Select
                  value={form.service_needed}
                  onValueChange={(value) => setForm((current) => ({ ...current, service_needed: value as Enums<"service_request_service_needed"> }))}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableServices.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Priority Level</label>
                <Select
                  value={form.priority_level}
                  onValueChange={(value) => setForm((current) => ({ ...current, priority_level: value as Enums<"service_request_priority"> }))}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceRequestPriorityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Description of the Issue (Optional)</label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={`Describe your ${selectedService?.label || "service"} request, SARS issue, deadlines, or supporting context.`}
                className="min-h-[140px] rounded-xl"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">SARS Debt Amount (Optional)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sars_debt_amount}
                  onChange={(event) => setForm((current) => ({ ...current, sars_debt_amount: event.target.value }))}
                  placeholder="0.00"
                  className="rounded-xl"
                />
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={form.returns_filed}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, returns_filed: checked === true }))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground font-body">Returns Filed?</span>
                    <span className="block text-xs text-muted-foreground font-body mt-1">
                      Leave unchecked if returns are still outstanding.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="rounded-[24px] border border-dashed border-border bg-accent/20 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                  <Upload className="h-4 w-4" />
                </div>
                <div className="w-full">
                  <p className="text-sm font-semibold text-foreground font-body">Upload Supporting Documents (Optional)</p>
                  <p className="mt-1 text-xs text-muted-foreground font-body">
                    Attach any SARS letters, statements, IDs, or supporting files that help explain the request. You can add multiple files before submitting.
                  </p>
                  <input
                    type="file"
                    multiple
                    className="mt-4 block w-full rounded-xl border border-input/90 bg-white/92 px-3.5 py-2.5 text-sm text-foreground shadow-[0_6px_24px_-22px_rgba(15,23,42,0.28)] ring-offset-background transition-all duration-200 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90 focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                    onChange={handleFileSelection}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  />
                  {files.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground font-body">
                          {files.length} file{files.length === 1 ? "" : "s"} selected
                        </p>
                        <button
                          type="button"
                          onClick={clearSelectedFiles}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {files.map((file) => (
                          <span
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-foreground shadow-sm"
                          >
                            <span className="max-w-[220px] truncate">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => removeSelectedFile(file)}
                              className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              aria-label={`Remove ${file.name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="rounded-xl" onClick={goBackInsidePortal}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Tax Assistance Request"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
