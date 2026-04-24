import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Enums } from "@/integrations/supabase/types";
import { serviceCategoryMap, serviceCategoryOptions, serviceNeededOptions } from "@/lib/serviceRequests";
import { practitionerAvailabilityOptions } from "@/lib/practitionerMarketplace";

export type PractitionerProfileFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber: string;
  taxPractitionerNumber: string;
  professionalBody: string;
  professionalTitle: string;
  city: string;
  province: string;
  profileSummary: string;
  languagesSpoken: string;
  showRegistrationNumber: boolean;
  businessType: "individual" | "company";
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
  isVatRegistered: boolean;
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
  const isRegisteredCompany = value.businessType === "company";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-accent/20 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Personal Details</p>
        <p className="mt-2 text-sm text-muted-foreground font-body">
          Keep your personal and registration details accurate so Acapolite can verify and present your practitioner profile correctly.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">First Name</label>
          <Input
            value={value.firstName}
            onChange={(event) => onChange({ ...value, firstName: event.target.value })}
            placeholder="First name"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Last Name</label>
          <Input
            value={value.lastName}
            onChange={(event) => onChange({ ...value, lastName: event.target.value })}
            placeholder="Last name"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Email</label>
          <Input
            value={value.email}
            onChange={(event) => onChange({ ...value, email: event.target.value })}
            placeholder="Email address"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Phone Number</label>
          <Input
            value={value.phone}
            onChange={(event) => onChange({ ...value, phone: event.target.value })}
            placeholder="+27 ..."
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">ID Number</label>
          <Input
            value={value.idNumber}
            onChange={(event) => onChange({ ...value, idNumber: event.target.value })}
            placeholder="ID number"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Tax Practitioner Number</label>
          <Input
            value={value.taxPractitionerNumber}
            onChange={(event) => onChange({ ...value, taxPractitionerNumber: event.target.value })}
            placeholder="Tax practitioner number"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Professional Body</label>
          <Input
            value={value.professionalBody}
            onChange={(event) => onChange({ ...value, professionalBody: event.target.value })}
            placeholder="Professional body"
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Professional Title</label>
          <Input
            value={value.professionalTitle}
            onChange={(event) => onChange({ ...value, professionalTitle: event.target.value })}
            placeholder="Tax Practitioner, Senior Tax Consultant..."
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">City</label>
          <Input
            value={value.city}
            onChange={(event) => onChange({ ...value, city: event.target.value })}
            placeholder="City"
            className="rounded-xl"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Province</label>
          <Input
            value={value.province}
            onChange={(event) => onChange({ ...value, province: event.target.value })}
            placeholder="Province"
            className="rounded-xl"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Business Type</label>
          <Select
            value={value.businessType}
            onValueChange={(next) => onChange({
              ...value,
              businessType: next as PractitionerProfileFormState["businessType"],
              businessName: next === "company" ? value.businessName : "",
              registrationNumber: next === "company" ? value.registrationNumber : "",
            })}
          >
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual Practitioner (Sole Proprietor)</SelectItem>
              <SelectItem value="company">Registered Company / Firm</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isRegisteredCompany ? (
          <>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Company / Firm Name</label>
              <Input
                value={value.businessName}
                onChange={(event) => onChange({ ...value, businessName: event.target.value })}
                placeholder="Acapolite Practitioner Services"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Company Registration Number</label>
              <Input
                value={value.registrationNumber}
                onChange={(event) => onChange({ ...value, registrationNumber: event.target.value })}
                placeholder="Company or firm registration number"
                className="rounded-xl"
              />
            </div>
          </>
        ) : null}
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
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Languages Spoken</label>
          <Input
            value={value.languagesSpoken}
            onChange={(event) => onChange({ ...value, languagesSpoken: event.target.value })}
            placeholder="English, isiZulu, Afrikaans"
            className="rounded-xl"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-foreground font-body">Profile Summary / Bio</label>
          <Textarea
            value={value.profileSummary}
            onChange={(event) => onChange({ ...value, profileSummary: event.target.value })}
            placeholder="Briefly describe your experience, specialties, and the type of clients you help."
            className="min-h-[120px] rounded-xl"
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
        {isRegisteredCompany ? (
          <div className="sm:col-span-2 rounded-2xl border border-border p-4">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={value.showRegistrationNumber}
                onCheckedChange={(checked) => onChange({ ...value, showRegistrationNumber: checked === true })}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-semibold text-foreground font-body">Show Registration Number To Clients</span>
                <span className="mt-1 block text-sm text-muted-foreground font-body">
                  Turn this on if you want your company or firm registration number to be visible in the client-facing practitioner profile.
                </span>
              </span>
            </label>
          </div>
        ) : null}
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
        <div className="sm:col-span-2 rounded-2xl border border-border p-4">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={value.isVatRegistered}
              onCheckedChange={(checked) => onChange({
                ...value,
                isVatRegistered: checked === true,
                vatNumber: checked === true ? value.vatNumber : "",
              })}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-semibold text-foreground font-body">I am VAT Registered</span>
              <span className="mt-1 block text-sm text-muted-foreground font-body">
                VAT is optional. Only add a VAT number if this practitioner is registered for VAT.
              </span>
            </span>
          </label>
          {value.isVatRegistered ? (
            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">VAT Number</label>
              <Input
                value={value.vatNumber}
                onChange={(event) => onChange({ ...value, vatNumber: event.target.value })}
                placeholder="VAT number"
                className="rounded-xl"
              />
            </div>
          ) : null}
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
