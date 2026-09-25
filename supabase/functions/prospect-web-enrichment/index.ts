// Prospect Hub public-website contact enrichment.
//
// Invoked by pg_cron (x-cron-secret) or manually by a signed-in user with
// can_manage_prospect_hub. For each eligible prospect it:
//   1. uses the stored website, or asks OpenAI web search for a *candidate*
//      official website (a suggestion only - never trusted as-is);
//   2. fetches the site (respecting robots.txt) and verifies the page
//      belongs to the company before accepting anything from it;
//   3. extracts contact details that are literally published on the
//      company's own pages, preferring same-domain email addresses;
//   4. fills only empty fields - existing email/phone/website values are
//      never overwritten - and records every extracted value with its
//      source URL in prospect_contacts as evidence.
// Each prospect is processed independently so one failure never fails the
// batch.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authorizeProspectCaller,
  createAdminClient,
  jsonResponse,
  preflight,
} from "../_shared/prospectHttp.ts";
import {
  assessIdentity,
  contactLinks,
  extractContacts,
  hostOf,
  isNonOfficialHost,
  normalizeWebsite,
  robotsAllows,
} from "../_shared/prospectEnrichment.ts";

const USER_AGENT = "AcapoliteProspectHub/1.0 (+https://acapoliteconsulting.co.za)";
const RUN_BUDGET_MS = 110_000;
const MAX_MANUAL_IDS = 25;

type Prospect = {
  id: string;
  company_name: string;
  city: string | null;
  province: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  metadata: Record<string, unknown> | null;
};

type Outcome = {
  status: "completed" | "partial" | "no_website" | "no_contacts" | "failed" | "needs_review";
  reason?: string;
  website?: string | null;
  websiteDiscovered?: boolean;
  websiteFetched?: boolean;
  email?: string | null;
  emailSource?: string | null;
  phone?: string | null;
  phoneSource?: string | null;
  identityEvidence?: string;
};

const robotsCache = new Map<string, string | null>();

async function fetchText(url: string, accept: string, timeoutMs = 8000) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": USER_AGENT, Accept: accept },
  });
  return response;
}

async function allowedByRobots(url: string) {
  const u = new URL(url);
  const key = u.origin;
  if (!robotsCache.has(key)) {
    try {
      const res = await fetchText(key + "/robots.txt", "text/plain", 5000);
      robotsCache.set(key, res.ok ? (await res.text()).slice(0, 100_000) : null);
    } catch {
      robotsCache.set(key, null);
    }
  }
  return robotsAllows(robotsCache.get(key) ?? null, u.pathname || "/");
}

async function fetchHtml(url: string) {
  if (!(await allowedByRobots(url))) return { blocked: true as const };
  const response = await fetchText(url, "text/html,application/xhtml+xml");
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return null;
  return { url: response.url, html: (await response.text()).slice(0, 750_000) };
}

async function suggestOfficialWebsite(company: string, city: string | null, province: string | null) {
  const key = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!key) throw new Error("web_search_unavailable");
  const prompt =
    "Find the official public business website for this South African company. Return JSON only: " +
    '{"website": string, "confidence": "high"|"medium"|"low"}. ' +
    "Company: " + company + ". City: " + (city || "unknown") + ". Province: " + (province || "unknown") + ". " +
    "Use web search. Never return directory listings, social-media profiles, tender portals, government sites or aggregators. " +
    "If you are not certain which website belongs to this exact company, return an empty website.";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_TAX_COACH_MODEL") || "gpt-4.1-mini",
      store: false,
      tools: [{ type: "web_search" }],
      input: prompt,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error("web_search_failed_" + response.status);
  const text = result?.output?.flatMap((o: any) => o.content ?? []).find((c: any) => c.type === "output_text")?.text;
  const match = typeof text === "string" ? text.match(/\{[\s\S]*\}/) : null;
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.confidence === "low") return null;
    const website = normalizeWebsite(parsed.website || null);
    if (!website || isNonOfficialHost(hostOf(website))) return null;
    return website;
  } catch {
    return null;
  }
}

async function enrichOne(prospect: Prospect, useSearch: boolean): Promise<Outcome> {
  let website = normalizeWebsite(prospect.website);
  let websiteDiscovered = false;
  if (website && isNonOfficialHost(hostOf(website))) website = null;
  if (!website && useSearch) {
    website = await suggestOfficialWebsite(prospect.company_name, prospect.city, prospect.province);
    websiteDiscovered = Boolean(website);
  }
  if (!website) return { status: "no_website", reason: useSearch ? "no_official_website_found" : "no_website_on_record" };

  const homepage = await fetchHtml(website);
  if (homepage && "blocked" in homepage) return { status: "failed", reason: "blocked_by_robots_txt", website };
  if (!homepage) return { status: "failed", reason: "website_unavailable", website };

  const identity = assessIdentity(prospect.company_name, homepage.html, homepage.url);
  // A website already on record was entered by staff or an official source,
  // so only search-suggested websites must pass the identity check.
  if (websiteDiscovered && identity.verdict === "mismatch") {
    return { status: "failed", reason: "website_identity_mismatch", website: homepage.url, websiteFetched: true };
  }
  if (websiteDiscovered && identity.verdict === "weak") {
    return { status: "needs_review", reason: "website_identity_uncertain", website: homepage.url, websiteFetched: true, identityEvidence: identity.evidence };
  }

  const found = extractContacts(homepage.html, homepage.url);
  let emailSource = found.email ? homepage.url : null;
  let phoneSource = found.phone ? homepage.url : null;
  if (!found.email || !found.phone) {
    for (const link of contactLinks(homepage.html, homepage.url)) {
      const page = await fetchHtml(link).catch(() => null);
      if (!page || "blocked" in page) continue;
      const extra = extractContacts(page.html, homepage.url);
      if (!found.email && extra.email) { found.email = extra.email; emailSource = page.url; }
      if (!found.phone && extra.phone) { found.phone = extra.phone; phoneSource = page.url; }
      if (found.email && found.phone) break;
    }
  }

  const status = found.email && found.phone ? "completed" : found.email || found.phone ? "partial" : "no_contacts";
  return {
    status,
    website: homepage.url,
    websiteDiscovered,
    websiteFetched: true,
    email: found.email,
    emailSource,
    phone: found.phone,
    phoneSource,
    identityEvidence: identity.evidence,
  };
}

async function recordEvidence(sb: SupabaseClient, prospectId: string, type: string, value: string, sourceUrl: string | null, label: string) {
  const { data: existing } = await sb.from("prospect_contacts").select("id").eq("prospect_id", prospectId).eq("contact_type", type).ilike("value", value).limit(1);
  if (existing?.length) return;
  await sb.from("prospect_contacts").insert({ prospect_id: prospectId, contact_type: type, value, source_url: sourceUrl, label, is_verified: false });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  const caller = await authorizeProspectCaller(req, "can_manage_prospect_hub");
  if (!caller) return jsonResponse(req, { error: "Forbidden" }, 403);

  const sb = createAdminClient();
  const startedAt = Date.now();
  const body = await req.json().catch(() => ({}));
  const requestedIds: string[] = Array.isArray(body?.prospect_ids)
    ? body.prospect_ids.filter((id: unknown) => typeof id === "string").slice(0, MAX_MANUAL_IDS)
    : [];
  let runId: string | null = null;
  let settingsId: string | null = null;

  try {
    const { data: settings, error: settingsError } = await sb.from("prospect_enrichment_settings").select("*").order("created_at").limit(1).single();
    if (settingsError) throw settingsError;
    settingsId = settings.id;
    if (!settings.enabled && caller.kind === "cron") return jsonResponse(req, { ok: true, skipped: true, reason: "enrichment_disabled" });

    const { data: run, error: runError } = await sb.from("prospect_enrichment_runs")
      .insert({ run_type: caller.kind === "cron" ? "scheduled" : "manual", metadata: { requested_by: caller.userId, requested_ids: requestedIds.length } })
      .select("id").single();
    if (runError) throw runError;
    runId = run.id;

    let query = sb.from("prospects")
      .select("id,company_name,city,province,website,email,phone,metadata")
      .neq("status", "converted");
    if (requestedIds.length) {
      query = query.in("id", requestedIds);
    } else {
      const cutoff = new Date(Date.now() - Number(settings.recheck_days || 14) * 86_400_000).toISOString();
      query = query
        .eq("do_not_contact", false)
        .neq("status", "disqualified")
        // One combined filter: (missing any contact field) AND (never checked OR due for recheck).
        .or(`and(or(email.is.null,phone.is.null,website.is.null),or(enrichment_checked_at.is.null,enrichment_checked_at.lt.${cutoff}))`)
        .order("enrichment_checked_at", { ascending: true, nullsFirst: true })
        .order("score", { ascending: false })
        .limit(Number(settings.batch_size || 8));
    }
    const { data: prospects, error } = await query;
    if (error) throw error;

    const stats = { checked: 0, websitesFound: 0, websitesFetched: 0, emailsFound: 0, phonesFound: 0, updated: 0, skipped: 0, failed: 0 };
    let budgetExhausted = false;

    for (const prospect of (prospects ?? []) as Prospect[]) {
      if (Date.now() - startedAt > RUN_BUDGET_MS) { budgetExhausted = true; break; }
      stats.checked++;
      await sb.from("prospects").update({ enrichment_status: "processing" }).eq("id", prospect.id);
      const now = () => new Date().toISOString();
      try {
        const result = await enrichOne(prospect, settings.use_openai_web_search === true);
        if (result.websiteFetched) stats.websitesFetched++;
        if (result.websiteDiscovered) stats.websitesFound++;

        const patch: Record<string, unknown> = {
          enrichment_status: result.status,
          enrichment_error: result.reason ?? null,
          enrichment_checked_at: now(),
          enrichment_source_url: result.emailSource ?? result.phoneSource ?? result.website ?? null,
        };
        const accepted = ["completed", "partial", "no_contacts"].includes(result.status);
        let changed = false;
        if (accepted) {
          patch.last_enriched_at = now();
          if (!prospect.website && result.website) { patch.website = result.website; changed = true; }
          if (!prospect.email && result.email) { patch.email = result.email; stats.emailsFound++; changed = true; }
          if (!prospect.phone && result.phone) { patch.phone = result.phone; stats.phonesFound++; changed = true; }
        }
        if (result.status === "needs_review") {
          patch.metadata = { ...(prospect.metadata ?? {}), enrichment_candidate_website: result.website, enrichment_identity_evidence: result.identityEvidence };
        }
        if (changed) stats.updated++;
        if (result.status === "failed") stats.failed++;
        if (result.status === "no_website") stats.skipped++;

        const { error: updateError } = await sb.from("prospects").update(patch).eq("id", prospect.id);
        if (updateError) throw updateError;

        if (accepted) {
          if (result.website && result.websiteDiscovered) await recordEvidence(sb, prospect.id, "website", result.website, result.website, "web_enrichment");
          if (result.email) await recordEvidence(sb, prospect.id, "email", result.email, result.emailSource ?? null, "web_enrichment");
          if (result.phone) await recordEvidence(sb, prospect.id, "phone", result.phone, result.phoneSource ?? null, "web_enrichment");
        }
        await sb.from("prospect_activities").insert({
          prospect_id: prospect.id,
          activity_type: "system",
          summary: `Web enrichment: ${result.status.replace("_", " ")}${changed ? " (contact details added)" : ""}`,
          performed_by: caller.userId,
          metadata: { kind: "enrichment", run_id: runId, status: result.status, reason: result.reason ?? null, website: result.website ?? null, email_source: result.emailSource ?? null, phone_source: result.phoneSource ?? null, identity: result.identityEvidence ?? null },
        });
      } catch (error) {
        stats.failed++;
        const message = error instanceof Error ? error.message : String(error);
        await sb.from("prospects").update({
          enrichment_status: "failed",
          enrichment_error: message.slice(0, 300),
          enrichment_checked_at: now(),
        }).eq("id", prospect.id);
      }
    }

    const finishedAt = new Date().toISOString();
    const runStatus = stats.failed > 0 || budgetExhausted ? "partial" : "completed";
    await sb.from("prospect_enrichment_runs").update({
      status: runStatus,
      completed_at: finishedAt,
      prospects_checked: stats.checked,
      websites_fetched: stats.websitesFetched,
      emails_found: stats.emailsFound,
      phones_found: stats.phonesFound,
      prospects_updated: stats.updated,
      skipped: stats.skipped,
      metadata: { requested_by: caller.userId, websites_found: stats.websitesFound, failed: stats.failed, budget_exhausted: budgetExhausted },
    }).eq("id", runId);
    await sb.from("prospect_enrichment_settings").update({ last_run_at: finishedAt, last_success_at: finishedAt, last_error: null }).eq("id", settingsId);

    return jsonResponse(req, {
      ok: true,
      run_id: runId,
      status: runStatus,
      prospects_checked: stats.checked,
      websites_found: stats.websitesFound,
      websites_fetched: stats.websitesFetched,
      emails_found: stats.emailsFound,
      phones_found: stats.phonesFound,
      prospects_updated: stats.updated,
      skipped: stats.skipped,
      failed: stats.failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("prospect-web-enrichment", JSON.stringify({ message }));
    const now = new Date().toISOString();
    if (runId) await sb.from("prospect_enrichment_runs").update({ status: "failed", completed_at: now, error_message: message }).eq("id", runId);
    if (settingsId) await sb.from("prospect_enrichment_settings").update({ last_run_at: now, last_error: message }).eq("id", settingsId);
    return jsonResponse(req, { ok: false, error: "Enrichment failed" }, 500);
  }
});
