import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ActivityAction =
  | "case_status_updated"
  | "case_assignment_updated"
  | "document_uploaded"
  | "document_approved"
  | "document_rejected"
  | "document_missing_requested"
  | "invoice_created"
  | "invoice_sent"
  | "invoice_marked_paid";

type ActivityTarget = "case" | "document" | "invoice";

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
