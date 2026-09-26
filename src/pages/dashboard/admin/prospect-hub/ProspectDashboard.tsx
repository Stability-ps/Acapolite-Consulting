/* eslint-disable @typescript-eslint/no-explicit-any -- Prospect Hub tables are not in the generated Supabase types yet, so rows follow the explicit select list in each query. */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, CalendarClock, CheckCircle2, Mail, MailQuestion, Radar, Sparkles, Target, TrendingUp, UserCheck, Users } from "lucide-react";
import { EmptyRow, Panel, ScoreBadge, StageBadge, StatCard, prospectDb, staffName, useStaffMembers } from "@/components/prospect-hub/shared";
import { formatDate } from "@/lib/prospectHub";

type Dashboard = Record<string, number>;

export default function ProspectDashboard() {
  const staff = useStaffMembers();
  const stats = useQuery({
    queryKey: ["prospect-dashboard"],
    queryFn: async () => {
      const { data, error } = await prospectDb.rpc("prospect_hub_dashboard");
      if (error) throw error;
      return data as Dashboard;
    },
  });
  const panels = useQuery({
    queryKey: ["prospect-dashboard-panels"],
    queryFn: async () => {
      const [discovery, enrichment, sources, latest, overdue, campaigns, activity] = await Promise.all([
        prospectDb.from("prospect_discovery_runs").select("id,started_at,status,run_type,records_fetched,prospects_created,prospects_updated,error_message").order("started_at", { ascending: false }).limit(5),
        prospectDb.from("prospect_enrichment_runs").select("id,started_at,status,run_type,prospects_checked,prospects_updated,emails_found,phones_found").order("started_at", { ascending: false }).limit(5),
        prospectDb.from("prospect_sources").select("id,name,enabled,status,last_success_at,last_attempt_at,consecutive_failures").order("name"),
        prospectDb.from("prospects").select("id,company_name,sector,province,score,status,discovered_at").order("discovered_at", { ascending: false }).limit(8),
        prospectDb.from("prospect_follow_ups").select("id,title,due_at,assigned_to,prospect_id,prospects(company_name)").eq("status", "open").lt("due_at", new Date().toISOString()).order("due_at").limit(8),
        prospectDb.from("prospect_campaigns").select("id,name,status,total_recipients,sent_count,replied_count,bounced_count,unsubscribed_count").neq("status", "draft").order("created_at", { ascending: false }).limit(5),
        prospectDb.from("prospect_activities").select("id,activity_type,summary,occurred_at,performed_by,prospect_id,prospects(company_name)").not("performed_by", "is", null).order("occurred_at", { ascending: false }).limit(10),
      ]);
      for (const r of [discovery, enrichment, sources, latest, overdue, campaigns, activity]) if (r.error) throw r.error;
      return { discovery: discovery.data, enrichment: enrichment.data, sources: sources.data, latest: latest.data, overdue: overdue.data, campaigns: campaigns.data, activity: activity.data };
    },
  });

  const s = stats.data ?? {};
  const contacted = Number(s.contacted ?? 0);
  const conversion = contacted > 0 ? `${((Number(s.converted ?? 0) / contacted) * 100).toFixed(1)}%` : "—";
  const p = panels.data;

  return (
    <div className="space-y-5">
      {stats.isError ? <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">Could not load dashboard statistics.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total prospects" value={s.total ?? "…"} icon={Building2} />
        <StatCard label="New today / this week" value={`${s.new_today ?? 0} / ${s.new_week ?? 0}`} icon={Radar} />
        <StatCard label="High-fit prospects" value={s.high_fit ?? "…"} hint="Fit score 70+, not yet converted" icon={Target} tone="good" />
        <StatCard label="Missing contact details" value={s.missing_contact ?? "…"} hint="No public email or phone yet" icon={MailQuestion} tone="warn" />
        <StatCard label="Enriched today" value={s.enriched_today ?? "…"} hint={s.needs_review ? `${s.needs_review} website matches need review` : undefined} icon={Sparkles} />
        <StatCard label="Follow-ups overdue / due today" value={`${s.follow_ups_overdue ?? 0} / ${s.follow_ups_due_today ?? 0}`} icon={CalendarClock} tone={Number(s.follow_ups_overdue) > 0 ? "warn" : undefined} />
        <StatCard label="Qualified leads" value={s.leads ?? "…"} icon={UserCheck} />
        <StatCard label="Converted clients" value={s.converted ?? "…"} hint={`Conversion of contacted: ${conversion}`} icon={CheckCircle2} tone="good" />
        <StatCard label="Campaign emails sent" value={s.campaign_emails_sent ?? "…"} hint="Accepted by the email provider" icon={Mail} />
        <StatCard label="Replies logged" value={s.campaign_replies ?? "…"} hint="Recorded by staff" icon={TrendingUp} />
        <StatCard label="Possible duplicates" value={s.duplicates_pending ?? "…"} hint="Awaiting review in Sources" icon={AlertTriangle} tone={Number(s.duplicates_pending) > 0 ? "warn" : undefined} />
        <StatCard label="Older suppliers" value={s.older_suppliers ?? "…"} hint="Last recorded procurement award was 2+ years ago; this does not imply non-compliance" icon={Building2} />
        <StatCard label="Recently active suppliers" value={s.recent_suppliers ?? "…"} hint="Recorded procurement activity within 12 months" icon={TrendingUp} />
        <StatCard label="Ready to contact" value={s.ready_to_contact ?? "…"} hint="Public email, not opted out, not previously contacted" icon={Mail} tone="good" />
        <StatCard label="Needs enrichment" value={s.needs_enrichment ?? "…"} hint="Missing email, phone or website" icon={Sparkles} tone="warn" />
        <StatCard label="Follow-up queue" value={s.follow_up_queue ?? "…"} icon={CalendarClock} />
        <StatCard label="Do not contact" value={s.do_not_contact ?? "…"} icon={Users} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Latest prospects" actions={<Link className="text-sm text-primary hover:underline" to="prospects">View all</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {(p?.latest ?? []).map((r: any) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-2"><Link className="font-medium hover:underline" to={`prospects/${r.id}`}>{r.company_name}</Link><div className="text-xs text-muted-foreground">{[r.sector, r.province].filter(Boolean).join(" · ") || "—"}</div></td>
                    <td className="py-2 pr-2"><StageBadge stage={r.status} /></td>
                    <td className="py-2 pr-2"><ScoreBadge score={r.score} /></td>
                    <td className="py-2 text-right text-xs text-muted-foreground">{formatDate(r.discovered_at)}</td>
                  </tr>
                ))}
                {p && !p.latest?.length ? <EmptyRow colSpan={4}>No prospects yet. Discovery runs automatically; you can also add or import prospects.</EmptyRow> : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Overdue follow-ups" actions={<Link className="text-sm text-primary hover:underline" to="follow-ups">Open follow-ups</Link>}>
          <ul className="divide-y text-sm">
            {(p?.overdue ?? []).map((f: any) => (
              <li key={f.id} className="flex items-start justify-between gap-3 py-2">
                <div><Link className="font-medium hover:underline" to={`prospects/${f.prospect_id}`}>{f.prospects?.company_name ?? "Prospect"}</Link><div className="text-xs text-muted-foreground">{f.title} · {staffName(staff.data, f.assigned_to)}</div></div>
                <span className="whitespace-nowrap text-xs font-medium text-amber-700">{formatDate(f.due_at, true)}</span>
              </li>
            ))}
            {p && !p.overdue?.length ? <li className="py-6 text-center text-muted-foreground">Nothing overdue.</li> : null}
          </ul>
        </Panel>

        <Panel title="Source health" actions={<Link className="text-sm text-primary hover:underline" to="sources">Sources</Link>}>
          <ul className="divide-y text-sm">
            {(p?.sources ?? []).map((src: any) => (
              <li key={src.id} className="flex items-center justify-between gap-3 py-2">
                <div><p className="font-medium">{src.name}</p><p className="text-xs text-muted-foreground">Last success: {formatDate(src.last_success_at, true)}</p></div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${!src.enabled ? "bg-muted text-muted-foreground" : src.status === "healthy" ? "bg-emerald-100 text-emerald-800" : src.status === "failing" ? "bg-rose-100 text-rose-700" : src.status === "degraded" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>
                  {!src.enabled ? "disabled" : src.status}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Campaign performance" actions={<Link className="text-sm text-primary hover:underline" to="campaigns">Campaigns</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Campaign</th><th>Sent</th><th>Replies</th><th>Bounced</th><th>Unsub.</th></tr></thead>
              <tbody>
                {(p?.campaigns ?? []).map((c: any) => (
                  <tr key={c.id} className="border-t"><td className="py-2 pr-2"><Link className="hover:underline" to={`campaigns/${c.id}`}>{c.name}</Link><div className="text-xs capitalize text-muted-foreground">{c.status}</div></td><td>{c.sent_count}/{c.total_recipients}</td><td>{c.replied_count}</td><td>{c.bounced_count}</td><td>{c.unsubscribed_count}</td></tr>
                ))}
                {p && !p.campaigns?.length ? <EmptyRow colSpan={5}>No campaigns have been queued yet.</EmptyRow> : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent discovery runs" actions={<Link className="text-sm text-primary hover:underline" to="discover">Discover</Link>}>
          <RunList rows={p?.discovery} render={(r: any) => `${r.records_fetched} releases · ${r.prospects_created} new · ${r.prospects_updated} updated${r.error_message ? ` · ${r.error_message}` : ""}`} />
        </Panel>
        <Panel title="Recent enrichment runs">
          <RunList rows={p?.enrichment} render={(r: any) => `${r.prospects_checked} checked · ${r.prospects_updated} updated · ${r.emails_found} emails · ${r.phones_found} phones`} />
        </Panel>

        <Panel title="Recent staff activity" className="xl:col-span-2">
          <ul className="divide-y text-sm">
            {(p?.activity ?? []).map((a: any) => (
              <li key={a.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span><span className="font-medium">{staffName(staff.data, a.performed_by)}</span> · {a.summary} · <Link className="text-primary hover:underline" to={`prospects/${a.prospect_id}`}>{a.prospects?.company_name}</Link></span>
                <span className="text-xs text-muted-foreground">{formatDate(a.occurred_at, true)}</span>
              </li>
            ))}
            {p && !p.activity?.length ? <li className="py-6 text-center text-muted-foreground">No staff activity yet.</li> : null}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function RunList({ rows, render }: { rows: any[] | undefined; render: (r: any) => string }) {
  return (
    <ul className="divide-y text-sm">
      {(rows ?? []).map((r) => (
        <li key={r.id} className="py-2">
          <div className="flex items-center justify-between gap-2"><span className="font-medium">{formatDate(r.started_at, true)} <span className="text-xs capitalize text-muted-foreground">({r.run_type})</span></span><span className={`text-xs font-medium capitalize ${r.status === "failed" ? "text-destructive" : r.status === "partial" ? "text-amber-700" : "text-emerald-700"}`}>{r.status}</span></div>
          <p className="text-xs text-muted-foreground">{render(r)}</p>
        </li>
      ))}
      {rows && !rows.length ? <li className="py-6 text-center text-muted-foreground">No runs yet.</li> : null}
    </ul>
  );
}
