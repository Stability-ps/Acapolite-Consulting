import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, BriefcaseBusiness, ClipboardList, Save } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { PractitionerProfileFields, type PractitionerProfileFormState } from "@/components/dashboard/PractitionerProfileFields";
import { WebPushPrompt } from "@/components/dashboard/WebPushPrompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/dashboard/RatingStars";
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
  bankAccountHolderName: "",
  bankName: "",
  bankBranchName: "",
  bankBranchCode: "",
  bankAccountNumber: "",
  bankAccountType: "",
  vatNumber: "",
};

type PractitionerReview = Tables<"practitioner_reviews">;

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

  const { data: practitionerReviews } = useQuery({
    queryKey: ["practitioner-reviews", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_reviews")
        .select("*")
        .eq("practitioner_profile_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as PractitionerReview[];
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
      bankAccountHolderName: practitionerProfile.bank_account_holder_name || profile?.full_name || "",
      bankName: practitionerProfile.bank_name || "",
      bankBranchName: practitionerProfile.bank_branch_name || "",
      bankBranchCode: practitionerProfile.bank_branch_code || "",
      bankAccountNumber: practitionerProfile.bank_account_number || "",
      bankAccountType: practitionerProfile.bank_account_type || "",
      vatNumber: practitionerProfile.vat_number || "",
    });
  }, [practitionerProfile, profile?.full_name]);

  const completion = useMemo(() => getProfileCompletion(form), [form]);
  const serviceLabels = useMemo(() => {
    const labelMap = new Map(serviceNeededOptions.map((service) => [service.value, service.label]));
    return form.servicesOffered.map((service) => labelMap.get(service) ?? service);
  }, [form.servicesOffered]);
  const reviewSummary = useMemo(() => {
    const reviews = practitionerReviews ?? [];
    const count = reviews.length;
    const average = count
      ? reviews.reduce((total, review) => total + review.rating, 0) / count
      : 0;

    return { average, count, latest: reviews.slice(0, 3) };
  }, [practitionerReviews]);

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
      bank_account_holder_name: form.bankAccountHolderName.trim() || null,
      bank_name: form.bankName.trim() || null,
      bank_branch_name: form.bankBranchName.trim() || null,
      bank_branch_code: form.bankBranchCode.trim() || null,
      bank_account_number: form.bankAccountNumber.trim() || null,
      bank_account_type: form.bankAccountType.trim() || null,
      vat_number: form.vatNumber.trim() || null,
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

          <WebPushPrompt buttonLabel="Allow Notifications" />

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

          <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-foreground">Client Feedback</h2>
                <p className="mt-2 text-sm text-muted-foreground font-body">
                  Ratings from completed client matters help you measure trust and service quality.
                </p>
              </div>
              <Badge className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {reviewSummary.count} review{reviewSummary.count === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-accent/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-body">Average Rating</p>
              <div className="mt-3 flex items-center gap-3">
                <p className="font-display text-3xl text-foreground">
                  {reviewSummary.count ? reviewSummary.average.toFixed(1) : "N/A"}
                </p>
                <RatingStars value={reviewSummary.average} readOnly />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {reviewSummary.latest.length ? (
                reviewSummary.latest.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <RatingStars value={review.rating} readOnly />
                      <p className="text-xs text-muted-foreground font-body">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="mt-3 text-sm text-foreground font-body">
                      {review.review_text || "Client left a rating without a written review."}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground font-body">
                  No client reviews yet. Ratings will appear once completed cases are reviewed by clients.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
