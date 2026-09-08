export type TaxCoachRole = "admin" | "consultant" | "client" | null | undefined;

export function canUseTaxCoach(
  role: TaxCoachRole,
  permission: boolean | null | undefined,
) {
  return role === "admin" || (role === "consultant" && permission === true);
}
