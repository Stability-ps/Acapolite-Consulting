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

      const { data, error } = await supabase
        .from("clients")
        .select("id")
        .eq("assigned_consultant_id", user.id);

      if (error) {
        throw error;
      }

      return (data ?? []).map((client) => client.id);
    },
    enabled: hasRestrictedScope && !!user?.id,
  });

  return {
    accessibleClientIds: query.data ?? null,
    hasRestrictedClientScope: hasRestrictedScope,
    isLoadingAccessibleClientIds: query.isLoading,
  };
}
