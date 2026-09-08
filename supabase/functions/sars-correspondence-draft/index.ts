import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchVerifiedCaseFacts, formatVerifiedCaseFactsBlock } from "../_shared/caseFacts.ts";
import {
  extractSearchWords,
  retrieveCaseDocuments,
  retrievePastCases,
  retrieveTaxKnowledge,
  type RetrievedSource,
} from "../_shared/taxCoachRetrieval.ts";
import { extractFileCitationIds, resolveFileCitations } from "../_shared/taxCoachFileCitations.ts";
import { buildCorrespondenceInstructions, buildSourcesBlock } from "../_shared/sarsCorrespondencePrompt.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANNEXURE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    body: { type: "string" },
    missingInformation: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    sourcesUsed: {
      type: "array",
      items: {
        type: "object",
        properties: {
          citationLabel: { type: "string" },
          classification: { type: "string" },
        },
        required: ["citationLabel", "classification"],
        additionalProperties: false,
      },
    },
  },
  required: ["body", "missingInformation", "warnings", "sourcesUsed"],
  additionalProperties: false,
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json(request, { error: "Authentication required." }, 401);

    const callerClient = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json(request, { error: "Authentication required." }, 401);

    const [{ data: profile, error: profileError }, { data: permissions, error: permissionError }] = await Promise.all([
      callerClient.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle(),
      callerClient.from("staff_permissions").select("can_use_tax_coach_ai, can_generate_sars_correspondence").eq("profile_id", user.id).maybeSingle(),
    ]);

    if (profileError || permissionError || !profile?.is_active) {
      return json(request, { error: "Unable to verify correspondence drafting access." }, 500);
    }

    const isAdmin = profile.role === "admin";
    const isAuthorisedConsultant = profile.role === "consultant"
      && permissions?.can_use_tax_coach_ai === true
      && permissions?.can_generate_sars_correspondence === true;

    if (!isAdmin && !isAuthorisedConsultant) {
      return json(request, { error: "SARS correspondence drafting is not enabled for this account." }, 403);
    }

    const payload = await request.json().catch(() => null);
    const caseId = typeof payload?.caseId === "string" ? payload.caseId : null;

    if (!caseId || !UUID_PATTERN.test(caseId)) {
      return json(request, { error: "A valid caseId is required. General Tax AI cannot draft case correspondence." }, 400);
    }

    const correspondenceType = typeof payload?.correspondenceType === "string" ? payload.correspondenceType.trim() : "";
    if (!correspondenceType) {
      return json(request, { error: "correspondenceType is required." }, 400);
    }

    const purpose = typeof payload?.purpose === "string" ? payload.purpose : undefined;
    const recipient = typeof payload?.recipient === "string" ? payload.recipient : undefined;
    const subject = typeof payload?.subject === "string" ? payload.subject : undefined;
    const tone = typeof payload?.tone === "string" ? payload.tone : undefined;
    const additionalInstructions = typeof payload?.additionalInstructions === "string" ? payload.additionalInstructions : undefined;
    const priorAnalysis = typeof payload?.priorAnalysis === "string" ? payload.priorAnalysis : undefined;
    const templateId = typeof payload?.templateId === "string" && UUID_PATTERN.test(payload.templateId) ? payload.templateId : null;

    const annexureDocumentIds: string[] = Array.isArray(payload?.annexureDocumentIds)
      ? payload.annexureDocumentIds.filter((id: unknown): id is string => typeof id === "string" && UUID_PATTERN.test(id))
      : [];

    const revisionOf = payload?.revisionOf
      && typeof payload.revisionOf === "object"
      && typeof payload.revisionOf.body === "string"
      && typeof payload.revisionOf.instruction === "string"
      ? { body: payload.revisionOf.body as string, instruction: payload.revisionOf.instruction as string }
      : undefined;

    // Fetching case facts through the caller's own RLS-scoped client is what
    // enforces case isolation here: an unauthorised case simply returns null,
    // exactly like it would for any other query this user runs.
    const facts = await fetchVerifiedCaseFacts(callerClient, caseId);
    if (!facts) {
      return json(request, { error: "Case not found or not accessible." }, 404);
    }

    // Re-validate every annexure id actually belongs to THIS case, even
    // though RLS already scopes what the caller can see - closes the gap
    // for admins, who can see every case, from cross-referencing another
    // case's document into this letter.
    let annexureRows: { id: string; title: string; category: string | null; file_name: string; document_date: string | null }[] = [];
    if (annexureDocumentIds.length > 0) {
      const { data } = await callerClient
        .from("documents")
        .select("id, title, category, file_name, document_date")
        .eq("case_id", caseId)
        .eq("client_id", facts.clientId)
        .in("id", annexureDocumentIds);
      annexureRows = data ?? [];
    }

    const annexureManifest = annexureRows.map((row, index) => ({
      letter: ANNEXURE_LETTERS[index] ?? `#${index + 1}`,
      documentId: row.id,
      label: row.category || row.title || row.file_name,
    }));

    const annexureBlock = annexureManifest.length > 0
      ? `SELECTED ANNEXURES (refer only to these, by letter):\n${annexureManifest.map((a) => `Annexure ${a.letter} - ${a.label}`).join("\n")}`
      : "SELECTED ANNEXURES: none selected. Do not refer to any attachment or annexure in the letter.";

    const searchWords = extractSearchWords([{ role: "user", content: [purpose, subject, additionalInstructions, priorAnalysis].filter(Boolean).join(" ") }]);

    const [knowledgeSources, pastCaseSources, caseDocumentSources, templateRow] = await Promise.all([
      retrieveTaxKnowledge(callerClient, searchWords),
      retrievePastCases(callerClient, searchWords),
      retrieveCaseDocuments(callerClient, facts.clientId, caseId),
      templateId
        ? callerClient.from("correspondence_templates").select("name, body_structure").eq("id", templateId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const allSources: RetrievedSource[] = [...caseDocumentSources, ...knowledgeSources, ...pastCaseSources];

    const [knowledgeStoreRow, pastCasesStoreRow, caseRow] = await Promise.all([
      callerClient.from("ai_vector_stores").select("openai_vector_store_id").eq("domain", "tax_knowledge").maybeSingle(),
      callerClient.from("ai_vector_stores").select("openai_vector_store_id").eq("domain", "past_cases").maybeSingle(),
      callerClient.from("cases").select("openai_vector_store_id").eq("id", caseId).maybeSingle(),
    ]);

    const vectorStoreIds = [
      knowledgeStoreRow.data?.openai_vector_store_id,
      pastCasesStoreRow.data?.openai_vector_store_id,
      caseRow.data?.openai_vector_store_id,
    ].filter((id): id is string => Boolean(id));

    const instructions = buildCorrespondenceInstructions({
      correspondenceType,
      purpose,
      recipient,
      subject,
      tone,
      additionalInstructions,
      factsBlock: formatVerifiedCaseFactsBlock(facts),
      annexureBlock,
      sourcesBlock: buildSourcesBlock(allSources),
      templateBlock: templateRow.data?.body_structure ?? undefined,
      priorAnalysisBlock: priorAnalysis,
      revisionOf,
    });

    const apiKey = env("OPENAI_API_KEY");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_TAX_COACH_MODEL") || Deno.env.get("OPENAI_WHATSAPP_MODEL") || "gpt-4.1-mini",
        store: false,
        instructions,
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: revisionOf
              ? `Revise the existing draft as instructed above.`
              : `Draft the ${correspondenceType} correspondence as instructed above.`,
          }],
        }],
        text: { format: { type: "json_schema", name: "sars_correspondence_draft", schema: DRAFT_SCHEMA, strict: true } },
        ...(vectorStoreIds.length > 0
          ? { tools: [{ type: "file_search", vector_store_ids: vectorStoreIds }], include: ["file_search_call.results"] }
          : {}),
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("OpenAI correspondence drafting request failed", response.status, result?.error?.code ?? "unknown");
      return json(request, { error: "Correspondence drafting is temporarily unavailable." }, 502);
    }

    const rawText = result.output_text
      || result.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content ?? [])
        .find((item: { type?: string; text?: string }) => item.type === "output_text")?.text;

    if (!rawText) return json(request, { error: "Correspondence drafting returned no output." }, 502);

    let parsed: { body: string; missingInformation: string[]; warnings: string[]; sourcesUsed: { citationLabel: string; classification: string }[] };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("Correspondence drafting returned invalid JSON");
      return json(request, { error: "Correspondence drafting returned an unreadable response. Please try again." }, 502);
    }

    const fileCitationIds = extractFileCitationIds(result.output);
    const fileCitations = await resolveFileCitations(callerClient, fileCitationIds);

    return json(request, {
      body: parsed.body,
      missingInformation: parsed.missingInformation ?? [],
      warnings: parsed.warnings ?? [],
      sourcesUsed: [...(parsed.sourcesUsed ?? []), ...fileCitations],
      annexureManifest,
      model: Deno.env.get("OPENAI_TAX_COACH_MODEL") || Deno.env.get("OPENAI_WHATSAPP_MODEL") || "gpt-4.1-mini",
    });
  } catch (error) {
    console.error("SARS correspondence drafting failed", error instanceof Error ? error.message : "Unknown error");
    return json(request, { error: "Correspondence drafting is temporarily unavailable." }, 500);
  }
});
