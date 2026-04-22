import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const pendingPractitionerAllowedPaths = [
  "/dashboard/staff/profile",
  "/dashboard/staff/verification-documents",
];

export function isPendingPractitionerAllowedPath(pathname: string) {
  return pendingPractitionerAllowedPaths.includes(pathname);
}

export function usePractitionerVerificationGate() {
  const { user, role, profile } = useAuth();
  const isConsultant = role === "consultant";

  const { data: practitionerProfile, isLoading } = useQuery({
    queryKey: ["practitioner-verification-gate", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select("profile_id, is_verified, verification_status")
        .eq("profile_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: isConsultant && !!user,
  });

  const isPendingVerification =
    isConsultant &&
    practitionerProfile?.verification_status !== "suspended" &&
    (
      profile?.is_active === false ||
      practitionerProfile?.is_verified !== true ||
      practitionerProfile?.verification_status !== "verified"
    );
  const isAccountSuspended =
    Boolean(profile && profile.is_active === false && !isConsultant) ||
    Boolean(
      isConsultant &&
      (
        practitionerProfile?.verification_status === "suspended" ||
        (profile?.is_active === false && practitionerProfile?.verification_status === "verified")
      ),
    );

  return {
    isAccountSuspended,
    isPendingVerification,
    loading: isConsultant && !!user && isLoading,
  };
}
