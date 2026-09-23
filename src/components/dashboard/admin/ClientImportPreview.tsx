import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  canOverrideRowAction,
  defaultRowAction,
  type PreviewRow,
  type PreviewRowStatus,
  type UserAction,
} from "@/lib/clientImportPreview";

const STATUS_LABELS: Record<PreviewRowStatus, string> = {
  valid: "Ready to import",
  review_duplicate: "Possible duplicate",
  existing_portal: "Existing portal account",
  invalid: "Blocked",
};

const STATUS_CLASSES: Record<PreviewRowStatus, string> = {
  valid: "bg-emerald-100 text-emerald-700",
  review_duplicate: "bg-amber-100 text-amber-700",
  existing_portal: "bg-blue-100 text-blue-700",
  invalid: "bg-red-100 text-red-700",
};

function rowDetail(row: PreviewRow): string | null {
  if (row.validation.errors.length) {
    return row.validation.errors.map((e) => e.message).join(" ");
  }
  if (row.status === "existing_portal") {
    return "A portal account already exists for this email — review required.";
  }
  const strongDuplicate = row.duplicates.find((d) => d.severity === "exact" || d.severity === "likely");
  if (strongDuplicate) {
    return strongDuplicate.reason;
  }
  if (row.validation.warnings.length) {
    return row.validation.warnings.map((w) => w.message).join(" ");
  }
  return null;
}

interface ClientImportPreviewProps {
  rows: PreviewRow[];
  rowActions: Record<number, UserAction>;
  onRowActionChange: (rowNumber: number, action: UserAction) => void;
}

export function ClientImportPreview({ rows, rowActions, onRowActionChange }: ClientImportPreviewProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px]">
        <thead>
          <tr className="border-b border-border bg-accent/30">
            <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Row</th>
            <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Client</th>
            <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Status</th>
            <th className="p-3 text-left text-xs font-semibold text-foreground font-body">Details</th>
            <th className="whitespace-nowrap p-3 text-left text-xs font-semibold text-foreground font-body">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isExpanded = expandedRow === row.rowNumber;
            const detail = rowDetail(row);
            const overridable = canOverrideRowAction(row.status);
            const currentAction = rowActions[row.rowNumber] ?? defaultRowAction(row.status);

            return (
              <Fragment key={row.rowNumber}>
                <tr className="border-b border-border last:border-0 hover:bg-accent/20">
                  <td
                    className="cursor-pointer whitespace-nowrap p-3 text-sm text-muted-foreground font-body"
                    onClick={() => setExpandedRow(isExpanded ? null : row.rowNumber)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {row.rowNumber}
                    </span>
                  </td>
                  <td
                    className="cursor-pointer p-3 text-sm font-medium text-foreground font-body"
                    onClick={() => setExpandedRow(isExpanded ? null : row.rowNumber)}
                  >
                    {row.displayName}
                  </td>
                  <td
                    className="cursor-pointer whitespace-nowrap p-3 text-sm font-body"
                    onClick={() => setExpandedRow(isExpanded ? null : row.rowNumber)}
                  >
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[row.status]}`}>
                      {STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td
                    className="cursor-pointer p-3 text-sm text-muted-foreground font-body"
                    onClick={() => setExpandedRow(isExpanded ? null : row.rowNumber)}
                  >
                    {detail || "—"}
                  </td>
                  <td className="whitespace-nowrap p-3 text-sm font-body">
                    {overridable ? (
                      <Select value={currentAction} onValueChange={(value) => onRowActionChange(row.rowNumber, value as UserAction)}>
                        <SelectTrigger className="w-[150px] rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip</SelectItem>
                          <SelectItem value="import_anyway">Import Anyway</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : row.status === "invalid" || row.status === "existing_portal" ? (
                      <span className="text-xs text-muted-foreground">Skip (forced)</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Import</span>
                    )}
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="border-b border-border bg-accent/10 last:border-0">
                    <td colSpan={5} className="p-4">
                      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {Object.entries(row.mapped)
                          .filter(([, value]) => value)
                          .map(([field, value]) => (
                            <div key={field} className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{field.replace(/_/g, " ")}</p>
                              <p className="break-words text-xs text-foreground">{value}</p>
                            </div>
                          ))}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
