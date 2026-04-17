# Admin Quick Reference: Managing Practitioners

## Accessing Practitioner Management

1. Go to **Staff** → **Users** (admin only)
2. Find practitioner in the users list
3. Click **Edit** icon to open practitioner editor
4. All tools are in the practitioner edit dialog

## What You'll See

### Section 1: Profile Completion Status

**Purpose**: Quick visual overview of what's missing

- **Progress Bar**: Shows % complete (green when 100%, amber otherwise)
- **Field Checklist**: Lists each field with status
  - ✓ Green checkmark = Complete
  - ⚠ Amber alert = Missing/Incomplete
- **Status Update**: Updates automatically as you make changes

### Section 2: Verification Status Toggle

**Purpose**: Mark practitioners as verified or unverified

- **Status Badge**: Shows "Verified" (green) or "Not Verified" (amber)
- **Toggle Button**:
  - Click "Mark as Verified" (emerald) to verify
  - Click "Mark as Unverified" (red) to unverify
  - Button shows "Updating..." while saving
- **Requirements**: Can only verify if:
  - All required documents are approved ✓
  - All required profile fields are complete ✓
  - If requirements not met, verification will fail with error message

### Section 3: Admin Document Upload

**Purpose**: Upload documents on behalf of practitioners

- **Blue Background Box**: Distinguishes admin actions from practitioner view
- **Two Categories**:
  - **Required Documents** (4): ID Copy, Tax Cert, Proof of Address, Bank Letter
  - **Optional Documents** (5): Membership, Company Reg, VAT Proof, Photo, CV

**How to Upload**:

1. Click file input under document name
2. Select file from your computer
3. File appears below input once selected
4. Click "Upload" button
5. Progress indicator shows during upload
6. Success or error message appears when done

**File Requirements**:

- Types: PDF, JPEG, PNG, DOC, DOCX
- Size: Max 10MB
- Invalid files are rejected with clear error message

### Section 4: Document Review Section

**Purpose**: Approve or reject uploaded documents

**Three Tabs**:

- **Pending**: Documents waiting for your action
- **Approved**: Documents you've approved (green badges)
- **Rejected**: Documents you've rejected (red badges)

**For Each Pending Document**:

- **Approve Button**: Click to approve immediately ✓
- **Reject Button**: Click to start rejection workflow
  - Enter rejection reason (e.g., "Image is blurry, need clearer photo")
  - Reason must be at least 1 character
  - Click "Confirm Rejection" to send back to practitioner
  - Practitioner sees reason in their upload interface

**For Rejected Documents**:

- Reason shown: "Reason: [admin's message]"
- Practitioner will re-upload an improved version
- Then appears in Pending tab again for review

### Section 5: Profile Fields

**Purpose**: Edit all practitioner details directly

**Editable Fields**:

- **Business Name**: Company/practitioner name
- **Registration Number**: Professional registration ID
- **Years of Experience**: Numeric field
- **Services Offered**: Multi-select checkboxes
- **Availability Status**: Dropdown (Available, Busy, Unavailable)
- **Bank Details**: Account holder, bank name, account number, branch code, account type
- **VAT Number**: Tax ID
- **Internal Notes**: Private notes for staff

**Tips**:

- Update from email communications: practitioner emails details, you enter them
- Check **Missing Fields** section to see what's needed
- Progress % updates as you fill fields
- Click "Save Staff Profile" button at bottom when done

## Common Tasks

### Task 1: Onboard Practitioner from Email

1. **Open Practitioner**
   - Find in Users list → Click Edit

2. **Check Missing Fields**
   - What's the amber/red status? Those need to be filled

3. **Fill Profile**
   - Scroll to "Profile Fields" section
   - Enter: Business Name, Registration Number, Services, etc.
   - From email: "Hi, my tax ID is XYZ, I offer tax planning"
   - Enter those values directly

4. **Upload Documents**
   - Scroll to "Admin Document Upload" (blue box)
   - For each required document email attached:
     - Click file input
     - Select file
     - Click Upload
   - After upload, documents appear in review tabs below

5. **Review & Approve**
   - Scroll to Document Tabs
   - Click "Pending" tab
   - For each document:
     - Click "View" to check quality
     - Click "Approve" if good
   - All required documents must show green checkmark

6. **Verify Practitioner**
   - Scroll back to "Verification Status" section
   - Click "Mark as Verified" button
   - Should succeed if all requirements met
   - You'll see success toast

### Task 2: Fix a Rejected Document

1. **Admin rejects** with reason: "Signature missing"
2. **Practitioner sees** the reason in their upload interface
3. **Practitioner re-uploads** document with signature
4. **Document appears** in Pending tab again
5. **You review** and click "Approve"
6. **Once all required** documents approved → practitioner can be verified

### Task 3: Check What's Missing

1. **Open Practitioner** → Edit
2. **Look at "Profile Completion"** card
   - Amber ⚠ = missing field
   - Green ✓ = complete field
3. **Priority**: Fix amber fields first
4. **Use the percentage**: Track progress to 100%

### Task 4: Mark Verified

**Before Verifying, Ensure**:

- ✓ Profile Completion shows 100% (or all required fields complete)
- ✓ All required documents show green "Approved" badge
- ✓ Banking details verified (separate verification)

**To Verify**:

1. Scroll to "Verification Status" (emerald box)
2. Read the current status badge
3. If "Not Verified", click "Mark as Verified" button
4. Wait for "Updating..." to complete
5. Button will show "Mark as Unverified" when done (status changed to verified)
6. Success toast confirms: "Practitioner marked as verified"

**If Verification Fails**:

- Error message explains what's missing
- Usually: "All required verification documents must be approved..."
- Go back and ensure all required documents are approved in tabs

### Task 5: Manage Documents Received via Email

1. **Practitioner emails**: Documents, ID number, business info
2. **Open practitioner** in AdminUsers
3. **Upload documents** using Admin Document Upload section:
   - ID Copy → upload photo/scan
   - Tax Registration → upload certificate
   - Proof of Address → upload utility bill
   - Bank Letter → upload bank confirmation
4. **Fill profile fields** from email content:
   - Business Name: from email
   - Registration Number: from email
   - Services: from email description
5. **Review documents** in tabs → Approve each one
6. **Mark as Verified** once all requirements met

## Troubleshooting

### "File type not allowed"

- Only PDF, JPEG, PNG, DOC, DOCX allowed
- Check file format and try again
- If it's a different format, convert it first

### "File size must be less than 10MB"

- File is too large
- Compress or reduce quality and re-upload
- PDFs usually need to be split into smaller chunks

### "Can't mark as verified" (error message)

- Read the error message carefully
- Usually means: Not all required documents approved
- Go to Document Tabs, check each one has green "Approved" badge
- If any still say "Pending" or "Rejected", address them first

### "Profile Completion shows less than 100%"

- Check the field list for amber ⚠ marks
- Scroll to Profile Fields section
- Fill in each missing field (they're listed)
- Save when done
- Completion % should update

### Document not appearing after upload

- Check "Pending" tab in Document Review
- If not there, check if upload succeeded (look for success toast)
- Try uploading again
- If still issues, contact support

## Tips & Best Practices

1. **Always Check Missing Fields First**
   - Tells you exactly what to fill in
   - Use as a checklist

2. **Save Frequently**
   - After filling profile fields, click "Save Staff Profile"
   - Don't lose your work

3. **Document Quality**
   - If document is blurry, text unreadable, or incomplete → Reject it
   - Rejection reason should tell practitioner what to fix
   - Example: "Photo is blurry. Please take a clearer photo of ID."

4. **Get All Required Docs**
   - Red ✗ Required badge means document is required
   - Must be approved before verification possible
   - Profile completion won't reach 100% if required field missing

5. **Use Admin Notes** (in Profile Fields)
   - Document where you got information
   - "From email sent 2024-04-17"
   - Helps audit trail

6. **Batch Processing**
   - If managing multiple practitioners from one email batch:
     - Open each one → Fill details → Upload docs → Review → Verify
     - Most efficient workflow

## Getting Help

- **Missing Fields Not Showing?** Check that practitioner is a consultant/practitioner role
- **Upload Button Disabled?** Make sure you selected a file first
- **Can't Save?** Scroll to bottom and click "Save Staff Profile" button (sometimes hidden)
- **Documents Not Saving?** Check browser console for errors, or try refreshing page

---

**Remember**: Admin tools are powerful - use them to help practitioners get onboarded efficiently while maintaining verification standards!
