import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [resending, setResending] = useState(false);
  const { dashboardPath, loading: authLoading, user, isConfirmed } = useAuth();

  useEffect(() => {
    if (!authLoading && user && isConfirmed) {
      window.location.replace(dashboardPath);
    }
  }, [authLoading, dashboardPath, user, isConfirmed]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user && !data.user.email_confirmed_at) {
        setVerificationRequired(true);
        await supabase.auth.signOut();
        return;
      }

      toast.success("Welcome back!");
      window.location.replace("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign in failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      if (error) throw error;
      toast.success("Verification email resent. Please check your inbox.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend verification email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 font-body text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
          <AcapoliteLogo className="mb-6 h-14" />

          {verificationRequired ? (
            <>
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">Verify your email</h1>
              <p className="text-muted-foreground font-body text-sm mb-8">
                Your email address <strong>{email}</strong> has not been confirmed yet. Please check your inbox for a verification link.
              </p>
              
              <Button 
                onClick={handleResendVerification} 
                disabled={resending}
                variant="outline" 
                className="w-full py-5 text-base font-semibold rounded-xl"
              >
                {resending ? "Resending..." : "Resend Verification Email"}
              </Button>

              <Button 
                onClick={() => setVerificationRequired(false)} 
                variant="ghost" 
                className="w-full mt-4 text-sm font-body text-muted-foreground"
              >
                Back to login
              </Button>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">Welcome back</h1>
              <p className="text-muted-foreground font-body text-sm mb-8">Sign in to your Acapolite workspace</p>

              <GoogleAuthButton disabled={loading} onLoadingChange={setLoading} />

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
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

                <div>
                  <Label htmlFor="password" className="font-body">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="mt-1.5"
                    placeholder="********"
                  />
                  <div className="mt-2 text-right">
                    <Link to="/reset-password" className="text-sm font-body text-primary font-semibold hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full py-5 text-base font-semibold rounded-xl">
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground font-body mt-6">
                Don't have an account?{" "}
                <Link to="/register" className="text-primary font-semibold hover:underline">Create one</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
