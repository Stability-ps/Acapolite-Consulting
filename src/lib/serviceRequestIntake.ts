import type { Json } from "@/integrations/supabase/types";
import {
  getDetailSummaryRows,
  type WizardDetailsData,
  type WizardEntityType,
} from "@/lib/requestWizard";

export type ParsedIntakePayload = {
  who?: {
    entityType?: string;
    province?: string;
    city?: string;
  };
  what?: {
    selectedServices?: Array<{ value: string; label: string; category?: string }>;
  };
  details?: {
    answers?: Record<string, string>;
    additionalNotes?: string | null;
  };
  contact?: {
    contactPreference?: string;
    phone?: string;
    marketingConsent?: boolean;
  };
};

export function parseIntakePayload(
  payload: Json | null | undefined,
): ParsedIntakePayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return payload as ParsedIntakePayload;
}

export function getIntakeDetailRows(payload: Json | null | undefined) {
  const parsed = parseIntakePayload(payload);
  const entityType = parsed?.who?.entityType;

  if (!parsed?.details || !entityType) {
    return [];
  }

  const details: WizardDetailsData = {
    answers: parsed.details.answers ?? {},
    additionalNotes: parsed.details.additionalNotes ?? "",
  };

  return getDetailSummaryRows(entityType as WizardEntityType, details);
}

export function getIntakeSupportingNotes(payload: Json | null | undefined) {
  const notes = parseIntakePayload(payload)?.details?.additionalNotes?.trim();
  return notes || null;
}

export function getIntakeContactPreference(payload: Json | null | undefined) {
  return parseIntakePayload(payload)?.contact?.contactPreference ?? null;
}
