import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseImportFile } from "@/lib/clientImport";
import { PROSPECT_IMPORT_FIELDS, guessProspectMapping, mapImportRows, type ProspectImportKey } from "@/lib/prospectHub";
import { errorMessage, prospectDb } from "./shared";

type RowOutcome = { index: number; status: string; reason?: string };

export function ImportProspectsDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (v: boolean) => void; onImported: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<ProspectImportKey, string>>>({});
  const [preview, setPreview] = useState<{ created: number; duplicates: number; rejected: number; rows: RowOutcome[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const reset = () => { setFileName(null); setHeaders([]); setRawRows([]); setMapping({}); setPreview(null); setDone(null); };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    try {
      const parsed = await parseImportFile(file);
      if (parsed.rows.length > 2000) throw new Error("Prospect imports are limited to 2000 rows per file.");
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setMapping(guessProspectMapping(parsed.headers));
    } catch (e) {
      toast.error(errorMessage(e, "Could not read that file"));
    }
  };

  const mapped = mapImportRows(rawRows, mapping);
  const clientErrors = mapped.filter((m) => m.errors.length);
  const validRows = mapped.filter((m) => !m.errors.length);

  const run = async (commit: boolean) => {
    setBusy(true);
    try {
      const { data, error } = await prospectDb.rpc("import_prospects", { p_rows: validRows.map((m) => m.row), p_commit: commit, p_filename: fileName });
      if (error) throw error;
      if (commit) {
        setDone(`${data.created} created · ${data.duplicates} duplicates skipped · ${data.rejected + clientErrors.length} rejected`);
        setPreview(null);
        onImported();
      } else {
        setPreview(data);
      }
    } catch (e) {
      toast.error(errorMessage(e, "Import failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import prospects</DialogTitle>
          <DialogDescription>Upload a CSV or XLSX of publicly available business details. Nothing is written until you confirm; existing prospects are never overwritten and duplicates are skipped.</DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/30">
          <Upload className="h-4 w-4" />{fileName ?? "Choose a .csv or .xlsx file"}
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>

        {headers.length ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Column mapping ({rawRows.length} rows)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROSPECT_IMPORT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}{f.key === "company_name" ? " *" : ""}</Label>
                  <Select value={mapping[f.key] ?? "__none"} onValueChange={(v) => { setPreview(null); setMapping((m) => ({ ...m, [f.key]: v === "__none" ? undefined : v })); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__none">Not imported</SelectItem>{headers.filter(Boolean).map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {clientErrors.length ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-medium">{clientErrors.length} row(s) will be rejected:</p>
                <ul className="mt-1 max-h-28 overflow-y-auto">{clientErrors.slice(0, 50).map((m) => <li key={m.rowNumber}>Row {m.rowNumber}: {m.errors.join("; ")}</li>)}</ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy || !mapping.company_name || !validRows.length} onClick={() => void run(false)}>{busy && !preview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Preview import</Button>
              {preview ? <Button disabled={busy || preview.created === 0} onClick={() => void run(true)}>Import {preview.created} new prospect{preview.created === 1 ? "" : "s"}</Button> : null}
            </div>
            {preview ? (
              <div className="rounded-xl border p-3 text-sm">
                <p><strong>{preview.created}</strong> new · <strong>{preview.duplicates}</strong> duplicates (skipped) · <strong>{preview.rejected + clientErrors.length}</strong> rejected</p>
                <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-muted-foreground">
                  {preview.rows.filter((r) => r.status !== "ready").slice(0, 100).map((r) => (
                    <li key={r.index}>{validRows[r.index - 1]?.row.company_name ?? `Row ${r.index}`}: {r.status} — {r.reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {done ? <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">Import complete: {done}.</p> : null}
      </DialogContent>
    </Dialog>
  );
}
