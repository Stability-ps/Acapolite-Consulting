import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage, prospectDb, useProspectPermissions } from "./shared";
import { PROVINCES, SECTORS } from "@/lib/prospectHub";

const EMPTY = { company_name: "", registration_number: "", sector: "", province: "Gauteng", city: "", email: "", phone: "", website: "", contact_name: "", source_url: "" };

export function AddProspectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const perms = useProspectPermissions();
  const [form, setForm] = useState(EMPTY);
  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: async () => {
      // Server-side duplicate detection shares the import path.
      const { data: check, error: checkError } = await prospectDb.rpc("import_prospects", { p_rows: [form], p_commit: false });
      if (checkError) throw checkError;
      const row = check?.rows?.[0];
      if (row?.status === "rejected") throw new Error(row.reason);
      if (row?.status === "duplicate") throw new Error(`Possible duplicate: ${row.reason}. Open the existing prospect instead.`);
      const { data, error } = await prospectDb.from("prospects").insert({
        company_name: form.company_name.trim(),
        registration_number: form.registration_number.trim() || null,
        sector: form.sector || null,
        province: form.province || null,
        city: form.city.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        website_source: form.website.trim() ? "manual" : null,
        contact_name: form.contact_name.trim() || null,
        source_url: form.source_url.trim() || null,
        source_name: "Manual entry",
        created_by: perms.userId,
      }).select("id").single();
      if (error) throw error;
      await prospectDb.from("prospect_activities").insert({ prospect_id: data.id, activity_type: "discovery", summary: "Added manually", performed_by: perms.userId });
      return data.id as string;
    },
    onSuccess: (id) => { toast.success("Prospect added"); setForm(EMPTY); onOpenChange(false); onCreated(id); },
    onError: (e) => toast.error(errorMessage(e, "Could not add prospect")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add prospect</DialogTitle>
          <DialogDescription>Only record publicly available business information. Do not guess contact names or details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company name *" className="sm:col-span-2"><Input value={form.company_name} onChange={(e) => set("company_name")(e.target.value)} /></Field>
          <Field label="Registration number"><Input value={form.registration_number} onChange={(e) => set("registration_number")(e.target.value)} placeholder="2020/123456/07" /></Field>
          <Field label="Sector">
            <Select value={form.sector || "none"} onValueChange={(v) => set("sector")(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Not specified</SelectItem>{SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Province">
            <Select value={form.province} onValueChange={set("province")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="City"><Input value={form.city} onChange={(e) => set("city")(e.target.value)} /></Field>
          <Field label="Public business email"><Input type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} /></Field>
          <Field label="Public business phone"><Input value={form.phone} onChange={(e) => set("phone")(e.target.value)} /></Field>
          <Field label="Website"><Input value={form.website} onChange={(e) => set("website")(e.target.value)} placeholder="example.co.za" /></Field>
          <Field label="Published contact person"><Input value={form.contact_name} onChange={(e) => set("contact_name")(e.target.value)} /></Field>
          <Field label="Source URL" className="sm:col-span-2"><Input value={form.source_url} onChange={(e) => set("source_url")(e.target.value)} placeholder="Where this information is published" /></Field>
        </div>
        <Button className="mt-2" disabled={!form.company_name.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Saving…" : "Save prospect"}</Button>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-1 ${className ?? ""}`}><Label className="text-xs">{label}</Label>{children}</div>;
}
