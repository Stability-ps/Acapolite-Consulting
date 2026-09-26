/* eslint-disable @typescript-eslint/no-explicit-any -- Prospect Hub tables are not in the generated Supabase types yet, so rows follow the explicit select list in each query. */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyRow, Panel, prospectDb, useProspectPermissions } from "@/components/prospect-hub/shared";
import { formatDate } from "@/lib/prospectHub";

export default function ProspectCampaigns() {
  const perms = useProspectPermissions();
  const campaigns = useQuery({
    queryKey: ["prospect-campaigns"],
    queryFn: async () => {
      const [c, s] = await Promise.all([
        prospectDb.from("prospect_campaigns").select("*").order("created_at", { ascending: false }).limit(200),
        prospectDb.from("prospect_campaign_settings").select("sending_enabled,daily_limit,batch_size").order("created_at").limit(1).maybeSingle(),
      ]);
      if (c.error) throw c.error;
      return { rows: c.data ?? [], settings: s.data };
    },
  });
  const settings = campaigns.data?.settings;

  return (
    <div className="space-y-4">
      {settings && !settings.sending_enabled ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Campaign sending is switched off.</strong> Campaigns can be built, reviewed and approved, but no email leaves the system until an admin enables sending in Prospect Hub → Settings.
        </div>
      ) : settings ? (
        <p className="text-xs text-muted-foreground">Sending is enabled: up to {settings.batch_size} emails every 5 minutes, maximum {settings.daily_limit} per day.</p>
      ) : null}
      <Panel
        title="Campaigns"
        description="Filter prospects → select companies → create campaign → choose template → preview → review recipients → approve & queue → track results."
        actions={perms.canManage || perms.canSend ? <Button asChild size="sm"><Link to="new"><Plus className="mr-1 h-4 w-4" />New campaign</Link></Button> : undefined}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-2">Campaign</th><th className="p-2">Status</th><th className="p-2">Recipients</th><th className="p-2">Sent</th><th className="p-2">Skipped</th><th className="p-2">Failed</th><th className="p-2">Bounced</th><th className="p-2">Replies</th><th className="p-2">Unsub.</th><th className="p-2">Created</th></tr></thead>
            <tbody>
              {(campaigns.data?.rows ?? []).map((c: any) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-2"><Link className="font-medium hover:underline" to={c.id}>{c.name}</Link><div className="max-w-xs truncate text-xs text-muted-foreground">{c.subject}</div></td>
                  <td className="p-2 capitalize">{c.status}</td>
                  <td className="p-2">{c.total_recipients}</td><td className="p-2">{c.sent_count}</td><td className="p-2">{c.skipped_count}</td><td className="p-2">{c.failed_count}</td><td className="p-2">{c.bounced_count}</td><td className="p-2">{c.replied_count}</td><td className="p-2">{c.unsubscribed_count}</td>
                  <td className="p-2 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                </tr>
              ))}
              {campaigns.isLoading ? <EmptyRow colSpan={10}><Loader2 className="mx-auto h-5 w-5 animate-spin" /></EmptyRow> : null}
              {campaigns.isSuccess && !campaigns.data.rows.length ? <EmptyRow colSpan={10}>No campaigns yet.</EmptyRow> : null}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">"Sent" means the email provider accepted the message. Delivery and bounces are shown only when the provider reports them. Replies are logged by staff. Opens are not tracked.</p>
      </Panel>
    </div>
  );
}
