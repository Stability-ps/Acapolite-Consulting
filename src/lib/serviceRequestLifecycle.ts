import type { Enums, Tables } from "@/integrations/supabase/types";

type ServiceRequest = Tables<"service_requests">;

export type ServiceRequestLifecycleStage = Enums<"service_request_lifecycle_stage">;
export type PractitionerPlanTier = "basic" | "professional" | "business";

export function formatLifecycleStageLabel(stage?: ServiceRequestLifecycleStage | null) {
  switch (stage) {
    case "business_exclusive":
      return "Business Exclusive";
    case "professional_access":
      return "Professional Access";
    case "open_marketplace":
      return "Open Marketplace";
    case "pending_client_confirmation":
      return "Pending Client Confirmation";
    case "expired":
      return "Expired";
    default:
      return "Business Exclusive";
  }
}

export function getLifecycleStageBadgeClass(stage?: ServiceRequestLifecycleStage | null) {
  switch (stage) {
    case "business_exclusive":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "professional_access":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "open_marketplace":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "pending_client_confirmation":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "expired":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function getLifecycleStageRequiredTier(stage?: ServiceRequestLifecycleStage | null): PractitionerPlanTier {
  switch (stage) {
    case "business_exclusive":
      return "business";
    case "professional_access":
      return "professional";
    default:
      return "basic";
  }
}

export function getTierRank(tier?: PractitionerPlanTier | null) {
  switch (tier ?? "basic") {
    case "business":
      return 3;
    case "professional":
      return 2;
    default:
      return 1;
  }
}

export function canPlanAccessLifecycleStage(
  planTier: PractitionerPlanTier,
  stage?: ServiceRequestLifecycleStage | null,
) {
  if (stage === "pending_client_confirmation" || stage === "expired") {
    return false;
  }

  return getTierRank(planTier) >= getTierRank(getLifecycleStageRequiredTier(stage));
}

export function getLifecycleCountdownLabel(
  request: Pick<ServiceRequest, "lifecycle_stage" | "lifecycle_stage_expires_at">,
  now = Date.now(),
) {
  if (!request.lifecycle_stage_expires_at) {
    return null;
  }

  const expiresAt = new Date(request.lifecycle_stage_expires_at).getTime();
  const remainingMs = expiresAt - now;

  if (remainingMs <= 0) {
    return "Stage update pending";
  }

  const totalMinutes = Math.floor(remainingMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const dayHours = hours % 24;
    return `${days}d ${dayHours}h remaining`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${Math.max(minutes, 1)}m remaining`;
}

export function getLifecycleAvailabilityMessage(stage?: ServiceRequestLifecycleStage | null) {
  switch (stage) {
    case "business_exclusive":
      return "This lead is currently reserved for Business plan practitioners.";
    case "professional_access":
      return "This lead is currently available to Business and Professional practitioners.";
    case "open_marketplace":
      return "This lead is currently open to all qualifying practitioners.";
    case "pending_client_confirmation":
      return "This lead is waiting for the client to confirm they still need assistance.";
    case "expired":
      return "This lead has expired and is no longer available in the marketplace.";
    default:
      return "This lead follows the lifecycle access rules.";
  }
}
