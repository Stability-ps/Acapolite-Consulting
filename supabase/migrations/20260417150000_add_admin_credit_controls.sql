-- Add more detailed admin credit action tracking
-- This migration enhances the practitioner_credit_transactions table with explicit admin tracking

alter table public.practitioner_credit_transactions
add column if not exists issued_by uuid references public.profiles(id) on delete set null,
add column if not exists reason text,
add column if not exists expiry_date timestamptz,
add column if not exists credit_type text check (credit_type in ('purchased', 'bonus', 'referral')) default 'purchased';

create index if not exists idx_practitioner_credit_transactions_issued_by
  on public.practitioner_credit_transactions(issued_by);

create index if not exists idx_practitioner_credit_transactions_expiry_date
  on public.practitioner_credit_transactions(expiry_date);

create index if not exists idx_practitioner_credit_transactions_credit_type
  on public.practitioner_credit_transactions(credit_type);

-- Add function to grant admin credits
create or replace function public.admin_grant_credits(
  p_practitioner_profile_id uuid,
  p_credits integer,
  p_reason text,
  p_credit_type text default 'bonus',
  p_expiry_date timestamptz default null,
  p_issued_by_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_current_user_id uuid;
begin
  -- Get current user ID if not provided
  if p_issued_by_id is null then
    v_current_user_id := auth.uid();
  else
    v_current_user_id := p_issued_by_id;
  end if;

  -- Ensure user is admin
  if not exists (
    select 1 from public.profiles
    where id = v_current_user_id and role = 'admin'
  ) then
    raise exception 'Only admins can grant credits';
  end if;

  -- Create credit account if needed
  perform public.ensure_practitioner_credit_account(p_practitioner_profile_id, false);

  -- Update balance and bonus credits
  update public.practitioner_credit_accounts
  set
    balance = balance + p_credits,
    total_bonus_credits = total_bonus_credits + p_credits,
    updated_at = now()
  where profile_id = p_practitioner_profile_id
  returning balance into v_balance;

  -- Record transaction
  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    transaction_type,
    credits_delta,
    balance_after,
    description,
    issued_by,
    reason,
    expiry_date,
    credit_type,
    metadata
  )
  values (
    p_practitioner_profile_id,
    'admin_grant',
    p_credits,
    v_balance,
    'Admin granted ' || p_credits || ' credits: ' || p_reason,
    v_current_user_id,
    p_reason,
    p_expiry_date,
    p_credit_type,
    jsonb_build_object(
      'reason', p_reason,
      'credit_type', p_credit_type,
      'has_expiry', p_expiry_date is not null
    )
  );

  return v_balance;
end;
$$;

-- Add function to deduct admin credits
create or replace function public.admin_deduct_credits(
  p_practitioner_profile_id uuid,
  p_credits integer,
  p_reason text,
  p_issued_by_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_current_user_id uuid;
begin
  -- Get current user ID if not provided
  if p_issued_by_id is null then
    v_current_user_id := auth.uid();
  else
    v_current_user_id := p_issued_by_id;
  end if;

  -- Ensure user is admin
  if not exists (
    select 1 from public.profiles
    where id = v_current_user_id and role = 'admin'
  ) then
    raise exception 'Only admins can deduct credits';
  end if;

  -- Ensure account exists
  perform public.ensure_practitioner_credit_account(p_practitioner_profile_id, false);

  -- Check if sufficient balance
  select balance
  into v_balance
  from public.practitioner_credit_accounts
  where profile_id = p_practitioner_profile_id
  for update;

  if coalesce(v_balance, 0) < p_credits then
    raise exception 'Insufficient credits. Current balance: %', coalesce(v_balance, 0);
  end if;

  -- Update balance
  update public.practitioner_credit_accounts
  set
    balance = balance - p_credits,
    updated_at = now()
  where profile_id = p_practitioner_profile_id
  returning balance into v_balance;

  -- Record transaction
  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    transaction_type,
    credits_delta,
    balance_after,
    description,
    issued_by,
    reason,
    metadata
  )
  values (
    p_practitioner_profile_id,
    'admin_deduction',
    -p_credits,
    v_balance,
    'Admin deducted ' || p_credits || ' credits: ' || p_reason,
    v_current_user_id,
    p_reason,
    jsonb_build_object('reason', p_reason)
  );

  return v_balance;
end;
$$;

-- Create a view for credit summary with admin details
create or replace view public.practitioner_credit_summary as
select
  pca.profile_id,
  pca.balance,
  pca.total_bonus_credits,
  pca.total_purchased_credits,
  pca.total_used_credits,
  pca.total_bonus_credits + pca.total_purchased_credits - pca.total_used_credits as available_credits,
  count(distinct case when pct.transaction_type = 'admin_grant' then pct.id end) as admin_grant_count,
  count(distinct case when pct.transaction_type = 'admin_deduction' then pct.id end) as admin_deduction_count,
  max(case when pct.transaction_type = 'admin_grant' then pct.created_at end) as last_admin_grant_at
from public.practitioner_credit_accounts pca
left join public.practitioner_credit_transactions pct on pca.profile_id = pct.practitioner_profile_id
group by pca.profile_id, pca.balance, pca.total_bonus_credits, pca.total_purchased_credits, pca.total_used_credits;
