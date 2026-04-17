# Practitioner Verification Documents System

## Overview

This system provides comprehensive document management for practitioner verification in Acapolite. Admin users can review, approve, and reject verification documents with detailed feedback.

## Key Features

### 1. **Document Types**

- **Required Documents** (must be approved for verification):
  - ID Copy
  - Tax Practitioner Registration Certificate
  - Proof of Address
  - Bank Confirmation Letter

- **Optional Documents** (improve profile quality):
  - Professional Body Membership Certificate
  - Company Registration Documents
  - VAT Number Proof
  - Profile Photo
  - CV / Professional Summary

### 2. **Document Statuses**

- **Pending Review**: Awaiting admin review
- **Approved**: Document accepted, practitioner can proceed
- **Rejected**: Document needs correction/resubmission with reason provided

### 3. **Admin Capabilities**

- **Document Review Panel** in AdminUsers.tsx → Practitioner Profile
- **Approve Documents**: Mark as verified for verification requirements
- **Reject Documents**: Include rejection reason for practitioner guidance
- **Document Organization**: Separate tabs for Pending, Approved, Rejected
- **Required Documents Checklist**: Visual progress on required docs
- **Download/View**: Access document files for verification

### 4. **Practitioner Restrictions**

- **Cannot be marked as verified** until:
  - All required banking details are approved (banking_verification_status = 'verified')
  - All required documents are approved
- **Rejected documents** remain visible in Rejected tab with rejection reason
- **Automatic blocking** prevents verification attempts without complete documents

### 5. **Database Components**

#### New Table: `practitioner_verification_documents`

```sql
- id: UUID (primary key)
- practitioner_profile_id: UUID (foreign key to practitioner_profiles)
- document_type: enum (id_copy, tax_registration_certificate, etc.)
- display_name: text
- file_path: text (unique, storage path)
- file_size: bigint (optional)
- mime_type: text (optional)
- status: enum (pending_review, approved, rejected)
- uploaded_at: timestamptz
- reviewed_at: timestamptz (when admin reviewed)
- reviewed_by: UUID (admin who reviewed)
- rejection_reason: text (why document was rejected)
- admin_notes: text (additional admin comments)
- is_required: boolean (flags if document is required)
```

#### New View: `practitioner_document_summary`

Provides aggregated document status for each practitioner:

- total_required_docs
- approved_required_docs
- rejected_required_docs
- pending_required_docs
- total_optional_docs
- approved_optional_docs
- total_rejected_docs
- total_pending_docs

#### Helper Function

`practitioner_has_all_required_documents_approved(practitioner_id)` - Returns true if all required documents are approved

### 6. **UI Components**

#### `PractitionerDocumentsSection` Component

Location: `src/components/dashboard/PractitionerDocumentsSection.tsx`

Props:

- `practitionerId`: The UUID of the practitioner
- `isAdmin`: Whether to show admin actions
- `onDocumentsChange`: Callback when documents are updated

Features:

- Required documents checklist
- Tab-based organization (Pending/Approved/Rejected)
- Document card display with metadata
- Admin approve/reject buttons
- Rejection reason input
- Download/view document buttons

#### Integration in AdminUsers

- Shows document section in practitioner profile dialog
- Blocks "Verify Practitioner" button until docs are ready
- Shows warning messages for document requirements

### 7. **Utility Functions**

Location: `src/lib/practitionerDocuments.ts`

Key functions:

- `getDocumentStatusLabel()` - Human-readable status
- `getDocumentStatusBadgeClass()` - CSS classes for status badges
- `isPractitionerDocumentsReady()` - Check if all required docs approved
- `getPractitionerDocumentsStatus()` - Get detailed status info
- `formatFileSize()` - Format bytes to human-readable size

### 8. **Migrations**

1. **20260417140000_add_practitioner_verification_documents.sql**
   - Creates practitioner_verification_documents table
   - Creates enums (practitioner_document_type, practitioner_document_status)
   - Sets up RLS policies
   - Creates helper function and view

2. **20260417141000_populate_practitioner_verification_documents.sql**
   - Migrates existing document paths from practitioner_profiles
   - Creates document records for existing practitioners
   - Maps verification_status to document statuses

### 9. **Row-Level Security (RLS)**

- Admins/staff can view all documents
- Practitioners can view their own documents
- Only admins can create/update/delete documents

### 10. **Workflow**

```
Practitioner Registration/Upload
    ↓
Documents stored in practitioner_verification_documents
    ↓
Admin review in AdminUsers → Practitioner Profile
    ↓
Admin approves/rejects documents
    ↓
If rejected: Practitioner sees reason, can reupload
    ↓
When all required docs approved:
    ↓
Admin can mark practitioner as verified
    ↓
Practitioner appears in marketplace
```

## Implementation Checklist

- [x] Database migrations created
- [x] React components built
- [x] Integration in AdminUsers.tsx
- [x] Verification blocking logic added
- [x] Utility functions created
- [x] RLS policies configured
- [x] Document status tracking
- [x] Rejection reason system

## Future Enhancements

1. Document upload UI for practitioners
2. Email notifications when documents rejected
3. Document versioning (track resubmissions)
4. Bulk document operations
5. Document templates/requirements page
6. Automated document validation (e.g., file type checking)
7. Document expiration/renewal reminders
8. Document storage cleanup policies

## Related Features

- **Banking Verification**: Separate system for bank account verification
- **Practitioner Verification**: Overall practitioner verification status
- **Admin Documents**: General document management page
- **Notifications**: Email/in-app alerts for document actions

## Troubleshooting

### Issue: "All required documents must be approved before marking practitioner as verified"

**Solution**: Ensure all required documents in the Pending tab have been approved before attempting to verify.

### Issue: Documents not appearing

**Solution**: Check if the practitioner has actually uploaded documents to the storage bucket. Verify practitioner_profile_id matches.

### Issue: RLS permission denied

**Solution**: Ensure user is admin role. Check RLS policies if attempting to access documents from non-admin account.
