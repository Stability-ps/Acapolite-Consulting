/* eslint-disable @typescript-eslint/no-explicit-any -- Prospect Hub tables are not in the generated Supabase types yet, so rows follow the explicit select list in each query. */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel, errorMessage, prospectDb, useProspectPermissions } from "@/components/prospect-hub/shared";
import { PROVINCES, SECTORS } from "@/lib/prospectHub";

export default function ProspectSettings() {
  const perms = useProspectPermissions();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["prospect-settings"],
    queryFn: async () => {
      const [d, e, c] = await Promise.all([
        prospectDb.from("prospect_discovery_settings").select("*").eq("source_name", "National Treasury eTenders OCDS").single(),
        prospectDb.from("prospect_enrichment_settings").select("*").order("created_at").limit(1).single(),
        prospectDb.from("prospect_campaign_settings").select("*").order("created_at").limit(1).single(),
      ]);
      for (const r of [d, e, c]) if (r.error) throw r.error;
      return { discovery: d.data, enrichment: e.data, campaign: c.data };
    },
  });
  const [d, setD] = useState<any>(null);
  const [e, setE] = useState<any>(null);
  const [c, setC] = useState<any>(null);
  useEffect(() => { if (q.data) { setD(q.data.discovery); setE(q.data.enrichment); setC(q.data.campaign); } }, [q.data]);

  const save = useMutation({
    mutationFn: async ({ table, row, fields }: { table: string; row: any; fields: string[] }) => {
      const patch = Object.fromEntries(fields.map((f) => [f, row[f]]));
      const { error } = await prospectDb.from(table).update(patch).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Settings saved"); void qc.invalidateQueries({ queryKey: ["prospect-settings"] }); },
    onError: (err) => toast.error(errorMessage(err, "Could not save settings")),
  });

  if (!d || !e || !c) return <p className="text-sm text-muted-foreground">Loading settings…</p>;
  const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const allProvinces = d.provinces.length === 0 || PROVINCES.every((p) => d.provinces.includes(p));
  const toggleProvince = (province: string) => {
    const current = allProvinces ? [...PROVINCES] : [...d.provinces];
    const next = current.includes(province) ? current.filter((p) => p !== province) : [...current, province];
    setD({ ...d, provinces: next.length === PROVINCES.length ? [] : next });
  };
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div className="space-y-4">
      <Panel title="Discovery (National Treasury eTenders)" description="Which awarded suppliers are imported. Changes apply from the next run.">
        <fieldset disabled={!perms.canManage} className="space-y-4">
          <label className="flex items-center gap-2 text-sm"><Switch checked={d.enabled} onCheckedChange={(v) => setD({ ...d, enabled: v })} />Discovery enabled</label>
          <div>
            <Label className="text-xs">Provinces</Label>
            <div className="mt-2 rounded-xl border bg-muted/30 p-3">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Checkbox
                  checked={allProvinces}
                  onCheckedChange={(checked) => setD({ ...d, provinces: checked ? [] : [...PROVINCES] })}
                />
                All Provinces
                {allProvinces ? <span className="text-xs font-normal text-muted-foreground">(recommended default)</span> : null}
              </label>
              <div className="flex flex-wrap gap-3">
                {PROVINCES.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={allProvinces || d.provinces.includes(p)} onCheckedChange={() => toggleProvince(p)} />
                    {p}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                All Provinces includes suppliers from every South African province, plus national/unspecified province records. Select individual provinces only if you want to restrict discovery.
              </p>
            </div>
          </div>
          <div><Label className="text-xs">Target sectors (none selected = all classified sectors)</Label>
            <div className="mt-1 flex flex-wrap gap-3">{SECTORS.map((s) => <label key={s} className="flex items-center gap-1.5 text-sm"><Checkbox checked={d.target_sectors.includes(s)} onCheckedChange={() => setD({ ...d, target_sectors: toggleIn(d.target_sectors, s) })} />{s}</label>)}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumField label="Max new prospects per run" value={d.max_new_per_run} min={1} max={1000} onChange={(v) => setD({ ...d, max_new_per_run: num(v) })} />
            <NumField label="Days scanned per run" value={d.windows_per_run} min={1} max={31} onChange={(v) => setD({ ...d, windows_per_run: num(v) })} />
            <NumField label="Initial look-back (days)" value={d.lookback_days} min={1} max={3650} onChange={(v) => setD({ ...d, lookback_days: num(v) })} />
            <NumField label="Releases per API request" value={d.page_size} min={5} max={100} onChange={(v) => setD({ ...d, page_size: num(v) })} hint="Historical catch-up currently uses 25; the worker retries transient eTenders failures." />
          </div>
          <Button onClick={() => save.mutate({ table: "prospect_discovery_settings", row: d, fields: ["enabled", "provinces", "target_sectors", "max_new_per_run", "windows_per_run", "lookback_days", "page_size"] })}>Save discovery settings</Button>
        </fieldset>
      </Panel>

      <Panel title="Website enrichment" description="Public company websites are checked four times each morning. Web search results are only suggestions and must pass a company-identity check.">
        <fieldset disabled={!perms.canManage} className="space-y-4">
          <label className="flex items-center gap-2 text-sm"><Switch checked={e.enabled} onCheckedChange={(v) => setE({ ...e, enabled: v })} />Enrichment enabled</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={e.use_openai_web_search} onCheckedChange={(v) => setE({ ...e, use_openai_web_search: v })} />Use OpenAI web search to suggest websites for prospects without one (uses OpenAI credits)</label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumField label="Prospects per run" value={e.batch_size} min={1} max={25} onChange={(v) => setE({ ...e, batch_size: num(v) })} />
            <NumField label="Re-check after (days)" value={e.recheck_days} min={1} max={90} onChange={(v) => setE({ ...e, recheck_days: num(v) })} />
          </div>
          <Button onClick={() => save.mutate({ table: "prospect_enrichment_settings", row: e, fields: ["enabled", "use_openai_web_search", "batch_size", "recheck_days"] })}>Save enrichment settings</Button>
        </fieldset>
      </Panel>

      <Panel title="Campaign sending" description={perms.isAdmin ? "Admin only. Sending uses Acapolite's existing Mailtrap account." : "Only admins can change sending settings."}>
        <fieldset disabled={!perms.isAdmin} className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={c.sending_enabled} onCheckedChange={(v) => setC({ ...c, sending_enabled: v })} />Sending enabled {c.sending_enabled ? "" : "(no campaign email leaves the system while this is off)"}</label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumField label="Emails per 5-minute batch" value={c.batch_size} min={1} max={100} onChange={(v) => setC({ ...c, batch_size: num(v) })} />
            <NumField label="Daily limit" value={c.daily_limit} min={1} max={5000} onChange={(v) => setC({ ...c, daily_limit: num(v) })} />
            <NumField label="Min days between emails to the same prospect" value={c.min_days_between_contact} min={0} max={365} onChange={(v) => setC({ ...c, min_days_between_contact: num(v) })} />
            <NumField label="Max send attempts" value={c.max_attempts} min={1} max={10} onChange={(v) => setC({ ...c, max_attempts: num(v) })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label className="text-xs">From name</Label><Input value={c.from_name} onChange={(ev) => setC({ ...c, from_name: ev.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Reply-to (blank = support address)</Label><Input value={c.reply_to ?? ""} onChange={(ev) => setC({ ...c, reply_to: ev.target.value || null })} /></div>
            <div className="space-y-1"><Label className="text-xs">Mailtrap stream</Label>
              <Select value={c.mailtrap_stream} onValueChange={(v) => setC({ ...c, mailtrap_stream: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="transactional">Transactional (existing)</SelectItem><SelectItem value="bulk">Bulk (requires Mailtrap bulk stream setup)</SelectItem></SelectContent></Select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Footer (company details shown in every campaign email)</Label><Textarea value={c.footer_text} onChange={(ev) => setC({ ...c, footer_text: ev.target.value })} /></div>
          {c.last_error ? <p className="text-sm text-destructive">Last sending error: {c.last_error}</p> : null}
          <Button onClick={() => save.mutate({ table: "prospect_campaign_settings", row: c, fields: ["sending_enabled", "batch_size", "daily_limit", "min_days_between_contact", "max_attempts", "from_name", "reply_to", "mailtrap_stream", "footer_text"] })}>Save sending settings</Button>
        </fieldset>
      </Panel>
    </div>
  );
}

function NumField({ label, value, min, max, onChange, hint }: { label: string; value: number; min: number; max: number; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={min} max={max} value={value} onChange={(ev) => onChange(ev.target.value)} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
