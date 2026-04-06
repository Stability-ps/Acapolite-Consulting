import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created! Check your email to verify.");
      navigate("/login");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 font-body text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-bold text-foreground">Acapolite</span>
          </div>

          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Create your account</h1>
          <p className="text-muted-foreground font-body text-sm mb-8">Start managing your tax obligations today</p>

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
