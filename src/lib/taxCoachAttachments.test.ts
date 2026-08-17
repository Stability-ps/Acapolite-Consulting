import { describe, expect, it } from "vitest";
import {
  buildTaxCoachAttachmentInput,
  validateTaxCoachAttachments,
} from "../../supabase/functions/_shared/taxCoachAttachments";

const pdf = {
  name: "sars-notice.pdf",
  mimeType: "application/pdf",
  size: 12,
  dataUrl: "data:application/pdf;base64,JVBERg==",
};

describe("Tax Coach attachments", () => {
  it("accepts valid PDFs and images", () => {
    expect(validateTaxCoachAttachments([pdf])).toBe(true);
    expect(validateTaxCoachAttachments([{ ...pdf, name: "scan.png", mimeType: "image/png", dataUrl: "data:image/png;base64,iVBORw==" }])).toBe(true);
  });

  it("rejects unsupported files, oversize files and excessive counts", () => {
    expect(validateTaxCoachAttachments([{ ...pdf, mimeType: "text/html", dataUrl: "data:text/html;base64,PGgxPg==" }])).toBe(false);
    expect(validateTaxCoachAttachments([{ ...pdf, size: 5 * 1024 * 1024 }])).toBe(false);
    expect(validateTaxCoachAttachments([pdf, pdf, pdf, pdf])).toBe(false);
  });

  it("maps images to vision input and PDFs to file input", () => {
    expect(buildTaxCoachAttachmentInput([pdf])[0]).toMatchObject({ type: "input_file", filename: "sars-notice.pdf" });
    expect(buildTaxCoachAttachmentInput([{ ...pdf, mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,/9j/" }])[0]).toMatchObject({ type: "input_image", detail: "high" });
  });
});
