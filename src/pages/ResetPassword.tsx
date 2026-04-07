import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { getAppBaseUrl } from "@/lib/siteUrl";

function getRecoveryTypeFromHash() {
  if (typeof window === "undefined") {
    return null;
  }

  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash).get("type");
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(getRecoveryTypeFromHash() === "recovery");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isPasswordMismatch = useMemo(() => {
    return confirmPassword.length > 0 && password !== confirmPassword;
  }, [confirmPassword, password]);

  const handleSendResetEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getAppBaseUrl()}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password reset link sent. Check your email.");
      setEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast.error(error.message);
        return;
      }

      await supabase.auth.signOut();
      toast.success("Password updated. Please sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 font-body text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>

        <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
          <AcapoliteLogo className="mb-6 h-14" />

          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            {recoveryMode ? "Set a new password" : "Forgot your password?"}
          </h1>
          <p className="text-muted-foreground font-body text-sm mb-8">
            {recoveryMode
              ? "Create a new password for your Acapolite client portal account."
              : "Enter your email address and we'll send you a password reset link."}
          </p>

          {recoveryMode ? (
            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div>
                <Label htmlFor="password" className="font-body">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  className="mt-1.5"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <Label htmlFor="confirm-password" className="font-body">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={6}
                  className="mt-1.5"
                  placeholder="Re-enter your password"
                />
                {isPasswordMismatch ? (
                  <p className="mt-2 text-sm text-destructive font-body">Passwords do not match.</p>
                ) : null}
              </div>

              <Button type="submit" disabled={loading || isPasswordMismatch} className="w-full py-5 text-base font-semibold rounded-xl">
                {loading ? "Updating password..." : "Update Password"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSendResetEmail} className="space-y-5">
              <div>
                <Label htmlFor="email" className="font-body">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="mt-1.5"
                  placeholder="you@example.com"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full py-5 text-base font-semibold rounded-xl">
                {loading ? "Sending reset link..." : "Send Reset Link"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
