import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  isPendingPractitionerAllowedPath,
  usePractitionerVerificationGate,
} from "@/hooks/usePractitionerVerificationGate";
import type { AppRole } from "@/lib/portal";
import { getDashboardHome } from "@/lib/portal";
import { Button } from "@/components/ui/button";

interface RequireRoleProps {
  allowedRoles: AppRole[];
}

export function RequireRole({ allowedRoles }: RequireRoleProps) {
  const { loading, user, role } = useAuth();
  const {
    isAccountSuspended,
    isPendingVerification,
    loading: practitionerVerificationLoading,
  } = usePractitionerVerificationGate();
  const location = useLocation();

  if (loading || practitionerVerificationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-body">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={getDashboardHome(role)} replace />;
  }

  if (isAccountSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-body">Account Suspended</p>
          <h1 className="mt-3 font-display text-2xl text-foreground">Your portal access is currently disabled</h1>
          <p className="mt-3 text-sm text-muted-foreground font-body">
            This account has been deactivated by the Acapolite Admin Team. Please contact support if you believe this
            needs to be reviewed.
          </p>
          <div className="mt-6">
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/login">Return to Login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const canPendingPractitionerAccessPath = isPendingPractitionerAllowedPath(location.pathname);

  if (isPendingVerification && !canPendingPractitionerAccessPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-body">Verification Pending</p>
          <h1 className="mt-3 font-display text-2xl text-foreground">Your practitioner account is pending verification</h1>
          <p className="mt-3 text-sm text-muted-foreground font-body">
            Our team is reviewing your credentials and documents. You can still review your profile, correct details,
            and upload verification documents while the admin team completes the review.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild className="rounded-xl">
              <Link to="/dashboard/staff/profile">Open My Profile</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/dashboard/staff/verification-documents">Upload Documents</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

