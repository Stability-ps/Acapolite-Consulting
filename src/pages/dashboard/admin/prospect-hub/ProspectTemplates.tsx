import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage, prospectDb, useProspectPermissions } from "@/components/prospect-hub/shared";
import { TEMPLATE_VARIABLES, unknownVariables } from "@/lib/prospectTemplates";

type Template = { id?: string; name: string; category: string; subject: string; body_text: string; description: string | null; is_active: boolean };
const EMPTY: Template = { name: "", category: "general", subject: "", body_text: "Good day,\n\n", description: "", is_active: true };

export default function ProspectTemplates() {
  const perms = useProspectPermissions();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const canEdit = perms.canManage || perms.canSend;

  const templates = useQuery({
    queryKey: ["prospect-templates"],
    queryFn: async () => {
      const { data, error } = await prospectDb.from("prospect_email_templates").select("*").order("is_active", { ascending: false }).order("name");
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const save = useMutation({
    mutationFn: async (t: Template) => {
      const unknown = [...unknownVariables(t.subject), ...unknownVariables(t.body_text)];
      if (unknown.length) throw new Error(`Unsupported variables: ${unknown.join(", ")}`);
      const payload = { name: t.name.trim(), category: t.category.trim() || "general", subject: t.subject.trim(), body_text: t.body_text, description: t.description?.trim() || null, is_active: t.is_active, updated_by: perms.userId };
      const { error } = t.id
        ? await prospectDb.from("prospect_email_templates").update(payload).eq("id", t.id)
        : await prospectDb.from("prospect_email_templates").insert({ ...payload, created_by: perms.userId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Template saved"); setEditing(null); void qc.invalidateQueries({ queryKey: ["prospect-templates"] }); void qc.invalidateQueries({ queryKey: ["prospect-templates-active"] }); },
    onError: (e) => toast.error(errorMessage(e, "Could not save template")),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Approved pitch templates. Describe what Acapolite does - never state or imply that a business has a SARS problem.</p>
        {canEdit ? <Button size="sm" onClick={() => setEditing(EMPTY)}><Plus className="mr-1 h-4 w-4" />New template</Button> : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {(templates.data ?? []).map((t) => (
          <div key={t.id} className={`rounded-2xl border bg-card p-4 shadow-sm ${t.is_active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div><h3 className="font-semibold">{t.name}</h3><p className="text-xs text-muted-foreground">{t.category.replace(/_/g, " ")}{t.is_active ? "" : " · inactive"}</p></div>
              {canEdit ? <Button size="sm" variant="ghost" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button> : null}
            </div>
            {t.description ? <p className="mt-1 text-xs text-muted-foreground">{t.description}</p> : null}
            <p className="mt-3 text-sm font-medium">{t.subject}</p>
            <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm text-muted-foreground">{t.body_text}</p>
          </div>
        ))}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit template" : "New template"}</DialogTitle><DialogDescription>Variables: {TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(", ")}. Use a fallback for values that may be unknown, e.g. {"{{contact_name|Good day}}"}.</DialogDescription></DialogHeader>
          {editing ? (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Category</Label><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Subject</Label><Input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Body</Label><Textarea className="min-h-64 font-mono text-xs" value={editing.body_text} onChange={(e) => setEditing({ ...editing, body_text: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />Active (available for new campaigns)</label>
              <Button disabled={!editing.name.trim() || !editing.subject.trim() || !editing.body_text.trim() || save.isPending} onClick={() => save.mutate(editing)}>Save template</Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
