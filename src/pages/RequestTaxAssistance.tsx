import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import {
  formatServiceRequestLabel,
  serviceNeededOptions,
  serviceRequestPriorityOptions,
  uploadServiceRequestFile,
} from "@/lib/serviceRequests";

type ClientType = Enums<"service_request_client_type">;

export default function RequestTaxAssistance() {
  const [submitting, setSubmitting] = useState(false);
  const [completedRequestId, setCompletedRequestId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    client_type: "individual" as ClientType,
    id_number: "",
    company_registration_number: "",
    service_needed: "tax_return" as Enums<"service_request_service_needed">,
    priority_level: "medium" as Enums<"service_request_priority">,
    description: "",
    sars_debt_amount: "",
    returns_filed: true,
  });

  const selectedService = useMemo(
    () => serviceNeededOptions.find((option) => option.value === form.service_needed),
    [form.service_needed],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim() || !form.description.trim()) {
      toast.error("Please complete all required fields.");
      return;
    }

    if (form.client_type === "individual" && !form.id_number.trim()) {
      toast.error("Please enter the ID number for the individual request.");
      return;
    }

    if (form.client_type === "company" && !form.company_registration_number.trim()) {
      toast.error("Please enter the company registration number.");
      return;
    }

    setSubmitting(true);

    try {
      const debtAmount = Number(form.sars_debt_amount || 0);

      if (Number.isNaN(debtAmount) || debtAmount < 0) {
        throw new Error("Please enter a valid SARS debt amount.");
      }

      const { data: serviceRequest, error: requestError } = await supabase
        .from("service_requests")
        .insert({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          client_type: form.client_type,
          id_number: form.client_type === "individual" ? form.id_number.trim() : null,
          company_registration_number: form.client_type === "company" ? form.company_registration_number.trim() : null,
          service_needed: form.service_needed,
          priority_level: form.priority_level,
          description: form.description.trim(),
          sars_debt_amount: debtAmount,
          returns_filed: form.returns_filed,
        })
        .select("id")
        .single();

      if (requestError || !serviceRequest) {
        throw new Error(requestError?.message || "Unable to save your request.");
      }

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
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-body">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

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
              <Button asChild className="rounded-xl">
                <Link to="/">Return to Website</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setCompletedRequestId(null);
                  setForm({
                    full_name: "",
                    email: "",
                    phone: "",
                    client_type: "individual",
                    id_number: "",
                    company_registration_number: "",
                    service_needed: "tax_return",
                    priority_level: "medium",
                    description: "",
                    sars_debt_amount: "",
                    returns_filed: true,
                  });
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
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-body">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-8 h-14" />
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-accent/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Public Lead Form
            </p>
            <h1 className="font-display text-3xl text-foreground sm:text-4xl">Request Tax Assistance</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground font-body sm:text-base">
              Tell Acapolite what you need help with, attach any supporting documents, and the admin team will receive
              your service request as a structured lead with risk and issue flags.
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
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.com"
                  className="rounded-xl"
                  required
                />
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
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">ID Number</label>
                  <Input
                    value={form.id_number}
                    onChange={(event) => setForm((current) => ({ ...current, id_number: event.target.value }))}
                    placeholder="South African ID Number"
                    className="rounded-xl"
                    required
                  />
                </div>
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
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Service Needed</label>
                <Select
                  value={form.service_needed}
                  onValueChange={(value) => setForm((current) => ({ ...current, service_needed: value as Enums<"service_request_service_needed"> }))}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceNeededOptions.map((option) => (
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
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Description of the Issue</label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={`Describe your ${selectedService?.label || "service"} request, SARS issue, deadlines, or supporting context.`}
                className="min-h-[140px] rounded-xl"
                required
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">SARS Debt Amount</label>
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
                  <p className="text-sm font-semibold text-foreground font-body">Upload Supporting Documents</p>
                  <p className="mt-1 text-xs text-muted-foreground font-body">
                    Attach any SARS letters, statements, IDs, or supporting files that help explain the request.
                  </p>
                  <input
                    type="file"
                    multiple
                    className="mt-4 block w-full rounded-xl border border-input/90 bg-white/92 px-3.5 py-2.5 text-sm text-foreground shadow-[0_6px_24px_-22px_rgba(15,23,42,0.28)] ring-offset-background transition-all duration-200 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90 focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                    onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  />
                  {files.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {files.map((file) => (
                        <span key={`${file.name}-${file.size}`} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                          {file.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-slate-50/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">What the system will record</p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                  Status: New
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                  Risk: calculated automatically
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                  Flags: Debt / Returns / Documents
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground font-body">
                The admin dashboard will show this request with issue flags and a low / medium / high risk indicator.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="rounded-xl" asChild>
                <Link to="/">Cancel</Link>
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
