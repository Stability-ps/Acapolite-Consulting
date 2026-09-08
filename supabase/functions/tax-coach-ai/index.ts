import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canUseTaxCoach } from "../_shared/taxCoachAccess.ts";
import { buildGroundedInstructions } from "../_shared/taxCoachPrompt.ts";
import {
  buildTaxCoachAttachmentInput,
  validateTaxCoachAttachments,
  type TaxCoachAttachment,
} from "../_shared/taxCoachAttachments.ts";
import {
  extractSearchWords,
  retrieveCaseDocuments,
  retrievePastCases,
  retrieveTaxKnowledge,
  type RetrievedSource,
} from "../_shared/taxCoachRetrieval.ts";
import { extractFileCitationIds, resolveFileCitations } from "../_shared/taxCoachFileCitations.ts";

type ChatMessage = { role: "user" | "assistant"; content: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function validMessages(value: unknown): value is ChatMessage[] {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= 20
    && value.every((message) => (
      message
      && typeof message === "object"
      && ["user", "assistant"].includes((message as ChatMessage).role)
      && typeof (message as ChatMessage).content === "string"
      && (message as ChatMessage).content.trim().length > 0
      && (message as ChatMessage).content.length <= 8_000
    ));
}

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
      callerClient.from("staff_permissions").select("can_use_tax_coach_ai").eq("profile_id", user.id).maybeSingle(),
    ]);

    if (profileError || permissionError) {
      return json(request, { error: "Unable to verify Tax Coach access." }, 500);
    }

    if (!profile?.is_active || !canUseTaxCoach(profile.role, permissions?.can_use_tax_coach_ai)) {
      return json(request, { error: "Tax Coach AI is not enabled for this account." }, 403);
    }

    const payload = await request.json();
    if (!validMessages(payload?.messages)) {
      return json(request, { error: "Provide between 1 and 20 valid chat messages." }, 400);
    }
    if (!validateTaxCoachAttachments(payload?.attachments)) {
      return json(request, { error: "Attach up to 3 valid PDF, PNG, JPEG or WebP files within the size limits." }, 400);
    }

    const requestedScope = payload?.scope === "case" ? "case" : "general";
    const clientId = typeof payload?.clientId === "string" ? payload.clientId : null;
    const caseId = typeof payload?.caseId === "string" ? payload.caseId : null;
    const includeKnowledge = payload?.includeKnowledge !== false;
    const includePastCases = payload?.includePastCases !== false;

    if (requestedScope === "case" && (!clientId || !UUID_PATTERN.test(clientId) || !caseId || !UUID_PATTERN.test(caseId))) {
      return json(request, { error: "Case-scoped requests require a valid clientId and caseId." }, 400);
    }

    const searchWords = extractSearchWords(payload.messages);

    const [knowledgeSources, pastCaseSources, caseDocumentSources] = await Promise.all([
      includeKnowledge ? retrieveTaxKnowledge(callerClient, searchWords) : Promise.resolve<RetrievedSource[]>([]),
      includePastCases ? retrievePastCases(callerClient, searchWords) : Promise.resolve<RetrievedSource[]>([]),
      requestedScope === "case" && clientId && caseId
        ? retrieveCaseDocuments(callerClient, clientId, caseId)
        : Promise.resolve<RetrievedSource[]>([]),
    ]);

    const allSources = [...caseDocumentSources, ...knowledgeSources, ...pastCaseSources];

    // Resolve which OpenAI vector stores (real file-content search, not just
    // structured metadata) are in scope for this request. General mode only
    // ever sees the two global domain stores; case documents are added only
    // when scope === "case" and only that case's own store - never another
    // client's or case's store.
    const [knowledgeStoreRow, pastCasesStoreRow, caseRow] = await Promise.all([
      includeKnowledge
        ? callerClient.from("ai_vector_stores").select("openai_vector_store_id").eq("domain", "tax_knowledge").maybeSingle()
        : Promise.resolve({ data: null }),
      includePastCases
        ? callerClient.from("ai_vector_stores").select("openai_vector_store_id").eq("domain", "past_cases").maybeSingle()
        : Promise.resolve({ data: null }),
      requestedScope === "case" && caseId
        ? callerClient.from("cases").select("openai_vector_store_id").eq("id", caseId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const vectorStoreIds = [
      knowledgeStoreRow.data?.openai_vector_store_id,
      pastCasesStoreRow.data?.openai_vector_store_id,
      caseRow.data?.openai_vector_store_id,
    ].filter((id): id is string => Boolean(id));

    const instructions = buildGroundedInstructions(requestedScope, allSources);

    const attachments = (payload.attachments ?? []) as TaxCoachAttachment[];
    const lastMessageIndex = payload.messages.length - 1;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_TAX_COACH_MODEL") || Deno.env.get("OPENAI_WHATSAPP_MODEL") || "gpt-4.1-mini",
        store: false,
        instructions,
        input: payload.messages.map((message: ChatMessage, index: number) => ({
          role: message.role,
          content: message.role === "assistant"
            ? [{ type: "output_text", text: message.content }]
            : [
                { type: "input_text", text: message.content },
                ...(index === lastMessageIndex ? buildTaxCoachAttachmentInput(attachments) : []),
              ],
        })),
        text: { verbosity: "medium" },
        ...(vectorStoreIds.length > 0
          ? {
              tools: [{ type: "file_search", vector_store_ids: vectorStoreIds }],
              include: ["file_search_call.results"],
            }
          : {}),
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("OpenAI Tax Coach request failed", response.status, result?.error?.code ?? "unknown");
      return json(request, { error: "Tax Coach AI is temporarily unavailable." }, 502);
    }

    const answer = result.output_text
      || result.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content ?? [])
        .find((item: { type?: string; text?: string }) => item.type === "output_text")?.text;

    if (!answer) return json(request, { error: "Tax Coach AI returned no answer." }, 502);

    const fileCitationIds = extractFileCitationIds(result.output);
    const fileCitations = await resolveFileCitations(callerClient, fileCitationIds);

    return json(request, {
      answer,
      sources: [
        ...allSources.map((source) => ({ citationLabel: source.citationLabel, classification: source.classification })),
        ...fileCitations,
      ],
      scope: requestedScope,
    });
  } catch (error) {
    console.error("Tax Coach AI failed", error instanceof Error ? error.message : "Unknown error");
    return json(request, { error: "Tax Coach AI is temporarily unavailable." }, 500);
  }
});
