import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { formatServiceRequestLabel, serviceNeededOptions } from "@/lib/serviceRequests";

type PendingConfirmationRequest = {
  id: string;
  email: string | null;
  full_name: string | null;
  client_profile_id?: string | null;
  client_confirmation_due_at?: string | null;
  service_needed?: Enums<"service_request_service_needed"> | null;
  service_needed_list?: Enums<"service_request_service_needed">[] | null;
  lifecycle_stage?: Enums<"service_request_lifecycle_stage"> | null;
  status?: Enums<"service_request_status"> | null;
};

const attemptedNotificationIds = new Set<string>();
const serviceLabelMap = new Map(serviceNeededOptions.map((option) => [option.value, option.label]));

function formatServiceType(request: PendingConfirmationRequest) {
  const services = request.service_needed_list?.length
    ? request.service_needed_list
    : request.service_needed
      ? [request.service_needed]
      : [];

  if (!services.length) {
    return "Tax assistance";
  }

  return services
    .map((service) => serviceLabelMap.get(service) || formatServiceRequestLabel(service))
    .join(", ");
}

export async function syncPendingClientConfirmationEmails(
  requests: PendingConfirmationRequest[],
) {
  const eligibleRequests = requests.filter((request) =>
    request.id
    && request.email
    && request.lifecycle_stage === "pending_client_confirmation"
    && request.status === "pending_client_confirmation"
    && !attemptedNotificationIds.has(request.id),
  );

  for (const request of eligibleRequests) {
    const { data, error } = await supabase.functions.invoke("send-portal-email", {
      body: {
        type: "lead_confirmation_required",
        requestId: request.id,
        clientProfileId: request.client_profile_id ?? undefined,
        clientEmail: request.email,
        clientName: request.full_name ?? "Client",
        clientConfirmationDueAt: request.client_confirmation_due_at ?? undefined,
        serviceType: formatServiceType(request),
      },
    });

    if (error) {
      console.error("Pending confirmation email send failed.", error);
      continue;
    }

    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      console.error("Pending confirmation email send failed.", data.error);
      continue;
    }

    attemptedNotificationIds.add(request.id);
  }
}
