import { useState } from "react";
import { toast } from "sonner";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const requestTypeOptions = [
  "General Inquiry",
  "Support Request",
  "Report an Issue",
  "Billing / Credits Support",
  "Practitioner Support",
  "Client Support",
  "Technical Problem",
  "Account Assistance",
  "Other",
];

const priorityOptions = ["Normal", "Urgent", "Critical"];

export default function ContactUs() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    requestType: requestTypeOptions[0],
    subject: "",
    message: "",
    priority: "Normal",
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    toast.success("Your support request has been sent. We will get back to you shortly.");
  };

  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Support</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Contact Us</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            Send your request and the Acapolite team will assist you. All support requests use this unified form
            so we can route you to the right specialist faster.
          </p>

          <div className="mt-6 rounded-xl bg-accent/20 p-4 border border-border/60">
            <h3 className="text-sm font-semibold text-foreground font-body mb-3">Contact Information</h3>
            <div className="space-y-2 text-sm text-muted-foreground font-body">
              <p><strong>General Support:</strong> <a href="mailto:support@acapoliteconsulting.co.za" className="text-primary hover:underline">support@acapoliteconsulting.co.za</a></p>
              <p><strong>Billing & Refunds:</strong> <a href="mailto:accounts@acapoliteconsulting.co.za" className="text-primary hover:underline">accounts@acapoliteconsulting.co.za</a></p>
              <p><strong>Office Phone:</strong> <a href="tel:+27102886912" className="text-primary hover:underline">+27 10 288 6912</a></p>
            </div>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Full Name</label>
                <Input
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
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
                  placeholder="name@email.com"
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
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Request Type</label>
                <Select
                  value={form.requestType}
                  onValueChange={(value) => setForm((current) => ({ ...current, requestType: value }))}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {requestTypeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Subject</label>
                <Input
                  value={form.subject}
                  onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Short summary of your request"
                  className="rounded-xl"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Message</label>
              <Textarea
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                placeholder="Describe your request in detail..."
                className="min-h-[160px] rounded-xl"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Priority Level</label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">File Upload</label>
                <input
                  type="file"
                  className="block w-full rounded-xl border border-input/90 bg-white/92 px-3.5 py-2.5 text-sm text-foreground shadow-[0_6px_24px_-22px_rgba(15,23,42,0.28)] ring-offset-background transition-all duration-200 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90 focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
                <p className="mt-2 text-xs text-muted-foreground font-body">
                  Optional: upload screenshots or supporting documents.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="rounded-xl">
                Submit Request
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
