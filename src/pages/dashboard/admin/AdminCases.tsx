import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Enums, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";

const statusOptions: Enums<"case_status">[] = [
  "new",
  "under_review",
  "in_progress",
  "awaiting_client_documents",
  "awaiting_sars_response",
  "resolved",
  "closed",
];

const caseTypeOptions: Enums<"case_type">[] = [
  "individual_tax_return",
  "corporate_tax_return",
  "vat_registration",
  "provisional_tax",
  "tax_clearance_certificate",
  "sars_dispute_objection",
  "other",
];

export default function AdminCases() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    case_title: "",
    case_type: "individual_tax_return" as Enums<"case_type">,
    description: "",
    due_date: "",
    priority: "2",
  });

  const { data: cases, isLoading } = useQuery({
    queryKey: ["staff-cases"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select("*, clients(company_name, first_name, last_name, client_code)")
        .order("last_activity_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["staff-case-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, company_name, first_name, last_name, client_code")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const clientOptions = useMemo(
    () =>
      (clients ?? []).map((client) => ({
        id: client.id,
        label: client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || client.client_code || "Client",
        clientCode: client.client_code,
      })),
    [clients],
  );

  const updateStatus = async (caseId: string, status: Enums<"case_status">) => {
    const { error } = await supabase.from("cases").update({ status }).eq("id", caseId);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Status updated");
    queryClient.invalidateQueries({ queryKey: ["staff-cases"] });
  };

  const createCase = async () => {
    if (!form.client_id || !form.case_title.trim()) {
      toast.error("Select a client and enter a case title.");
      return;
    }

    setCreating(true);

    const payload: TablesInsert<"cases"> = {
      client_id: form.client_id,
      case_title: form.case_title.trim(),
      case_type: form.case_type,
      description: form.description.trim() || null,
      priority: Number(form.priority),
      created_by: user?.id ?? null,
      due_date: form.due_date ? new Date(`${form.due_date}T12:00:00`).toISOString() : null,
    };

    const { error } = await supabase.from("cases").insert(payload);

    if (error) {
      toast.error(error.message);
      setCreating(false);
      return;
    }

    toast.success("Case created");
    setForm({
      client_id: "",
      case_title: "",
      case_type: "individual_tax_return",
      description: "",
      due_date: "",
      priority: "2",
    });
    setCreating(false);
    setIsCreateModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["staff-cases"] });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-700";
      case "in_progress": return "bg-yellow-100 text-yellow-700";
      case "under_review": return "bg-purple-100 text-purple-700";
      case "awaiting_client_documents": return "bg-orange-100 text-orange-700";
      case "awaiting_sars_response": return "bg-sky-100 text-sky-700";
      case "resolved": return "bg-green-100 text-green-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">All Cases</h1>
          <p className="text-muted-foreground font-body text-sm">Manage case progress across all clients</p>
        </div>
        <Button className="rounded-xl" onClick={() => setIsCreateModalOpen(true)}>
          Create Case
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : (
        <div className="space-y-4">
          {cases?.map((caseItem: { id: string; case_title: string; case_type: string; status: Enums<"case_status">; description: string | null; due_date: string | null; clients?: { company_name?: string | null; first_name?: string | null; last_name?: string | null; client_code?: string | null } | null }) => (
            <div key={caseItem.id} className="bg-card rounded-xl border border-border shadow-card p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">{caseItem.case_title}</h3>
                  <p className="text-sm text-muted-foreground font-body">
                    {caseItem.clients?.company_name || [caseItem.clients?.first_name, caseItem.clients?.last_name].filter(Boolean).join(" ") || "Client"} | {caseItem.case_type.replace(/_/g, " ")}
                  </p>
                </div>
                <Badge variant="outline" className={statusColor(caseItem.status)}>
                  {caseItem.status.replace(/_/g, " ")}
                </Badge>
              </div>
              {caseItem.description && <p className="text-sm text-muted-foreground font-body mb-4">{caseItem.description}</p>}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-muted-foreground font-body">
                  {caseItem.clients?.client_code ? `Client code: ${caseItem.clients.client_code}` : "No client code"}{caseItem.due_date ? ` | Due: ${new Date(caseItem.due_date).toLocaleDateString()}` : ""}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-body">Update status:</span>
                  <Select value={caseItem.status} onValueChange={(value) => updateStatus(caseItem.id, value as Enums<"case_status">)}>
                    <SelectTrigger className="w-56 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <DashboardItemDialog
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Create Case"
        description="Open a new tax or SARS case for a client from the staff workspace."
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Client</label>
            <Select value={form.client_id} onValueChange={(value) => setForm((current) => ({ ...current, client_id: value }))}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clientOptions.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.label}{client.clientCode ? ` (${client.clientCode})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Case Title</label>
            <Input
              value={form.case_title}
              onChange={(event) => setForm((current) => ({ ...current, case_title: event.target.value }))}
              placeholder="Example: 2026 Individual Tax Return"
              className="rounded-xl"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Case Type</label>
              <Select value={form.case_type} onValueChange={(value) => setForm((current) => ({ ...current, case_type: value as Enums<"case_type"> }))}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {caseTypeOptions.map((caseType) => (
                    <SelectItem key={caseType} value={caseType}>
                      {caseType.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground font-body mb-2">Priority</label>
              <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - High</SelectItem>
                  <SelectItem value="2">2 - Normal</SelectItem>
                  <SelectItem value="3">3 - Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Due Date</label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground font-body mb-2">Description</label>
            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Add the client need, SARS issue, or service details."
              className="rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsCreateModalOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={createCase} disabled={creating}>
              {creating ? "Creating..." : "Create Case"}
            </Button>
          </div>
        </div>
      </DashboardItemDialog>
    </div>
  );
}
