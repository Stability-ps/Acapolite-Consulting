import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Enums } from "@/integrations/supabase/types";
import { serviceCategoryMap, serviceCategoryOptions, serviceNeededOptions } from "@/lib/serviceRequests";
import { practitionerAvailabilityOptions } from "@/lib/practitionerMarketplace";

export type PractitionerProfileFormState = {
  businessName: string;
  registrationNumber: string;
  yearsOfExperience: string;
  availabilityStatus: Enums<"practitioner_availability_status">;
  isVerified: boolean;
  internalNotes: string;
  servicesOffered: string[];
};

export function PractitionerProfileFields({
  value,
  onChange,
  allowVerification = true,
}: {
  value: PractitionerProfileFormState;
  onChange: (next: PractitionerProfileFormState) => void;
  allowVerification?: boolean;
}) {
  const toggleService = (serviceValue: string, checked: boolean) => {
    const nextServices = checked
      ? Array.from(new Set([...value.servicesOffered, serviceValue]))
      : value.servicesOffered.filter((item) => item !== serviceValue);

    onChange({ ...value, servicesOffered: nextServices });
  };

  const serviceLabelMap = new Map(serviceNeededOptions.map((service) => [service.value, service.label]));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Business Name</label>
          <Input
            value={value.businessName}
            onChange={(event) => onChange({ ...value, businessName: event.target.value })}
            placeholder="Acapolite Practitioner Services"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Registration Number</label>
          <Input
            value={value.registrationNumber}
            onChange={(event) => onChange({ ...value, registrationNumber: event.target.value })}
            placeholder="Professional registration number"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Years of Experience</label>
          <Input
            type="number"
            min="0"
            value={value.yearsOfExperience}
            onChange={(event) => onChange({ ...value, yearsOfExperience: event.target.value })}
            placeholder="0"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Availability</label>
          <Select
            value={value.availabilityStatus}
            onValueChange={(next) => onChange({ ...value, availabilityStatus: next as Enums<"practitioner_availability_status"> })}
          >
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {practitionerAvailabilityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {allowVerification ? (
        <div className="rounded-2xl border border-border p-4">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={value.isVerified}
              onCheckedChange={(checked) => onChange({ ...value, isVerified: checked === true })}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-semibold text-foreground font-body">Verified Practitioner Badge</span>
              <span className="mt-1 block text-sm text-muted-foreground font-body">
                Verified practitioners can be highlighted to clients and prioritized for automatic lead assignment.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground font-body">Services Offered</label>
        <div className="space-y-4">
          {serviceCategoryOptions.map((category) => (
            <div key={category.value}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground font-body">
                {category.label}
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {serviceCategoryMap[category.value].map((service) => (
                  <label key={service} className="flex items-start gap-3 rounded-2xl border border-border p-4">
                    <Checkbox
                      checked={value.servicesOffered.includes(service)}
                      onCheckedChange={(checked) => toggleService(service, checked === true)}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-foreground font-body">{serviceLabelMap.get(service) || service}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground font-body">Internal Practitioner Notes</label>
        <Textarea
          value={value.internalNotes}
          onChange={(event) => onChange({ ...value, internalNotes: event.target.value })}
          placeholder="Internal notes, strengths, sector focus, or onboarding notes..."
          className="min-h-[120px] rounded-xl"
        />
      </div>
    </div>
  );
}
