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
  bankAccountHolderName: string;
  bankName: string;
  bankBranchName: string;
  bankBranchCode: string;
  bankAccountNumber: string;
  bankAccountType: string;
  vatNumber: string;
};

const bankOptions = [
  "ABSA",
  "Capitec",
  "FNB",
  "Nedbank",
  "Standard Bank",
  "Discovery Bank",
  "Investec",
  "TymeBank",
  "African Bank",
  "Other",
];

const accountTypeOptions = ["Cheque", "Savings", "Business"];

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

      <div className="rounded-2xl border border-border bg-accent/20 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Banking Profile</p>
        <p className="mt-2 text-sm text-muted-foreground font-body">
          These details are used to auto-fill invoices. Keep them accurate and up to date.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Account Holder Name</label>
          <Input
            value={value.bankAccountHolderName}
            onChange={(event) => onChange({ ...value, bankAccountHolderName: event.target.value })}
            placeholder="Account holder name"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Bank Name</label>
          <Select
            value={value.bankName}
            onValueChange={(next) => onChange({ ...value, bankName: next })}
          >
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue placeholder="Select bank" />
            </SelectTrigger>
            <SelectContent>
              {bankOptions.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Branch Name</label>
          <Input
            value={value.bankBranchName}
            onChange={(event) => onChange({ ...value, bankBranchName: event.target.value })}
            placeholder="Branch name"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Branch Code</label>
          <Input
            value={value.bankBranchCode}
            onChange={(event) => onChange({ ...value, bankBranchCode: event.target.value })}
            placeholder="Branch code"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Account Number</label>
          <Input
            value={value.bankAccountNumber}
            onChange={(event) => onChange({ ...value, bankAccountNumber: event.target.value })}
            placeholder="Account number"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Account Type</label>
          <Select
            value={value.bankAccountType}
            onValueChange={(next) => onChange({ ...value, bankAccountType: next })}
          >
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              {accountTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">VAT Number (Optional)</label>
          <Input
            value={value.vatNumber}
            onChange={(event) => onChange({ ...value, vatNumber: event.target.value })}
            placeholder="VAT number"
            className="rounded-xl"
          />
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
