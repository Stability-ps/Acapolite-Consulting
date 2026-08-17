export const TAX_COACH_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const TAX_COACH_MAX_ATTACHMENTS = 3;
export const TAX_COACH_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const TAX_COACH_MAX_TOTAL_BYTES = 10 * 1024 * 1024;

export type TaxCoachAttachment = {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
};

export function validateTaxCoachAttachments(value: unknown): value is TaxCoachAttachment[] {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > TAX_COACH_MAX_ATTACHMENTS) return false;

  let totalBytes = 0;
  for (const attachment of value) {
    if (!attachment || typeof attachment !== "object") return false;
    const item = attachment as TaxCoachAttachment;
    if (!item.name || item.name.length > 180) return false;
    if (!TAX_COACH_ATTACHMENT_TYPES.includes(item.mimeType as typeof TAX_COACH_ATTACHMENT_TYPES[number])) return false;
    if (!Number.isInteger(item.size) || item.size < 1 || item.size > TAX_COACH_MAX_FILE_BYTES) return false;
    if (!item.dataUrl.startsWith(`data:${item.mimeType};base64,`)) return false;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(item.dataUrl.split(",", 2)[1] ?? "")) return false;
    totalBytes += item.size;
  }

  return totalBytes <= TAX_COACH_MAX_TOTAL_BYTES;
}

export function buildTaxCoachAttachmentInput(attachments: TaxCoachAttachment[]) {
  return attachments.map((attachment) => (
    attachment.mimeType.startsWith("image/")
      ? { type: "input_image" as const, image_url: attachment.dataUrl, detail: "high" as const }
      : { type: "input_file" as const, filename: attachment.name, file_data: attachment.dataUrl }
  ));
}
