import { authorizeProspectCaller, createAdminClient, jsonResponse, preflight, requireEnv } from "../_shared/prospectHttp.ts";

type Hit = {
  company_name: string;
  title: string;
  source_url: string;
  signal_type: string;
  signal_date?: string | null;
  case_number?: string | null;
  court_or_authority?: string | null;
  evidence_summary: string;
  service_relevance?: string | null;
};

const TAX_FAMILIES = [
  "SARS preservation order section 163 company",
  "SARS tax debt enforcement company",
  "SARS VAT assessment dispute company",
  "SARS PAYE assessment dispute company",
  "SARS section 164 suspension of payment company",
  "SARS tax appeal assessment company",
  "SARS liquidation or sequestration company",
];

const GAZETTE_FAMILIES = [
  "company in liquidation",
  "provisional liquidation company",
  "final liquidation company",
  "business rescue company",
  "insolvent company",
];

const normalise = (value: string) =>
  value.toLowerCase()
    .replace(/\(pty\)\s*ltd|pty\s*ltd|close corporation|\bcc\b|limited|\bltd\b/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function nextCursor(year: number, familyIndex: number, startYear: number, endYear: number, families: string[]) {
  let nextFamily = familyIndex + 1;
  let nextYear = year;
  if (nextFamily >= families.length) {
    nextFamily = 0;
    nextYear = year - 1;
    if (nextYear < startYear) nextYear = endYear;
  }
  return { cursor_year: nextYear, cursor_family_index: nextFamily };
}

function parseJsonArray(text: string): Hit[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("Search response did not contain a JSON array");
  const parsed = JSON.parse(text.slice(start, end + 1));
  return Array.isArray(parsed) ? parsed : [];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function webSearch(query: string, maxResults: number): Promise<Hit[]> {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      tools: [{ type: "web_search" }],
      input: `Search public South African records for: ${query}.
Return ONLY a JSON array with at most ${maxResults} items. Fields: company_name,title,source_url,signal_type,signal_date,case_number,court_or_authority,evidence_summary,service_relevance.
Allowed signal_type values: sars_court_case,tax_dispute,sars_debt_enforcement,preservation_order,liquidation,business_rescue,insolvency,other_public_record.
STRICT RULES:
- Return named businesses/entities only, not people, courts, law firms, SARS or government departments.
- For tax/SARS signals, the source itself must explicitly connect the entity to the tax/SARS issue.
- Never infer current non-compliance from a historic case.
- For liquidation/insolvency/business rescue, describe only the published proceeding; do not infer a SARS problem.
- source_url must be the exact public record that supports the statement.
- Prefer distinct companies. Do not repeat the same entity twice in one result set.`,
      }),
    });
    if (response.ok) break;
    if (response.status !== 429 && response.status < 500) break;
    const retryAfter = Number(response.headers.get("retry-after") || 0);
    const delayMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(30000, 2000 * 2 ** attempt);
    await sleep(delayMs);
  }
  if (!response || !response.ok) throw new Error(`OpenAI HTTP ${response?.status || "unknown"} after retries`);
  const data = await response.json();
  const text = (data.output || [])
    .flatMap((o: any) => o.content || [])
    .filter((x: any) => x.type === "output_text")
    .map((x: any) => x.text)
    .join("\n")
    .trim();
  return parseJsonArray(text);
}

async function saveHits(sb: any, source: any, hits: Hit[], sourceKey: string) {
  let created = 0, matched = 0, signals = 0, skipped = 0;
  for (const h of hits) {
    try {
      if (!h.company_name || !h.source_url || !h.evidence_summary || !h.signal_type) { skipped++; continue; }
      const normalizedName = normalise(h.company_name);
      if (!normalizedName || normalizedName.length < 2) { skipped++; continue; }

      let { data: prospect } = await sb.from("prospects").select("id").eq("normalized_name", normalizedName).maybeSingle();
      if (!prospect) {
        const inserted = await sb.from("prospects").insert({
          company_name: h.company_name.trim(),
          normalized_name: normalizedName,
          source_name: source.name,
          source_url: h.source_url,
          metadata: { public_record_discovery: true, source_key: sourceKey },
          enrichment_status: "pending",
        }).select("id").single();
        if (inserted.error) throw inserted.error;
        prospect = inserted.data;
        created++;
      } else {
        matched++;
      }

      const upserted = await sb.from("prospect_public_signals").upsert({
        prospect_id: prospect.id,
        source_id: source.id,
        source_record_id: h.case_number || h.source_url,
        signal_type: h.signal_type,
        signal_date: h.signal_date || null,
        title: h.title || h.company_name,
        case_number: h.case_number || null,
        court_or_authority: h.court_or_authority || null,
        source_url: h.source_url,
        service_relevance: h.service_relevance || null,
        evidence_summary: h.evidence_summary,
        confidence: "review_required",
        metadata: { source_key: sourceKey },
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "source_url,signal_type,prospect_id" });
      if (upserted.error) throw upserted.error;
      signals++;

      const { data: ss } = await sb.from("prospect_public_signals").select("signal_type,signal_date").eq("prospect_id", prospect.id);
      const types = [...new Set((ss || []).map((v: any) => v.signal_type))];
      const dates = (ss || []).map((v: any) => v.signal_date).filter(Boolean).sort();
      await sb.from("prospects").update({
        public_signal_count: (ss || []).length,
        public_signal_types: types,
        last_public_signal_at: dates.at(-1) || null,
        enrichment_status: "pending",
        enrichment_checked_at: null,
      }).eq("id", prospect.id);
    } catch {
      skipped++;
    }
  }
  return { created, matched, signals, skipped };
}

async function processSource(sb: any, sourceKey: string, families: string[], siteQuery: string, defaultStartYear: number, queriesPerRun: number) {
  const { data: source, error } = await sb.from("prospect_sources").select("*").eq("key", sourceKey).single();
  if (error) throw error;
  if (!source.enabled) return { sourceKey, skipped: true };

  const config = source.config || {};
  const nowYear = new Date().getUTCFullYear();
  const startYear = Number(config.start_year || defaultStartYear);
  const endYear = Number(config.end_year || nowYear);
  let year = Number(config.cursor_year || endYear);
  let familyIndex = Number(config.cursor_family_index || 0);
  const maxResults = Math.min(25, Math.max(5, Number(config.max_results_per_query || 20)));

  const totals = { found: 0, created: 0, matched: 0, signals: 0, skipped: 0, queries: [] as any[], errors: [] as string[] };
  let successfulSlices = 0;

  for (let i = 0; i < queriesPerRun; i++) {
    const family = families[familyIndex] || families[0];
    const query = `${siteQuery} ${year} ${family}`;
    try {
      const hits = await webSearch(query, maxResults);
      const saved = await saveHits(sb, source, hits, sourceKey);
      totals.found += hits.length;
      totals.created += saved.created;
      totals.matched += saved.matched;
      totals.signals += saved.signals;
      totals.skipped += saved.skipped;
      totals.queries.push({ year, family, found: hits.length, created: saved.created });
      successfulSlices++;
      await sleep(2500);
      const next = nextCursor(year, familyIndex, startYear, endYear, families);
      year = next.cursor_year;
      familyIndex = next.cursor_family_index;
    } catch (e) {
      totals.errors.push(`${year}/${family}: ${e instanceof Error ? e.message : String(e)}`);
      break;
    }
  }

  const nextConfig = {
    ...config,
    start_year: startYear,
    end_year: endYear,
    cursor_year: year,
    cursor_family_index: familyIndex,
    max_results_per_query: maxResults,
    last_backfill_queries: totals.queries,
  };

  await sb.from("prospect_sources").update({
    config: nextConfig,
    status: totals.errors.length ? (successfulSlices ? "degraded" : "failing") : "healthy",
    last_attempt_at: new Date().toISOString(),
    ...(successfulSlices ? { last_success_at: new Date().toISOString() } : {}),
    last_error: totals.errors[0] || null,
    consecutive_failures: totals.errors.length && !successfulSlices ? Number(source.consecutive_failures || 0) + 1 : 0,
    total_failures: Number(source.total_failures || 0) + (totals.errors.length && !successfulSlices ? 1 : 0),
    total_runs: Number(source.total_runs || 0) + 1,
    records_discovered: Number(source.records_discovered || 0) + totals.found,
    prospects_created: Number(source.prospects_created || 0) + totals.created,
  }).eq("id", source.id);

  return { sourceKey, ...totals, next_year: year, next_family_index: familyIndex };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  const caller = await authorizeProspectCaller(req, "can_manage_prospect_hub");
  if (!caller) return jsonResponse(req, { error: "Forbidden" }, 403);

  const sb = createAdminClient();
  const results = [];
  try {
    results.push(await processSource(sb, "saflii_sars_cases", TAX_FAMILIES, "site:saflii.org/za/cases South Africa", 2000, 1));
  } catch (e) {
    results.push({ sourceKey: "saflii_sars_cases", errors: [e instanceof Error ? e.message : String(e)] });
  }
  try {
    results.push(await processSource(sb, "gov_gazette_insolvency", GAZETTE_FAMILIES, "site:gov.za/sites/default/files/gcis_document Government Gazette South Africa", 2000, 1));
  } catch (e) {
    results.push({ sourceKey: "gov_gazette_insolvency", errors: [e instanceof Error ? e.message : String(e)] });
  }

  const errors = results.flatMap((r: any) => r.errors || []);
  return jsonResponse(req, { ok: errors.length === 0, results });
});
