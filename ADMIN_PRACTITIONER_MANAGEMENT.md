# Admin Practitioner Management System

## Overview

The admin practitioner management system enables staff members (admins) to completely manage practitioner profiles, documents, and verification status. This is critical for onboarding practitioners who send information via email or other channels instead of using the platform directly.

## Features

### 1. **View Missing Profile Fields** ✓

Admins can see at a glance which profile fields are missing or incomplete for each practitioner.

**Implementation**: `PractitionerProfileMissingFields` component

- Shows visual progress bar with completion percentage
- Lists all required and optional fields with status indicators
- Fields tracked:
  - Business Name
  - Registration Number
  - Services Offered
  - Years of Experience
  - Availability Status
  - Banking Information
  - VAT Number

**Location**: Appears in the practitioner edit dialog in AdminUsers.tsx

**Visual Indicators**:

- Green checkmark for complete fields
- Amber alert icon for missing fields
- Progress bar (green when 100%, amber otherwise)

### 2. **Edit Practitioner Full Profile** ✓

Admins can edit any practitioner profile field through a comprehensive form.

**Implementation**: Uses existing `PractitionerProfileFields` component

- All profile fields editable by admin
- Supports updating:
  - Business name and registration number
  - Services offered (multi-select)
  - Availability status
  - Years of experience
  - Banking information (account holder, bank, account number, branch, type)
  - VAT number
  - Internal notes

**Location**: In the practitioner edit dialog, below missing fields indicator

**Data Persistence**: Changes saved to `practitioner_profiles` table

### 3. **Admin Document Upload** ✓

Admins can upload documents on behalf of practitioners who submit via email.

**Implementation**: Enhanced `PractitionerDocumentsSection` component with admin upload UI

- Separate admin upload section (blue background to distinguish from review section)
- Two categories:
  - **Required Documents** (4 docs):
    - ID Copy
    - Tax Registration Certificate
    - Proof of Address
    - Bank Confirmation Letter
  - **Optional Documents** (5 docs):
    - Professional Body Membership
    - Company Registration
    - VAT Number Proof
    - Profile Photo
    - CV/Professional Summary

**File Validation**:

- Allowed types: PDF, JPEG, PNG, DOC, DOCX
- Max file size: 10MB
- Real-time error messages for invalid files

**Upload Flow**:

1. Admin selects file for a document type
2. File validation occurs client-side
3. File uploaded to storage bucket (`documents/practitioner-verifications/{id}/{type}`)
4. Document record created in `practitioner_verification_documents` table
5. Status set to `pending_review` (admin can approve after review)
6. Admin notes added: "Uploaded by admin on behalf of practitioner"

**Location**: In the practitioner edit dialog, below missing fields component

**Visual Indicators**:

- Blue background to distinguish from practitioner-facing upload
- Separate grids for required and optional documents
- Loading state with spinner during upload
- Success/error toasts for feedback

### 4. **Document Status Management** ✓

Admins can review, approve, reject, and track document status.

**Implementation**: `PractitionerDocumentsSection` with admin review capabilities

- Three tabs for document organization:
  - **Pending Review**: Documents awaiting admin action
  - **Approved**: Accepted documents (green badge)
  - **Rejected**: Documents sent back (red badge)

**Document Card Actions** (for pending docs):

- **Approve Button**: Marks document as approved, records review timestamp and reviewer ID
- **Reject Button**: Triggers rejection workflow
  - Admin must provide rejection reason (textarea)
  - Reason stored in database
  - Practitioner sees rejection reason in their upload interface
  - Confirmation required before rejecting

**Admin Notes & Tracking**:

- Rejection reason stored in `rejection_reason` column
- Admin notes in `admin_notes` column
- Reviewed timestamp (`reviewed_at`)
- Reviewer ID (`reviewed_by`) - automatically captured

**Required Documents Progress**:

- Checklist showing all required documents
- Visual indicators: ✓ Approved, ✗ Rejected, ⏱ Pending
- Updates in real-time as documents are reviewed

### 5. **Verification Status Control** ✓

Admins can mark practitioners as verified or unverified.

**Implementation**: New verification status section in practitioner edit dialog

- **Status Badge**:
  - Green with checkmark when verified
  - Amber with alert when not verified
- **Toggle Button**:
  - "Mark as Verified" (emerald) when not verified
  - "Mark as Unverified" (red) when verified
  - Disabled state during save operation

**Verification Requirements** (enforced by database trigger):

1. All required documents must be approved:
   - ID Copy
   - Tax Registration Certificate
   - Proof of Address
   - Bank Confirmation Letter
2. All required profile fields must be complete:
   - Tax Practitioner Number
   - Business Name
   - Registration Number
   - Services Offered
   - Years of Experience

**Blocking Logic**:

- Attempts to verify without approved docs fail with error message:
  "All required verification documents must be approved by admin before marking practitioner as verified."
- Verification can only succeed if both documents AND profile requirements are met

**Location**: Emerald-tinted box in practitioner edit dialog, immediately after profile intro

### 6. **Complete Profile on Behalf of Practitioner** ✓

Admins can fill in all missing profile fields directly.

**Implementation**: Full edit capability through `PractitionerProfileFields`

- All fields editable without restriction
- Admins can:
  - Enter business details from email communications
  - Add tax practitioner numbers from documents
  - Set availability status
  - Select services offered
  - Add banking information
  - Input VAT number

**Workflow Example**:

1. Practitioner emails: "Here's my tax ID 12345, business is John's Tax Services"
2. Admin edits profile fields:
   - Sets Business Name: "John's Tax Services"
   - Sets Registration Number: "12345"
   - Selects Services Offered: [Tax Compliance, Tax Planning]
   - Sets Availability: "Available"
3. Admin uploads documents from email attachments using admin upload section
4. Admin reviews and approves documents
5. Admin clicks "Mark as Verified" once all requirements met

## File Structure

### New Components Created

- `src/components/dashboard/PractitionerProfileMissingFields.tsx`
  - Shows profile completion status with visual indicators
  - Tracks 7 key profile fields
  - Calculates completion percentage

### Modified Components

- `src/components/dashboard/PractitionerDocumentsSection.tsx`
  - Added: `handleAdminFileSelect()` function
  - Added: `uploadAdminDocument()` function
  - Added: Admin file upload UI section (blue background)
  - Added: File input state management (`selectedAdminFiles`, `uploadingFiles`)
  - Added: OPTIONAL_DOCUMENT_TYPES and MAX_FILE_SIZE constants
  - Enhanced: Support for admin upload capability alongside existing review features

### Modified Pages

- `src/pages/dashboard/admin/AdminUsers.tsx`
  - Added: Import for `PractitionerProfileMissingFields`
  - Added: New verification status section with toggle button
  - Added: `PractitionerProfileMissingFields` component in edit dialog
  - Enhanced: Verification status management with button and badge

## Database Schema

### Table: `practitioner_verification_documents`

Used for all document tracking:

```sql
- id (uuid) - Primary key
- practitioner_profile_id (uuid) - FK to practitioner_profiles
- document_type (enum) - Type of document
- display_name (text) - User-friendly name
- file_path (text) - Storage bucket path
- file_size (bigint) - Size in bytes
- mime_type (text) - MIME type
- status (enum) - pending_review | approved | rejected
- uploaded_at (timestamptz) - Upload time
- reviewed_at (timestamptz) - Review completion time
- reviewed_by (uuid) - FK to admin who reviewed
- rejection_reason (text) - If rejected, why
- admin_notes (text) - Admin-specific notes
- is_required (boolean) - Whether document is required
```

### Table: `practitioner_profiles`

Updated columns:

- `is_verified (boolean)` - Verification status controlled by admin button
- `banking_verification_status` - Separate banking verification tracking

### Views & Functions

- `practitioner_document_summary` - Aggregates document counts by status
- `practitioner_has_all_required_documents_approved()` - Checks if all required docs approved
- `ensure_practitioner_verification_documents()` - Trigger enforcing verification requirements

## Security & Permissions

### RLS Policies (Row Level Security)

- **Staff/Admin**: Can view, create, update all documents in their workspace
- **Practitioners**: Can only view their own documents
- **Admin Actions**: All document uploads logged with `reviewed_by` field

### Role-Based Access

- Only users with "admin" role can:
  - Mark practitioners as verified/unverified
  - Upload documents on behalf of practitioners
  - Approve/reject documents
  - Edit practitioner profiles

## User Workflows

### Workflow 1: Email-Based Practitioner Onboarding

1. Practitioner emails admin: "Here's my info and documents"
2. Admin opens AdminUsers page
3. Admin selects practitioner from staff list
4. Admin clicks edit button
5. Admin reviews missing fields section
6. Admin fills in any missing profile info
7. Admin scrolls to "Admin Document Upload" section
8. Admin uploads each document from email attachments
9. Admin reviews each document in tabs below
10. Admin approves documents
11. Admin clicks "Mark as Verified"
12. Practitioner is now active and can accept leads

### Workflow 2: Fixing Rejected Documents

1. Admin rejects a document with reason: "Photo is blurry, needs clearer image"
2. System sends notification to practitioner
3. Practitioner logs in, sees rejection reason
4. Practitioner re-uploads clearer photo
5. Admin reviews new photo
6. Admin approves it
7. Once all required docs approved, practitioner can be verified

### Workflow 3: Profile Updates

1. Admin is managing a practitioner
2. Admin sees missing "Services Offered" in profile completion
3. Admin scrolls to Profile section
4. Admin checks boxes for services practitioner provides
5. Admin saves profile
6. Missing fields component updates to show services as complete

## Error Handling

### File Upload Errors

- File too large: "File size must be less than 10MB"
- Invalid file type: "File type not allowed. Please upload PDF, image, or document files."
- Storage upload fails: "Upload failed: [storage error]"
- Database insert fails: File is automatically deleted from storage

### Verification Errors

- Missing documents: "All required verification documents must be approved by admin before marking practitioner as verified."
- Missing profile fields: Database trigger prevents verification with incomplete required fields
- Rejection without reason: "Please provide a rejection reason"

## UI/UX Considerations

### Visual Hierarchy

- **Verification Status**: Green emerald box - immediately visible and important
- **Missing Fields**: Amber/emerald progress indicators - helps prioritize work
- **Document Upload**: Blue background - distinguishes admin action from practitioner view
- **Document Review**: Tabs organize by status - pending docs at top

### Color Coding

- **Green**: Complete/Verified status
- **Amber**: Missing/Pending/Warning status
- **Red**: Rejected/Destructive actions
- **Blue**: Admin-specific actions

### Accessibility

- All inputs have labels
- Status indicators use icons + text (not just color)
- Buttons have clear action labels
- Progress bars have percentage text
- File inputs have accept filters for file types

## Performance Considerations

### Query Optimization

- `PractitionerDocumentsSection` uses single query with order by
- `PractitionerProfileMissingFields` does no database queries (computed from existing profile object)
- Document status updates use single row update

### Client-Side Validation

- File type/size checked before upload attempt
- Reduces server load and provides instant feedback

### Real-Time Updates

- After document upload/review, query client cache invalidated
- `quickRefreshStaffBoard()` refreshes staff list stats
- `onDocumentsChange()` callback notifies parent of changes

## Testing Recommendations

### Unit Tests

- `PractitionerProfileMissingFields` - verify correct field status calculation
- Document validation - test all file type and size combinations
- Missing fields calculation - test with various profile states

### Integration Tests

- Admin upload → database record → document visible in tabs
- Admin approval → status updates → verification button enabled
- Profile edit → missing fields component updates
- Verification toggle → database update → UI reflects change

### Manual Testing Checklist

- [ ] Upload all document types (required and optional)
- [ ] Reject document with reason, verify practitioner sees it
- [ ] Edit each profile field
- [ ] Attempt verification without all required docs (should fail)
- [ ] Attempt verification with all required docs (should succeed)
- [ ] Toggle verification on/off
- [ ] Check profile completion percentage updates
- [ ] Test file validation (too large, wrong type)
- [ ] Test with no practitioner selected (error message shown)

## Future Enhancements

### Potential Improvements

1. **Bulk Document Upload**: ZIP file support for multiple documents
2. **Document Templates**: Pre-filled forms for common documents
3. **Automated Verification**: Auto-approve certain document types
4. **Audit Trail**: Full history of all document actions
5. **Notification System**: Auto-notify practitioners of rejections
6. **Document Expiry**: Track and alert on expiring documents
7. **Compliance Reports**: Generate verification compliance reports
8. **Integration**: Pull documents from email/cloud storage automatically

## Summary

This admin practitioner management system provides complete control over:

- ✅ Profile completion tracking (missing fields visible)
- ✅ Direct profile editing (fill any field for any practitioner)
- ✅ Document uploads on behalf (email-based documents)
- ✅ Document review workflow (approve/reject with reasons)
- ✅ Verification control (mark verified/unverified)

All features work together to enable efficient onboarding of practitioners who prefer email communication while maintaining security, auditability, and compliance requirements.
