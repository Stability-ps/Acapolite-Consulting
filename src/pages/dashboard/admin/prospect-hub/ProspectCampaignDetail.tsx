/* eslint-disable @typescript-eslint/no-explicit-any -- Prospect Hub tables are not in the generated Supabase types yet, so rows follow the explicit select list in each query. */
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Ban, Loader2, Pause, Play, Reply, Send, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyRow, Panel, StatCard, errorMessage, prospectDb, useProspectPermissions } from "@/components/prospect-hub/shared";
import { formatDate, skipReasonLabel } from "@/lib/prospectHub";
import { buildCampaignEmail, renderTemplate } from "@/lib/prospectTemplates";

export default function ProspectCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const perms = useProspectPermissions();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [confirmQueue, setConfirmQueue] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const data = useQuery({
    queryKey: ["prospect-campaign", id],
    enabled: !!id,
    refetchInterval: (q) => (["queued", "sending"].includes((q.state.data as any)?.campaign?.status) ? 15_000 : false),
    queryFn: async () => {
      const [c, r, s] = await Promise.all([
        prospectDb.from("prospect_campaigns").select("*").eq("id", id).single(),
        prospectDb.from("prospect_campaign_recipients").select("*, prospects(company_name,contact_name,sector,city,province)").eq("campaign_id", id).order("created_at").limit(5000),
        prospectDb.from("prospect_campaign_settings").select("sending_enabled,daily_limit,batch_size").order("created_at").limit(1).maybeSingle(),
      ]);
      if (c.error) throw c.error;
      return { campaign: c.data, recipients: r.data ?? [], settings: s.data };
    },
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["prospect-campaign", id] }); void qc.invalidateQueries({ queryKey: ["prospect-campaigns"] }); };

  const act = useMutation({
    mutationFn: async ({ fn, args }: { fn: string; args: Record<string, unknown>; ok?: string }) => {
      const { data: r, error } = await prospectDb.rpc(fn, args);
      if (error) throw error;
      return r;
    },
    onSuccess: (r, v) => { toast.success(v.ok ?? (r?.already ? "Already queued" : "Done")); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const c = data.data?.campaign;
  const recipients = useMemo(() => data.data?.recipients ?? [], [data.data]);
  const eligible = useMemo(() => recipients.filter((r: any) => r.status !== "skipped"), [recipients]);
  const filtered = useMemo(() => recipients.filter((r: any) => tab === "all" || (tab === "skipped" ? r.status === "skipped" : tab === "problems" ? ["failed", "bounced", "unsubscribed"].includes(r.status) : tab === "sent" ? Boolean(r.sent_at) : !["skipped"].includes(r.status) && !r.sent_at)), [recipients, tab]);
  const sample = eligible[0];
  const preview = useMemo(() => {
    if (!c || !sample) return null;
    const v = { company_name: sample.prospects?.company_name, contact_name: sample.prospects?.contact_name, sector: sample.prospects?.sector, city: sample.prospects?.city, province: sample.prospects?.province };
    if (sample.rendered_subject) return { subject: sample.rendered_subject, html: buildCampaignEmail({ body: sample.rendered_body_text ?? "", footer: "Acapolite Consulting", unsubscribeUrl: "#" }).html };
    return { subject: renderTemplate(c.subject, v).text, html: buildCampaignEmail({ body: renderTemplate(c.body_text, v).text, footer: "Acapolite Consulting (Pty) Ltd · Pretoria, Gauteng, South Africa · acapoliteconsulting.co.za", unsubscribeUrl: "#" }).html };
  }, [c, sample]);

  if (data.isLoading) return <Loader2 className="mx-auto h-6 w-6 animate-spin" />;
  if (!c) return <p className="text-sm text-muted-foreground">Campaign not found. <Link className="text-primary underline" to="../campaigns">Back</Link></p>;
  const isDraft = ["draft", "ready"].includes(c.status);

  return (
    <div className="space-y-4">
      <Link to="../campaigns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Campaigns</Link>
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{c.name}</h2>
          <p className="text-sm text-muted-foreground">Status: <span className="font-medium capitalize text-foreground">{c.status}</span> · created {formatDate(c.created_at, true)}{c.approved_at ? ` · approved ${formatDate(c.approved_at, true)}` : ""}{c.completed_at ? ` · completed ${formatDate(c.completed_at, true)}` : ""}</p>
          {data.data?.settings && !data.data.settings.sending_enabled && !isDraft ? <p className="mt-1 text-sm text-amber-700">Queued, but sending is switched off in Settings - nothing will be sent until an admin enables it.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && perms.canSend ? <Button disabled={!eligible.length || act.isPending} onClick={() => setConfirmQueue(true)}><Send className="mr-1 h-4 w-4" />Approve & queue</Button> : null}
          {isDraft && !perms.canSend ? <p className="text-sm text-muted-foreground">An authorised sender must approve this draft.</p> : null}
          {["queued", "sending"].includes(c.status) && perms.canSend ? <Button variant="outline" onClick={() => act.mutate({ fn: "set_prospect_campaign_state", args: { p_campaign_id: id, p_action: "pause" }, ok: "Paused" })}><Pause className="mr-1 h-4 w-4" />Pause</Button> : null}
          {c.status === "paused" && perms.canSend ? <Button variant="outline" onClick={() => act.mutate({ fn: "set_prospect_campaign_state", args: { p_campaign_id: id, p_action: "resume" }, ok: "Resumed" })}><Play className="mr-1 h-4 w-4" />Resume</Button> : null}
          {!["completed", "cancelled"].includes(c.status) && perms.canSend ? <Button variant="ghost" className="text-destructive" onClick={() => setConfirmCancel(true)}><Ban className="mr-1 h-4 w-4" />Cancel</Button> : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Eligible" value={c.total_recipients} />
        <StatCard label="Skipped" value={c.skipped_count} />
        <StatCard label="Sent (accepted)" value={c.sent_count} />
        <StatCard label="Failed / bounced" value={`${c.failed_count} / ${c.bounced_count}`} />
        <StatCard label="Replies" value={c.replied_count} />
        <StatCard label="Unsubscribed" value={c.unsubscribed_count} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Recipients" className="xl:col-span-2">
          <Tabs value={tab} onValueChange={setTab} className="mb-3">
            <TabsList className="flex-wrap"><TabsTrigger value="all">All ({recipients.length})</TabsTrigger><TabsTrigger value="pending">Pending</TabsTrigger><TabsTrigger value="sent">Sent</TabsTrigger><TabsTrigger value="skipped">Skipped</TabsTrigger><TabsTrigger value="problems">Problems</TabsTrigger></TabsList>
          </Tabs>
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground"><tr><th className="p-2">Prospect</th><th className="p-2">Status</th><th className="p-2">Detail</th><th className="p-2" /></tr></thead>
              <tbody>
                {filtered.map((r: any) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-2"><Link className="hover:underline" to={`../prospects/${r.prospect_id}`}>{r.prospects?.company_name}</Link><div className="text-xs text-muted-foreground">{r.email || "no email"}</div></td>
                    <td className="p-2 capitalize">{r.status}</td>
                    <td className="p-2 text-xs text-muted-foreground">{r.status === "skipped" ? skipReasonLabel(r.skip_reason) : r.error_message ?? (r.sent_at ? `Sent ${formatDate(r.sent_at, true)}` : "")}{r.override_by ? " · admin override" : ""}{r.replied_at ? " · replied" : ""}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {isDraft && r.status !== "skipped" && (perms.canManage || perms.canSend) ? <Button size="sm" variant="ghost" onClick={() => act.mutate({ fn: "remove_prospect_campaign_recipient", args: { p_recipient_id: r.id }, ok: "Removed" })}><Trash2 className="h-4 w-4" /></Button> : null}
                      {isDraft && r.skip_reason === "recently_contacted" && perms.isAdmin ? <Button size="sm" variant="ghost" onClick={() => { setOverrideFor(r.id); setOverrideReason(""); }}><ShieldAlert className="mr-1 h-4 w-4" />Override</Button> : null}
                      {r.sent_at && !r.replied_at && perms.canManage ? <Button size="sm" variant="ghost" onClick={() => act.mutate({ fn: "log_prospect_reply", args: { p_prospect_id: r.prospect_id, p_campaign_id: id, p_note: `Replied to campaign "${c.name}"` }, ok: "Reply logged" })}><Reply className="mr-1 h-4 w-4" />Replied</Button> : null}
                    </td>
                  </tr>
                ))}
                {!filtered.length ? <EmptyRow colSpan={4}>No recipients in this view.</EmptyRow> : null}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Email preview" description={sample ? `As sent to ${sample.prospects?.company_name}` : undefined}>
          {preview ? (
            <div className="rounded-xl border bg-white p-3 text-slate-800">
              <p className="mb-2 border-b pb-2 text-sm"><strong>Subject:</strong> {preview.subject}</p>
              <iframe title="Email preview" className="h-96 w-full" sandbox="" srcDoc={preview.html} />
            </div>
          ) : <p className="text-sm text-muted-foreground">No eligible recipients.</p>}
        </Panel>
      </div>

      <AlertDialog open={confirmQueue} onOpenChange={setConfirmQueue}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve and queue "{c.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {eligible.length} recipient(s) will be queued. {c.skipped_count} are excluded by suppression and duplicate checks. Every recipient is re-checked against the suppression list immediately before sending.
              {data.data?.settings?.sending_enabled ? ` Emails go out in batches of ${data.data.settings.batch_size} every 5 minutes (max ${data.data.settings.daily_limit}/day).` : " Sending is currently switched off, so nothing will be sent until an admin enables it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={act.isPending} onClick={() => act.mutate({ fn: "queue_prospect_campaign", args: { p_campaign_id: id }, ok: "Campaign approved and queued" })}>Approve & queue</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancel this campaign?</AlertDialogTitle><AlertDialogDescription>Unsent recipients are skipped. Emails already sent cannot be recalled. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep campaign</AlertDialogCancel><AlertDialogAction onClick={() => act.mutate({ fn: "set_prospect_campaign_state", args: { p_campaign_id: id, p_action: "cancel" }, ok: "Campaign cancelled" })}>Cancel campaign</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(overrideFor)} onOpenChange={(v) => !v && setOverrideFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Override "recently contacted"?</AlertDialogTitle><AlertDialogDescription>Admin only. This prospect was emailed recently. The override and your reason are recorded in the audit log. Unsubscribes, bounces, complaints and do-not-contact can never be overridden.</AlertDialogDescription></AlertDialogHeader>
          <Input placeholder="Reason (required)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={!overrideReason.trim()} onClick={() => overrideFor && act.mutate({ fn: "override_prospect_campaign_recipient", args: { p_recipient_id: overrideFor, p_reason: overrideReason }, ok: "Override recorded" })}>Override</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
