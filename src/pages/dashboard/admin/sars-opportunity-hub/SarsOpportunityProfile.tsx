/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Mail, Phone, Globe, Scale } from "lucide-react";
import { Panel, prospectDb } from "@/components/prospect-hub/shared";
const pretty=(s:string)=>s?.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())||"—";
export default function SarsOpportunityProfile(){
 const {id}=useParams();
 const q=useQuery({queryKey:["sars-opportunity",id],queryFn:async()=>{
  const r=await prospectDb.from("sars_opportunities").select("*,prospects(*),prospect_public_signals(*)").eq("id",id!).single();
  if(r.error)throw r.error; return r.data as any;
 },enabled:!!id});
 const r=q.data;
 if(q.isLoading)return <p className="text-muted-foreground">Loading SARS opportunity…</p>;
 if(!r)return <p className="text-muted-foreground">Opportunity not found.</p>;
 const p=r.prospects||{}, s=r.prospect_public_signals||{};
 return <div className="space-y-5">
  <Link to="../opportunities" className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4"/>Back to opportunities</Link>
  <div className="rounded-2xl border bg-card p-5">
   <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary"/><h2 className="text-2xl font-bold">{p.company_name}</h2></div><p className="mt-1 text-sm text-muted-foreground">{pretty(r.opportunity_type)} · {p.sector||"Sector unknown"} · {p.province||"Province unknown"}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Opportunity score</p><p className="text-2xl font-bold">{r.score}</p><p className="text-sm capitalize">{String(r.status).replace(/_/g," ")}</p></div></div>
  </div>
  <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
   <div className="space-y-5"><Panel title="Public business contact"><div className="space-y-3 text-sm">
    <p className="flex gap-2"><Mail className="h-4 w-4"/>{p.email||"Email not known"}</p><p className="flex gap-2"><Phone className="h-4 w-4"/>{p.phone||"Phone not known"}</p><p className="flex gap-2"><Globe className="h-4 w-4"/>{p.website||"Website not known"}</p>
   </div></Panel><Panel title="Case classification"><dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">Type</dt><dd>{pretty(r.opportunity_type)}</dd></div><div><dt className="text-muted-foreground">Status</dt><dd className="capitalize">{String(r.status).replace(/_/g," ")}</dd></div><div><dt className="text-muted-foreground">Case / reference</dt><dd>{s.case_number||"Not published"}</dd></div><div><dt className="text-muted-foreground">Court / authority</dt><dd>{s.court_or_authority||"Not published"}</dd></div><div><dt className="text-muted-foreground">Signal date</dt><dd>{s.signal_date||"Not published"}</dd></div></dl></Panel></div>
   <div className="space-y-5"><Panel title="Documented SARS / tax issue" description="This is evidence from the cited public record. It is not an inference of current non-compliance."><p className="text-sm leading-6">{s.evidence_summary||r.issue_summary||"No summary recorded."}</p>{s.title?<p className="mt-3 font-medium">{s.title}</p>:null}{s.source_url?<a href={s.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-primary underline">Open original evidence <ExternalLink className="h-4 w-4"/></a>:null}</Panel>
   <Panel title="Service relevance"><p className="text-sm leading-6">{s.service_relevance||"Review the evidence and determine whether Acapolite services are relevant before any outreach."}</p></Panel>
   <Panel title="Evidence metadata"><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Source type</dt><dd>{pretty(s.signal_type)}</dd></div><div><dt className="text-muted-foreground">Confidence</dt><dd>{pretty(s.confidence)}</dd></div><div><dt className="text-muted-foreground">Last seen</dt><dd>{s.last_seen_at?new Date(s.last_seen_at).toLocaleString():"—"}</dd></div><div><dt className="text-muted-foreground">Company</dt><dd>{p.company_name}</dd></div></dl></Panel></div>
  </div>
 </div>;
}
