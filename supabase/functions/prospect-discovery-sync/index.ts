import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const SOURCE = "National Treasury eTenders OCDS";
const API = "https://ocds-api.etenders.gov.za/api/OCDSReleases";

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS }); }
function env(name: string) { const v=Deno.env.get(name)?.trim(); if(!v) throw new Error("Missing "+name); return v; }
function adminKey() {
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if(legacy) return legacy;
  const raw=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(!raw) throw new Error("Missing Supabase admin key");
  return JSON.parse(raw).default;
}
function safeText(v: unknown) { return typeof v === "string" && v.trim() ? v.trim() : null; }
function norm(v: unknown) { return String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
function first<T>(v: T[] | undefined | null): T | null { return Array.isArray(v) && v.length ? v[0] : null; }
function sectorFor(text: string, targets: string[]) {
  const n=norm(text);
  const aliases: Record<string,string[]> = {
    Construction:["construction","building","civil works","infrastructure"],
    Engineering:["engineering","engineer"],
    Security:["security","guarding","protection"],
    Cleaning:["cleaning","hygiene","janitorial"],
    Transport:["transport","transportation"],
    Logistics:["logistics","freight","courier"],
    IT:["information technology","ict","software","computer","network"],
    Catering:["catering","food service"],
    Maintenance:["maintenance","repairs","facilities management"]
  };
  for(const target of targets) if((aliases[target]||[target.toLowerCase()]).some(k=>n.includes(k))) return target;
  return null;
}
function scoreProspect(p: {email:string|null;phone:string|null;province:string|null;sector:string|null;award:boolean}) {
  let s=25;
  if(p.award) s+=25;
  if(p.email) s+=15;
  if(p.phone) s+=10;
  if(p.province==="Gauteng") s+=10;
  if(p.sector) s+=10;
  return Math.min(100,s);
}
function isCron(req: Request) {
  const expected=(Deno.env.get("PROSPECT_SYNC_CRON_SECRET") || Deno.env.get("SOCIAL_CRON_SECRET"))?.trim() || "";
  const got=req.headers.get("x-cron-secret") || "";
  if(!expected || got.length!==expected.length) return false;
  let diff=0; for(let i=0;i<got.length;i++) diff |= got.charCodeAt(i)^expected.charCodeAt(i);
  return diff===0;
}
async function isAdminUser(req: Request, sbAdmin: any) {
  const auth=req.headers.get("authorization") || "";
  if(!auth.startsWith("Bearer ")) return false;
  const token=auth.slice(7);
  const { data:{user} }=await sbAdmin.auth.getUser(token);
  if(!user) return false;
  const { data }=await sbAdmin.from("profiles").select("role").eq("id",user.id).maybeSingle();
  return data?.role==="admin";
}
function findProvince(release:any, supplier:any) {
  const values=[
    supplier?.address?.region,
    supplier?.address?.locality,
    release?.tender?.deliveryAddresses?.[0]?.region,
    release?.buyer?.address?.region,
    release?.planning?.budget?.projectLocation?.region
  ].map(safeText).filter(Boolean) as string[];
  const joined=norm(values.join(" "));
  const provinces=["Gauteng","Western Cape","Eastern Cape","KwaZulu-Natal","Limpopo","Mpumalanga","North West","Free State","Northern Cape"];
  return provinces.find(p=>joined.includes(norm(p))) || null;
}
function suppliersFromRelease(release:any) {
  const ids=new Set<string>();
  for(const award of release?.awards || []) for(const s of award?.suppliers || []) if(s?.id) ids.add(String(s.id));
  const parties=(release?.parties || []).filter((p:any)=>ids.has(String(p?.id)) || (p?.roles || []).includes("supplier"));
  return parties.map((p:any)=>({party:p,award:ids.has(String(p?.id))}));
}
Deno.serve(async (req: Request) => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:JSON_HEADERS});
  const sb=createClient(env("SUPABASE_URL"),adminKey(),{auth:{persistSession:false,autoRefreshToken:false}});
  const cron=isCron(req);
  const admin=cron ? false : await isAdminUser(req,sb);
  if(!cron && !admin) return json({error:"Forbidden"},403);
  let runId:string|null=null;
  try {
    const runType=cron ? "scheduled" : "manual";
    const { data:settings,error:settingsError }=await sb.from("prospect_discovery_settings").select("*").eq("source_name",SOURCE).single();
    if(settingsError) throw settingsError;
    if(!settings.enabled && cron) return json({ok:true,skipped:true,reason:"source_disabled"});
    const {data:run,error:runError}=await sb.from("prospect_discovery_runs").insert({source_name:SOURCE,run_type:runType}).select("id").single();
    if(runError) throw runError; runId=run.id;
    const provinces=(settings.provinces || []) as string[];
    const targets=(settings.target_sectors || []) as string[];
    const pageSize=Math.min(100,Math.max(10,settings.page_size || 100));
    const pages=Math.min(10,Math.max(1,settings.pages_per_run || 3));
    let page=Math.max(1,settings.next_page || 1);
    let fetched=0,seen=0,created=0,updated=0,skipped=0;
    for(let step=0;step<pages;step++,page++) {
      const url=API+"?PageNumber="+page+"&PageSize="+pageSize;
      const response=await fetch(url,{headers:{"Accept":"application/json","User-Agent":"Acapolite-Prospect-Hub/1.0"}});
      if(!response.ok) throw new Error("eTenders API "+response.status);
      const payload=await response.json();
      const releases=Array.isArray(payload?.releases) ? payload.releases : [];
      fetched += releases.length;
      if(!releases.length) { page=1; break; }
      for(const release of releases) {
        const tenderText=[release?.tender?.title,release?.tender?.description,...(release?.tender?.items || []).map((i:any)=>i?.description)].filter(Boolean).join(" ");
        const sector=sectorFor(tenderText,targets);
        for(const entry of suppliersFromRelease(release)) {
          seen++;
          const p=entry.party;
          const company=safeText(p?.name);
          if(!company) { skipped++; continue; }
          const province=findProvince(release,p);
          if(provinces.length && province && !provinces.includes(province)) { skipped++; continue; }
          if(!sector) { skipped++; continue; }
          const contact=p?.contactPoint || {};
          const email=safeText(contact?.email);
          const phone=safeText(contact?.telephone);
          const website=safeText(p?.details?.url) || safeText(p?.contactPoint?.url);
          const sourceRecord=[release?.ocid,p?.id].filter(Boolean).join(":") || null;
          const sourceUrl=release?.ocid ? "https://www.etenders.gov.za/Home/opportunities?id="+encodeURIComponent(release.ocid) : null;
          const row:any={
            company_name:company, sector, province, city:safeText(p?.address?.locality), email, phone, website,
            contact_name:safeText(contact?.name), source_name:SOURCE, source_record_id:sourceRecord,
            source_url:sourceUrl, source_last_seen_at:new Date().toISOString(), last_enriched_at:new Date().toISOString(),
            score:scoreProspect({email,phone,province,sector,award:entry.award}),
            priority:"high",
            metadata:{ocid:release?.ocid || null,tender_title:release?.tender?.title || null,tender_status:release?.tender?.status || null,award_supplier:entry.award,official_source:true}
          };
          let existing:any=null;
          if(sourceRecord) {
            const {data}=await sb.from("prospects").select("id,status,notes,do_not_contact,email_opt_out_at").eq("source_name",SOURCE).eq("source_record_id",sourceRecord).maybeSingle();
            existing=data;
          }
          if(!existing && email) {
            const {data}=await sb.from("prospects").select("id,status,notes,do_not_contact,email_opt_out_at").ilike("email",email).limit(1).maybeSingle();
            existing=data;
          }
          if(existing) {
            delete row.status; delete row.notes; delete row.do_not_contact; delete row.email_opt_out_at;
            const {error}=await sb.from("prospects").update(row).eq("id",existing.id);
            if(error) throw error; updated++;
          } else {
            const {error}=await sb.from("prospects").insert(row);
            if(error) {
              if(String(error.code)==="23505") { skipped++; continue; }
              throw error;
            }
            created++;
          }
        }
      }
    }
    const now=new Date().toISOString();
    await sb.from("prospect_discovery_settings").update({next_page:page,last_run_at:now,last_success_at:now,last_error:null}).eq("source_name",SOURCE);
    await sb.from("prospect_discovery_runs").update({status:"completed",completed_at:now,records_fetched:fetched,suppliers_seen:seen,prospects_created:created,prospects_updated:updated,skipped,metadata:{next_page:page}}).eq("id",runId);
    return json({ok:true,run_id:runId,records_fetched:fetched,suppliers_seen:seen,prospects_created:created,prospects_updated:updated,skipped,next_page:page});
  } catch(error) {
    const message=error instanceof Error ? error.message : String(error);
    console.error("prospect-discovery-sync",message);
    const now=new Date().toISOString();
    if(runId) await sb.from("prospect_discovery_runs").update({status:"failed",completed_at:now,error_message:message}).eq("id",runId);
    await sb.from("prospect_discovery_settings").update({last_run_at:now,last_error:message}).eq("source_name",SOURCE);
    return json({ok:false,error:"Discovery sync failed"},500);
  }
});