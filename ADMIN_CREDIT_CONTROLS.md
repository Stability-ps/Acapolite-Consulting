# Admin Credit Controls System

## Overview

The admin credit controls system enables administrators to manage practitioner credits for marketing campaigns, promotions, and referral rewards. Admins can grant bonus credits, set expiry dates, and track all credit actions in a detailed history log.

## Features

### 1. **Grant Bonus Credits** ✓

Admins can give free bonus credits to practitioners without cost restrictions.

**Workflow**:

1. Open practitioner in AdminUsers
2. Scroll to "Credit Management" section
3. Select "Grant Credits" action
4. Enter number of credits
5. Select credit type (Bonus or Referral)
6. Add optional expiry date (promotional credits)
7. Enter reason (Campaign Bonus, Referral Reward, Promotion, etc.)
8. Click "Grant X Credits" button

**Use Cases**:

- Campaign bonuses to encourage participation
- Referral rewards when practitioners refer other practitioners
- Promotional special offers during product launches
- Loyalty rewards for high-performing practitioners
- Free trial credits for new practitioners

### 2. **Deduct Credits** ✓

Admins can remove credits if needed (e.g., service issues, refunds).

**Workflow**:

1. Select "Deduct Credits" action
2. Enter number of credits to deduct
3. Practitioner must have sufficient balance (system prevents overdraft)
4. Enter reason (Service Issue, Correction, Refund, etc.)
5. Click "Deduct X Credits" button

**Use Cases**:

- Correct accidental credit additions
- Process refunds for services
- Remove fraudulent credits
- Account corrections

### 3. **Credit Types** ✓

Three types of credits tracked separately:

- **Purchased Credits**: Bought by practitioner via payment
- **Bonus Credits**: Given by admin (no cost)
- **Referral Credits**: Earned through successful referrals

**Tracking**:

- Each transaction records credit type
- Balance aggregates all types
- History shows type for each credit action

### 4. **Expiry Dates** ✓

Optional expiry dates for promotional credits.

**Features**:

- Set when granting credits
- Specified in days (auto-calculates expiry date)
- Shows in credit history
- Warning displayed when approaching expiry
- Visual alert when expired

**Example**:

- Grant 20 bonus credits
- Add 30-day expiry
- Displayed as: "Expires 2026-05-17"
- Practitioners warned: "This bonus credit expires on May 17, 2026"

### 5. **Credit History Log** ✓

Complete transaction history for each practitioner.

**Information Displayed**:

- Transaction type with icon and badge
- Credit delta (+ or -)
- Balance after transaction
- Description/Reason
- Date and time
- Admin who issued (for admin grants)
- Expiry date (if applicable)
- Status warnings (expiring/expired)

**Transaction Types Shown**:

- 🎁 Admin Grant (Blue)
- ➖ Admin Deduction (Red)
- 💰 Package Purchase (Amber)
- ⚡ Lead Response (Purple)
- 🎁 Signup Bonus (Emerald)
- 💳 Refund (Teal)

## User Interface

### Credit Management Card

Located in practitioner edit dialog after document section.

**Layout**:

- Header with coin icon and current balance
- Action selector (Grant/Deduct)
- Credits input field
- Credit type selector (for grants)
- Optional expiry date checkbox
- Reason textarea (required)
- Preview summary showing new balance
- Action button (color-coded by action)

**Visual Indicators**:

- Green/Emerald: Grant actions
- Red: Deduct actions
- Disabled state during processing
- Loading spinner during save

### Credit Transaction History

Shows all transactions in chronological order (newest first).

**Each Transaction Card Shows**:

- Transaction type badge with icon
- Description
- Credit delta (green + / red -)
- New balance after transaction
- Date/time
- Admin name (if applicable)
- Reason (if different from description)
- Expiry warnings (amber/red border)

**Visual Feedback**:

- ✅ Green for credit additions
- ❌ Red for credit deductions
- ⏱ Amber warning for approaching expiry
- 🚫 Red warning for expired credits

## Database Schema

### New Columns in `practitioner_credit_transactions`

```sql
issued_by uuid           -- Admin who issued the credit
reason text              -- Reason for credit action
expiry_date timestamptz  -- When this credit expires
credit_type text         -- 'purchased', 'bonus', or 'referral'
```

### Indexes Added

- `idx_practitioner_credit_transactions_issued_by`
- `idx_practitioner_credit_transactions_expiry_date`
- `idx_practitioner_credit_transactions_credit_type`

### Database Functions

#### `admin_grant_credits()`

Grants bonus/referral credits to a practitioner.

```sql
admin_grant_credits(
  p_practitioner_profile_id uuid,
  p_credits integer,
  p_reason text,
  p_credit_type text = 'bonus',
  p_expiry_date timestamptz = null,
  p_issued_by_id uuid = null
) returns integer
```

**Returns**: New credit balance after grant

**Permissions**: Only admins can execute

**Tracking**:

- Updates `practitioner_credit_accounts.balance`
- Updates `practitioner_credit_accounts.total_bonus_credits`
- Creates transaction record with all metadata

#### `admin_deduct_credits()`

Removes credits from a practitioner account.

```sql
admin_deduct_credits(
  p_practitioner_profile_id uuid,
  p_credits integer,
  p_reason text,
  p_issued_by_id uuid = null
) returns integer
```

**Returns**: New credit balance after deduction

**Permissions**: Only admins can execute

**Validation**: Prevents overdraft (insufficient balance error)

**Tracking**:

- Updates `practitioner_credit_accounts.balance`
- Creates transaction record
- Logs reason and admin who deducted

### View: `practitioner_credit_summary`

Aggregates credit statistics per practitioner.

```sql
- profile_id
- balance (current)
- total_bonus_credits
- total_purchased_credits
- total_used_credits
- available_credits (sum of all types)
- admin_grant_count (number of admin grants)
- admin_deduction_count (number of deductions)
- last_admin_grant_at (timestamp of most recent grant)
```

## Security & Permissions

### RLS (Row Level Security)

- Only admins can call grant/deduct functions
- Transaction history visible to practitioners for their own account
- Transaction history visible to admins for any account
- Modification requires admin role

### Audit Trail

- Every credit action recorded with:
  - Admin ID (`issued_by`)
  - Reason
  - Timestamp
  - Credit type
  - Previous and new balances

## File Structure

### New Files Created

- `supabase/migrations/20260417150000_add_admin_credit_controls.sql`
  - Database schema changes
  - Admin grant/deduct functions
  - Credit summary view
  - Indexes for performance

- `src/components/dashboard/AdminCreditControls.tsx`
  - Admin credit grant/deduct interface
  - Form validation
  - Real-time preview
  - Loading states

- `src/components/dashboard/CreditHistory.tsx`
  - Transaction history display
  - Type-based formatting and colors
  - Expiry date warnings
  - Admin tracking display

### Modified Files

- `src/pages/dashboard/admin/AdminUsers.tsx`
  - Added imports for AdminCreditControls and CreditHistory
  - Added credit account query
  - Integrated components into edit dialog

## Workflow Examples

### Scenario 1: Campaign Bonus Distribution

**Situation**: Launch new marketing campaign, want to give all practitioners 25 bonus credits.

**Steps**:

1. Admin opens each practitioner's profile
2. Credit Management section visible
3. Selects "Grant Credits"
4. Enters: 25 credits, Bonus type
5. Reason: "Q2 Marketing Campaign Bonus"
6. Optional: Set 60-day expiry to encourage immediate use
7. Click "Grant 25 Credits"
8. Repeat for all practitioners
9. All actions tracked in credit history

### Scenario 2: Referral Reward

**Situation**: Practitioner refers new high-value practitioner.

**Steps**:

1. Admin opens referrer's profile
2. Selects "Grant Credits"
3. Enters: 50 credits, Referral type
4. Reason: "Referral of John Smith - New Premium Practitioner"
5. Click "Grant 50 Credits"
6. Referrer sees reward in their credit history

### Scenario 3: Service Credit (Correction/Refund)

**Situation**: Practitioner had technical issue, manually correct their account.

**Steps**:

1. Open practitioner's profile
2. Review Credit History to see transactions
3. Identify incorrect or missing credit
4. Selects "Grant Credits" to add correction
5. Reason: "Technical issue correction - Service response not counted"
6. Grant appropriate credit amount
7. Transaction recorded for audit trail

### Scenario 4: Account Correction (Deduct)

**Situation**: Duplicate credit was accidentally applied.

**Steps**:

1. Check credit history for duplicate
2. Select "Deduct Credits"
3. Enter amount to remove (matches duplicate)
4. Reason: "Correction - Duplicate credit removed (see transaction ID)"
5. Check current balance is sufficient
6. Confirm deduction
7. Both original and correction visible in history

## Practitioner Experience

### As a Practitioner

When admin grants bonus credits:

1. **Immediate Effect**: Credit balance increases
2. **Credit History**: New transaction appears with:
   - "Admin Grant" badge in blue
   - Number of credits received
   - Reason from admin
   - Date issued
   - Admin name who issued
   - Expiry date (if applicable)
3. **Expiry Warning**: If credits expire:
   - Amber warning showing expiry date
   - Red warning if already expired

### Using Bonus Credits

- No special action needed
- Used same way as purchased credits
- When responding to leads, system debits any available credits

## Performance Considerations

### Indexing

- Queries indexed by:
  - `profile_id` for credit account lookups
  - `transaction_type` for filtering (admin_grant, admin_deduction)
  - `issued_by` for admin tracking
  - `expiry_date` for expiry date queries
  - `created_at` for chronological sorting

### Efficient Operations

- RPC functions execute in database
- No N+1 queries
- Credit summary view pre-aggregates statistics
- Pagination on transaction history (20 most recent)

## Testing Recommendations

### Unit Tests

- Grant credits with various amounts
- Deduct credits (with and without sufficient balance)
- Expiry date calculation (30, 60, 90 days)
- Credit type classification (bonus, referral)

### Integration Tests

- Admin grant → practitioners see in history
- Admin deduction → balance decreased correctly
- Expiry date set → appears in history with warning
- Transaction audit trail → all admins see same record

### Manual Testing Checklist

- [ ] Grant 50 bonus credits to practitioner
- [ ] Check balance increased
- [ ] Verify transaction in credit history
- [ ] Set 30-day expiry, check calculation correct
- [ ] Try deduct with insufficient balance (should error)
- [ ] Deduct valid amount, verify balance decreased
- [ ] Check reason appears in history
- [ ] Check admin name appears in history
- [ ] Verify expiry warning shows for upcoming expirations
- [ ] Verify expired credit warning shows (use past date)

## Future Enhancements

### Potential Improvements

1. **Bulk Credit Grants**: Upload CSV to grant credits to multiple practitioners at once
2. **Scheduled Credits**: Schedule credit grants for future dates (e.g., monthly loyalty)
3. **Credit Expiry Automation**: Automatic email reminders before expiry
4. **Credit Reports**: Generate reports on credit distribution, usage patterns
5. **Credit Tiers**: Different credit values for different practitioner levels
6. **Promotional Templates**: Pre-built reasons for common promotions
7. **Credit Freezing**: Temporarily prevent credit usage without removal
8. **Credit Rollover**: Carry over unused monthly subscription credits
9. **Credit Marketplace**: Allow practitioners to trade/sell credits
10. **Analytics Dashboard**: Visual dashboard of credit distribution and usage

## Summary

The admin credit controls system provides:

- ✅ Grant unlimited bonus credits
- ✅ Deduct credits (with balance validation)
- ✅ Track credit types (purchased, bonus, referral)
- ✅ Set expiry dates for promotional credits
- ✅ Detailed history log with admin tracking
- ✅ Audit trail for compliance
- ✅ Real-time balance updates
- ✅ Comprehensive filtering and sorting

All features designed for marketing campaigns, referral rewards, and promotional growth initiatives.
