/* eslint-disable @typescript-eslint/no-explicit-any -- Prospect Hub tables are not in the generated Supabase types yet, so rows follow the explicit select list in each query. */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, ChevronLeft, ChevronRight, Download, Filter, Loader2, Mail, Plus, Search, Sparkles, Upload, UserPlus, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyRow, ScoreBadge, StageBadge, errorMessage, prospectDb, staffName, useProspectPermissions, useStaffMembers } from "@/components/prospect-hub/shared";
import { AddProspectDialog } from "@/components/prospect-hub/AddProspectDialog";
import { ImportProspectsDialog } from "@/components/prospect-hub/ImportProspectsDialog";
import { FollowUpDialog } from "@/components/prospect-hub/FollowUpDialog";
import {
  ENRICHMENT_STATUSES, PROSPECT_LIST_COLUMNS, PROSPECT_STAGES, PROVINCES, SECTORS,
  applyProspectFilters, enrichmentLabel, exportProspects, formatDate, type ProspectFilters, type ProspectListRow,
} from "@/lib/prospectHub";

const PAGE_SIZE = 25;
const SORTS = {
  score: { column: "score", ascending: false, label: "Fit score" },
  newest: { column: "discovered_at", ascending: false, label: "Newest" },
  name: { column: "company_name", ascending: true, label: "Company A–Z" },
  follow_up: { column: "next_follow_up_at", ascending: true, label: "Next follow-up" },
} as const;

export default function ProspectList({ mode = "prospects" }: { mode?: "prospects" | "leads" }) {
  const perms = useProspectPermissions();
  const staff = useStaffMembers();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<ProspectFilters>({ doNotContact: "any", contacted: "any", leadsOnly: mode === "leads" });
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<keyof typeof SORTS>(mode === "leads" ? "follow_up" : "score");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [dncConfirm, setDncConfirm] = useState(false);
  const [bulkStage, setBulkStage] = useState("");
  const [bulkAssignee, setBulkAssignee] = useState("");

  useEffect(() => { setFilters((f) => ({ ...f, leadsOnly: mode === "leads" })); setSelected(new Set()); setPage(0); }, [mode]);
  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => ({ ...f, search: searchInput })); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const sources = useQuery({
    queryKey: ["prospect-source-names"],
    queryFn: async () => {
      const { data, error } = await prospectDb.from("prospect_sources").select("name").order("name");
      if (error) throw error;
      return (data ?? []).map((s: { name: string }) => s.name) as string[];
    },
  });

  const list = useQuery({
    queryKey: ["prospect-list", filters, sort, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const s = SORTS[sort];
      let q = prospectDb.from("prospects").select(PROSPECT_LIST_COLUMNS, { count: "exact" });
      q = applyProspectFilters(q, filters);
      q = q.order(s.column, { ascending: s.ascending, nullsFirst: false }).order("id").range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as ProspectListRow[], count: count ?? 0 };
    },
  });

  const rows = list.data?.rows ?? [];
  const total = list.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedIds = useMemo(() => [...selected], [selected]);
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["prospect-list"] });
    void queryClient.invalidateQueries({ queryKey: ["prospect-dashboard"] });
  };

  const bulkUpdate = useMutation({
    mutationFn: async (args: { status?: string; assignedTo?: string; unassign?: boolean }) => {
      const { data, error } = await prospectDb.rpc("bulk_update_prospects", {
        p_ids: selectedIds, p_status: args.status ?? null, p_assigned_to: args.assignedTo ?? null, p_unassign: args.unassign ?? false,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => { toast.success(`${n} prospect${n === 1 ? "" : "s"} updated`); setBulkStage(""); setBulkAssignee(""); refresh(); },
    onError: (e) => toast.error(errorMessage(e, "Bulk update failed")),
  });

  const markDnc = useMutation({
    mutationFn: async () => {
      const { data, error } = await prospectDb.rpc("set_prospects_do_not_contact", { p_ids: selectedIds, p_do_not_contact: true, p_reason: "Marked in bulk by staff" });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => { toast.success(`${n} marked do-not-contact`); setSelected(new Set()); refresh(); },
    onError: (e) => toast.error(errorMessage(e, "Could not update")),
  });

  const enrich = useMutation({
    mutationFn: async () => {
      const ids = selectedIds.slice(0, 25);
      const { data, error } = await prospectDb.functions.invoke("prospect-web-enrichment", { body: { trigger: "manual", prospect_ids: ids } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Enrichment failed");
      return data;
    },
    onSuccess: (d) => { toast.success(`Checked ${d.prospects_checked}: ${d.prospects_updated} updated, ${d.emails_found} emails, ${d.phones_found} phones, ${d.failed} failed`); refresh(); },
    onError: (e) => toast.error(errorMessage(e, "Enrichment failed")),
  });

  const exportRows = useMutation({
    mutationFn: async (format: "csv" | "xlsx") => {
      let q = prospectDb.from("prospects").select(PROSPECT_LIST_COLUMNS);
      q = selected.size ? q.in("id", selectedIds.slice(0, 300)) : applyProspectFilters(q, filters);
      const { data, error } = await q.order("score", { ascending: false }).limit(5000);
      if (error) throw error;
      exportProspects((data ?? []) as ProspectListRow[], format);
      return (data ?? []).length;
    },
    onSuccess: (n) => toast.success(`Exported ${n} prospects`),
    onError: (e) => toast.error(errorMessage(e, "Export failed")),
  });

  const setFilter = (patch: Partial<ProspectFilters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(0); };
  const toggle = (id: string, on: boolean) => setSelected((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="rounded-xl pl-9" placeholder="Search company, registration no., email, phone, city or sector" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as keyof typeof SORTS)}>
              <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(SORTS).map(([k, s]) => <SelectItem key={k} value={k}>Sort: {s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowFilters((v) => !v)}><Filter className="mr-2 h-4 w-4" />Filters</Button>
            {perms.canManage ? (
              <>
                <Button variant="outline" className="rounded-xl" disabled={exportRows.isPending} onClick={() => exportRows.mutate("csv")}><Download className="mr-2 h-4 w-4" />CSV</Button>
                <Button variant="outline" className="rounded-xl" disabled={exportRows.isPending} onClick={() => exportRows.mutate("xlsx")}><Download className="mr-2 h-4 w-4" />XLSX</Button>
              </>
            ) : null}
            {perms.canManage ? <Button variant="outline" className="rounded-xl" onClick={() => setImportOpen(true)}><Upload className="mr-2 h-4 w-4" />Import</Button> : null}
            {perms.canManage ? <Button className="rounded-xl" onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add prospect</Button> : null}
          </div>
        </div>

        {showFilters ? (
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
            {mode === "prospects" ? (
              <FilterSelect label="Stage" value={filters.stage ?? "all"} onChange={(v) => setFilter({ stage: v })} options={PROSPECT_STAGES.map((s) => [s.value, s.label])} />
            ) : null}
            <FilterSelect label="Province" value={filters.province ?? "all"} onChange={(v) => setFilter({ province: v })} options={PROVINCES.map((p) => [p, p])} />
            <div className="space-y-1"><Label className="text-xs">City</Label><Input className="rounded-xl" value={filters.city ?? ""} onChange={(e) => setFilter({ city: e.target.value })} placeholder="Any city" /></div>
            <FilterSelect label="Sector" value={filters.sector ?? "all"} onChange={(v) => setFilter({ sector: v })} options={SECTORS.map((s) => [s, s])} />
            <FilterSelect label="Source" value={filters.source ?? "all"} onChange={(v) => setFilter({ source: v })} options={(sources.data ?? []).map((s) => [s, s])} />
            <FilterSelect label="Assigned to" value={filters.assignedTo ?? "all"} onChange={(v) => setFilter({ assignedTo: v })} options={[["unassigned", "Unassigned"], ...(staff.data ?? []).map((m) => [m.id, m.full_name || m.email || "Staff"] as [string, string])]} />
            <FilterSelect label="Enrichment" value={filters.enrichment ?? "all"} onChange={(v) => setFilter({ enrichment: v })} options={ENRICHMENT_STATUSES.map((s) => [s.value, s.label])} />
            <div className="space-y-1"><Label className="text-xs">Minimum fit score</Label><Input className="rounded-xl" type="number" min={0} max={100} value={filters.minScore ?? ""} onChange={(e) => setFilter({ minScore: e.target.value ? Number(e.target.value) : null })} placeholder="0" /></div>
            <FilterSelect label="Procurement activity" value={filters.procurementAge ?? "any"} allLabel="Any age" allValue="any" onChange={(v) => setFilter({ procurementAge: v as ProspectFilters["procurementAge"] })} options={[["older", "Older supplier (2+ years)"], ["recent", "Recently active (12 months)"]]} />
            <FilterSelect label="Contact status" value={filters.contacted ?? "any"} allLabel="Any" allValue="any" onChange={(v) => setFilter({ contacted: v as ProspectFilters["contacted"] })} options={[["not_contacted", "Not contacted"], ["contacted", "Contacted"]]} />
            <FilterSelect label="Do not contact" value={filters.doNotContact ?? "any"} allLabel="Include" allValue="any" onChange={(v) => setFilter({ doNotContact: v as ProspectFilters["doNotContact"] })} options={[["exclude", "Exclude"], ["only", "Only do-not-contact"]]} />
            <div className="space-y-1"><Label className="text-xs">Discovered from</Label><Input className="rounded-xl" type="date" value={filters.discoveredFrom ?? ""} onChange={(e) => setFilter({ discoveredFrom: e.target.value || undefined })} /></div>
            <div className="space-y-1"><Label className="text-xs">Discovered to</Label><Input className="rounded-xl" type="date" value={filters.discoveredTo ?? ""} onChange={(e) => setFilter({ discoveredTo: e.target.value || undefined })} /></div>
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
              {([["hasEmail", "Has email"], ["hasPhone", "Has phone"], ["hasWebsite", "Has website"], ["procurement", "Has procurement records"], ["readyToContact", "Ready to contact"], ["needsEnrichment", "Needs enrichment"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm"><Switch checked={Boolean(filters[k])} onCheckedChange={(v) => setFilter({ [k]: v } as Partial<ProspectFilters>)} />{label}</label>
              ))}
              <Button variant="ghost" size="sm" onClick={() => { setFilters({ doNotContact: "any", contacted: "any", leadsOnly: mode === "leads" }); setSearchInput(""); }}>Clear filters</Button>
            </div>
          </div>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm lg:flex-row lg:items-center lg:justify-between">
          <span className="font-medium">{selected.size} selected <button className="ml-2 text-xs text-primary underline" onClick={() => setSelected(new Set())}>Clear</button></span>
          <div className="flex flex-wrap gap-2">
            {perms.canManage ? (
              <>
                <Select value={bulkStage} onValueChange={(v) => { setBulkStage(v); bulkUpdate.mutate({ status: v }); }}>
                  <SelectTrigger className="h-9 w-40 rounded-xl"><SelectValue placeholder="Change stage" /></SelectTrigger>
                  <SelectContent>{PROSPECT_STAGES.filter((s) => s.value !== "converted").map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={bulkAssignee} onValueChange={(v) => { setBulkAssignee(v); bulkUpdate.mutate(v === "__none" ? { unassign: true } : { assignedTo: v }); }}>
                  <SelectTrigger className="h-9 w-44 rounded-xl"><UserPlus className="mr-1 h-4 w-4" /><SelectValue placeholder="Assign staff" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">Unassign</SelectItem>{(staff.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="rounded-xl" disabled={enrich.isPending} onClick={() => enrich.mutate()}>
                  {enrich.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}Enrich{selected.size > 25 ? " (first 25)" : ""}
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setFollowUpOpen(true)}><CalendarPlus className="mr-1 h-4 w-4" />Follow-up</Button>
                <Button size="sm" variant="outline" className="rounded-xl text-destructive" onClick={() => setDncConfirm(true)}><Ban className="mr-1 h-4 w-4" />Do not contact</Button>
              </>
            ) : null}
            {perms.canManage || perms.canSend ? (
              <Button size="sm" className="rounded-xl" onClick={() => navigate("../campaigns/new", { state: { prospectIds: selectedIds } })}><Mail className="mr-1 h-4 w-4" />Add to campaign</Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 p-3"><Checkbox aria-label="Select page" checked={allOnPageSelected} onCheckedChange={(v) => setSelected((prev) => { const next = new Set(prev); rows.forEach((r) => (v ? next.add(r.id) : next.delete(r.id))); return next; })} /></th>
                <th className="p-3">Company</th><th className="p-3">Location</th><th className="p-3">Contact</th><th className="p-3">Stage</th><th className="p-3">Fit</th><th className="p-3">Assigned</th><th className="p-3">{mode === "leads" ? "Next follow-up" : "Discovered"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3"><Checkbox aria-label={`Select ${p.company_name}`} checked={selected.has(p.id)} onCheckedChange={(v) => toggle(p.id, Boolean(v))} /></td>
                  <td className="p-3">
                    <Link to={`../prospects/${p.id}`} className="font-medium text-foreground hover:underline">{p.company_name}</Link>
                    <div className="text-xs text-muted-foreground">{[p.sector, p.source_name].filter(Boolean).join(" · ")}{p.procurement_record_count ? ` · ${p.procurement_record_count} award${p.procurement_record_count === 1 ? "" : "s"}` : ""}{p.do_not_contact ? " · Do not contact" : ""}</div>
                  </td>
                  <td className="p-3">{[p.city, p.province].filter(Boolean).join(", ") || "—"}</td>
                  <td className="p-3"><div className="max-w-[220px] truncate">{p.email || "—"}</div><div className="text-xs text-muted-foreground">{p.phone || (p.enrichment_status !== "completed" ? enrichmentLabel(p.enrichment_status) : "")}</div></td>
                  <td className="p-3"><StageBadge stage={p.status} /></td>
                  <td className="p-3"><ScoreBadge score={p.score} title={(p.score_reasons ?? []).map((r) => `${r.label} +${r.points}`).join("\n")} /></td>
                  <td className="p-3 text-xs">{staffName(staff.data, p.assigned_to)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{mode === "leads" ? formatDate(p.next_follow_up_at, true) : formatDate(p.discovered_at)}</td>
                </tr>
              ))}
              {!list.isLoading && rows.length === 0 ? <EmptyRow colSpan={8}>{mode === "leads" ? "No qualified leads yet. Mark an interested prospect as a lead from its profile." : "No prospects match these filters."}</EmptyRow> : null}
              {list.isLoading ? <EmptyRow colSpan={8}><Loader2 className="mx-auto h-5 w-5 animate-spin" /></EmptyRow> : null}
              {list.isError ? <EmptyRow colSpan={8}>{errorMessage(list.error, "Could not load prospects")}</EmptyRow> : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t p-3 text-sm">
          <span className="text-muted-foreground">{total.toLocaleString()} result{total === 1 ? "" : "s"}{list.isFetching ? " · updating…" : ""}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span>Page {page + 1} of {pages}</span>
            <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <AddProspectDialog open={addOpen} onOpenChange={setAddOpen} onCreated={(id) => { refresh(); navigate(`../prospects/${id}`); }} />
      <ImportProspectsDialog open={importOpen} onOpenChange={setImportOpen} onImported={refresh} />
      <FollowUpDialog open={followUpOpen} onOpenChange={setFollowUpOpen} prospectIds={selectedIds} onSaved={refresh} />
      <AlertDialog open={dncConfirm} onOpenChange={setDncConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {selected.size} prospect{selected.size === 1 ? "" : "s"} as do-not-contact?</AlertDialogTitle>
            <AlertDialogDescription>They will be excluded from all future campaigns and their email addresses added to the marketing suppression list. This is recorded in the audit log and can be reversed individually from each profile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => markDnc.mutate()}>Mark do-not-contact</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, allLabel = "All", allValue = "all" }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]>; allLabel?: string; allValue?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value={allValue}>{allLabel}</SelectItem>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
