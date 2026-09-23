export type ImportRowResultStatus =
  | "imported"
  | "skipped_user"
  | "blocked_validation"
  | "blocked_duplicate_changed"
  | "blocked_portal_collision"
  | "failed";

export type ImportRowResult = {
  row_number: number;
  status: ImportRowResultStatus;
  client_id: string | null;
  client_name: string;
  reason: string | null;
  duplicate_reason: string | null;
  matched_client_ids: string[];
};

export type ImportSummary = {
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  blocked_count: number;
  failed_count: number;
};

const STATUS_LABELS: Record<ImportRowResultStatus, string> = {
  imported: "Imported",
  skipped_user: "Skipped",
  blocked_validation: "Blocked — validation",
  blocked_duplicate_changed: "Blocked — duplicate",
  blocked_portal_collision: "Blocked — portal account",
  failed: "Failed",
};

const STATUS_CLASSES: Record<ImportRowResultStatus, string> = {
  imported: "bg-emerald-100 text-emerald-700",
  skipped_user: "bg-slate-200 text-slate-700",
  blocked_validation: "bg-red-100 text-red-700",
  blocked_duplicate_changed: "bg-amber-100 text-amber-700",
  blocked_portal_collision: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
};

interface ClientImportResultsProps {
  summary: ImportSummary;
  rows: ImportRowResult[];
  onOpenClient: (clientId: string) => void;
}

function ResultTile({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className={`text-2xl font-bold ${className ?? "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function ClientImportResults({ summary, rows, onOpenClient }: ClientImportResultsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold text-foreground">Import complete</h3>
        <p className="text-sm text-muted-foreground font-body">
          {summary.total_rows} row{summary.total_rows === 1 ? "" : "s"} processed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResultTile label="Imported" value={summary.imported_count} className="text-emerald-600" />
        <ResultTile label="Skipped" value={summary.skipped_count} className="text-slate-600" />
        <ResultTile label="Blocked" value={summary.blocked_count} className="text-amber-600" />
        <ResultTile label="Failed" value={summary.failed_count} className="text-red-600" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="border-b border-border bg-accent/30">
              <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Row</th>
              <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Name</th>
              <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Status</th>
              <th className="p-3 text-left text-xs font-semibold text-foreground font-body">Reason</th>
              <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Client</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.row_number} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap p-3 text-sm text-muted-foreground font-body">{row.row_number}</td>
                <td className="p-3 text-sm font-medium text-foreground font-body">{row.client_name}</td>
                <td className="whitespace-nowrap p-3 text-sm font-body">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[row.status]}`}>
                    {STATUS_LABELS[row.status]}
                  </span>
                </td>
                <td className="p-3 text-sm text-muted-foreground font-body">{row.reason || row.duplicate_reason || "—"}</td>
                <td className="whitespace-nowrap p-3 text-sm font-body">
                  {row.client_id ? (
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => onOpenClient(row.client_id as string)}
                    >
                      Open
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
