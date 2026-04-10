import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, BriefcaseBusiness, ClipboardList, Save } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PractitionerProfileFields, type PractitionerProfileFormState } from "@/components/dashboard/PractitionerProfileFields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { serviceNeededOptions } from "@/lib/serviceRequests";
import { formatAvailabilityLabel, getAvailabilityBadgeClass, normalizeServicesOffered } from "@/lib/practitionerMarketplace";

const initialPractitionerForm: PractitionerProfileFormState = {
  businessName: "",
  registrationNumber: "",
  yearsOfExperience: "0",
  availabilityStatus: "available",
  isVerified: false,
  internalNotes: "",
  servicesOffered: [],
};

function getProfileCompletion(form: PractitionerProfileFormState) {
  const checks = [
    Boolean(form.businessName.trim()),
    Boolean(form.registrationNumber.trim()),
    Number(form.yearsOfExperience || 0) > 0,
    form.servicesOffered.length > 0,
  ];

  const completed = checks.filter(Boolean).length;

  return {
    completed,
    total: checks.length,
    percent: Math.round((completed / checks.length) * 100),
  };
}

export default function PractitionerProfile() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PractitionerProfileFormState>(initialPractitionerForm);
  const [saving, setSaving] = useState(false);

  const { data: practitionerProfile } = useQuery({
    queryKey: ["practitioner-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select("*")
        .eq("profile_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!practitionerProfile) {
      setForm(initialPractitionerForm);
      return;
    }

    setForm({
      businessName: practitionerProfile.business_name || "",
      registrationNumber: practitionerProfile.registration_number || "",
      yearsOfExperience: String(practitionerProfile.years_of_experience ?? 0),
      availabilityStatus: practitionerProfile.availability_status ?? "available",
      isVerified: practitionerProfile.is_verified ?? false,
      internalNotes: practitionerProfile.internal_notes || "",
      servicesOffered: practitionerProfile.services_offered ?? [],
    });
  }, [practitionerProfile]);

  const completion = useMemo(() => getProfileCompletion(form), [form]);
  const serviceLabels = useMemo(() => {
    const labelMap = new Map(serviceNeededOptions.map((service) => [service.value, service.label]));
    return form.servicesOffered.map((service) => labelMap.get(service) ?? service);
  }, [form.servicesOffered]);

  const saveProfile = async () => {
    if (!user) return;

    setSaving(true);

    const years = Number(form.yearsOfExperience || 0);
    const { error } = await supabase.from("practitioner_profiles").upsert({
      profile_id: user.id,
      business_name: form.businessName.trim() || null,
      registration_number: form.registrationNumber.trim() || null,
      years_of_experience: Number.isNaN(years) ? 0 : Math.max(0, years),
      availability_status: form.availabilityStatus,
      is_verified: practitionerProfile?.is_verified ?? false,
      internal_notes: form.internalNotes.trim() || null,
      services_offered: normalizeServicesOffered(form.servicesOffered),
    });

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Practitioner profile updated.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["practitioner-profile", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["practitioner-own-lead-responses", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["practitioner-overview-leads", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["practitioner-visible-leads", user.id] }),
    ]);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-body">Practitioner Profile</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">
          {profile?.full_name || "Practitioner"} profile setup
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground font-body">
          Keep your profile current so Acapolite can match you to the right leads and present your expertise clearly.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-foreground">My Profile</h2>
              <p className="mt-2 text-sm text-muted-foreground font-body">
                Update your practitioner identity, service coverage, and availability for lead assignment.
              </p>
            </div>
            <Badge className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAvailabilityBadgeClass(practitionerProfile?.availability_status ?? form.availabilityStatus)}`}>
              {practitionerProfile?.is_verified ? "Verified Practitioner" : "Verification Pending"}
            </Badge>
          </div>

          <div className="mt-6">
            <PractitionerProfileFields
              value={form}
              onChange={setForm}
              allowVerification={false}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="button" className="rounded-xl" onClick={saveProfile} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Practitioner Profile"}
            </Button>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-foreground">Profile Status</h2>
                <p className="mt-2 text-sm text-muted-foreground font-body">A quick health check for your practitioner setup.</p>
              </div>
              <Badge className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {completion.percent}% complete
              </Badge>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <BadgeCheck className="h-5 w-5 text-primary" />
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Verification</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {practitionerProfile?.is_verified ? "Verified" : "Pending review"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/20 p-4">
                <BriefcaseBusiness className="h-5 w-5 text-primary" />
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Availability</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatAvailabilityLabel(form.availabilityStatus)}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Completion checklist</p>
              <div className="mt-3 space-y-2 text-sm font-body">
                <p className={form.businessName.trim() ? "text-foreground" : "text-muted-foreground"}>
                  {form.businessName.trim() ? "Complete" : "Missing"} business name
                </p>
                <p className={form.registrationNumber.trim() ? "text-foreground" : "text-muted-foreground"}>
                  {form.registrationNumber.trim() ? "Complete" : "Missing"} registration number
                </p>
                <p className={Number(form.yearsOfExperience || 0) > 0 ? "text-foreground" : "text-muted-foreground"}>
                  {Number(form.yearsOfExperience || 0) > 0 ? "Complete" : "Missing"} experience level
                </p>
                <p className={form.servicesOffered.length > 0 ? "text-foreground" : "text-muted-foreground"}>
                  {form.servicesOffered.length > 0 ? "Complete" : "Missing"} services offered
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display text-2xl text-foreground">Service Coverage</h2>
                <p className="mt-2 text-sm text-muted-foreground font-body">These services are used when matching marketplace leads.</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {serviceLabels.length ? (
                serviceLabels.map((label) => (
                  <Badge key={label} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary">
                    {label}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground font-body">No service specialties selected yet.</p>
              )}
            </div>

            <div className="mt-6">
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/dashboard/staff/service-requests">Open lead inbox</Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
