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
import { getAppBaseUrl } from "@/lib/siteUrl";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { dashboardPath, loading: authLoading, user } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      window.location.replace(dashboardPath);
    }
  }, [authLoading, dashboardPath, user]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "client",
          },
          emailRedirectTo: `${getAppBaseUrl()}/login`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Account created successfully.");

      if (data.session) {
        window.location.replace("/dashboard");
        return;
      }

      toast.success("Check your email to verify your account.");
      window.location.replace("/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign up failed. Please try again.";
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

          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Create your account</h1>
          <p className="text-muted-foreground font-body text-sm mb-8">Create your secure client portal account</p>

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <Label htmlFor="name" className="font-body">Full Name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1.5" placeholder="John Doe" />
            </div>
            <div>
              <Label htmlFor="email" className="font-body">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="password" className="font-body">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" placeholder="Min. 6 characters" minLength={6} />
            </div>
            <Button type="submit" disabled={loading} className="w-full py-5 text-base font-semibold rounded-xl">
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground font-body mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
