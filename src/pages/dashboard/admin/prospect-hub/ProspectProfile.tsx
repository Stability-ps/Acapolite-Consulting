/* eslint-disable @typescript-eslint/no-explicit-any -- Prospect Hub tables are not in the generated Supabase types yet, so rows follow the explicit select list in each query. */
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Ban, BadgeCheck, CalendarPlus, ExternalLink, Globe, Loader2, Mail, MessageCircle, Pencil, Phone, PhoneCall,
  Reply, Sparkles, StickyNote, UserCheck, Building2, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel, ScoreBadge, StageBadge, errorMessage, prospectDb, staffName, useProspectPermissions, useStaffMembers } from "@/components/prospect-hub/shared";
import { FollowUpDialog } from "@/components/prospect-hub/FollowUpDialog";
import { CALL_OUTCOMES, PROSPECT_STAGES, PROVINCES, SECTORS, enrichmentLabel, formatDate, whatsappLink } from "@/lib/prospectHub";

type Timeline = { id: string; at: string; kind: string; title: string; detail?: string | null; by?: string | null };

export default function ProspectProfile() {
  const { id } = useParams<{ id: string }>();
  const perms = useProspectPermissions();
  const staff = useStaffMembers();
  const qc = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [dncOpen, setDncOpen] = useState(false);

  const data = useQuery({
    queryKey: ["prospect-profile", id],
    enabled: !!id,
    queryFn: async () => {
      const [p, notes, activities, followUps, records, contacts, recipients] = await Promise.all([
        prospectDb.from("prospects").select("*").eq("id", id).single(),
        prospectDb.from("prospect_notes").select("*").eq("prospect_id", id).order("created_at", { ascending: false }),
        prospectDb.from("prospect_activities").select("*").eq("prospect_id", id).order("occurred_at", { ascending: false }).limit(200),
        prospectDb.from("prospect_follow_ups").select("*").eq("prospect_id", id).order("due_at"),
        prospectDb.from("prospect_source_records").select("*").eq("prospect_id", id).order("award_date", { ascending: false, nullsFirst: false }),
        prospectDb.from("prospect_contacts").select("*").eq("prospect_id", id).order("created_at", { ascending: false }),
        prospectDb.from("prospect_campaign_recipients").select("id,campaign_id,status,sent_at,replied_at,skip_reason,prospect_campaigns(name)").eq("prospect_id", id).order("created_at", { ascending: false }),
      ]);
      if (p.error) throw p.error;
      return { prospect: p.data, notes: notes.data ?? [], activities: activities.data ?? [], followUps: followUps.data ?? [], records: records.data ?? [], contacts: contacts.data ?? [], recipients: recipients.data ?? [] };
    },
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["prospect-profile", id] }); void qc.invalidateQueries({ queryKey: ["prospect-list"] }); };

  const rpc = useMutation({
    mutationFn: async ({ fn, args }: { fn: string; args: Record<string, unknown>; success?: string }) => {
      const { data: result, error } = await prospectDb.rpc(fn, args);
      if (error) throw error;
      return result;
    },
    onSuccess: (_r, v) => { if (v.success) toast.success(v.success); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await prospectDb.from("prospects").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); refresh(); },
    onError: (e) => toast.error(errorMessage(e, "Could not save")),
  });

  const enrich = useMutation({
    mutationFn: async () => {
      const { data: r, error } = await prospectDb.functions.invoke("prospect-web-enrichment", { body: { trigger: "manual", prospect_ids: [id] } });
      if (error) throw error;
      if (!r?.ok) throw new Error(r?.error || "Enrichment failed");
      return r;
    },
    onSuccess: (r) => { toast.success(`Enrichment finished: ${r.prospects_updated ? "contact details added" : "no new details"}`); refresh(); },
    onError: (e) => toast.error(errorMessage(e, "Enrichment failed")),
  });

  const logActivity = async (activity_type: string, summary: string, metadata: Record<string, unknown> = {}) => {
    await prospectDb.from("prospect_activities").insert({ prospect_id: id, activity_type, direction: "outbound", summary, performed_by: perms.userId, metadata });
    await prospectDb.from("prospects").update({ last_contacted_at: new Date().toISOString(), ...(p?.status === "new" ? { status: "contacted" } : {}) }).eq("id", id);
    refresh();
  };

  const p = data.data?.prospect;
  const timeline: Timeline[] = useMemo(() => {
    if (!data.data) return [];
    const items: Timeline[] = [
      ...data.data.activities.map((a: any) => ({ id: a.id, at: a.occurred_at, kind: a.activity_type, title: a.summary, detail: a.outcome ? `Outcome: ${String(a.outcome).replace(/_/g, " ")}${a.metadata?.next_action ? ` · Next: ${a.metadata.next_action}` : ""}` : null, by: a.performed_by })),
      ...data.data.notes.map((n: any) => ({ id: n.id, at: n.created_at, kind: "note", title: n.body, by: n.created_by })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [data.data]);

  if (data.isLoading) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (data.isError || !p) return <p className="rounded-xl border p-6 text-sm text-muted-foreground">Prospect not found or you do not have access. <Link className="text-primary underline" to="../prospects">Back to prospects</Link></p>;

  const converted = Boolean(p.converted_client_id);
  const wa = whatsappLink(p.whatsapp || p.phone);

  return (
    <div className="space-y-4">
      <Link to="../prospects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Prospects</Link>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{p.company_name}</h2>
              <StageBadge stage={p.status} />
              {p.do_not_contact ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Do not contact</span> : null}
              {p.email_opt_out_at ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Unsubscribed</span> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {[p.sector, [p.city, p.province].filter(Boolean).join(", "), p.registration_number ? `Reg. ${p.registration_number}` : null].filter(Boolean).join(" · ") || "No location or sector recorded"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Assigned: {staffName(staff.data, p.assigned_to)} · Discovered {formatDate(p.discovered_at)} via {p.source_name ?? "manual entry"}</p>
            {converted ? <p className="mt-2 text-sm"><Link className="text-primary underline" to={`/dashboard/staff/client-workspace?clientId=${p.converted_client_id}`}>Open client record</Link> (converted {formatDate(p.converted_at)})</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right"><p className="text-xs text-muted-foreground">Fit score</p><ScoreBadge score={p.score} /></div>
          </div>
        </div>

        {perms.canManage ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}><StickyNote className="mr-1 h-4 w-4" />Add note</Button>
            <Button size="sm" variant="outline" onClick={() => setCallOpen(true)}><PhoneCall className="mr-1 h-4 w-4" />Log call</Button>
            {p.email && !p.do_not_contact ? (
              <Button size="sm" variant="outline" asChild>
                <a href={`mailto:${p.email}`} onClick={() => void logActivity("email", `Email opened in mail client to ${p.email}`)}><Mail className="mr-1 h-4 w-4" />Send email</a>
              </Button>
            ) : null}
            {wa && !p.do_not_contact ? (
              <Button size="sm" variant="outline" asChild>
                <a href={wa} target="_blank" rel="noreferrer" onClick={() => void logActivity("whatsapp", `WhatsApp chat opened to ${p.whatsapp || p.phone}`)}><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</a>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setFollowOpen(true)}><CalendarPlus className="mr-1 h-4 w-4" />Create follow-up</Button>
            <Button size="sm" variant="outline" disabled={enrich.isPending} onClick={() => enrich.mutate()}>{enrich.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}Enrich</Button>
            <Button size="sm" variant="outline" onClick={() => rpc.mutate({ fn: "log_prospect_reply", args: { p_prospect_id: id, p_campaign_id: null, p_note: "Prospect replied" }, success: "Reply logged" })}><Reply className="mr-1 h-4 w-4" />Log reply</Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>
            {!converted ? <Button size="sm" variant="secondary" onClick={() => setLeadOpen(true)}><UserCheck className="mr-1 h-4 w-4" />{p.lead_at ? "Lead details" : "Convert to lead"}</Button> : null}
            {!converted ? <Button size="sm" onClick={() => setConvertOpen(true)}><Building2 className="mr-1 h-4 w-4" />Convert to client</Button> : null}
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDncOpen(true)}><Ban className="mr-1 h-4 w-4" />{p.do_not_contact ? "Remove do-not-contact" : "Do not contact"}</Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-1">
          <Panel title="Contact" description="Public business contact details only.">
            <dl className="space-y-3 text-sm">
              <ContactRow icon={Mail} label="Email" value={p.email} source={p.email_source_url} verifiedAt={p.email_verified_at} onVerify={perms.canManage && p.email ? () => rpc.mutate({ fn: "verify_prospect_contact", args: { p_prospect_id: id, p_field: "email" }, success: "Email marked verified" }) : undefined} />
              <ContactRow icon={Phone} label="Phone" value={p.phone} source={p.phone_source_url} verifiedAt={p.phone_verified_at} onVerify={perms.canManage && p.phone ? () => rpc.mutate({ fn: "verify_prospect_contact", args: { p_prospect_id: id, p_field: "phone" }, success: "Phone marked verified" }) : undefined} />
              <ContactRow icon={Globe} label="Website" value={p.website} href={p.website} verifiedAt={p.website_verified_at} onVerify={perms.canManage && p.website ? () => rpc.mutate({ fn: "verify_prospect_contact", args: { p_prospect_id: id, p_field: "website" }, success: "Website marked verified" }) : undefined} />
              <ContactRow icon={MessageCircle} label="WhatsApp" value={p.whatsapp} />
              <ContactRow icon={UserCheck} label="Published contact person" value={p.contact_name ? `${p.contact_name}${p.contact_title ? ` (${p.contact_title})` : ""}` : null} />
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Enrichment: {enrichmentLabel(p.enrichment_status)} · last checked {formatDate(p.enrichment_checked_at, true)}{p.enrichment_error ? ` · ${String(p.enrichment_error).replace(/_/g, " ")}` : ""}</p>
            {p.metadata?.enrichment_candidate_website ? (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Possible website needing review: <a className="underline" href={p.metadata.enrichment_candidate_website} target="_blank" rel="noreferrer">{p.metadata.enrichment_candidate_website}</a> ({p.metadata.enrichment_identity_evidence}). Add it via Edit only if it clearly belongs to this company.</p>
            ) : null}
          </Panel>

          <Panel title="Fit score breakdown" description="Relevance as a potential Acapolite customer. Not a statement about SARS compliance.">
            <ul className="space-y-1 text-sm">
              {(p.score_reasons ?? []).map((r: any, i: number) => <li key={i} className="flex justify-between gap-2"><span>{r.label}</span><span className="font-medium text-emerald-700">+{r.points}</span></li>)}
              {!(p.score_reasons ?? []).length ? <li className="text-muted-foreground">No scoring factors yet.</li> : null}
              <li className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{p.score}</span></li>
            </ul>
          </Panel>

          <Panel title="Follow-ups">
            <ul className="space-y-2 text-sm">
              {data.data!.followUps.map((f: any) => (
                <li key={f.id} className="flex items-start justify-between gap-2">
                  <div><p className={f.status !== "open" ? "text-muted-foreground line-through" : ""}>{f.title}</p><p className="text-xs text-muted-foreground">{formatDate(f.due_at, true)} · {f.task_type} · {staffName(staff.data, f.assigned_to)}</p></div>
                  {f.status === "open" && perms.canManage ? <Button size="sm" variant="ghost" onClick={async () => { const { error } = await prospectDb.from("prospect_follow_ups").update({ status: "completed", completed_at: new Date().toISOString(), completed_by: perms.userId }).eq("id", f.id); if (error) toast.error(error.message); else refresh(); }}>Done</Button> : <span className="text-xs capitalize text-muted-foreground">{f.status}</span>}
                </li>
              ))}
              {!data.data!.followUps.length ? <li className="text-muted-foreground">No follow-ups.</li> : null}
            </ul>
          </Panel>

          {perms.canManage ? (
            <Panel title="Stage & assignment">
              <div className="space-y-3">
                <div className="space-y-1"><Label className="text-xs">Stage</Label>
                  <Select value={p.status} disabled={converted} onValueChange={(v) => update.mutate({ status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PROSPECT_STAGES.filter((s) => s.value !== "converted" || converted).map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Assigned staff</Label>
                  <Select value={p.assigned_to ?? "__none"} onValueChange={(v) => update.mutate({ assigned_to: v === "__none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__none">Unassigned</SelectItem>{(staff.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Panel title="Source & procurement evidence" description="Why this business is in Prospect Hub. Procurement activity indicates a potential customer; it says nothing about SARS status.">
            <p className="mb-2 text-sm">Original source: <strong>{p.source_name ?? "Manual entry"}</strong>{p.source_url ? <> · <a className="text-primary underline" href={p.source_url} target="_blank" rel="noreferrer">source record</a></> : null} · last seen {formatDate(p.source_last_seen_at)}</p>
            {data.data!.records.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Tender / award</th><th>Buyer</th><th>Value</th><th>Date</th></tr></thead>
                  <tbody>
                    {data.data!.records.map((r: any) => (
                      <tr key={r.id} className="border-t align-top">
                        <td className="py-2 pr-2"><p>{r.tender_title || r.tender_reference || r.source_record_id}</p><p className="text-xs text-muted-foreground">{[r.tender_reference, r.tender_category, r.supplier_size].filter(Boolean).join(" · ")}{r.source_url ? <> · <a className="underline" href={r.source_url} target="_blank" rel="noreferrer">official record</a></> : null}</p></td>
                        <td className="py-2 pr-2">{r.buyer_name ?? "—"}</td>
                        <td className="py-2 pr-2 whitespace-nowrap">{r.award_value ? `${r.award_currency ?? "ZAR"} ${Number(r.award_value).toLocaleString("en-ZA")}` : "—"}</td>
                        <td className="py-2 whitespace-nowrap text-xs">{formatDate(r.award_date ?? r.first_seen_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-muted-foreground">No procurement records attached.</p>}
          </Panel>

          <Panel title="Enrichment evidence" description="Every value found on a company website is recorded with the page it came from.">
            <ul className="space-y-1 text-sm">
              {data.data!.contacts.map((c: any) => (
                <li key={c.id} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span><span className="capitalize text-muted-foreground">{c.contact_type}:</span> {c.value}</span><span className="text-xs text-muted-foreground">{c.source_url ? <a className="underline" href={c.source_url} target="_blank" rel="noreferrer">{c.source_url}</a> : c.label} · {formatDate(c.created_at)}</span></li>
              ))}
              {!data.data!.contacts.length ? <li className="text-muted-foreground">No enrichment evidence yet.</li> : null}
            </ul>
          </Panel>

          {data.data!.recipients.length ? (
            <Panel title="Campaigns">
              <ul className="space-y-1 text-sm">
                {data.data!.recipients.map((r: any) => <li key={r.id} className="flex justify-between gap-2"><Link className="hover:underline" to={`../campaigns/${r.campaign_id}`}>{r.prospect_campaigns?.name}</Link><span className="text-xs capitalize text-muted-foreground">{r.status}{r.sent_at ? ` · ${formatDate(r.sent_at)}` : ""}</span></li>)}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Activity timeline">
            <ol className="space-y-3">
              {timeline.map((t) => (
                <li key={`${t.kind}-${t.id}`} className="border-l-2 border-primary/30 pl-3">
                  <p className="text-xs text-muted-foreground"><span className="font-medium capitalize text-foreground">{t.kind.replace(/_/g, " ")}</span> · {formatDate(t.at, true)}{t.by ? ` · ${staffName(staff.data, t.by)}` : " · system"}</p>
                  <p className="whitespace-pre-wrap text-sm">{t.title}</p>
                  {t.detail ? <p className="text-xs text-muted-foreground">{t.detail}</p> : null}
                </li>
              ))}
              {!timeline.length ? <li className="text-sm text-muted-foreground">No activity yet.</li> : null}
            </ol>
          </Panel>
        </div>
      </div>

      <NoteDialog open={noteOpen} onOpenChange={setNoteOpen} prospectId={id!} onSaved={refresh} />
      <CallDialog open={callOpen} onOpenChange={setCallOpen} prospectId={id!} onSaved={refresh} />
      <FollowUpDialog open={followOpen} onOpenChange={setFollowOpen} prospectIds={[id!]} onSaved={refresh} />
      <LeadDialog open={leadOpen} onOpenChange={setLeadOpen} prospect={p} onSaved={refresh} />
      <ConvertDialog open={convertOpen} onOpenChange={setConvertOpen} prospect={p} canConvert={perms.canManageClients} onSaved={refresh} />
      <EditDialog open={editOpen} onOpenChange={setEditOpen} prospect={p} onSave={(patch) => update.mutate(patch, { onSuccess: () => setEditOpen(false) })} />
      <Dialog open={dncOpen} onOpenChange={setDncOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{p.do_not_contact ? "Remove do-not-contact?" : "Mark as do-not-contact?"}</DialogTitle>
            <DialogDescription>{p.do_not_contact ? "The prospect becomes eligible for outreach again (unsubscribes, bounces and complaints still apply)." : "The prospect is excluded from all campaigns and the email address is added to the marketing suppression list."} This is audited.</DialogDescription>
          </DialogHeader>
          <Button variant={p.do_not_contact ? "default" : "destructive"} onClick={() => rpc.mutate({ fn: "set_prospects_do_not_contact", args: { p_ids: [id], p_do_not_contact: !p.do_not_contact, p_reason: p.do_not_contact ? "Removed by staff" : "Marked by staff" }, success: "Updated" }, { onSuccess: () => setDncOpen(false) })}>Confirm</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactRow({ icon: Icon, label, value, href, source, verifiedAt, onVerify }: { icon: typeof Mail; label: string; value: string | null; href?: string | null; source?: string | null; verifiedAt?: string | null; onVerify?: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words">
          {value ? (href ? <a className="text-primary underline" href={href} target="_blank" rel="noreferrer">{value} <ExternalLink className="inline h-3 w-3" /></a> : value) : <span className="text-muted-foreground">Not known</span>}
          {verifiedAt ? <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-emerald-700"><BadgeCheck className="h-3 w-3" />verified</span> : null}
        </dd>
        {source ? <a className="text-xs text-muted-foreground underline" href={source} target="_blank" rel="noreferrer">source</a> : null}
      </div>
      {onVerify && !verifiedAt ? <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onVerify}><ShieldCheck className="mr-1 h-3 w-3" />Verify</Button> : null}
    </div>
  );
}

function NoteDialog({ open, onOpenChange, prospectId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; prospectId: string; onSaved: () => void }) {
  const perms = useProspectPermissions();
  const [body, setBody] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await prospectDb.from("prospect_notes").insert({ prospect_id: prospectId, body: body.trim(), created_by: perms.userId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Note added"); setBody(""); onOpenChange(false); onSaved(); },
    onError: (e) => toast.error(errorMessage(e, "Could not save note")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add note</DialogTitle><DialogDescription>Notes are permanent history and cannot be edited later.</DialogDescription></DialogHeader>
        <Textarea className="min-h-32" value={body} onChange={(e) => setBody(e.target.value)} placeholder="e.g. Already has an accountant; open to a TCS review before next tender." />
        <Button disabled={!body.trim() || save.isPending} onClick={() => save.mutate()}>Save note</Button>
      </DialogContent>
    </Dialog>
  );
}

function CallDialog({ open, onOpenChange, prospectId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; prospectId: string; onSaved: () => void }) {
  const [outcome, setOutcome] = useState("no_answer");
  const [note, setNote] = useState("");
  const [at, setAt] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
  const [followUp, setFollowUp] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [stage, setStage] = useState("__auto");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await prospectDb.rpc("log_prospect_call", {
        p_prospect_id: prospectId, p_outcome: outcome, p_note: note.trim() || null, p_occurred_at: new Date(at).toISOString(),
        p_next_action: nextAction.trim() || null, p_follow_up_at: followUp ? new Date(followUp).toISOString() : null, p_new_status: stage === "__auto" ? null : stage,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Call logged"); setNote(""); setFollowUp(""); setNextAction(""); onOpenChange(false); onSaved(); },
    onError: (e) => toast.error(errorMessage(e, "Could not log call")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Log call</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label className="text-xs">Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CALL_OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Date & time</Label><Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Asked us to call Monday" /></div>
          <div className="space-y-1"><Label className="text-xs">Next action</Label><Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="e.g. Send TCS info pack" /></div>
          <div className="space-y-1"><Label className="text-xs">Follow-up date (optional)</Label><Input type="datetime-local" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Stage</Label>
            <Select value={stage} onValueChange={setStage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__auto">Update automatically</SelectItem>{PROSPECT_STAGES.filter((s) => s.value !== "converted").map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>Save call</Button>
      </DialogContent>
    </Dialog>
  );
}

function LeadDialog({ open, onOpenChange, prospect, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; prospect: any; onSaved: () => void }) {
  const [interest, setInterest] = useState(prospect.lead_service_interest ?? "");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await prospectDb.rpc("mark_prospect_as_lead", { p_prospect_id: prospect.id, p_service_interest: interest.trim() || null, p_note: note.trim() || null });
      if (error) throw error;
      return data;
    },
    onSuccess: (r) => { toast.success(r?.status === "already_lead" ? "Already a qualified lead" : "Converted to qualified lead"); onOpenChange(false); onSaved(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{prospect.lead_at ? "Qualified lead" : "Convert to qualified lead"}</DialogTitle>
          <DialogDescription>The lead stays in Prospect Hub with its full history and source attribution. It is not published to the practitioner marketplace.</DialogDescription>
        </DialogHeader>
        {prospect.lead_at ? <p className="text-sm">Lead since {formatDate(prospect.lead_at, true)}{prospect.lead_service_interest ? ` · Interest: ${prospect.lead_service_interest}` : ""}</p> : (
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Service interest</Label><Input value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="e.g. Tax Compliance Status for tender" /></div>
            <div className="space-y-1"><Label className="text-xs">Qualification note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>Convert to lead</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConvertDialog({ open, onOpenChange, prospect, canConvert, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; prospect: any; canConvert: boolean; onSaved: () => void }) {
  const [clientType, setClientType] = useState("company");
  const matches = useQuery({
    queryKey: ["prospect-client-matches", prospect.id, open],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await prospectDb.rpc("convert_prospect_to_client", { p_prospect_id: prospect.id, p_mode: "check" });
      if (error) throw error;
      return (data?.matches ?? []) as Array<{ client_id: string; display_name: string; email: string | null; phone: string | null; company_registration_number: string | null; match_reasons: string[] }>;
    },
  });
  const convert = useMutation({
    mutationFn: async (args: { mode: "create_new" | "link_existing"; clientId?: string; confirm?: boolean }) => {
      const { data, error } = await prospectDb.rpc("convert_prospect_to_client", {
        p_prospect_id: prospect.id, p_mode: args.mode, p_existing_client_id: args.clientId ?? null, p_confirm_despite_matches: args.confirm ?? false, p_client_type: clientType,
      });
      if (error) throw error;
      if (data?.status === "possible_duplicates") throw new Error("Possible existing client found - review the matches below.");
      return data;
    },
    onSuccess: () => { toast.success("Converted to client"); onOpenChange(false); onSaved(); },
    onError: (e) => toast.error(errorMessage(e, "Conversion failed")),
  });
  const list = matches.data ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Convert to client</DialogTitle>
          <DialogDescription>Creates (or links) a record in the existing Acapolite clients list using the details already known. Source attribution and history stay on the prospect, and the prospect is removed from future marketing campaigns.</DialogDescription>
        </DialogHeader>
        {!canConvert ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">You need client-management permission to convert prospects to clients.</p> : null}
        {matches.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {list.length ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-800">Possible existing client{list.length > 1 ? "s" : ""}:</p>
            {list.map((m) => (
              <div key={m.client_id} className="flex flex-col gap-2 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium">{m.display_name}</p><p className="text-xs text-muted-foreground">{[m.email, m.phone, m.company_registration_number].filter(Boolean).join(" · ")} · matched on {m.match_reasons.join(", ").replace(/_/g, " ")}</p></div>
                <Button size="sm" disabled={!canConvert || convert.isPending} onClick={() => convert.mutate({ mode: "link_existing", clientId: m.client_id })}>Link to this client</Button>
              </div>
            ))}
          </div>
        ) : matches.isSuccess ? <p className="text-sm text-muted-foreground">No existing client matches the registration number, company name, email or phone.</p> : null}
        <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end">
          <div className="space-y-1"><Label className="text-xs">Client type</Label>
            <Select value={clientType} onValueChange={setClientType}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="company">Company</SelectItem><SelectItem value="individual">Individual</SelectItem><SelectItem value="trust">Trust</SelectItem><SelectItem value="npo">NPO</SelectItem></SelectContent></Select>
          </div>
          <Button variant={list.length ? "outline" : "default"} disabled={!canConvert || convert.isPending || matches.isLoading} onClick={() => convert.mutate({ mode: "create_new", confirm: list.length > 0 })}>
            {list.length ? "Create a new client anyway" : "Create client"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ open, onOpenChange, prospect, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; prospect: any; onSave: (patch: Record<string, unknown>) => void }) {
  const fields = ["company_name", "registration_number", "sector", "industry", "city", "province", "physical_address", "email", "phone", "whatsapp", "website", "contact_name", "contact_title"] as const;
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f, prospect[f] ?? ""])));
  const labels: Record<string, string> = { company_name: "Company name", registration_number: "Registration number", sector: "Sector", industry: "Industry", city: "City", province: "Province", physical_address: "Public business address", email: "Public email", phone: "Public phone", whatsapp: "Public WhatsApp", website: "Website", contact_name: "Published contact person", contact_title: "Contact title" };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) setForm(Object.fromEntries(fields.map((f) => [f, prospect[f] ?? ""]))); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Edit prospect</DialogTitle><DialogDescription>Changes to contact fields are audited. Only record publicly available business information.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f} className="space-y-1">
              <Label className="text-xs">{labels[f]}</Label>
              {f === "sector" || f === "province" ? (
                <Select value={form[f] || "__none"} onValueChange={(v) => setForm((s) => ({ ...s, [f]: v === "__none" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">Not specified</SelectItem>{(f === "sector" ? SECTORS : PROVINCES).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              ) : <Input value={form[f]} onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))} />}
            </div>
          ))}
        </div>
        <Button disabled={!form.company_name?.trim()} onClick={() => {
          const patch: Record<string, unknown> = {};
          for (const f of fields) { const v = form[f]?.trim() || null; if (v !== (prospect[f] ?? null)) patch[f] = v; }
          if ("website" in patch && patch.website) patch.website_source = "manual";
          if ("email" in patch) patch.email_verified_at = null;
          if ("phone" in patch) patch.phone_verified_at = null;
          if (Object.keys(patch).length) onSave(patch); else onOpenChange(false);
        }}>Save changes</Button>
      </DialogContent>
    </Dialog>
  );
}
