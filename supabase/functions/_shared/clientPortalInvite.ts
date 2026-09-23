const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidInviteEmail(email: string | null | undefined): boolean {
  const trimmed = (email ?? "").trim();
  return trimmed.length > 0 && EMAIL_PATTERN.test(trimmed);
}

export type InviteNameSource = {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};

export function deriveInviteFullName(client: InviteNameSource, email: string): string {
  const personName = [client.first_name, client.last_name].filter(Boolean).join(" ").trim();
  return personName || (client.company_name ?? "").trim() || email.split("@")[0];
}
