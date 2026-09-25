import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FOLLOW_UP_TYPES, PRIORITIES } from "@/lib/prospectHub";
import { errorMessage, prospectDb, useProspectPermissions, useStaffMembers } from "./shared";

function defaultDue() {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FollowUpDialog({ open, onOpenChange, prospectIds, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; prospectIds: string[]; onSaved: () => void }) {
  const perms = useProspectPermissions();
  const staff = useStaffMembers();
  const [title, setTitle] = useState("Follow up");
  const [due, setDue] = useState(defaultDue());
  const [type, setType] = useState<string>("call");
  const [priority, setPriority] = useState<string>("medium");
  const [assignee, setAssignee] = useState<string>("");
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const rows = prospectIds.map((id) => ({
        prospect_id: id, title: title.trim() || "Follow up", due_at: new Date(due).toISOString(), task_type: type, priority,
        assigned_to: assignee || perms.userId, created_by: perms.userId, notes: notes.trim() || null,
      }));
      const { error } = await prospectDb.from("prospect_follow_ups").insert(rows);
      if (error) throw error;
      await prospectDb.from("prospect_activities").insert(prospectIds.map((id) => ({
        prospect_id: id, activity_type: "follow_up", summary: `Follow-up scheduled: ${title.trim() || "Follow up"} (${new Date(due).toLocaleString("en-ZA")})`, performed_by: perms.userId,
      })));
    },
    onSuccess: () => { toast.success(`Follow-up created for ${prospectIds.length} prospect${prospectIds.length === 1 ? "" : "s"}`); onOpenChange(false); setNotes(""); onSaved(); },
    onError: (e) => toast.error(errorMessage(e, "Could not create follow-up")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create follow-up{prospectIds.length > 1 ? ` (${prospectIds.length} prospects)` : ""}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Task</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Due</Label><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FOLLOW_UP_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Priority</Label>
            <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Assigned to</Label>
            <Select value={assignee || perms.userId || ""} onValueChange={setAssignee}><SelectTrigger><SelectValue placeholder="Me" /></SelectTrigger><SelectContent>{(staff.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <Button disabled={!prospectIds.length || !due || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save follow-up"}</Button>
      </DialogContent>
    </Dialog>
  );
}
