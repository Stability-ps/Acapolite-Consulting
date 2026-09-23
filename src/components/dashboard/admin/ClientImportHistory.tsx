import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import {
  outcomeBucket,
  reconcileBatchCounts,
  resolveRowClientLink,
  rowStatusLabel,
  sortBatchesNewestFirst,
  type ImportBatchRow,
  type ImportBatchSummary,
} from "@/lib/clientImportHistory";
import { exportImportReport, type ClientEnrichmentMap, type ImportReportFormat } from "@/lib/importReport";

const ROW_STATUS_CLASSES: Record<string, string> = {
  imported: "bg-emerald-100 text-emerald-700",
  skipped: "bg-slate-200 text-slate-700",
  blocked: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
  unknown: "bg-red-100 text-red-700",
};

type StatusFilter = "all" | "issues" | "clean" | "processing";

async function fetchBatches(): Promise<ImportBatchSummary[]> {
  const { data, error } = await supabase
    .from("client_import_batches")
    .select(
      "id,status,source_filename,total_rows,imported_count,skipped_count,blocked_count,failed_count,created_at,completed_at,actor_profile_id,actor:profiles!client_import_batches_actor_profile_id_fkey(full_name,email)",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((batch) => {
    const actor = Array.isArray(batch.actor) ? batch.actor[0] : batch.actor;
    return {
      id: batch.id,
      status: batch.status,
      source_filename: batch.source_filename,
      total_rows: batch.total_rows,
      imported_count: batch.imported_count,
      skipped_count: batch.skipped_count,
      blocked_count: batch.blocked_count,
      failed_count: batch.failed_count,
      created_at: batch.created_at,
      completed_at: batch.completed_at,
      actor_profile_id: batch.actor_profile_id,
      actor_name: actor?.full_name ?? null,
      actor_email: actor?.email ?? null,
    };
  });
}

async function fetchBatchRows(batchId: string): Promise<ImportBatchRow[]> {
  const { data, error } = await supabase
    .from("client_import_batch_rows")
    .select("id,batch_id,row_number,status,client_id,client_name,reason,duplicate_reason,matched_client_ids,forced_import_anyway,created_at")
    .eq("batch_id", batchId)
    .order("row_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ImportBatchRow[];
}

async function fetchClientEnrichment(clientIds: string[]): Promise<ClientEnrichmentMap> {
  if (!clientIds.length) return {};
  const { data, error } = await supabase.from("clients").select("id,client_type,email,phone").in("id", clientIds);
  if (error) throw error;
  const map: ClientEnrichmentMap = {};
  for (const client of data ?? []) {
    map[client.id] = { client_type: client.client_type, email: client.email, phone: client.phone };
  }
  return map;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

interface ClientImportHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenClient: (clientId: string) => void;
}

export function ClientImportHistory({ open, onOpenChange, onOpenClient }: ClientImportHistoryProps) {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isDownloading, setIsDownloading] = useState<"results" | "issues" | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<ImportReportFormat>("csv");

  const { data: batches, isLoading: isLoadingBatches } = useQuery({
    queryKey: ["client-import-history-batches"],
    queryFn: fetchBatches,
    enabled: open,
  });

  const { data: rows, isLoading: isLoadingRows } = useQuery({
    queryKey: ["client-import-history-rows", selectedBatchId],
    queryFn: () => fetchBatchRows(selectedBatchId as string),
    enabled: open && !!selectedBatchId,
  });

  const clientIdsInView = useMemo(
    () => Array.from(new Set((rows ?? []).map((row) => row.client_id).filter((id): id is string => Boolean(id)))),
    [rows],
  );

  const { data: enrichment } = useQuery({
    queryKey: ["client-import-history-enrichment", selectedBatchId, clientIdsInView.join(",")],
    queryFn: () => fetchClientEnrichment(clientIdsInView),
    enabled: open && !!selectedBatchId && !!rows,
  });

  const selectedBatch = (batches ?? []).find((batch) => batch.id === selectedBatchId) ?? null;
  const reconciliation = selectedBatch && rows ? reconcileBatchCounts(selectedBatch, rows) : null;

  const filteredBatches = useMemo(() => {
    const sorted = sortBatchesNewestFirst(batches ?? []);
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTime = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;

    return sorted.filter((batch) => {
      if (normalizedSearch) {
        const haystack = [batch.source_filename, batch.id, batch.actor_name, batch.actor_email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }

      if (statusFilter === "processing" && batch.status === "completed") return false;
      if (statusFilter === "issues" && !(batch.status === "completed" && (batch.blocked_count > 0 || batch.failed_count > 0))) return false;
      if (statusFilter === "clean" && !(batch.status === "completed" && batch.blocked_count === 0 && batch.failed_count === 0)) return false;

      const createdTime = new Date(batch.created_at).getTime();
      if (fromTime !== null && createdTime < fromTime) return false;
      if (toTime !== null && createdTime > toTime) return false;

      return true;
    });
  }, [batches, searchQuery, statusFilter, dateFrom, dateTo]);

  const downloadReport = async (issuesOnly: boolean) => {
    if (!selectedBatch || !rows) return;
    setIsDownloading(issuesOnly ? "issues" : "results");
    try {
      const result = exportImportReport(
        rows,
        enrichment ?? {},
        downloadFormat,
        `import-${issuesOnly ? "issues" : "results"}-${selectedBatch.id.slice(0, 8)}`,
        { issuesOnly },
      );
      if (!result.exported) {
        toast.error("No issue rows to report for this batch.");
      }
    } finally {
      setIsDownloading(null);
    }
  };

  return (
    <DashboardItemDialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setSelectedBatchId(null);
          setSearchQuery("");
          setStatusFilter("all");
          setDateFrom("");
          setDateTo("");
        }
      }}
      title={selectedBatch ? `Import Batch — ${selectedBatch.source_filename ?? "Untitled file"}` : "Import History"}
      description={
        selectedBatch
          ? `Run on ${formatDateTime(selectedBatch.created_at)}. Read-only historical record.`
          : "Previous client import runs, newest first. Read-only."
      }
    >
      {!selectedBatchId ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search filename, batch ID, or staff..."
              className="rounded-xl sm:flex-1"
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full rounded-xl sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All batches</SelectItem>
                <SelectItem value="issues">Has issues</SelectItem>
                <SelectItem value="clean">Clean</SelectItem>
                <SelectItem value="processing">Still processing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-xl" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-xl" />
          </div>

          {isLoadingBatches ? (
            <div className="text-muted-foreground font-body">Loading...</div>
          ) : filteredBatches.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-border bg-accent/30">
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Date</th>
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">File</th>
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Imported By</th>
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Total</th>
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Imported</th>
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Skipped</th>
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Blocked</th>
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Failed</th>
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/20"
                      onClick={() => setSelectedBatchId(batch.id)}
                    >
                      <td className="whitespace-nowrap p-3 text-sm text-muted-foreground font-body">{formatDateTime(batch.created_at)}</td>
                      <td className="p-3 text-sm font-medium text-foreground font-body">{batch.source_filename ?? "—"}</td>
                      <td className="whitespace-nowrap p-3 text-sm text-muted-foreground font-body">{batch.actor_name || batch.actor_email || "—"}</td>
                      <td className="whitespace-nowrap p-3 text-sm text-muted-foreground font-body">{batch.total_rows}</td>
                      <td className="whitespace-nowrap p-3 text-sm text-emerald-700 font-body">{batch.imported_count}</td>
                      <td className="whitespace-nowrap p-3 text-sm text-slate-600 font-body">{batch.skipped_count}</td>
                      <td className="whitespace-nowrap p-3 text-sm text-amber-700 font-body">{batch.blocked_count}</td>
                      <td className="whitespace-nowrap p-3 text-sm text-red-700 font-body">{batch.failed_count}</td>
                      <td className="whitespace-nowrap p-3 text-sm font-body">
                        {batch.status === "completed" ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Completed</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">Processing</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <p className="text-muted-foreground font-body">
                {searchQuery.trim() ? "No import batches matched your search." : "No client imports have been run yet."}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setSelectedBatchId(null)}>
            Back to Import History
          </Button>

          {selectedBatch ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{selectedBatch.total_rows}</p>
                <p className="text-xs text-muted-foreground">Total rows</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{selectedBatch.imported_count}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{selectedBatch.blocked_count}</p>
                <p className="text-xs text-muted-foreground">Blocked</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{selectedBatch.failed_count}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          ) : null}

          {reconciliation && !reconciliation.consistent ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <p className="text-sm font-semibold text-red-700">This batch's summary counts don't match its row records</p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-red-700">
                    {reconciliation.mismatches.map((mismatch) => (
                      <li key={mismatch}>{mismatch}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Select value={downloadFormat} onValueChange={(value) => setDownloadFormat(value as ImportReportFormat)}>
              <SelectTrigger className="w-[100px] rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="xlsx">XLSX</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => downloadReport(false)} disabled={!rows?.length || isDownloading !== null}>
              <Download className="mr-2 h-4 w-4" />
              {isDownloading === "results" ? "Preparing..." : "Download Results"}
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => downloadReport(true)} disabled={!rows?.length || isDownloading !== null}>
              <Download className="mr-2 h-4 w-4" />
              {isDownloading === "issues" ? "Preparing..." : "Download Issues"}
            </Button>
          </div>

          {isLoadingRows ? (
            <div className="text-muted-foreground font-body">Loading rows...</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-border bg-accent/30">
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Row</th>
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Client</th>
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Outcome</th>
                    <th className="p-3 text-left text-xs font-semibold text-foreground font-body">Reason</th>
                    <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((row) => {
                    const link = resolveRowClientLink(row);
                    return (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap p-3 text-sm text-muted-foreground font-body">{row.row_number}</td>
                        <td className="p-3 text-sm font-medium text-foreground font-body">{row.client_name || "—"}</td>
                        <td className="whitespace-nowrap p-3 text-sm font-body">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ROW_STATUS_CLASSES[outcomeBucket(row.status)]}`}>
                            {rowStatusLabel(row.status)}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground font-body">{row.reason || row.duplicate_reason || "—"}</td>
                        <td className="whitespace-nowrap p-3 text-sm font-body">
                          {link.hasLink && row.client_id ? (
                            <button
                              type="button"
                              className="text-primary underline-offset-2 hover:underline"
                              onClick={() => onOpenClient(row.client_id as string)}
                            >
                              {link.label}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">{link.label}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </DashboardItemDialog>
  );
}
