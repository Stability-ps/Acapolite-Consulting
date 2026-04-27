import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClientRecord } from "@/hooks/useClientRecord";

const provinces = [
  "Gauteng",
  "Western Cape",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
];

const SA_ID_NUMBER_LENGTH = 13;

function normalizeIdNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, SA_ID_NUMBER_LENGTH);
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: client } = useClientRecord();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    client_type: "individual",
    first_name: "",
    last_name: "",
    company_name: "",
    company_registration_number: "",
    tax_number: "",
    sars_reference_number: "",
    id_number: "",
    province: "",
    city: "",
    address_line_1: "",
    address_line_2: "",
    postal_code: "",
    country: "South Africa",
    vat_number: "",
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
      client_type: client?.client_type || "individual",
      first_name: client?.first_name || "",
      last_name: client?.last_name || "",
      company_name: client?.company_name || "",
      company_registration_number: client?.company_registration_number || "",
      tax_number: client?.tax_number || "",
      sars_reference_number: client?.sars_reference_number || "",
      id_number: client?.id_number || "",
      province: client?.province || "",
      city: client?.city || "",
      address_line_1: client?.address_line_1 || "",
      address_line_2: client?.address_line_2 || "",
      postal_code: client?.postal_code || "",
      country: client?.country || "South Africa",
      vat_number: client?.vat_number || "",
    });
  }, [profile, client]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);

    if (
      form.client_type === "individual" &&
      form.id_number.trim() &&
      form.id_number.trim().length !== SA_ID_NUMBER_LENGTH
    ) {
      toast.error("ID number must be exactly 13 digits.");
      setSaving(false);
      return;
    }

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
            client_type: form.client_type,
            first_name: form.first_name,
            last_name: form.last_name,
            company_name: form.company_name,
            company_registration_number: form.client_type === "company" ? form.company_registration_number : null,
            tax_number: form.tax_number,
            sars_reference_number: form.sars_reference_number,
            id_number: form.client_type === "individual" ? form.id_number : null,
            province: form.province,
            city: form.city,
            address_line_1: form.address_line_1,
            address_line_2: form.address_line_2,
            postal_code: form.postal_code,
            country: form.country,
            vat_number: form.vat_number,
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
        <div>
          <Label className="font-body">Individual or Company</Label>
          <Select
            value={form.client_type}
            onValueChange={(value) =>
              setForm((current) => ({
                ...current,
                client_type: value,
                id_number: value === "individual" ? current.id_number : "",
                company_name: value === "company" ? current.company_name : "",
                company_registration_number: value === "company" ? current.company_registration_number : "",
              }))
            }
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="company">Company</SelectItem>
            </SelectContent>
          </Select>
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
            <Label className="font-body">
              {form.client_type === "company" ? "Company Name" : "ID Number"}
            </Label>
            {form.client_type === "company" ? (
              <Input
                value={form.company_name}
                onChange={(event) => setForm({ ...form, company_name: event.target.value })}
                className="mt-1.5"
              />
            ) : (
              <Input
                value={form.id_number}
                onChange={(event) => setForm({ ...form, id_number: normalizeIdNumber(event.target.value) })}
                className="mt-1.5"
                inputMode="numeric"
                maxLength={SA_ID_NUMBER_LENGTH}
              />
            )}
          </div>
          <div>
            <Label className="font-body">
              {form.client_type === "company" ? "Company Registration Number" : "Tax Number"}
            </Label>
            {form.client_type === "company" ? (
              <Input
                value={form.company_registration_number}
                onChange={(event) => setForm({ ...form, company_registration_number: event.target.value })}
                className="mt-1.5"
              />
            ) : (
              <Input value={form.tax_number} onChange={(event) => setForm({ ...form, tax_number: event.target.value })} className="mt-1.5" />
            )}
          </div>
        </div>
        {form.client_type === "company" ? (
          <div>
            <Label className="font-body">Tax Number</Label>
            <Input value={form.tax_number} onChange={(event) => setForm({ ...form, tax_number: event.target.value })} className="mt-1.5" />
          </div>
        ) : null}
        <div>
          <Label className="font-body">SARS Reference Number</Label>
          <Input value={form.sars_reference_number} onChange={(event) => setForm({ ...form, sars_reference_number: event.target.value })} className="mt-1.5" />
        </div>
        <div>
          <Label className="font-body">VAT Number (Optional)</Label>
          <Input value={form.vat_number} onChange={(event) => setForm({ ...form, vat_number: event.target.value })} className="mt-1.5" placeholder="VAT number" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="font-body">City</Label>
            <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label className="font-body">Province</Label>
            <Select value={form.province} onValueChange={(value) => setForm({ ...form, province: value })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((province) => (
                  <SelectItem key={province} value={province}>
                    {province}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="font-body">Address Line 1</Label>
          <Input value={form.address_line_1} onChange={(event) => setForm({ ...form, address_line_1: event.target.value })} className="mt-1.5" />
        </div>
        <div>
          <Label className="font-body">Address Line 2</Label>
          <Input value={form.address_line_2} onChange={(event) => setForm({ ...form, address_line_2: event.target.value })} className="mt-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="font-body">Postal Code</Label>
            <Input value={form.postal_code} onChange={(event) => setForm({ ...form, postal_code: event.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label className="font-body">Country</Label>
            <Input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} className="mt-1.5" />
          </div>
        </div>
        <Button type="submit" disabled={saving} className="rounded-xl">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}
