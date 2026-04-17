/**
 * Utility functions for practitioner verification documents
 */

export const PRACTITIONER_DOCUMENT_TYPES = {
    ID_COPY: "id_copy",
    TAX_REGISTRATION_CERTIFICATE: "tax_registration_certificate",
    PROOF_OF_ADDRESS: "proof_of_address",
    BANK_CONFIRMATION_LETTER: "bank_confirmation_letter",
    PROFESSIONAL_BODY_MEMBERSHIP: "professional_body_membership",
    COMPANY_REGISTRATION: "company_registration",
    VAT_NUMBER_PROOF: "vat_number_proof",
    PROFILE_PHOTO: "profile_photo",
    CV_PROFESSIONAL_SUMMARY: "cv_professional_summary",
    OTHER: "other",
} as const;

export const REQUIRED_DOCUMENT_TYPES = [
    PRACTITIONER_DOCUMENT_TYPES.ID_COPY,
    PRACTITIONER_DOCUMENT_TYPES.TAX_REGISTRATION_CERTIFICATE,
    PRACTITIONER_DOCUMENT_TYPES.PROOF_OF_ADDRESS,
    PRACTITIONER_DOCUMENT_TYPES.BANK_CONFIRMATION_LETTER,
];

export const OPTIONAL_DOCUMENT_TYPES = [
    PRACTITIONER_DOCUMENT_TYPES.PROFESSIONAL_BODY_MEMBERSHIP,
    PRACTITIONER_DOCUMENT_TYPES.COMPANY_REGISTRATION,
    PRACTITIONER_DOCUMENT_TYPES.VAT_NUMBER_PROOF,
    PRACTITIONER_DOCUMENT_TYPES.PROFILE_PHOTO,
    PRACTITIONER_DOCUMENT_TYPES.CV_PROFESSIONAL_SUMMARY,
];

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
    [PRACTITIONER_DOCUMENT_TYPES.ID_COPY]: "ID Copy",
    [PRACTITIONER_DOCUMENT_TYPES.TAX_REGISTRATION_CERTIFICATE]:
        "Tax Practitioner Registration Certificate",
    [PRACTITIONER_DOCUMENT_TYPES.PROOF_OF_ADDRESS]: "Proof of Address",
    [PRACTITIONER_DOCUMENT_TYPES.BANK_CONFIRMATION_LETTER]:
        "Bank Confirmation Letter",
    [PRACTITIONER_DOCUMENT_TYPES.PROFESSIONAL_BODY_MEMBERSHIP]:
        "Professional Body Membership Certificate",
    [PRACTITIONER_DOCUMENT_TYPES.COMPANY_REGISTRATION]:
        "Company Registration Documents",
    [PRACTITIONER_DOCUMENT_TYPES.VAT_NUMBER_PROOF]: "VAT Number Proof",
    [PRACTITIONER_DOCUMENT_TYPES.PROFILE_PHOTO]: "Profile Photo",
    [PRACTITIONER_DOCUMENT_TYPES.CV_PROFESSIONAL_SUMMARY]:
        "CV / Professional Summary",
    [PRACTITIONER_DOCUMENT_TYPES.OTHER]: "Other Document",
};

export type DocumentStatus =
    | "pending_review"
    | "approved"
    | "rejected";

export interface DocumentSummary {
    total_required_docs: number | null;
    approved_required_docs: number | null;
    rejected_required_docs: number | null;
    pending_required_docs: number | null;
    total_optional_docs: number | null;
    approved_optional_docs: number | null;
    total_rejected_docs: number | null;
    total_pending_docs: number | null;
}

export function getDocumentStatusLabel(status: DocumentStatus): string {
    const labels: Record<DocumentStatus, string> = {
        pending_review: "Pending Review",
        approved: "Approved",
        rejected: "Rejected",
    };
    return labels[status] || status;
}

export function getDocumentStatusBadgeClass(status: DocumentStatus): string {
    switch (status) {
        case "approved":
            return "bg-emerald-100 text-emerald-700 border-emerald-300";
        case "rejected":
            return "bg-red-100 text-red-700 border-red-300";
        case "pending_review":
            return "bg-amber-100 text-amber-700 border-amber-300";
        default:
            return "bg-gray-100 text-gray-700 border-gray-300";
    }
}

export function isPractitionerDocumentsReady(
    summary?: DocumentSummary | null
): boolean {
    if (!summary || !summary.total_required_docs) {
        return false;
    }

    return (
        summary.approved_required_docs === summary.total_required_docs &&
        (summary.rejected_required_docs ?? 0) === 0
    );
}

export function getPractitionerDocumentsStatus(
    summary?: DocumentSummary | null
): {
    status: string;
    label: string;
    ready: boolean;
    description: string;
} {
    if (!summary || !summary.total_required_docs) {
        return {
            status: "no_documents",
            label: "No documents uploaded",
            ready: false,
            description: "Practitioner must upload required verification documents",
        };
    }

    if ((summary.rejected_required_docs ?? 0) > 0) {
        return {
            status: "has_rejected",
            label: `${summary.rejected_required_docs} required document(s) rejected`,
            ready: false,
            description:
                "Practitioner needs to address rejected documents and resubmit",
        };
    }

    if (
        summary.approved_required_docs === summary.total_required_docs &&
        (summary.rejected_required_docs ?? 0) === 0
    ) {
        return {
            status: "all_approved",
            label: "All required documents approved",
            ready: true,
            description: "Ready for practitioner verification",
        };
    }

    if ((summary.pending_required_docs ?? 0) > 0) {
        return {
            status: "pending_review",
            label: `${summary.pending_required_docs} required document(s) pending admin review`,
            ready: false,
            description: "Admin must review and approve pending documents",
        };
    }

    return {
        status: "incomplete",
        label: `${summary.approved_required_docs ?? 0} of ${summary.total_required_docs} required documents approved`,
        ready: false,
        description: "Pending documents need to be uploaded and approved",
    };
}

export function formatFileSize(bytes?: number | null): string {
    if (!bytes) return "Unknown size";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}
