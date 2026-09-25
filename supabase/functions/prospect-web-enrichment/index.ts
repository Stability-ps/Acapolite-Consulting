import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
function env(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}
function adminKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("Missing Supabase admin key");
  return JSON.parse(raw).default;
}
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
function isCron(req: Request) {
  const expected = (Deno.env.get("PROSPECT_SYNC_CRON_SECRET") || Deno.env.get("SOCIAL_CRON_SECRET") || "").trim();
  const provided = req.headers.get("x-cron-secret") || "";
  return Boolean(expected) && timingSafeEqual(expected, provided);
}
async function isAdminUser(req: Request, sb: any) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return false;
  const { data } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role === "admin";
}
function normalizeWebsite(url: string | null) {
  if (!url) return null;
  try {
    const candidate = /^https?:\/\//i.test(url) ? url : "https://" + url;
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
function decodeHtml(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&#64;/g, "@").replace(/&commat;/g, "@").replace(/\s+/g, " ").trim();
}
function extractContacts(html: string) {
  const emails = [...html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
    .map((m) => decodeHtml(m[0]))
    .filter((x) => !/(example\.com|sentry|wixpress|wordpress|cloudflare|schema\.org)/i.test(x));
  const phones = [...html.matchAll(/(?:\+27|0)[1-8][0-9](?:[\s().-]*[0-9]){7,9}/g)]
    .map((m) => decodeHtml(m[0]))
    .filter((x) => x.replace(/\D/g, "").length >= 10);
  return {
    email: [...new Set(emails)][0] || null,
    phone: [...new Set(phones)][0] || null,
  };
}
function companyLooksRelevant(company: string, html: string) {
  const words = company.toLowerCase().replace(/\b(pty|ltd|cc|inc|limited|proprietary)\b/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  if (!words.length) return true;
  const hay = html.toLowerCase();
  return words.slice(0, 3).some((w) => hay.includes(w));
}
async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Acapolite Prospect Hub/1.0 (+https://acapoliteconsulting.co.za)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;
    return { url: response.url, html: (await response.text()).slice(0, 750000) };
  } finally {
    clearTimeout(timeout);
  }
}
function contactLinks(html: string, base: string) {
  const links = [...html.matchAll(/href=["']([^"'#]+)["']/gi)]
    .map((m) => m[1])
    .filter((href) => /(contact|about|reach-us|contact-us)/i.test(href));
  const out: string[] = [];
  for (const href of links) {
    try {
      const u = new URL(href, base);
      if (u.hostname === new URL(base).hostname) out.push(u.toString());
    } catch {}
  }
  return [...new Set(out)].slice(0, 2);
}
async function findOfficialWebsite(company: string, city: string | null, province: string | null) {
  const key = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!key) { console.error("prospect-web-search", JSON.stringify({error:"missing_openai_key"})); return null; }
  console.log("prospect-web-search-start", company);
  const prompt =
    "Find the official public business website for this South African company. Return JSON only with fields website and confidence. " +
    "Company: " + company + ". City: " + (city || "") + ". Province: " + (province || "") + ". " +
    "Use web search. Do not return directory listings, social-media profiles, tender pages, or aggregator sites. " +
    "If uncertain, website must be an empty string. Confidence must be high, medium, or low.";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_TAX_COACH_MODEL") || "gpt-4.1-mini",
      store: false,
      tools: [{ type: "web_search" }],
      input: prompt,
    }),
    signal: AbortSignal.timeout(25000),
  });
  const result = await response.json();
  if (!response.ok) { console.error("prospect-web-search", JSON.stringify({status: response.status, error: result?.error})); return null; }
  const text = result.output?.flatMap((o: any) => o.content ?? []).find((c: any) => c.type === "output_text")?.text;
  if (!text) return null;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const website = normalizeWebsite(parsed.website || null);
    if (!website || parsed.confidence === "low") return null;
    return website;
  } catch {
    return null;
  }
}
async function enrichOne(prospect: any, useSearch: boolean) {
  let website = normalizeWebsite(prospect.website);
  let discoveredWebsite = false;
  if (!website && useSearch) {
    website = await findOfficialWebsite(prospect.company_name, prospect.city, prospect.province);
    discoveredWebsite = Boolean(website);
  }
  if (!website) return { status: "skipped", reason: "no_website" };

  const homepage = await fetchHtml(website);
  if (!homepage) return { status: "failed", reason: "website_unavailable", website };
  if (!companyLooksRelevant(prospect.company_name, homepage.html)) {
    return { status: "failed", reason: "website_identity_mismatch", website: homepage.url };
  }

  let found = extractContacts(homepage.html);
  let sourceUrl = homepage.url;
  if (!found.email || !found.phone) {
    for (const link of contactLinks(homepage.html, homepage.url)) {
      const page = await fetchHtml(link);
      if (!page) continue;
      const x = extractContacts(page.html);
      if (!found.email && x.email) found.email = x.email;
      if (!found.phone && x.phone) found.phone = x.phone;
      if (x.email || x.phone) sourceUrl = page.url;
      if (found.email && found.phone) break;
    }
  }

  return {
    status: "completed",
    website: homepage.url,
    discoveredWebsite,
    email: found.email,
    phone: found.phone,
    sourceUrl,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: JSON_HEADERS });
  const sb = createClient(env("SUPABASE_URL"), adminKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const cron = isCron(req);
  const admin = cron ? false : await isAdminUser(req, sb);
  if (!cron && !admin) return json({ error: "Forbidden" }, 403);

  let runId: string | null = null;
  try {
    const { data: settings, error: settingsError } = await sb.from("prospect_enrichment_settings").select("*").limit(1).single();
    if (settingsError) throw settingsError;
    if (!settings.enabled && cron) return json({ ok: true, skipped: true, reason: "enrichment_disabled" });

    const { data: run, error: runError } = await sb.from("prospect_enrichment_runs")
      .insert({ run_type: cron ? "scheduled" : "manual" }).select("id").single();
    if (runError) throw runError;
    runId = run.id;

    const cutoff = new Date(Date.now() - Number(settings.recheck_days || 14) * 86400000).toISOString();
    const { data: prospects, error } = await sb.from("prospects")
      .select("id,company_name,city,province,website,email,phone,enrichment_checked_at,enrichment_status")
      .or(`enrichment_checked_at.is.null,enrichment_checked_at.lt.${cutoff}`)
      .order("enrichment_checked_at", { ascending: true, nullsFirst: true })
      .limit(Number(settings.batch_size || 8));
    if (error) throw error;

    let checked = 0, websitesFetched = 0, emailsFound = 0, phonesFound = 0, updated = 0, skipped = 0;

    for (const prospect of prospects || []) {
      checked++;
      try {
        const result = await enrichOne(prospect, settings.use_openai_web_search === true);
        const now = new Date().toISOString();

        if (result.status === "skipped") {
          skipped++;
          await sb.from("prospects").update({
            enrichment_status: "no_website",
            enrichment_error: result.reason,
            enrichment_checked_at: now,
          }).eq("id", prospect.id);
          continue;
        }

        if (result.status === "failed") {
          skipped++;
          await sb.from("prospects").update({
            enrichment_status: "failed",
            enrichment_error: result.reason,
            enrichment_checked_at: now,
            enrichment_source_url: result.website || null,
          }).eq("id", prospect.id);
          continue;
        }

        websitesFetched++;
        const patch: any = {
          enrichment_status: "completed",
          enrichment_error: null,
          enrichment_checked_at: now,
          enrichment_source_url: result.sourceUrl,
          last_enriched_at: now,
        };
        if (!prospect.website && result.website) patch.website = result.website;
        if (!prospect.email && result.email) { patch.email = result.email; emailsFound++; }
        if (!prospect.phone && result.phone) { patch.phone = result.phone; phonesFound++; }
        if ((!prospect.website && result.website) || (!prospect.email && result.email) || (!prospect.phone && result.phone)) updated++;

        const { error: updateError } = await sb.from("prospects").update(patch).eq("id", prospect.id);
        if (updateError) throw updateError;
      } catch (error) {
        skipped++;
        await sb.from("prospects").update({
          enrichment_status: "failed",
          enrichment_error: error instanceof Error ? error.message.slice(0, 300) : "Enrichment failed",
          enrichment_checked_at: new Date().toISOString(),
        }).eq("id", prospect.id);
      }
    }

    const now = new Date().toISOString();
    await sb.from("prospect_enrichment_runs").update({
      status: "completed", completed_at: now, prospects_checked: checked,
      websites_fetched: websitesFetched, emails_found: emailsFound,
      phones_found: phonesFound, prospects_updated: updated, skipped,
    }).eq("id", runId);
    await sb.from("prospect_enrichment_settings").update({
      last_run_at: now, last_success_at: now, last_error: null,
    }).eq("id", settings.id);

    return json({ ok: true, run_id: runId, prospects_checked: checked, websites_fetched: websitesFetched, emails_found: emailsFound, phones_found: phonesFound, prospects_updated: updated, skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("prospect-web-enrichment", JSON.stringify({ message }));
    const now = new Date().toISOString();
    if (runId) await sb.from("prospect_enrichment_runs").update({ status: "failed", completed_at: now, error_message: message }).eq("id", runId);
    await sb.from("prospect_enrichment_settings").update({ last_run_at: now, last_error: message });
    return json({ ok: false, error: "Enrichment failed" }, 500);
  }
});