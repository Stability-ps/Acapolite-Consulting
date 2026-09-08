import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import type { Tables } from "@/integrations/supabase/types";

export type CorrespondenceStatus = Tables<"case_correspondence">["status"];

export const CORRESPONDENCE_TYPES = [
  "General SARS correspondence",
  "Audit response",
  "Verification response",
  "Request for Relevant Material response",
  "Supporting document cover letter",
  "Objection motivation",
  "Objection cover letter",
  "Appeal motivation",
  "ADR correspondence",
  "Suspension of payment request",
  "Payment arrangement request",
  "Compromise motivation",
  "Request for reasons",
  "Remission request",
  "Penalty remission correspondence",
  "Interest correspondence",
  "Extension request",
  "Compliance status correspondence",
  "VAT correspondence",
  "PAYE correspondence",
  "Income Tax correspondence",
  "Corporate Income Tax correspondence",
  "SARS follow-up",
  "Escalation",
  "Arrangement/default explanation",
  "Payment notification",
  "Withdrawal request",
  "Practitioner cover letter",
  "Other / custom",
] as const;

export const CORRESPONDENCE_PURPOSES = [
  "Respond",
  "Request",
  "Motivate",
  "Object",
  "Appeal",
  "Follow Up",
  "Escalate",
  "Submit Evidence",
  "Request Extension",
  "Request Suspension",
  "Request Arrangement",
  "Request Compromise",
] as const;

export const CORRESPONDENCE_TONES = [
  { value: "formal", label: "Formal" },
  { value: "concise", label: "Concise" },
  { value: "detailed", label: "Detailed" },
  { value: "firm", label: "Firm" },
  { value: "cooperative", label: "Cooperative" },
  { value: "urgent", label: "Urgent" },
] as const;

export const CORRESPONDENCE_STATUS_LABELS: Record<CorrespondenceStatus, string> = {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  sent: "Sent",
  superseded: "Superseded",
  archived: "Archived",
};

export function getCorrespondenceStatusBadgeClass(status: CorrespondenceStatus): string {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "sent":
      return "bg-blue-100 text-blue-700 border-blue-300";
    case "under_review":
      return "bg-amber-100 text-amber-700 border-amber-300";
    case "superseded":
      return "bg-orange-100 text-orange-700 border-orange-300";
    case "archived":
      return "bg-gray-200 text-gray-600 border-gray-300";
    default:
      return "bg-slate-100 text-slate-600 border-slate-300";
  }
}

export type ExportableCorrespondence = {
  correspondenceType: string;
  subject?: string | null;
  recipient?: string | null;
  sarsReference?: string | null;
  taxType?: string | null;
  taxPeriod?: string | null;
  body: string;
  annexureManifest?: Array<{ letter: string; label: string }> | null;
  practitionerName?: string | null;
  practitionerDesignation?: string | null;
  clientLegalName?: string | null;
};

function letterFileNameBase(data: ExportableCorrespondence) {
  const safeType = data.correspondenceType.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return `sars-${safeType}-${new Date().toISOString().slice(0, 10)}`;
}

export async function exportCorrespondenceDocx(data: ExportableCorrespondence) {
  const bodyParagraphs = data.body
    .split(/\n{1,}/)
    .filter((line) => line.trim().length > 0)
    .map((line) => new Paragraph({ children: [new TextRun(line.trim())], spacing: { after: 200 } }));

  const referenceLines = [
    data.sarsReference ? `SARS Reference: ${data.sarsReference}` : null,
    data.taxType ? `Tax Type: ${data.taxType}` : null,
    data.taxPeriod ? `Tax Period: ${data.taxPeriod}` : null,
  ].filter((line): line is string => Boolean(line));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "ACAPOLITE CONSULTING", bold: true, size: 32 })],
          spacing: { after: 100 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Tax, Accounting, SARS & Business Support", size: 20, italics: true })],
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [new TextRun(new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" }))],
          spacing: { after: 200 },
        }),
        data.recipient ? new Paragraph({ children: [new TextRun({ text: data.recipient, bold: true })], spacing: { after: 200 } }) : null,
        data.subject ? new Paragraph({ children: [new TextRun({ text: `Re: ${data.subject}`, bold: true })], spacing: { after: 100 } }) : null,
        ...referenceLines.map((line) => new Paragraph({ children: [new TextRun(line)], spacing: { after: 100 } })),
        new Paragraph({ text: "", spacing: { after: 200 } }),
        ...bodyParagraphs,
        new Paragraph({ text: "", spacing: { after: 300 } }),
        new Paragraph({ children: [new TextRun("Yours faithfully,")], spacing: { after: 400 } }),
        data.practitionerName ? new Paragraph({ children: [new TextRun({ text: data.practitionerName, bold: true })] }) : null,
        data.practitionerDesignation ? new Paragraph({ children: [new TextRun(data.practitionerDesignation)] }) : null,
        new Paragraph({ children: [new TextRun("Acapolite Consulting")], spacing: { after: 300 } }),
        ...(data.annexureManifest && data.annexureManifest.length > 0
          ? [
              new Paragraph({ children: [new TextRun({ text: "Annexure Schedule", bold: true })], spacing: { before: 300, after: 150 } }),
              ...data.annexureManifest.map((a) => new Paragraph({ children: [new TextRun(`Annexure ${a.letter} - ${a.label}`)], spacing: { after: 80 } })),
            ]
          : []),
      ].filter((child): child is Paragraph => child !== null),
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${letterFileNameBase(data)}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function exportCorrespondencePdf(data: ExportableCorrespondence) {
  const { default: html2pdf } = await import("html2pdf.js");

  const bodyHtml = data.body
    .split(/\n{1,}/)
    .filter((line) => line.trim().length > 0)
    .map((line) => `<p style="margin:0 0 12px 0;">${escapeHtml(line.trim())}</p>`)
    .join("");

  const annexureHtml = data.annexureManifest && data.annexureManifest.length > 0
    ? `<div style="margin-top:24px;"><strong>Annexure Schedule</strong>${data.annexureManifest.map((a) => `<p style="margin:6px 0 0 0;">Annexure ${a.letter} - ${escapeHtml(a.label)}</p>`).join("")}</div>`
    : "";

  const container = document.createElement("div");
  container.style.fontFamily = "Georgia, 'Times New Roman', serif";
  container.style.fontSize = "12pt";
  container.style.lineHeight = "1.5";
  container.style.padding = "40px";
  container.innerHTML = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:18pt;font-weight:bold;">ACAPOLITE CONSULTING</div>
      <div style="font-size:10pt;font-style:italic;">Tax, Accounting, SARS &amp; Business Support</div>
    </div>
    <p>${new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}</p>
    ${data.recipient ? `<p style="font-weight:bold;">${escapeHtml(data.recipient)}</p>` : ""}
    ${data.subject ? `<p style="font-weight:bold;">Re: ${escapeHtml(data.subject)}</p>` : ""}
    ${data.sarsReference ? `<p>SARS Reference: ${escapeHtml(data.sarsReference)}</p>` : ""}
    ${data.taxType ? `<p>Tax Type: ${escapeHtml(data.taxType)}</p>` : ""}
    ${data.taxPeriod ? `<p>Tax Period: ${escapeHtml(data.taxPeriod)}</p>` : ""}
    <div style="margin-top:20px;">${bodyHtml}</div>
    <p style="margin-top:24px;">Yours faithfully,</p>
    ${data.practitionerName ? `<p style="font-weight:bold;margin:20px 0 0 0;">${escapeHtml(data.practitionerName)}</p>` : ""}
    ${data.practitionerDesignation ? `<p style="margin:0;">${escapeHtml(data.practitionerDesignation)}</p>` : ""}
    <p>Acapolite Consulting</p>
    ${annexureHtml}
  `;

  await html2pdf().set({
    margin: 15,
    filename: `${letterFileNameBase(data)}.pdf`,
    html2canvas: { scale: 2 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  }).from(container).save();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
