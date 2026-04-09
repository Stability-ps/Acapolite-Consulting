import type { Enums } from "@/integrations/supabase/types";

export const practitionerAvailabilityOptions: Array<{
  value: Enums<"practitioner_availability_status">;
  label: string;
}> = [
  { value: "available", label: "Available" },
  { value: "limited", label: "Limited" },
  { value: "not_available", label: "Not Available" },
];

export function formatAvailabilityLabel(value?: string | null) {
  return (value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getAvailabilityBadgeClass(value?: string | null) {
  switch (value) {
    case "available":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "limited":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

export function getResponseStatusClass(value?: string | null) {
  switch (value) {
    case "selected":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "declined":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "withdrawn":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700";
  }
}

export function getAssignmentTypeLabel(value?: string | null) {
  return (value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeServicesOffered(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function getWorkloadLabel(count: number) {
  if (count <= 2) return "Light";
  if (count <= 5) return "Moderate";
  return "Busy";
}
