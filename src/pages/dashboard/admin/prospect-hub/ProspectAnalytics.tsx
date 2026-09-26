import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { EmptyRow, Panel, errorMessage, prospectDb } from "@/components/prospect-hub/shared";

type Row = Record<string, string | number>;

export default function ProspectAnalytics() {
  const q = useQuery({
    queryKey: ["prospect-analytics"],
    queryFn: async () => {
      const { data, error } = await prospectDb.rpc("prospect_hub_analytics");
      if (error) throw error;
      return data as { funnel: Record<string, number>; by_source: Row[]; by_sector: Row[]; campaigns: Row[]; staff_activity: Row[]; revenue: { invoiced: number; paid: number; clients_with_invoices: number; currency: string } | null };
    },
  });
  if (q.isLoading) return <Loader2 className="mx-auto h-6 w-6 animate-spin" />;
  if (q.isError) return <p className="text-sm text-destructive">{errorMessage(q.error, "Could not load analytics")}</p>;
  const a = q.data!;
  const steps: Array<[string, number]> = [["Discovered", a.funnel.discovered], ["Contacted", a.funnel.contacted], ["Replied", a.funnel.replied], ["Qualified lead", a.funnel.qualified], ["Client", a.funnel.clients]];
  const max = Math.max(1, steps[0][1]);

  return (
    <div className="space-y-4">
      <Panel title="Funnel" description="Discovered → Contacted → Replied → Qualified → Client. Replies are counted when staff log them.">
        <div className="space-y-2">
          {steps.map(([label, n], i) => (
            <div key={label} className="grid grid-cols-[8rem_1fr_5rem] items-center gap-3 text-sm">
              <span>{label}</span>
              <div className="h-6 rounded-md bg-muted"><div className="h-6 rounded-md bg-primary" style={{ width: `${Math.max(n ? 2 : 0, (n / max) * 100)}%` }} /></div>
              <span className="text-right tabular-nums">{n}{i > 0 && steps[i - 1][1] ? <span className="ml-1 text-xs text-muted-foreground">({Math.round((n / steps[i - 1][1]) * 100)}%)</span> : null}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Source → leads → clients" description="Which sources actually produce clients.">
          <SimpleTable rows={a.by_source} cols={[["source", "Source"], ["prospects", "Prospects"], ["leads", "Leads"], ["clients", "Clients"]]} />
        </Panel>
        <Panel title="Sector → conversion">
          <SimpleTable rows={a.by_sector} cols={[["sector", "Sector"], ["prospects", "Prospects"], ["leads", "Leads"], ["clients", "Clients"]]} />
        </Panel>
        <Panel title="Campaign outcomes" description="Leads/clients count prospects that became a lead or client after the email was sent.">
          <SimpleTable rows={a.campaigns} cols={[["name", "Campaign"], ["sent", "Sent"], ["replies", "Replies"], ["leads", "Leads"], ["clients", "Clients"], ["unsubscribed", "Unsub."], ["bounced", "Bounced"]]} link={(r) => `../campaigns/${r.id}`} />
        </Panel>
        <Panel title="Staff activity (30 days)">
          <SimpleTable rows={a.staff_activity} cols={[["staff", "Staff"], ["calls", "Calls"], ["notes", "Notes"], ["stage_changes", "Stage changes"], ["conversions", "Leads/clients"]]} />
        </Panel>
        <Panel title="Revenue attributed to Prospect Hub clients" description="Invoices issued (excluding cancelled) to clients converted from Prospect Hub, from their conversion date onward.">
          {a.revenue ? (
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Invoiced</p><p className="text-xl font-semibold">R {Number(a.revenue.invoiced).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p></div>
              <div><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-semibold">R {Number(a.revenue.paid).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p></div>
              <div><p className="text-xs text-muted-foreground">Paying clients</p><p className="text-xl font-semibold">{a.revenue.clients_with_invoices}</p></div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Requires invoice access.</p>}
        </Panel>
      </div>
    </div>
  );
}

function SimpleTable({ rows, cols, link }: { rows: Row[]; cols: Array<[string, string]>; link?: (r: Row) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr>{cols.map(([, h]) => <th key={h} className="p-1.5">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i} className="border-t">{cols.map(([k], j) => <td key={k} className="p-1.5">{j === 0 && link ? <Link className="hover:underline" to={link(r)}>{r[k]}</Link> : r[k]}</td>)}</tr>)}
          {!rows.length ? <EmptyRow colSpan={cols.length}>No data yet.</EmptyRow> : null}
        </tbody>
      </table>
    </div>
  );
}
