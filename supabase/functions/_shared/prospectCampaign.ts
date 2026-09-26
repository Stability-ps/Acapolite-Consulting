// Pure helpers for prospect campaign emails: template variables, rendering
// and the marketing footer. No network access.
//
// Variables are only ever filled with values actually known for the
// prospect. `{{contact_name}}` is never guessed: templates must either
// provide an explicit fallback (`{{contact_name|Good day}}`) or the
// recipient is held back for review.

export const TEMPLATE_VARIABLES = ["company_name", "contact_name", "sector", "city", "province"] as const;
export type TemplateVariable = typeof TEMPLATE_VARIABLES[number];
export type TemplateValues = Partial<Record<TemplateVariable, string | null>>;

const VARIABLE_RE = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/gi;

export function templateVariables(text: string) {
  const found: Array<{ name: string; fallback: string | null }> = [];
  for (const m of text.matchAll(VARIABLE_RE)) found.push({ name: m[1].toLowerCase(), fallback: m[2] !== undefined ? m[2].trim() : null });
  return found;
}

export function unknownVariables(text: string) {
  return [...new Set(templateVariables(text).map((v) => v.name).filter((n) => !(TEMPLATE_VARIABLES as readonly string[]).includes(n)))];
}

export function renderTemplate(text: string, values: TemplateValues): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const rendered = text.replace(VARIABLE_RE, (_all, rawName: string, fallback: string | undefined) => {
    const name = rawName.toLowerCase() as TemplateVariable;
    const value = values[name]?.toString().trim();
    if (value) return value;
    if (fallback !== undefined) return fallback.trim();
    missing.add(name);
    return "";
  });
  return { text: rendered, missing: [...missing] };
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function buildCampaignEmail(params: { body: string; footer: string; unsubscribeUrl: string }) {
  const text = `${params.body.trim()}\n\n--\n${params.footer}\nYou are receiving this because your business contact details are publicly listed. To stop receiving these emails, unsubscribe here: ${params.unsubscribeUrl}\n`;
  const paragraphs = params.body.trim().split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2937;max-width:640px">${paragraphs}` +
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">` +
    `<p style="font-size:12px;color:#6b7280;margin:0 0 6px">${escapeHtml(params.footer)}</p>` +
    `<p style="font-size:12px;color:#6b7280;margin:0">You are receiving this because your business contact details are publicly listed. ` +
    `<a href="${escapeHtml(params.unsubscribeUrl)}" style="color:#6b7280">Unsubscribe</a> to stop receiving these emails.</p></body></html>`;
  return { text, html };
}

/** Provider responses that mean the email was definitely NOT accepted and may be retried. */
export function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}
