/* eslint-disable @typescript-eslint/no-explicit-any -- Prospect Hub tables are not in the generated Supabase types yet, so rows follow the explicit select list in each query. */
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel, ScoreBadge, errorMessage, prospectDb, useProspectPermissions } from "@/components/prospect-hub/shared";
import { PROVINCES, SECTORS, applyProspectFilters, type ProspectFilters } from "@/lib/prospectHub";
import { TEMPLATE_VARIABLES, buildCampaignEmail, renderTemplate, unknownVariables } from "@/lib/prospectTemplates";

type Candidate = { id: string; company_name: string; email: string | null; score: number; sector: string | null; city: string | null; province: string | null; contact_name: string | null };

export default function ProspectCampaignNew() {
  const perms = useProspectPermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const preselected: string[] = (location.state as { prospectIds?: string[] } | null)?.prospectIds ?? [];
  const [filters, setFilters] = useState<ProspectFilters>({ province: "Gauteng", hasEmail: true, doNotContact: "exclude", contacted: "not_contacted", minScore: 60 });
  const [searchNow, setSearchNow] = useState(preselected.length > 0);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const templates = useQuery({
    queryKey: ["prospect-templates-active"],
    queryFn: async () => {
      const { data, error } = await prospectDb.from("prospect_email_templates").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const candidates = useQuery({
    queryKey: ["prospect-campaign-candidates", preselected, filters, searchNow],
    enabled: searchNow,
    queryFn: async () => {
      let q = prospectDb.from("prospects").select("id,company_name,email,score,sector,city,province,contact_name");
      q = preselected.length ? q.in("id", preselected.slice(0, 300)) : applyProspectFilters(q, filters);
      const { data, error } = await q.order("score", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as Candidate[];
    },
  });

  const chosen = useMemo(() => (candidates.data ?? []).filter((c) => !excluded.has(c.id)), [candidates.data, excluded]);
  const unknown = [...unknownVariables(subject), ...unknownVariables(body)];
  const sample = chosen[0];
  const preview = useMemo(() => {
    if (!sample) return null;
    const values = { company_name: sample.company_name, contact_name: sample.contact_name, sector: sample.sector, city: sample.city, province: sample.province };
    const s = renderTemplate(subject, values);
    const b = renderTemplate(body, values);
    return { subject: s.text, missing: [...new Set([...s.missing, ...b.missing])], email: buildCampaignEmail({ body: b.text, footer: "Acapolite Consulting (Pty) Ltd · Pretoria, Gauteng, South Africa · acapoliteconsulting.co.za", unsubscribeUrl: "https://acapoliteconsulting.co.za/unsubscribe?token=…" }) };
  }, [sample, subject, body]);
  const missingAcross = useMemo(() => {
    let n = 0;
    for (const c of chosen) {
      const values = { company_name: c.company_name, contact_name: c.contact_name, sector: c.sector, city: c.city, province: c.province };
      if (renderTemplate(subject, values).missing.length || renderTemplate(body, values).missing.length) n++;
    }
    return n;
  }, [chosen, subject, body]);

  const create = useMutation({
    mutationFn: async () => {
      const { data: campaign, error } = await prospectDb.from("prospect_campaigns").insert({
        name: name.trim(), template_id: templateId || null, subject: subject.trim(), body_text: body, status: "draft", created_by: perms.userId,
        filters: preselected.length ? { selection: "manual", count: preselected.length } : filters,
      }).select("id").single();
      if (error) throw error;
      const ids = chosen.map((c) => c.id);
      const totals = { added: 0, skipped: 0 };
      for (let i = 0; i < ids.length; i += 500) {
        const { data, error: addError } = await prospectDb.rpc("add_prospect_campaign_recipients", { p_campaign_id: campaign.id, p_prospect_ids: ids.slice(i, i + 500) });
        if (addError) throw addError;
        totals.added += data.added; totals.skipped += data.skipped;
      }
      return { id: campaign.id as string, ...totals };
    },
    onSuccess: (r) => { toast.success(`Draft created: ${r.added} eligible, ${r.skipped} skipped by suppression checks`); navigate(`../campaigns/${r.id}`); },
    onError: (e) => toast.error(errorMessage(e, "Could not create campaign")),
  });

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.data?.find((x: any) => x.id === id);
    if (t) { setSubject(t.subject); setBody(t.body_text); if (!name) setName(`${t.name} — ${new Date().toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}`); }
  };
  const setFilter = (patch: Partial<ProspectFilters>) => { setFilters((f) => ({ ...f, ...patch })); setSearchNow(false); };

  if (!perms.canManage && !perms.canSend) return <p className="text-sm text-muted-foreground">You do not have permission to create campaigns.</p>;

  return (
    <div className="space-y-4">
      <Link to="../campaigns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Campaigns</Link>

      <Panel title="1. Recipients" description={preselected.length ? `${preselected.length} prospects selected from the prospect list.` : "Filter prospects. Suppressed, do-not-contact, converted and recently-contacted prospects are removed automatically on the server when the draft is created."}>
        {!preselected.length ? (
          <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Sel label="Province" value={filters.province ?? "all"} onChange={(v) => setFilter({ province: v })} options={[["all", "All"], ...PROVINCES.map((p) => [p, p] as [string, string])]} />
            <Sel label="Sector" value={filters.sector ?? "all"} onChange={(v) => setFilter({ sector: v })} options={[["all", "All"], ...SECTORS.map((p) => [p, p] as [string, string])]} />
            <div className="space-y-1"><Label className="text-xs">Min fit score</Label><Input type="number" value={filters.minScore ?? ""} onChange={(e) => setFilter({ minScore: e.target.value ? Number(e.target.value) : null })} /></div>
            <div className="flex items-end gap-3 pb-2 text-sm lg:col-span-2">
              <label className="flex items-center gap-2"><Switch checked={filters.contacted === "not_contacted"} onCheckedChange={(v) => setFilter({ contacted: v ? "not_contacted" : "any" })} />Not contacted</label>
              <Button size="sm" onClick={() => setSearchNow(true)}><Search className="mr-1 h-4 w-4" />Find prospects</Button>
            </div>
          </div>
        ) : null}
        {candidates.isFetching ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {candidates.data ? (
          <>
            <p className="mb-2 text-sm"><strong>{chosen.length}</strong> selected of {candidates.data.length} found{candidates.data.length >= 2000 ? " (limited to 2000)" : ""}. {candidates.data.filter((c) => !c.email).length ? `${candidates.data.filter((c) => !c.email).length} have no email and will be skipped.` : ""}</p>
            <div className="max-h-72 overflow-y-auto rounded-xl border">
              <table className="w-full text-sm">
                <tbody>
                  {candidates.data.slice(0, 500).map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="w-10 p-2"><Checkbox checked={!excluded.has(c.id)} onCheckedChange={(v) => setExcluded((prev) => { const n = new Set(prev); if (v) n.delete(c.id); else n.add(c.id); return n; })} /></td>
                      <td className="p-2">{c.company_name}<div className="text-xs text-muted-foreground">{c.email ?? "no email"}</div></td>
                      <td className="p-2 text-xs">{[c.sector, c.city].filter(Boolean).join(" · ")}</td>
                      <td className="p-2"><ScoreBadge score={c.score} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Panel>

      <Panel title="2. Message" description={`Variables: ${TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(", ")}. Only values actually known are used. Add a fallback for optional values, e.g. {{contact_name|Good day}}; recipients with a missing value and no fallback are skipped.`}>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Template</Label>
              <Select value={templateId} onValueChange={chooseTemplate}><SelectTrigger><SelectValue placeholder="Choose an approved template" /></SelectTrigger><SelectContent>{(templates.data ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Campaign name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Construction TCS Outreach — October 2026" /></div>
            <div className="space-y-1"><Label className="text-xs">Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Body</Label><Textarea className="min-h-64 font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} /></div>
            {unknown.length ? <p className="text-sm text-destructive">Unsupported variables: {unknown.map((u) => `{{${u}}}`).join(", ")}</p> : null}
            {missingAcross ? <p className="text-sm text-amber-700">{missingAcross} selected recipient(s) are missing a variable value and will be skipped unless you add a fallback.</p> : null}
            <p className="text-xs text-muted-foreground">Keep claims truthful: describe Acapolite's services. Never state or imply that the business has a SARS problem.</p>
          </div>
          <div>
            <Label className="text-xs">Preview{sample ? ` (${sample.company_name})` : ""}</Label>
            {preview ? (
              <div className="mt-1 rounded-xl border bg-white p-3 text-slate-800">
                <p className="mb-2 border-b pb-2 text-sm"><strong>Subject:</strong> {preview.subject}</p>
                <iframe title="Email preview" className="h-80 w-full" sandbox="" srcDoc={preview.email.html} />
              </div>
            ) : <p className="mt-1 rounded-xl border p-6 text-sm text-muted-foreground">Select recipients to preview the email.</p>}
          </div>
        </div>
      </Panel>

      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Creating the draft sends nothing. You will review the final recipient list and skip reasons before approving.</p>
        <Button disabled={!name.trim() || !subject.trim() || !body.trim() || unknown.length > 0 || !chosen.length || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create draft ({chosen.length} recipients)
        </Button>
      </div>
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <div className="space-y-1"><Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
    </div>
  );
}
