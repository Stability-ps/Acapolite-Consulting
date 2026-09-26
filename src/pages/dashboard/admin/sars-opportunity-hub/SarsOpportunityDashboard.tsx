/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Scale, ShieldAlert, ReceiptText, Gavel, Building2, SearchCheck, PhoneCall, TrendingUp } from "lucide-react";
import { Panel, StatCard, prospectDb } from "@/components/prospect-hub/shared";

const label=(v:string)=>v.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());

export default function SarsOpportunityDashboard(){
 const q=useQuery({queryKey:["sars-opportunity-dashboard"],queryFn:async()=>{
  const [opps,signals,sources]=await Promise.all([
   prospectDb.from("sars_opportunities").select("id,opportunity_type,status,score,created_at,prospect_id,prospects(company_name,email,phone,website),prospect_public_signals(title,signal_date,court_or_authority,source_url)"),
   prospectDb.from("prospect_public_signals").select("id,reviewed_at,signal_type"),
   prospectDb.from("prospect_sources").select("id,key,name,status,last_success_at,records_discovered,prospects_created").in("key",["saflii_sars_cases","gov_gazette_insolvency","statssa_liquidations"])
  ]); for(const r of [opps,signals,sources]) if(r.error) throw r.error; return {opps:opps.data??[],signals:signals.data??[],sources:sources.data??[]};
 }});
 const rows=q.data?.opps??[]; const count=(types:string[])=>rows.filter((r:any)=>types.includes(r.opportunity_type)).length;
 const review=rows.filter((r:any)=>r.status==="review").length, ready=rows.filter((r:any)=>r.prospects?.email||r.prospects?.phone).length;
 return <div className="space-y-5">
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <StatCard label="SARS opportunities" value={rows.length||"…"} icon={Scale}/>
   <StatCard label="Review queue" value={review} hint="Evidence requires human review" icon={SearchCheck} tone={review?"warn":undefined}/>
   <StatCard label="Tax / enforcement" value={count(["sars_debt_enforcement","preservation_order","tax_dispute_appeal","s164_suspension","s200_compromise","vat","paye","other_tax"])} icon={Gavel}/>
   <StatCard label="Liquidation / distress" value={count(["liquidation","insolvency","business_rescue"])} icon={Building2}/>
   <StatCard label="Preservation orders" value={count(["preservation_order"])} icon={ShieldAlert}/>
   <StatCard label="VAT / PAYE" value={count(["vat","paye"])} icon={ReceiptText}/>
   <StatCard label="Contact details found" value={ready} hint="Public business email or phone available" icon={PhoneCall}/>
   <StatCard label="High relevance" value={rows.filter((r:any)=>r.score>=70).length} hint="Opportunity score 70+; not a finding of non-compliance" icon={TrendingUp}/>
  </div>
  <Panel title="Latest SARS opportunities" description="Review the underlying public evidence before qualification or outreach." actions={<Link className="text-sm text-primary hover:underline" to="opportunities">View all</Link>}>
   <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Company</th><th>Type</th><th>Score</th><th>Status</th><th>Evidence</th></tr></thead><tbody>
   {rows.sort((a:any,b:any)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,12).map((r:any)=><tr key={r.id} className="border-t"><td className="py-2 pr-3 font-medium">{r.prospects?.company_name||"—"}</td><td className="pr-3">{label(r.opportunity_type)}</td><td className="pr-3">{r.score}</td><td className="pr-3 capitalize">{r.status.replace(/_/g," ")}</td><td>{r.prospect_public_signals?.source_url?<a className="text-primary underline" target="_blank" rel="noreferrer" href={r.prospect_public_signals.source_url}>Open source</a>:"—"}</td></tr>)}
   </tbody></table></div>
  </Panel>
  <Panel title="Source health"><div className="grid gap-3 md:grid-cols-3">{(q.data?.sources??[]).map((s:any)=><div key={s.id} className="rounded-xl border p-3"><p className="font-medium">{s.name}</p><p className="mt-1 text-xs text-muted-foreground capitalize">{s.status} · {s.records_discovered} records · {s.prospects_created} prospects</p></div>)}</div></Panel>
 </div>;
}