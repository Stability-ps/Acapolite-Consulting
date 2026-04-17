import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PractitionerDocumentUpload } from "@/components/dashboard/PractitionerDocumentUpload";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function PractitionerDocumentsUploadPage() {
  const { user, profile } = useAuth();

  if (!user || !profile) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Loading your profile...
          </p>
        </div>
      </div>
    );
  }

  const isPractitioner = profile.role === "consultant";

  if (!isPractitioner) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Access Denied</p>
              <p className="mt-1 text-sm text-red-800">
                This page is only available for practitioner accounts.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="flex items-start gap-4">
          <Link to="/dashboard/staff/profile">
            <Button variant="outline" size="icon" className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-body">
              Your Profile
            </p>
            <h1 className="mt-2 font-display text-3xl text-foreground">
              Verification Documents
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground font-body">
              Upload your verification documents for Acapolite review. All
              required documents must be approved before you can be marked as
              verified and appear in the marketplace.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">
                Upload documents securely
              </p>
              <p className="mt-1 text-sm text-blue-800">
                Your documents are encrypted and only accessible to verified
                Acapolite admin staff. We review everything carefully to ensure
                quality and protect your privacy.
              </p>
            </div>
          </div>
        </div>
      </section>

      <PractitionerDocumentUpload practitionerId={user.id} />

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Upload Guidelines
        </h2>

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="font-semibold text-foreground">
              Accepted File Types
            </h3>
            <p className="mt-1 text-sm text-muted-foreground font-body">
              PDF, JPEG, PNG, or Microsoft Word documents (*.pdf, *.jpg, *.png,
              *.doc, *.docx)
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground">File Size Limit</h3>
            <p className="mt-1 text-sm text-muted-foreground font-body">
              Maximum 10MB per document
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground">Document Quality</h3>
            <p className="mt-1 text-sm text-muted-foreground font-body">
              Ensure documents are legible, not blurry, and show all required
              information. For scanned documents, use at least 300 DPI
              resolution.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground">Review Timeline</h3>
            <p className="mt-1 text-sm text-muted-foreground font-body">
              Admin typically reviews submitted documents within 2-3 business
              days. You'll be notified via email when your documents are
              approved or if adjustments are needed.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground">Next Steps</h3>
            <p className="mt-1 text-sm text-muted-foreground font-body">
              Once all required documents are approved:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground font-body">
              <li>Your banking details will need to be verified separately</li>
              <li>Admin will mark your profile as verified</li>
              <li>You'll appear in the marketplace and can accept leads</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
