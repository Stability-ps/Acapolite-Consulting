import { authorizeProspectCaller, createAdminClient, jsonResponse, preflight, requireEnv } from "../_shared/prospectHttp.ts";
const SOURCES=[
 {key:"saflii_sars_cases",query:"site:saflii.org/za/cases South Africa company SARS tax debt preservation order section 163 tax dispute VAT PAYE assessment"},
 {key:"gov_gazette_insolvency",query:"site:gov.za Government Gazette South Africa company liquidation insolvency final liquidation provisional liquidation notice"}
];
type Hit={company_name:string;title:string;source_url:string;signal_type:string;signal_date?:string;case_number?:string;court_or_authority?:string;evidence_summary:string;service_relevance?:string};
const norm=(s:string)=>s.toLowerCase().replace(/\(pty\)\s*ltd|pty\s*ltd|cc|limited|ltd/gi,"").replace(/[^a-z0-9]+/g," ").trim();
async function search(q:string):Promise<Hit[]>{
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${requireEnv("OPENAI_API_KEY")}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5-mini",tools:[{type:"web_search"}],input:`Search public South African records for: ${q}. Return ONLY JSON array (max 12) with company_name,title,source_url,signal_type,signal_date,case_number,court_or_authority,evidence_summary,service_relevance. signal_type: sars_court_case|tax_dispute|sars_debt_enforcement|preservation_order|liquidation|business_rescue|insolvency|other_public_record. Tax signals require the source to explicitly connect that entity to the tax/SARS issue. Never infer non-compliance. Insolvency/liquidation signals describe only the published proceeding. Exact supporting public URL required. Businesses/entities only, not people, courts, law firms, SARS or government departments.`})});
 if(!r.ok) throw new Error(`OpenAI HTTP ${r.status}`); const d=await r.json();
 const t=(d.output||[]).flatMap((o:any)=>o.content||[]).filter((x:any)=>x.type==="output_text").map((x:any)=>x.text).join("").trim().replace(/^\`\`\`json\s*/,"").replace(/\`\`\`$/,"");
 const p=JSON.parse(t||"[]"); return Array.isArray(p)?p:[];
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return preflight(req); if(req.method!=="POST")return jsonResponse(req,{error:"Method not allowed"},405);
 const caller=await authorizeProspectCaller(req,"can_manage_prospect_hub"); if(!caller)return jsonResponse(req,{error:"Forbidden"},403);
 const sb=createAdminClient(),stats={found:0,created:0,matched:0,signals:0,skipped:0,errors:[] as string[]};
 for(const cfg of SOURCES){try{
  const {data:source}=await sb.from("prospect_sources").select("*").eq("key",cfg.key).single(); if(!source?.enabled)continue;
  const hits=await search(cfg.query); stats.found+=hits.length; let sourceCreated=0;
  for(const h of hits){try{
   if(!h.company_name||!h.source_url||!h.evidence_summary||!h.signal_type){stats.skipped++;continue}
   const n=norm(h.company_name); if(!n){stats.skipped++;continue}
   let {data:p}=await sb.from("prospects").select("id").eq("normalized_name",n).maybeSingle();
   if(!p){const x=await sb.from("prospects").insert({company_name:h.company_name.trim(),normalized_name:n,source_name:source.name,source_url:h.source_url,metadata:{public_record_discovery:true,source_key:cfg.key},enrichment_status:"pending"}).select("id").single();if(x.error)throw x.error;p=x.data;stats.created++;sourceCreated++;}else stats.matched++;
   const x=await sb.from("prospect_public_signals").upsert({prospect_id:p.id,source_id:source.id,source_record_id:h.case_number||h.source_url,signal_type:h.signal_type,signal_date:h.signal_date||null,title:h.title||h.company_name,case_number:h.case_number||null,court_or_authority:h.court_or_authority||null,source_url:h.source_url,service_relevance:h.service_relevance||null,evidence_summary:h.evidence_summary,confidence:"review_required",metadata:{source_key:cfg.key},last_seen_at:new Date().toISOString()},{onConflict:"source_url,signal_type,prospect_id"});if(x.error)throw x.error;stats.signals++;
   const {data:ss}=await sb.from("prospect_public_signals").select("signal_type,signal_date").eq("prospect_id",p.id);const types=[...new Set((ss||[]).map((v:any)=>v.signal_type))],dates=(ss||[]).map((v:any)=>v.signal_date).filter(Boolean).sort();
   await sb.from("prospects").update({public_signal_count:(ss||[]).length,public_signal_types:types,last_public_signal_at:dates.at(-1)||null,enrichment_status:"pending",enrichment_checked_at:null}).eq("id",p.id);
  }catch(e){stats.skipped++;stats.errors.push(String(e))}}
  await sb.from("prospect_sources").update({status:"healthy",last_success_at:new Date().toISOString(),last_attempt_at:new Date().toISOString(),last_error:null,records_discovered:Number(source.records_discovered||0)+hits.length,prospects_created:Number(source.prospects_created||0)+sourceCreated,total_runs:Number(source.total_runs||0)+1}).eq("id",source.id);
 }catch(e){const message=e instanceof Error?e.message:String(e);stats.errors.push(`${cfg.key}: ${message}`);const {data:source}=await sb.from("prospect_sources").select("id,total_failures,consecutive_failures").eq("key",cfg.key).maybeSingle();if(source){await sb.from("prospect_sources").update({status:"degraded",last_attempt_at:new Date().toISOString(),last_error:message,total_failures:Number(source.total_failures||0)+1,consecutive_failures:Number(source.consecutive_failures||0)+1}).eq("id",source.id)}}}
 return jsonResponse(req,{ok:stats.errors.length===0,...stats});
});