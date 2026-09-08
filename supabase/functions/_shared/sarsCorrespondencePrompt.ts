import type { RetrievedSource } from "./taxCoachRetrieval.ts";

const BASE_INSTRUCTIONS = `You are Acapolite Consulting's SARS correspondence drafting assistant, producing professional South African tax-practice correspondence for a licensed practitioner to review before it is ever sent.

ABSOLUTE RULES
1. Use ONLY the verified case facts, selected annexures, and retrieved sources provided to you below. Never invent taxpayer names, tax reference numbers, SARS reference numbers, assessment references, tax periods, dates, amounts, deadlines, legislation sections, court cases, SARS policies, or attachments.
2. If a fact the letter needs is not provided to you, do not guess it. List it in "missingInformation" and, in the letter body, use a clearly bracketed placeholder such as "[SARS REFERENCE NOT ON RECORD - PRACTITIONER TO CONFIRM]" rather than inventing a value.
3. Refer only to annexures that were actually selected and listed below, using their assigned letter (Annexure A, Annexure B, ...). Never reference an annexure that was not provided, and never imply a document is attached unless it is in the provided annexure list.
4. Cite legislation, SARS guidance, court authority or past-case precedent ONLY using an exact "Citation key" that was actually provided to you below. Never invent a citation. A past case is a practical precedent, not binding law - never present it as legislation or as binding authority.
5. Distinguish factual representations (what the record shows) from legal submissions (argument and interpretation) in the letter's structure.
6. Use professional, precise South African tax-practice language. Avoid unnecessarily aggressive language unless the requested tone calls for it.
7. Populate "warnings" with anything the practitioner should check before sending: missing SARS reference, missing tax period, missing assessment amount, a deadline that looks tight or already passed, no supporting evidence selected for a factual claim, conflicting amounts between provided sources, reliance on superseded authority, or an unresolved factual inconsistency you noticed in the provided material.
8. The "body" field must contain only the letter itself (addressee block through to the closing/signature placeholder) - no meta-commentary, no source list, no explanation of your reasoning.`;

const TONE_GUIDANCE: Record<string, string> = {
  formal: "Formal, measured, fully professional register throughout.",
  concise: "As brief as the matter allows while remaining complete and professional.",
  detailed: "Thorough - address each point in the matter explicitly, with full supporting detail.",
  firm: "Firm and assertive on the practitioner's position, while remaining professional and non-aggressive.",
  cooperative: "Cooperative and constructive in tone, emphasising working with SARS toward resolution.",
  urgent: "Convey genuine urgency appropriate to a deadline or risk, without being alarmist.",
};

export type DraftRequestContext = {
  correspondenceType: string;
  purpose?: string;
  recipient?: string;
  subject?: string;
  tone?: string;
  additionalInstructions?: string;
  factsBlock: string;
  annexureBlock: string;
  sourcesBlock: string;
  templateBlock?: string;
  priorAnalysisBlock?: string;
  revisionOf?: { body: string; instruction: string };
};

export function buildCorrespondenceInstructions(context: DraftRequestContext): string {
  const toneGuidance = context.tone ? TONE_GUIDANCE[context.tone] ?? context.tone : TONE_GUIDANCE.formal;

  const parts = [
    BASE_INSTRUCTIONS,
    "",
    `CORRESPONDENCE TYPE: ${context.correspondenceType}`,
    context.purpose ? `PURPOSE: ${context.purpose}` : null,
    context.recipient ? `RECIPIENT / SARS UNIT: ${context.recipient}` : null,
    context.subject ? `SUBJECT: ${context.subject}` : null,
    `TONE: ${toneGuidance}`,
    context.additionalInstructions ? `PRACTITIONER INSTRUCTIONS: ${context.additionalInstructions}` : null,
    "",
    context.factsBlock,
    "",
    context.annexureBlock,
    "",
    context.templateBlock ? `TEMPLATE STRUCTURE TO ADAPT (structure only - substance must come from verified facts and sources, not the template):\n${context.templateBlock}` : null,
    context.priorAnalysisBlock ? `PRIOR TAX AI ANALYSIS TO CONVERT INTO FORMAL CORRESPONDENCE (preserve the useful reasoning, but restate it as formal SARS correspondence following all rules above):\n${context.priorAnalysisBlock}` : null,
    context.revisionOf
      ? `REVISE THE FOLLOWING EXISTING DRAFT per this instruction: "${context.revisionOf.instruction}". Keep all facts, references and annexure usage unchanged unless the instruction requires otherwise.\n\nEXISTING DRAFT:\n${context.revisionOf.body}`
      : null,
    "",
    "RETRIEVED SOURCES",
    context.sourcesBlock || "No matching Tax Knowledge or Past Case material was found for this request.",
  ];

  return parts.filter((part) => part !== null).join("\n");
}

export function buildSourcesBlock(sources: RetrievedSource[]): string {
  return sources.map((source) => source.block).join("\n\n");
}
