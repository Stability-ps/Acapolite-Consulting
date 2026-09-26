/* eslint-disable @typescript-eslint/no-explicit-any -- Prospect Hub tables are not in the generated Supabase types yet, so rows follow the explicit select list in each query. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck, ChevronLeft, ChevronRight, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyRow, Panel, ScoreBadge, StageBadge, errorMessage, prospectDb, useProspectPermissions } from "@/components/prospect-hub/shared";
import { ENRICHMENT_STATUSES, PROVINCES, SECTORS, applyProspectFilters, enrichmentLabel, formatDate, type ProspectFilters } from "@/lib/prospectHub";

const PAGE = 20;

export default function ProspectDiscover() {
  const perms = useProspectPermissions();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<ProspectFilters & { reviewed?: "any" | "unreviewed" }>({ reviewed: "unreviewed", doNotContact: "any" });
  const [page, setPage] = useState(0);
  const set = (patch: Partial<typeof filters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(0); };

  const state = useQuery({
    queryKey: ["prospect-discovery-state"],
    queryFn: async () => {
      const [settings, source, druns, eruns, esettings] = await Promise.all([
        prospectDb.from("prospect_discovery_settings").select("*").eq("source_name", "National Treasury eTenders OCDS").maybeSingle(),
        prospectDb.from("prospect_sources").select("*").eq("key", "etenders_ocds").maybeSingle(),
        prospectDb.from("prospect_discovery_runs").select("*").order("started_at", { ascending: false }).limit(10),
        prospectDb.from("prospect_enrichment_runs").select("*").order("started_at", { ascending: false }).limit(10),
        prospectDb.from("prospect_enrichment_settings").select("*").order("created_at").limit(1).maybeSingle(),
      ]);
      return { settings: settings.data, source: source.data, druns: druns.data ?? [], eruns: eruns.data ?? [], esettings: esettings.data };
    },
  });

  const found = useQuery({
    queryKey: ["prospect-discover-list", filters, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = prospectDb.from("prospects").select(
        "id,company_name,sector,province,city,score,status,discovered_at,source_name,email,phone,website,enrichment_status,reviewed_at,procurement_record_count,last_procurement_at,prospect_source_records(tender_title,buyer_name,award_value,award_date,source_url)",
        { count: "exact" },
      );
      q = applyProspectFilters(q, filters);
      if (filters.reviewed === "unreviewed") q = q.is("reviewed_at", null);
      q = q.order("discovered_at", { ascending: false }).order("id").range(page * PAGE, page * PAGE + PAGE - 1);
      q = q.order("award_date", { referencedTable: "prospect_source_records", ascending: false }).limit(1, { referencedTable: "prospect_source_records" });
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const run = useMutation({
    mutationFn: async (fn: "prospect-discovery-sync" | "prospect-web-enrichment") => {
      const { data, error } = await prospectDb.functions.invoke(fn, { body: { trigger: "manual" } });
      if (error) throw error;
      return { fn, data };
    },
    onSuccess: ({ fn, data }) => {
      if (fn === "prospect-discovery-sync") {
        if (data?.skipped) toast.success(data.reason === "caught_up" ? "Discovery is up to date - every completed day has been scanned." : `Skipped: ${data.reason}`);
        else toast[data?.ok ? "success" : "error"](`Discovery ${data?.status}: ${data?.pages_fetched ?? 0} pages, ${data?.prospects_created ?? 0} new, ${data?.prospects_updated ?? 0} updated${data?.error ? ` (${data.error})` : ""}`);
      } else {
        toast.success(`Enrichment: ${data.prospects_checked} checked · ${data.websites_found} websites found · ${data.websites_fetched} fetched · ${data.emails_found} emails · ${data.phones_found} phones · ${data.prospects_updated} updated · ${data.skipped} skipped · ${data.failed} failed`);
      }
      void qc.invalidateQueries({ queryKey: ["prospect-discovery-state"] });
      void qc.invalidateQueries({ queryKey: ["prospect-discover-list"] });
      void qc.invalidateQueries({ queryKey: ["prospect-dashboard"] });
    },
    onError: (e) => toast.error(errorMessage(e, "The run failed. See run history for details.")),
  });

  const markReviewed = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await prospectDb.from("prospects").update({ reviewed_at: new Date().toISOString(), reviewed_by: perms.userId }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["prospect-discover-list"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const st = state.data;
  const rows = found.data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((found.data?.count ?? 0) / PAGE));

  return (
    <div className="space-y-4">
      <Panel
        title="Automated discovery"
        description="Businesses enter Prospect Hub when the official National Treasury eTenders OCDS data shows they were awarded government work in a target sector. Procurement activity only indicates a potential customer; it is not evidence of any tax issue."
        actions={perms.canManage ? (
          <>
            <Button size="sm" disabled={run.isPending} onClick={() => run.mutate("prospect-discovery-sync")}><RefreshCw className={`mr-1 h-4 w-4 ${run.isPending && run.variables === "prospect-discovery-sync" ? "animate-spin" : ""}`} />Run discovery now</Button>
            <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate("prospect-web-enrichment")}><Sparkles className="mr-1 h-4 w-4" />Enrich contacts now</Button>
          </>
        ) : undefined}
      >
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Source status" value={st?.source ? `${st.source.enabled ? st.source.status : "disabled"}${st.source.consecutive_failures ? ` (${st.source.consecutive_failures} failed runs)` : ""}` : "—"} />
          <Info label="Scanned up to" value={st?.settings?.window_cursor ? `${formatDate(st.settings.window_cursor)} (page ${st.settings.next_page})` : "Not started"} />
          <Info label="Target area / sectors" value={`${(st?.settings?.provinces ?? []).join(", ") || "All provinces"} · ${(st?.settings?.target_sectors ?? []).length || "all"} sectors`} />
          <Info label="Schedule" value={st?.source?.schedule_description ?? "—"} />
        </div>
        {run.isPending ? <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Running… this can take up to two minutes because the eTenders API is slow.</p> : null}
      </Panel>

      <Panel title="Newly discovered businesses" actions={perms.canManage && rows.length ? <Button size="sm" variant="outline" onClick={() => markReviewed.mutate(rows.filter((r: any) => !r.reviewed_at).map((r: any) => r.id))}><CheckCheck className="mr-1 h-4 w-4" />Mark page reviewed</Button> : undefined}>
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Sel label="Review" value={filters.reviewed ?? "any"} onChange={(v) => set({ reviewed: v as "any" | "unreviewed" })} options={[["unreviewed", "Not reviewed"], ["any", "All"]]} />
          <Sel label="Province" value={filters.province ?? "all"} onChange={(v) => set({ province: v })} options={[["all", "All"], ...PROVINCES.map((p) => [p, p] as [string, string])]} />
          <Sel label="Sector" value={filters.sector ?? "all"} onChange={(v) => set({ sector: v })} options={[["all", "All"], ...SECTORS.map((p) => [p, p] as [string, string])]} />
          <Sel label="Enrichment" value={filters.enrichment ?? "all"} onChange={(v) => set({ enrichment: v })} options={[["all", "All"], ...ENRICHMENT_STATUSES.map((s) => [s.value, s.label] as [string, string])]} />
          <div className="space-y-1"><Label className="text-xs">City</Label><Input value={filters.city ?? ""} onChange={(e) => set({ city: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Min fit score</Label><Input type="number" value={filters.minScore ?? ""} onChange={(e) => set({ minScore: e.target.value ? Number(e.target.value) : null })} /></div>
          <div className="space-y-1"><Label className="text-xs">Discovered from</Label><Input type="date" value={filters.discoveredFrom ?? ""} onChange={(e) => set({ discoveredFrom: e.target.value || undefined })} /></div>
          <div className="flex flex-wrap items-end gap-3 pb-1 text-sm">
            <label className="flex items-center gap-2"><Switch checked={Boolean(filters.hasEmail)} onCheckedChange={(v) => set({ hasEmail: v })} />Has email</label>
            <label className="flex items-center gap-2"><Switch checked={filters.contacted === "not_contacted"} onCheckedChange={(v) => set({ contacted: v ? "not_contacted" : "any" })} />Not contacted</label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-2">Business</th><th className="p-2">Why it was added</th><th className="p-2">Discovered</th><th className="p-2">Enrichment</th><th className="p-2">Fit</th><th className="p-2">Stage</th><th className="p-2" /></tr></thead>
            <tbody>
              {rows.map((r: any) => {
                const ev = r.prospect_source_records?.[0];
                return (
                  <tr key={r.id} className="border-b align-top last:border-0">
                    <td className="p-2"><Link className="font-medium hover:underline" to={`../prospects/${r.id}`}>{r.company_name}</Link><div className="text-xs text-muted-foreground">{[r.sector, r.city, r.province].filter(Boolean).join(" · ")}</div></td>
                    <td className="p-2 text-xs">
                      {ev ? <><p className="line-clamp-2">{ev.tender_title}</p><p className="text-muted-foreground">{ev.buyer_name}{ev.award_value ? ` · R ${Number(ev.award_value).toLocaleString("en-ZA")}` : ""}{r.procurement_record_count > 1 ? ` · ${r.procurement_record_count} awards` : ""}{ev.source_url ? <> · <a className="underline" href={ev.source_url} target="_blank" rel="noreferrer">record</a></> : null}</p></> : <span className="text-muted-foreground">{r.source_name ?? "Manual"}</span>}
                    </td>
                    <td className="p-2 whitespace-nowrap text-xs">{formatDate(r.discovered_at, true)}</td>
                    <td className="p-2 text-xs">{enrichmentLabel(r.enrichment_status)}<div className="text-muted-foreground">{[r.email ? "email" : null, r.phone ? "phone" : null, r.website ? "website" : null].filter(Boolean).join(", ") || "no contacts"}</div></td>
                    <td className="p-2"><ScoreBadge score={r.score} /></td>
                    <td className="p-2"><StageBadge stage={r.status} /></td>
                    <td className="p-2 text-right">{r.reviewed_at ? <span className="text-xs text-muted-foreground">Reviewed</span> : perms.canManage ? <Button size="sm" variant="ghost" onClick={() => markReviewed.mutate([r.id])}>Reviewed</Button> : null}</td>
                  </tr>
                );
              })}
              {found.isSuccess && !rows.length ? <EmptyRow colSpan={7}>Nothing here yet. Discovery runs automatically every 20 minutes until it has caught up.</EmptyRow> : null}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span>Page {page + 1} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Discovery run history">
          <RunTable rows={st?.druns ?? []} cols={[["Started", (r) => formatDate(r.started_at, true)], ["Type", (r) => r.run_type], ["Status", (r) => r.status], ["Releases", (r) => r.records_fetched], ["New", (r) => r.prospects_created], ["Updated", (r) => r.prospects_updated], ["Note", (r) => r.error_message ?? (r.metadata?.next_cursor ? `next ${r.metadata.next_cursor} p${r.metadata.next_page ?? 1}` : "")]]} />
        </Panel>
        <Panel title="Enrichment run history" description={st?.esettings ? `Batch of ${st.esettings.batch_size} per run · rechecks after ${st.esettings.recheck_days} days` : undefined}>
          <RunTable rows={st?.eruns ?? []} cols={[["Started", (r) => formatDate(r.started_at, true)], ["Type", (r) => r.run_type], ["Status", (r) => r.status], ["Checked", (r) => r.prospects_checked], ["Sites", (r) => r.websites_fetched], ["Emails", (r) => r.emails_found], ["Phones", (r) => r.phones_found], ["Updated", (r) => r.prospects_updated], ["Failed", (r) => r.metadata?.failed ?? "—"]]} />
        </Panel>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>;
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <div className="space-y-1"><Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
    </div>
  );
}

function RunTable({ rows, cols }: { rows: any[]; cols: Array<[string, (r: any) => React.ReactNode]> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr>{cols.map(([h]) => <th key={h} className="p-1.5">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.id} className="border-t">{cols.map(([h, f]) => <td key={h} className={`p-1.5 ${h === "Status" ? (r.status === "failed" ? "text-destructive" : r.status === "partial" ? "text-amber-700" : "") : ""} ${h === "Type" || h === "Status" ? "capitalize" : ""}`}>{f(r)}</td>)}</tr>)}
          {!rows.length ? <EmptyRow colSpan={cols.length}>No runs yet.</EmptyRow> : null}
        </tbody>
      </table>
    </div>
  );
}
