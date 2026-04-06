import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    id_number: "",
    tax_number: "",
    company_name: "",
  });

  // Sync form when profile loads
  useState(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        id_number: profile.id_number || "",
        tax_number: profile.tax_number || "",
        company_name: profile.company_name || "",
      });
    }
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Settings</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Manage your profile information</p>

      <form onSubmit={handleSave} className="bg-card rounded-xl border border-border shadow-card p-6 space-y-5">
        <div>
          <Label className="font-body">Email</Label>
          <Input value={user?.email || ""} disabled className="mt-1.5 bg-muted" />
        </div>
        <div>
          <Label className="font-body">Full Name</Label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1.5" />
        </div>
        <div>
          <Label className="font-body">Phone Number</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="font-body">ID Number</Label>
            <Input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label className="font-body">Tax Number</Label>
            <Input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label className="font-body">Company Name</Label>
          <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="mt-1.5" />
        </div>
        <Button type="submit" disabled={saving} className="rounded-xl">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}
