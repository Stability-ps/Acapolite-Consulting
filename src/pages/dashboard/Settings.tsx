import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClientRecord } from "@/hooks/useClientRecord";

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: client } = useClientRecord();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    first_name: "",
    last_name: "",
    company_name: "",
    tax_number: "",
    sars_reference_number: "",
    id_number: "",
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    setForm({
      full_name: profile?.full_name || "",
      phone: profile?.phone || "",
      first_name: client?.first_name || "",
      last_name: client?.last_name || "",
      company_name: client?.company_name || "",
      tax_number: client?.tax_number || "",
      sars_reference_number: client?.sars_reference_number || "",
      id_number: client?.id_number || "",
    });
  }, [profile, client]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);

    const profileUpdate = supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        phone: form.phone,
      })
      .eq("id", user.id);

    const clientUpdate = client
      ? supabase
          .from("clients")
          .update({
            first_name: form.first_name,
            last_name: form.last_name,
            company_name: form.company_name,
            tax_number: form.tax_number,
            sars_reference_number: form.sars_reference_number,
            id_number: form.id_number,
          })
          .eq("id", client.id)
      : Promise.resolve({ error: null });

    const [profileResult, clientResult] = await Promise.all([profileUpdate, clientUpdate]);

    if (profileResult.error || clientResult.error) {
      toast.error(profileResult.error?.message || clientResult.error?.message || "Unable to save your settings.");
    } else {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      queryClient.invalidateQueries({ queryKey: ["client-record", user.id] });
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
          <Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="mt-1.5" />
        </div>
        <div>
          <Label className="font-body">Phone Number</Label>
          <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="font-body">First Name</Label>
            <Input value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label className="font-body">Last Name</Label>
            <Input value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} className="mt-1.5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="font-body">ID Number</Label>
            <Input value={form.id_number} onChange={(event) => setForm({ ...form, id_number: event.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label className="font-body">Tax Number</Label>
            <Input value={form.tax_number} onChange={(event) => setForm({ ...form, tax_number: event.target.value })} className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label className="font-body">SARS Reference Number</Label>
          <Input value={form.sars_reference_number} onChange={(event) => setForm({ ...form, sars_reference_number: event.target.value })} className="mt-1.5" />
        </div>
        <div>
          <Label className="font-body">Company Name</Label>
          <Input value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} className="mt-1.5" />
        </div>
        <Button type="submit" disabled={saving} className="rounded-xl">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}
