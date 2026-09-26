/* eslint-disable @typescript-eslint/no-explicit-any -- Prospect Hub tables are not in the generated Supabase types yet, so rows follow the explicit select list in each query. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Merge, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyRow, Panel, errorMessage, prospectDb, useProspectPermissions } from "@/components/prospect-hub/shared";
import { formatDate, skipReasonLabel } from "@/lib/prospectHub";

export default function ProspectSources() {
  const perms = useProspectPermissions();
  const qc = useQueryClient();
  const [supEmail, setSupEmail] = useState("");
  const [supReason, setSupReason] = useState("manually_blocked");
  const [liftFor, setLiftFor] = useState<{ id: string; email: string } | null>(null);
  const [liftReason, setLiftReason] = useState("");
  const [mergeFor, setMergeFor] = useState<{ keep: { id: string; company_name: string }; merge: { id: string; company_name: string } } | null>(null);

  const data = useQuery({
    queryKey: ["prospect-sources-page"],
    queryFn: async () => {
      const [sources, dups, sups] = await Promise.all([
        prospectDb.from("prospect_sources").select("*").order("name"),
        prospectDb.from("prospect_duplicate_candidates").select("id,reason,created_at,prospect_id,candidate_prospect_id,a:prospects!prospect_duplicate_candidates_prospect_id_fkey(id,company_name,registration_number,email,city),b:prospects!prospect_duplicate_candidates_candidate_prospect_id_fkey(id,company_name,registration_number,email,city)").eq("status", "pending").order("created_at", { ascending: false }).limit(100),
        prospectDb.from("prospect_email_suppressions").select("*").is("lifted_at", null).order("created_at", { ascending: false }).limit(200),
      ]);
      for (const r of [sources, dups, sups]) if (r.error) throw r.error;
      return { sources: sources.data ?? [], dups: dups.data ?? [], sups: sups.data ?? [] };
    },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["prospect-sources-page"] });

  const toggleSource = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await prospectDb.from("prospect_sources").update({ enabled, status: enabled ? "unknown" : "disabled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Source updated"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rpc = useMutation({
    mutationFn: async ({ fn, args }: { fn: string; args: Record<string, unknown> }) => {
      const { error } = await prospectDb.rpc(fn, args);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Done"); refresh(); setSupEmail(""); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <Panel title="Source registry" description="Procurement, enrichment, court judgments and public insolvency/liquidation sources. Public-record signals are evidence-led: they do not imply SARS non-compliance unless the cited record explicitly establishes the tax issue. Authentication, CAPTCHAs and access restrictions are never bypassed.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-2">Source</th><th className="p-2">Type</th><th className="p-2">Status</th><th className="p-2">Last success</th><th className="p-2">Last attempt</th><th className="p-2">Records</th><th className="p-2">Prospects created</th><th className="p-2">Failures</th><th className="p-2">Schedule</th><th className="p-2">Enabled</th></tr></thead>
            <tbody>
              {(data.data?.sources ?? []).map((s: any) => (
                <tr key={s.id} className="border-b align-top last:border-0">
                  <td className="p-2"><p className="font-medium">{s.name}</p>{s.notes ? <p className="max-w-sm text-xs text-muted-foreground">{s.notes}</p> : null}{s.terms_url ? <a className="text-xs text-primary underline" href={s.terms_url} target="_blank" rel="noreferrer">API / terms</a> : null}{s.last_error ? <p className="text-xs text-destructive">Last error: {s.last_error}</p> : null}</td>
                  <td className="p-2 text-xs">{s.source_type.replace(/_/g, " ")}</td>
                  <td className="p-2 capitalize">{s.enabled ? s.status : "disabled"}</td>
                  <td className="p-2 text-xs">{formatDate(s.last_success_at, true)}</td>
                  <td className="p-2 text-xs">{formatDate(s.last_attempt_at, true)}</td>
                  <td className="p-2">{s.records_discovered}</td>
                  <td className="p-2">{s.prospects_created}</td>
                  <td className="p-2">{s.total_failures}{s.consecutive_failures ? ` (${s.consecutive_failures} in a row)` : ""}</td>
                  <td className="p-2 text-xs">{s.schedule_description ?? "—"}</td>
                  <td className="p-2"><Switch disabled={!perms.canManage || ["manual", "import"].includes(s.key)} checked={s.enabled} onCheckedChange={(v) => toggleSource.mutate({ id: s.id, enabled: v })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Possible duplicates" description="Flagged when a new company's name is similar to, or shares an email/website/phone with, an existing prospect. They are never merged automatically.">
        <ul className="divide-y text-sm">
          {(data.data?.dups ?? []).map((d: any) => (
            <li key={d.id} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p><Link className="font-medium hover:underline" to={`../prospects/${d.a?.id}`}>{d.a?.company_name}</Link> <span className="text-muted-foreground">vs</span> <Link className="font-medium hover:underline" to={`../prospects/${d.b?.id}`}>{d.b?.company_name}</Link></p>
                <p className="text-xs text-muted-foreground">Reason: {d.reason.replace(/_/g, " ")} · {[d.a?.registration_number, d.b?.registration_number].filter(Boolean).join(" / ") || "no registration numbers"} · flagged {formatDate(d.created_at)}</p>
              </div>
              {perms.canManage ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => rpc.mutate({ fn: "resolve_prospect_duplicate", args: { p_candidate_id: d.id, p_status: "dismissed" } })}><X className="mr-1 h-4 w-4" />Different companies</Button>
                  <Button size="sm" variant="outline" onClick={() => setMergeFor({ keep: d.b, merge: d.a })}><Merge className="mr-1 h-4 w-4" />Merge into "{d.b?.company_name}"</Button>
                </div>
              ) : null}
            </li>
          ))}
          {data.isSuccess && !data.data.dups.length ? <li className="py-6 text-center text-muted-foreground">No possible duplicates awaiting review.</li> : null}
        </ul>
      </Panel>

      <Panel title="Marketing suppression list" description="Addresses excluded from all prospect campaigns (checked server-side before every send). Transactional and client-service email is not affected.">
        {perms.canManage ? (
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <Input placeholder="email@example.co.za" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} />
            <Select value={supReason} onValueChange={setSupReason}><SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger><SelectContent>{["manually_blocked", "do_not_contact", "invalid_email", "hard_bounce", "complaint", "unsubscribed"].map((r) => <SelectItem key={r} value={r}>{skipReasonLabel(r)}</SelectItem>)}</SelectContent></Select>
            <Button disabled={!supEmail.trim()} onClick={() => rpc.mutate({ fn: "add_prospect_suppression", args: { p_email: supEmail.trim(), p_reason: supReason, p_notes: null } })}><Plus className="mr-1 h-4 w-4" />Suppress</Button>
          </div>
        ) : null}
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Email</th><th className="p-2">Reason</th><th className="p-2">Added</th><th className="p-2" /></tr></thead>
            <tbody>
              {(data.data?.sups ?? []).map((s: any) => (
                <tr key={s.id} className="border-t">
                  <td className="p-2">{s.email}</td><td className="p-2">{skipReasonLabel(s.reason)}</td><td className="p-2 text-xs">{formatDate(s.created_at, true)}</td>
                  <td className="p-2 text-right">{perms.isAdmin ? <Button size="sm" variant="ghost" onClick={() => { setLiftFor({ id: s.id, email: s.email }); setLiftReason(""); }}>Lift</Button> : null}</td>
                </tr>
              ))}
              {data.isSuccess && !data.data.sups.length ? <EmptyRow colSpan={4}>No suppressed addresses.</EmptyRow> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <AlertDialog open={Boolean(mergeFor)} onOpenChange={(v) => !v && setMergeFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge "{mergeFor?.merge.company_name}" into "{mergeFor?.keep.company_name}"?</AlertDialogTitle>
            <AlertDialogDescription>Notes, calls, follow-ups, evidence and campaign history move to "{mergeFor?.keep.company_name}"; blank fields are filled from the duplicate, and the duplicate record is then deleted. Merging is refused if the registration numbers differ. This cannot be undone (the merged record is kept in the audit log).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => mergeFor && rpc.mutate({ fn: "merge_prospects", args: { p_keep_id: mergeFor.keep.id, p_merge_id: mergeFor.merge.id } })}>Merge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(liftFor)} onOpenChange={(v) => !v && setLiftFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lift suppression for {liftFor?.email}?</AlertDialogTitle>
            <AlertDialogDescription>Admin override. Only do this if the recipient has asked to receive emails again. The reason is recorded in the audit log.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input placeholder="Reason (required)" value={liftReason} onChange={(e) => setLiftReason(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!liftReason.trim()} onClick={() => liftFor && rpc.mutate({ fn: "lift_prospect_suppression", args: { p_suppression_id: liftFor.id, p_reason: liftReason.trim() } })}>Lift suppression</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
