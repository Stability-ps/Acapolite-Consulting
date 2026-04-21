import { AlertCircle, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

type PractitionerProfile = Tables<"practitioner_profiles">;

interface PractitionerProfileMissingFieldsProps {
  profile?: PractitionerProfile | null;
}

function getMissingFields(profile?: PractitionerProfile | null) {
  if (!profile) {
    return [
      { field: "Business Type", status: "missing" },
      { field: "Services Offered", status: "missing" },
      { field: "Years of Experience", status: "missing" },
      { field: "Availability Status", status: "missing" },
      { field: "Banking Information", status: "missing" },
    ];
  }

  const missingFields = [];
  const businessType = profile.business_type === "company" ? "company" : "individual";

  missingFields.push({ field: "Business Type", status: "complete" });

  if (businessType === "company") {
    if (!profile.business_name?.trim()) {
      missingFields.push({ field: "Company / Firm Name", status: "missing" });
    } else {
      missingFields.push({ field: "Company / Firm Name", status: "complete" });
    }

    if (!profile.registration_number?.trim()) {
      missingFields.push({ field: "Company Registration Number", status: "missing" });
    } else {
      missingFields.push({ field: "Company Registration Number", status: "complete" });
    }
  }

  if (!profile.services_offered?.length) {
    missingFields.push({ field: "Services Offered", status: "missing" });
  } else {
    missingFields.push({ field: "Services Offered", status: "complete" });
  }

  if (!profile.years_of_experience) {
    missingFields.push({ field: "Years of Experience", status: "missing" });
  } else {
    missingFields.push({ field: "Years of Experience", status: "complete" });
  }

  if (!profile.availability_status) {
    missingFields.push({ field: "Availability Status", status: "missing" });
  } else {
    missingFields.push({ field: "Availability Status", status: "complete" });
  }

  const hasBankingInfo =
    profile.bank_account_holder_name?.trim() &&
    profile.bank_name?.trim() &&
    profile.bank_account_number?.trim() &&
    profile.bank_account_type?.trim();

  if (!hasBankingInfo) {
    missingFields.push({ field: "Banking Information", status: "missing" });
  } else {
    missingFields.push({ field: "Banking Information", status: "complete" });
  }

  if (profile.is_vat_registered) {
    if (!profile.vat_number?.trim()) {
      missingFields.push({ field: "VAT Number", status: "missing" });
    } else {
      missingFields.push({ field: "VAT Number", status: "complete" });
    }
  }

  return missingFields;
}

export function PractitionerProfileMissingFields({
  profile,
}: PractitionerProfileMissingFieldsProps) {
  const fields = getMissingFields(profile);
  const missingCount = fields.filter((f) => f.status === "missing").length;
  const completeCount = fields.filter((f) => f.status === "complete").length;
  const completionPercent = Math.round((completeCount / fields.length) * 100);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Profile Completion
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {missingCount > 0
                ? `${missingCount} field${missingCount !== 1 ? "s" : ""} needs attention`
                : "All fields are complete"}
            </p>
          </div>
          <Badge
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              completionPercent === 100
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {completionPercent}%
          </Badge>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full transition-all duration-300 ${
            completionPercent === 100 ? "bg-emerald-500" : "bg-amber-500"
          }`}
          style={{ width: `${completionPercent}%` }}
        />
      </div>

      <div className="space-y-2">
        {fields.map((item) => (
          <div
            key={item.field}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
              item.status === "complete"
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            {item.status === "complete" ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            )}
            <span
              className={`text-sm font-medium ${
                item.status === "complete"
                  ? "text-emerald-900"
                  : "text-amber-900"
              }`}
            >
              {item.field}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
