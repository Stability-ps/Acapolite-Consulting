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

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { dashboardPath, loading: authLoading, user } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      window.location.replace(dashboardPath);
    }
  }, [authLoading, dashboardPath, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast.error(error.message);
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

  return (
    <div className="min-h-screen bg-surface-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 font-body text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
          <AcapoliteLogo className="mb-6 h-14" />

          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Welcome back</h1>
          <p className="text-muted-foreground font-body text-sm mb-8">Sign in to your Acapolite workspace</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label htmlFor="email" className="font-body">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="password" className="font-body">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" placeholder="••••••••" />
            </div>
            <Button type="submit" disabled={loading} className="w-full py-5 text-base font-semibold rounded-xl">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground font-body mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-semibold hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
