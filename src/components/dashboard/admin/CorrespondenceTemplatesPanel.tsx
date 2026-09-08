import { downloadAiKnowledgeFile, getAiKnowledgeSignedUrl } from "@/lib/aiKnowledgeStorage";
import { DocumentIngestionDialog } from "./DocumentIngestionDialog";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CORRESPONDENCE_TYPES } from "@/lib/sarsCorrespondence";

type TemplateRow = Tables<"correspondence_templates">;

const TEMPLATE_STATUS_LABELS: Record<TemplateRow["status"], string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

function getTemplateStatusBadgeClass(status: TemplateRow["status"]) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "archived":
      return "bg-gray-200 text-gray-600 border-gray-300";
    default:
      return "bg-slate-100 text-slate-600 border-slate-300";
  }
}

type FormState = {
  name: string;
  correspondence_type: string;
  tax_type: string;
  case_type: string;
  purpose: string;
  body_structure: string;
  approved: boolean;
  status: TemplateRow["status"];
};

const emptyForm: FormState = {
  name: "",
  correspondence_type: CORRESPONDENCE_TYPES[0],
  tax_type: "",
  case_type: "",
  purpose: "",
  body_structure: "",
  approved: false,
  status: "draft",
};

const VARIABLE_HELP = "{{taxpayer_name}} {{tax_reference}} {{sars_reference}} {{tax_type}} {{tax_period}} {{assessment_amount}} {{debt_amount}} {{notice_date}} {{deadline}} {{case_summary}} {{practitioner_name}} {{practitioner_designation}}";

export function CorrespondenceTemplatesPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["correspondence-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("correspondence_templates")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (row: TemplateRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      correspondence_type: row.correspondence_type,
      tax_type: row.tax_type ?? "",
      case_type: row.case_type ?? "",
      purpose: row.purpose ?? "",
      body_structure: row.body_structure ?? "",
      approved: row.approved,
      status: row.status,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Template name is required.");
      return;
    }
    if (!user) {
      toast.error("Your session is not ready yet.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        correspondence_type: form.correspondence_type,
        tax_type: form.tax_type.trim() || null,
        case_type: form.case_type.trim() || null,
        purpose: form.purpose.trim() || null,
        body_structure: form.body_structure.trim() || null,
        approved: form.approved,
        status: form.status,
        updated_by: user.id,
      };

      if (editingId) {
        const existing = templates?.find((t) => t.id === editingId);
        const { error } = await supabase
          .from("correspondence_templates")
          .update({ ...payload, version: (existing?.version ?? 1) + 1 })
          .eq("id", editingId);
        if (error) throw new Error(error.message);
        toast.success("Template updated.");
      } else {
        const { error } = await supabase
          .from("correspondence_templates")
          .insert({ ...payload, created_by: user.id });
        if (error) throw new Error(error.message);
        toast.success("Template created.");
      }

      await queryClient.invalidateQueries({ queryKey: ["correspondence-templates"] });
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save this template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-body max-w-2xl">
          Global SARS correspondence structures. Templates provide structure only — Tax AI still adapts every letter
          to the verified facts of the current case. Never linked to a client or case.
        </p>
        <Button className="rounded-xl shrink-0" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      <DocumentIngestionDialog kind="template" />

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : templates && templates.length > 0 ? (
        <div className="grid gap-3">
          {templates.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => openEditDialog(row)}
              className="w-full text-left bg-card rounded-xl border border-border shadow-card p-4 hover:shadow-elevated hover:border-primary/30 transition-all"
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="font-body font-medium text-foreground">{row.name}</p>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border font-body ${getTemplateStatusBadgeClass(row.status)}`}>
                  {TEMPLATE_STATUS_LABELS[row.status]}
                </span>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border font-body ${row.approved ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-slate-100 text-slate-600 border-slate-300"}`}>
                  {row.approved ? "Approved" : "Not Approved"}
                </span>
                <span className="text-[11px] text-muted-foreground font-body">v{row.version}</span>
              </div>
              <p className="text-xs text-muted-foreground font-body">
                {[row.correspondence_type, row.tax_type, row.case_type].filter(Boolean).join(" | ")}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">No correspondence templates yet.</p>
        </div>
      )}

      <DashboardItemDialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        title={editingId ? "Edit Correspondence Template" : "Add Correspondence Template"}
        description="Global structure only. Not linked to any client or case."
      >
        <div className="space-y-5">
          {editingId && templates?.find(t => t.id === editingId)?.source_file_path && <div className="flex gap-2"><Button variant="outline" onClick={async () => {try {const source = templates.find(t => t.id === editingId)!; window.open(await getAiKnowledgeSignedUrl(source.source_file_path!), "_blank", "noopener,noreferrer");} catch {toast.error("Unable to open the private source.");}}}>Open original template</Button><Button variant="outline" onClick={() => {const source = templates.find(t => t.id === editingId)!; if (source.source_file_path) void downloadAiKnowledgeFile(source.source_file_path, source.source_file_name ?? undefined);}}>Download source</Button></div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Name *</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Correspondence Type</label>
              <Select value={form.correspondence_type} onValueChange={(value) => setForm((f) => ({ ...f, correspondence_type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CORRESPONDENCE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Tax Type</label>
              <Input value={form.tax_type} onChange={(e) => setForm((f) => ({ ...f, tax_type: e.target.value }))} placeholder="e.g. VAT, PAYE, Income Tax" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Case Type</label>
              <Input value={form.case_type} onChange={(e) => setForm((f) => ({ ...f, case_type: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Status</label>
              <Select value={form.status} onValueChange={(value) => setForm((f) => ({ ...f, status: value as FormState["status"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TEMPLATE_STATUS_LABELS) as Array<TemplateRow["status"]>).map((status) => (
                    <SelectItem key={status} value={status}>{TEMPLATE_STATUS_LABELS[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Purpose</label>
              <Input value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Body Structure</label>
              <Textarea
                rows={10}
                value={form.body_structure}
                onChange={(e) => setForm((f) => ({ ...f, body_structure: e.target.value }))}
                placeholder="Structural guidance for Tax AI to adapt with verified case facts. Not sent as-is."
              />
              <p className="text-xs text-muted-foreground font-body mt-1.5">
                Available variables: {VARIABLE_HELP}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-semibold text-foreground font-body">Approved</p>
                <p className="text-xs text-muted-foreground font-body">Only approved templates are offered when drafting correspondence.</p>
              </div>
              <Switch checked={form.approved} onCheckedChange={(checked) => setForm((f) => ({ ...f, approved: checked }))} />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Template"}
            </Button>
          </div>
        </div>
      </DashboardItemDialog>
    </div>
  );
}
