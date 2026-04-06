import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useClientRecord() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["client-record", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("profile_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });
}
