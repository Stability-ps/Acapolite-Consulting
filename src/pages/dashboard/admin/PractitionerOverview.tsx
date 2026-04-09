import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, BriefcaseBusiness, ClipboardList, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PractitionerProfileFields, type PractitionerProfileFormState } from "@/components/dashboard/PractitionerProfileFields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { serviceNeededOptions } from "@/lib/serviceRequests";
import { formatAvailabilityLabel, getAvailabilityBadgeClass, getWorkloadLabel, normalizeServicesOffered } from "@/lib/practitionerMarketplace";
import { Link } from "react-router-dom";

const initialPractitionerForm: PractitionerProfileFormState = {
  businessName: "",
  registrationNumber: "",
  yearsOfExperience: "0",
  availabilityStatus: "available",
  isVerified: false,
  internalNotes: "",
  servicesOffered: [],
};

export default function PractitionerOverview() {
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

  const { data: activeCaseCount } = useQuery({
    queryKey: ["practitioner-active-case-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("cases")
        .select("id", { count: "exact", head: true })
        .eq("assigned_consultant_id", user!.id)
        .not("status", "in", '("resolved","closed")');

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: assignedClientCount } = useQuery({
    queryKey: ["practitioner-assigned-client-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("assigned_consultant_id", user!.id);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: openLeadCount } = useQuery({
    queryKey: ["practitioner-open-lead-count", user?.id],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from("service_requests")
        .select("id, assigned_practitioner_id, status")
        .neq("status", "closed");

      if (error) throw error;

      const { data: responses } = await supabase
        .from("service_request_responses")
        .select("service_request_id")
        .eq("practitioner_profile_id", user!.id);

      const respondedIds = new Set((responses ?? []).map((response) => response.service_request_id));

      return (leads ?? []).filter((lead) =>
        lead.assigned_practitioner_id === null
        || lead.assigned_practitioner_id === user!.id
        || respondedIds.has(lead.id)).length;
    },
    enabled: !!user,
  });

  const { data: recentLeads } = useQuery({
    queryKey: ["practitioner-recent-leads", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id, full_name, service_needed, priority_level, risk_indicator, status, assigned_practitioner_id, created_at")
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!practitionerProfile) return;

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
    await queryClient.invalidateQueries({ queryKey: ["practitioner-profile", user.id] });
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-body">Practitioner Dashboard</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">
          Welcome back, {profile?.full_name?.split(/\s+/)[0] || "Practitioner"}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground font-body">
          Keep your practitioner profile current, watch your active workload, and manage the leads available to you in the marketplace.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <BadgeCheck className="h-5 w-5 text-primary" />
            <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getAvailabilityBadgeClass(practitionerProfile?.availability_status ?? form.availabilityStatus)}`}>
              {practitionerProfile?.is_verified ? "Verified" : "Pending Verification"}
            </Badge>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Availability</p>
          <p className="mt-2 font-display text-2xl text-foreground">{formatAvailabilityLabel(form.availabilityStatus)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <BriefcaseBusiness className="h-5 w-5 text-primary" />
          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Active Cases</p>
          <p className="mt-2 font-display text-2xl text-foreground">{activeCaseCount ?? 0}</p>
          <p className="mt-2 text-sm text-muted-foreground font-body">{getWorkloadLabel(activeCaseCount ?? 0)} workload</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <Users className="h-5 w-5 text-primary" />
          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Assigned Clients</p>
          <p className="mt-2 font-display text-2xl text-foreground">{assignedClientCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <ClipboardList className="h-5 w-5 text-primary" />
          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Visible Leads</p>
          <p className="mt-2 font-display text-2xl text-foreground">{openLeadCount ?? 0}</p>
          <Link to="/dashboard/staff/service-requests" className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
            Open lead inbox
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-foreground">Practitioner Profile Setup</h2>
              <p className="mt-2 text-sm text-muted-foreground font-body">
                This profile is used when you respond to client requests and when admins review practitioner workload.
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
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-2xl text-foreground">Services Offered</h2>
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
          </section>

          <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-2xl text-foreground">Recent Lead Activity</h2>
            <div className="mt-4 space-y-3">
              {(recentLeads ?? []).length ? (
                (recentLeads ?? []).map((lead) => (
                  <Link
                    key={lead.id}
                    to="/dashboard/staff/service-requests"
                    className="block rounded-2xl border border-border bg-background/60 p-4 transition-all hover:border-primary/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-foreground font-body">{lead.full_name}</p>
                      <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getAvailabilityBadgeClass(lead.assigned_practitioner_id === user?.id ? "available" : "limited")}`}>
                        {lead.assigned_practitioner_id === user?.id ? "Assigned to you" : "Open lead"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground font-body">
                      {serviceNeededOptions.find((item) => item.value === lead.service_needed)?.label || lead.service_needed}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground font-body">No current leads are visible yet.</p>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
