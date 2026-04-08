import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/portal";
import { getDashboardHome } from "@/lib/portal";
import type { StaffPermissionKey, StaffPermissionValues } from "@/lib/staffPermissions";
import { hasStaffPermission as checkStaffPermission, resolveStaffPermissions } from "@/lib/staffPermissions";

type Profile = Tables<"profiles">;
type StaffPermissions = Tables<"staff_permissions">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  role: AppRole | null;
  staffPermissions: StaffPermissionValues | null;
  dashboardPath: string;
  isClient: boolean;
  isAdmin: boolean;
  isConsultant: boolean;
  isStaff: boolean;
  hasStaffPermission: (permission: StaffPermissionKey) => boolean;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  profile: null,
  role: null,
  staffPermissions: null,
  dashboardPath: "/dashboard",
  isClient: false,
  isAdmin: false,
  isConsultant: false,
  isStaff: false,
  hasStaffPermission: () => false,
  signOut: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [staffPermissions, setStaffPermissions] = useState<StaffPermissions | null>(null);

  useEffect(() => {
    let isActive = true;
    let requestSequence = 0;

    const loadAccessState = async (nextSession: Session | null) => {
      const currentRequest = ++requestSequence;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setRole(null);
        setStaffPermissions(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const userId = nextSession.user.id;
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      const nextRole = (profileData?.role as AppRole | undefined) ?? "client";
      let permissionsData: StaffPermissions | null = null;

      if (nextRole === "admin" || nextRole === "consultant") {
        const { data } = await supabase
          .from("staff_permissions")
          .select("*")
          .eq("profile_id", userId)
          .maybeSingle();

        permissionsData = data ?? null;
      }

      if (!isActive || currentRequest !== requestSequence) {
        return;
      }

      setProfile(profileData ?? null);
      setRole(nextRole);
      setStaffPermissions(permissionsData);
      setLoading(false);
    };

    const queueAccessStateLoad = (nextSession: Session | null) => {
      window.setTimeout(() => {
        void loadAccessState(nextSession);
      }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queueAccessStateLoad(nextSession);
    });

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      void loadAccessState(nextSession);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || !profile || !role) {
      return;
    }

    void supabase.functions.invoke("send-portal-email", {
      body: {
        type: "signup_notification",
        profileId: profile.id,
        email: profile.email ?? user.email ?? "",
        fullName: profile.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? "",
        role,
        provider: user.app_metadata?.provider ?? "email",
      },
    });
  }, [profile, role, user]);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();

      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      setStaffPermissions(null);
      setLoading(false);

      return { error: error ? new Error(error.message) : null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error("Unable to sign out."),
      };
    }
  };

  const isAdmin = role === "admin";
  const isConsultant = role === "consultant";
  const isClient = role === "client";
  const isStaff = role === "admin" || role === "consultant";
  const resolvedStaffPermissions = resolveStaffPermissions(role, staffPermissions);
  const dashboardPath = getDashboardHome(role, resolvedStaffPermissions);
  const hasStaffPermission = (permission: StaffPermissionKey) => checkStaffPermission(role, resolvedStaffPermissions, permission);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profile,
        role,
        staffPermissions: resolvedStaffPermissions,
        dashboardPath,
        isAdmin,
        isConsultant,
        isStaff,
        isClient,
        hasStaffPermission,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
