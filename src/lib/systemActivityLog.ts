import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ActivityAction =
  | "case_status_updated"
  | "case_assignment_updated"
  | "document_uploaded"
  | "document_approved"
  | "document_rejected"
  | "document_deleted"
  | "document_missing_requested"
  | "invoice_created"
  | "invoice_sent"
  | "invoice_marked_paid"
  | "tax_knowledge_uploaded"
  | "tax_knowledge_updated"
  | "tax_knowledge_archived"
  | "tax_knowledge_ai_approved"
  | "tax_knowledge_ai_revoked"
  | "knowledge_entry_created"
  | "knowledge_file_replaced"
  | "knowledge_file_removed"
  | "knowledge_entry_archived"
  | "knowledge_entry_restored"
  | "knowledge_entry_deleted"
  | "index_removed"
  | "index_retried"
  | "temporary_upload_cleaned"
  | "past_case_created"
  | "past_case_updated"
  | "past_case_anonymisation_changed"
  | "past_case_ai_approved"
  | "past_case_ai_revoked"
  | "past_case_document_uploaded"
  | "past_case_document_deleted"
  | "past_case_document_added"
  | "past_case_document_replaced"
  | "past_case_document_removed"
  | "past_case_archived"
  | "past_case_restored"
  | "past_case_deleted"
  | "template_created"
  | "template_source_replaced"
  | "template_source_removed"
  | "template_archived"
  | "template_restored"
  | "template_deleted"
  | "correspondence_generated"
  | "correspondence_saved"
  | "correspondence_edited"
  | "correspondence_regenerated"
  | "correspondence_approved"
  | "correspondence_exported"
  | "correspondence_superseded"
  | "correspondence_archived";

type ActivityTarget = "case" | "document" | "invoice" | "practitioner_profile" | "tax_knowledge_library" | "past_case" | "past_case_document" | "correspondence_template";

type LogActivityInput = {
  actorProfileId: string;
  actorRole: Database["public"]["Enums"]["app_role"];
  action: ActivityAction;
  targetType: ActivityTarget;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logSystemActivity(input: LogActivityInput) {
  const { error } = await supabase.from("system_activity_log").insert({
    actor_profile_id: input.actorProfileId,
    actor_role: input.actorRole,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? null,
  });

  return { error };
}
