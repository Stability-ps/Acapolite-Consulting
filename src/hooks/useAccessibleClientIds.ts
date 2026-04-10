import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useAccessibleClientIds() {
  const { user, isConsultant, staffPermissions } = useAuth();
  const hasRestrictedScope = Boolean(isConsultant && staffPermissions?.assigned_clients_only);

  const query = useQuery({
    queryKey: ["accessible-client-ids", user?.id, hasRestrictedScope],
    queryFn: async () => {
      if (!hasRestrictedScope || !user?.id) {
        return null;
      }

      const { data: assignedClients, error: assignedClientsError } = await supabase
        .from("clients")
        .select("id")
        .eq("assigned_consultant_id", user.id);

      if (assignedClientsError) {
        throw assignedClientsError;
      }

      const { data: assignedCases, error: assignedCasesError } = await supabase
        .from("cases")
        .select("client_id")
        .eq("assigned_consultant_id", user.id);

      if (assignedCasesError) {
        throw assignedCasesError;
      }

      const clientIds = new Set<string>();

      for (const client of assignedClients ?? []) {
        if (client.id) {
          clientIds.add(client.id);
        }
      }

      for (const caseItem of assignedCases ?? []) {
        if (caseItem.client_id) {
          clientIds.add(caseItem.client_id);
        }
      }

      return Array.from(clientIds);
    },
    enabled: hasRestrictedScope && !!user?.id,
  });

  return {
    accessibleClientIds: query.data ?? null,
    hasRestrictedClientScope: hasRestrictedScope,
    isLoadingAccessibleClientIds: query.isLoading,
  };
}
