type ClientRiskSource = {
  client_type?: string | null;
  company_registration_number?: string | null;
  id_number?: string | null;
  sars_outstanding_debt?: number | string | null;
  returns_filed?: boolean | null;
};

type ClientRiskCounts = {
  outstandingInvoices?: number;
  outstandingDocumentRequests?: number;
};

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export const CLIENT_TYPE_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "company", label: "Company / Business" },
  { value: "trust", label: "Trust" },
  { value: "npo_organisation", label: "NPO / Organisation" },
] as const;

export type ClientTypeValue = (typeof CLIENT_TYPE_OPTIONS)[number]["value"];

export function isOrganisationClientType(clientType?: string | null) {
  return (
    clientType === "company" ||
    clientType === "trust" ||
    clientType === "npo_organisation"
  );
}

export function getClientTypeLabel(clientType?: string | null) {
  switch (clientType) {
    case "company":
      return "Company / Business";
    case "trust":
      return "Trust";
    case "npo_organisation":
      return "NPO / Organisation";
    default:
      return "Individual";
  }
}

export function getClientIdentityLabel(client: ClientRiskSource) {
  if (client.client_type === "company") {
    return client.company_registration_number || "Not provided";
  }

  if (client.client_type === "trust" || client.client_type === "npo_organisation") {
    return client.company_registration_number || "Not provided";
  }

  return client.id_number || "Not provided";
}

export function getClientIdentityFieldLabel(clientType?: string | null) {
  if (clientType === "company") {
    return "Company Registration Number";
  }

  if (clientType === "trust") {
    return "Trust Reference Number";
  }

  if (clientType === "npo_organisation") {
    return "Organisation Reference Number";
  }

  return "ID Number";
}

export function getClientWarningSummary(client: ClientRiskSource, counts: ClientRiskCounts = {}) {
  const outstandingInvoices = counts.outstandingInvoices ?? 0;
  const outstandingDocumentRequests = counts.outstandingDocumentRequests ?? 0;
  const debtAmount = Number(client.sars_outstanding_debt ?? 0);
  const reasons: string[] = [];

  if (debtAmount > 0) {
    reasons.push("SARS debt outstanding");
  }

  if (client.returns_filed === false) {
    reasons.push("Returns not filed");
  }

  if (outstandingInvoices > 0) {
    reasons.push(`${pluralize(outstandingInvoices, "invoice", "invoices")} outstanding`);
  }

  if (outstandingDocumentRequests > 0) {
    reasons.push(`${pluralize(outstandingDocumentRequests, "document request", "document requests")} outstanding`);
  }

  return {
    debtAmount,
    reasons,
    issueCount: reasons.length,
    hasIssues: reasons.length > 0,
    outstandingInvoices,
    outstandingDocumentRequests,
  };
}
