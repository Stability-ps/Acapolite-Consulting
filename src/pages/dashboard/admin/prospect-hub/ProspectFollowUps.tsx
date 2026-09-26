/* eslint-disable @typescript-eslint/no-explicit-any -- Prospect Hub tables are not in the generated Supabase types yet, so rows follow the explicit select list in each query. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyRow, errorMessage, prospectDb, staffName, useProspectPermissions, useStaffMembers } from "@/components/prospect-hub/shared";
import { formatDate } from "@/lib/prospectHub";

type View = "overdue" | "today" | "upcoming" | "completed";

export default function ProspectFollowUps() {
  const perms = useProspectPermissions();
  const staff = useStaffMembers();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("overdue");
  const [owner, setOwner] = useState<string>("all");
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");

  const list = useQuery({
    queryKey: ["prospect-follow-ups", view, owner],
    queryFn: async () => {
      const now = new Date();
      const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
      let q = prospectDb.from("prospect_follow_ups").select("*, prospects(id,company_name,phone,email,status)");
      if (view === "completed") q = q.neq("status", "open").order("completed_at", { ascending: false, nullsFirst: false }).limit(100);
      else {
        q = q.eq("status", "open");
        if (view === "overdue") q = q.lt("due_at", now.toISOString());
        if (view === "today") q = q.gte("due_at", now.toISOString()).lte("due_at", endOfToday.toISOString());
        if (view === "upcoming") q = q.gt("due_at", endOfToday.toISOString());
        q = q.order("due_at").limit(200);
      }
      if (owner === "mine") q = q.eq("assigned_to", perms.userId);
      else if (owner !== "all") q = q.eq("assigned_to", owner);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const complete = useMutation({
    mutationFn: async ({ id, prospectId, title }: { id: string; prospectId: string; title: string }) => {
      const { error } = await prospectDb.from("prospect_follow_ups").update({ status: "completed", completed_at: new Date().toISOString(), completed_by: perms.userId, outcome: outcome.trim() || null }).eq("id", id);
      if (error) throw error;
      await prospectDb.from("prospect_activities").insert({ prospect_id: prospectId, activity_type: "follow_up", summary: `Follow-up completed: ${title}${outcome.trim() ? ` — ${outcome.trim()}` : ""}`, performed_by: perms.userId });
    },
    onSuccess: () => { toast.success("Follow-up completed"); setOutcomeFor(null); setOutcome(""); void qc.invalidateQueries({ queryKey: ["prospect-follow-ups"] }); void qc.invalidateQueries({ queryKey: ["prospect-dashboard"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reschedule = useMutation({
    mutationFn: async ({ id, due }: { id: string; due: string }) => {
      const { error } = await prospectDb.from("prospect_follow_ups").update({ due_at: new Date(due).toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rescheduled"); void qc.invalidateQueries({ queryKey: ["prospect-follow-ups"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList><TabsTrigger value="overdue">Overdue</TabsTrigger><TabsTrigger value="today">Today</TabsTrigger><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger></TabsList>
        </Tabs>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="w-52 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Everyone</SelectItem><SelectItem value="mine">Assigned to me</SelectItem>{(staff.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Due</th><th className="p-3">Prospect</th><th className="p-3">Task</th><th className="p-3">Priority</th><th className="p-3">Assigned</th><th className="p-3 text-right">Action</th></tr></thead>
            <tbody>
              {(list.data ?? []).map((f: any) => (
                <tr key={f.id} className="border-b align-top last:border-0">
                  <td className={`p-3 whitespace-nowrap ${view === "overdue" ? "font-medium text-amber-700" : ""}`}>{formatDate(view === "completed" ? f.completed_at : f.due_at, true)}</td>
                  <td className="p-3"><Link className="font-medium hover:underline" to={`../prospects/${f.prospect_id}`}>{f.prospects?.company_name}</Link><div className="text-xs text-muted-foreground">{f.prospects?.phone || f.prospects?.email || ""}</div></td>
                  <td className="p-3"><p>{f.title}</p><p className="text-xs capitalize text-muted-foreground">{f.task_type}{f.notes ? ` · ${f.notes}` : ""}{f.outcome ? ` · Outcome: ${f.outcome}` : ""}</p></td>
                  <td className="p-3 capitalize">{f.priority}</td>
                  <td className="p-3 text-xs">{staffName(staff.data, f.assigned_to)}</td>
                  <td className="p-3 text-right">
                    {f.status === "open" && perms.canManage ? (
                      outcomeFor === f.id ? (
                        <div className="flex flex-col items-end gap-2">
                          <Input className="h-8 w-56" placeholder="Outcome (optional)" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
                          <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setOutcomeFor(null)}>Cancel</Button><Button size="sm" disabled={complete.isPending} onClick={() => complete.mutate({ id: f.id, prospectId: f.prospect_id, title: f.title })}><Check className="mr-1 h-4 w-4" />Complete</Button></div>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Input type="date" className="h-8 w-36" aria-label="Reschedule" onChange={(e) => e.target.value && reschedule.mutate({ id: f.id, due: `${e.target.value}T09:00` })} />
                          <Button size="sm" onClick={() => setOutcomeFor(f.id)}>Done</Button>
                        </div>
                      )
                    ) : <span className="text-xs capitalize text-muted-foreground">{f.status}</span>}
                  </td>
                </tr>
              ))}
              {list.isLoading ? <EmptyRow colSpan={6}><Loader2 className="mx-auto h-5 w-5 animate-spin" /></EmptyRow> : null}
              {list.isSuccess && !list.data.length ? <EmptyRow colSpan={6}>No follow-ups here.</EmptyRow> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
