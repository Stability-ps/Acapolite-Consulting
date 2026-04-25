alter table public.practitioner_credit_accounts
  add column if not exists monthly_credits_remaining integer not null default 0 check (monthly_credits_remaining >= 0),
  add column if not exists monthly_credits_expires_at timestamptz,
  add column if not exists purchased_credits_balance integer not null default 0 check (purchased_credits_balance >= 0),
  add column if not exists storage_used_bytes bigint not null default 0 check (storage_used_bytes >= 0),
  add column if not exists storage_base_limit_mb integer not null default 2048 check (storage_base_limit_mb >= 0),
  add column if not exists storage_addon_limit_mb integer not null default 0 check (storage_addon_limit_mb >= 0),
  add column if not exists storage_override_limit_mb integer not null default 0 check (storage_override_limit_mb >= 0),
  add column if not exists storage_warning_sent_at timestamptz,
  add column if not exists tracked_client_count integer not null default 0 check (tracked_client_count >= 0);

update public.practitioner_credit_accounts
set purchased_credits_balance = greatest(balance, 0)
where purchased_credits_balance = 0
  and balance > 0;

alter table public.practitioner_subscription_plans
  add column if not exists storage_limit_mb integer not null default 2048 check (storage_limit_mb >= 0),
  add column if not exists listing_priority_level integer not null default 1 check (listing_priority_level >= 1),
  add column if not exists includes_upgrade_support boolean not null default true;

create table if not exists public.practitioner_storage_addon_purchases (
  id uuid primary key default gen_random_uuid(),
  practitioner_profile_id uuid not null references public.profiles(id) on delete cascade,
  addon_code text not null check (addon_code in ('plus_5gb', 'plus_10gb', 'plus_25gb')),
  addon_name text not null,
  storage_mb integer not null check (storage_mb > 0),
  amount_zar numeric not null check (amount_zar >= 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  payment_provider text not null default 'test' check (payment_provider in ('test', 'paystack')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'completed', 'failed', 'cancelled')),
  provider_payment_id text unique,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_practitioner_storage_addon_purchases_profile_id
  on public.practitioner_storage_addon_purchases(practitioner_profile_id, created_at desc);

drop trigger if exists trg_practitioner_storage_addon_purchases_updated_at on public.practitioner_storage_addon_purchases;
create trigger trg_practitioner_storage_addon_purchases_updated_at
before update on public.practitioner_storage_addon_purchases
for each row execute function public.set_updated_at();

alter table public.practitioner_credit_transactions
  add column if not exists credit_bucket text not null default 'purchased'
    check (credit_bucket in ('monthly', 'purchased', 'bonus', 'referral', 'mixed')),
  add column if not exists monthly_credits_used integer not null default 0 check (monthly_credits_used >= 0),
  add column if not exists purchased_credits_used integer not null default 0 check (purchased_credits_used >= 0);

alter table public.practitioner_credit_transactions
  drop constraint if exists practitioner_credit_transactions_transaction_type_check;

alter table public.practitioner_credit_transactions
  add constraint practitioner_credit_transactions_transaction_type_check
  check (
    transaction_type in (
      'signup_bonus',
      'signup_bonus_adjustment',
      'package_purchase',
      'lead_response',
      'lead_unlock',
      'subscription_credit',
      'admin_grant',
      'admin_deduction',
      'refund',
      'storage_addon_purchase',
      'monthly_credit_expiry'
    )
  );

alter table public.service_requests
  drop constraint if exists service_requests_max_selected_services_check;

alter table public.service_requests
  add constraint service_requests_max_selected_services_check
  check (
    service_needed_list is null
    or coalesce(array_length(service_needed_list, 1), 0) between 0 and 5
  );

create or replace function public.refresh_practitioner_credit_balance(
  p_profile_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  update public.practitioner_credit_accounts
  set
    balance = greatest(monthly_credits_remaining, 0) + greatest(purchased_credits_balance, 0),
    updated_at = now()
  where profile_id = p_profile_id
  returning balance into v_balance;

  return coalesce(v_balance, 0);
end;
$$;

create or replace function public.expire_practitioner_monthly_credits(
  p_profile_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.practitioner_credit_accounts%rowtype;
  v_balance integer;
begin
  select *
  into v_account
  from public.practitioner_credit_accounts
  where profile_id = p_profile_id
  for update;

  if v_account.profile_id is null then
    return 0;
  end if;

  if v_account.monthly_credits_remaining > 0
    and v_account.monthly_credits_expires_at is not null
    and v_account.monthly_credits_expires_at <= now()
  then
    update public.practitioner_credit_accounts
    set
      monthly_credits_remaining = 0,
      monthly_credits_expires_at = null,
      updated_at = now()
    where profile_id = p_profile_id;

    v_balance := public.refresh_practitioner_credit_balance(p_profile_id);

    insert into public.practitioner_credit_transactions (
      practitioner_profile_id,
      transaction_type,
      credits_delta,
      balance_after,
      description,
      credit_bucket,
      monthly_credits_used,
      metadata
    )
    values (
      p_profile_id,
      'monthly_credit_expiry',
      -v_account.monthly_credits_remaining,
      v_balance,
      'Unused monthly credits expired at the end of the billing cycle.',
      'monthly',
      v_account.monthly_credits_remaining,
      jsonb_build_object('expired_at', now())
    );

    return v_balance;
  end if;

  return public.refresh_practitioner_credit_balance(p_profile_id);
end;
$$;

create or replace function public.get_practitioner_storage_limit_mb(
  p_profile_id uuid
)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(storage_base_limit_mb, 0)
    + coalesce(storage_addon_limit_mb, 0)
    + coalesce(storage_override_limit_mb, 0)
  from public.practitioner_credit_accounts
  where profile_id = p_profile_id
$$;

create or replace function public.ensure_practitioner_credit_account(
  p_profile_id uuid,
  p_grant_signup_bonus boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  insert into public.practitioner_credit_accounts (
    profile_id,
    balance,
    purchased_credits_balance,
    storage_base_limit_mb
  )
  values (
    p_profile_id,
    0,
    0,
    2048
  )
  on conflict (profile_id) do nothing;

  if p_grant_signup_bonus
    and not exists (
      select 1
      from public.practitioner_credit_transactions
      where practitioner_profile_id = p_profile_id
        and transaction_type = 'signup_bonus'
    )
  then
    update public.practitioner_credit_accounts
    set
      purchased_credits_balance = purchased_credits_balance + 10,
      total_bonus_credits = total_bonus_credits + 10,
      updated_at = now()
    where profile_id = p_profile_id;

    v_balance := public.refresh_practitioner_credit_balance(p_profile_id);

    insert into public.practitioner_credit_transactions (
      practitioner_profile_id,
      transaction_type,
      credits_delta,
      balance_after,
      description,
      credit_bucket
    )
    values (
      p_profile_id,
      'signup_bonus',
      10,
      coalesce(v_balance, 10),
      'New practitioner signup bonus credits.',
      'bonus'
    );
  end if;

  perform public.expire_practitioner_monthly_credits(p_profile_id);

  select balance
  into v_balance
  from public.practitioner_credit_accounts
  where profile_id = p_profile_id;

  return coalesce(v_balance, 0);
end;
$$;

create or replace function public.grant_practitioner_purchased_credits(
  p_profile_id uuid,
  p_credits integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if coalesce(p_credits, 0) <= 0 then
    return public.ensure_practitioner_credit_account(p_profile_id, false);
  end if;

  perform public.ensure_practitioner_credit_account(p_profile_id, false);

  update public.practitioner_credit_accounts
  set
    purchased_credits_balance = purchased_credits_balance + p_credits,
    total_purchased_credits = total_purchased_credits + p_credits,
    updated_at = now()
  where profile_id = p_profile_id;

  v_balance := public.refresh_practitioner_credit_balance(p_profile_id);
  return v_balance;
end;
$$;

create or replace function public.grant_practitioner_monthly_credits(
  p_profile_id uuid,
  p_credits integer,
  p_expires_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  perform public.ensure_practitioner_credit_account(p_profile_id, false);

  update public.practitioner_credit_accounts
  set
    monthly_credits_remaining = greatest(coalesce(p_credits, 0), 0),
    monthly_credits_expires_at = p_expires_at,
    updated_at = now()
  where profile_id = p_profile_id;

  v_balance := public.refresh_practitioner_credit_balance(p_profile_id);
  return v_balance;
end;
$$;

create or replace function public.consume_practitioner_credit_wallet(
  p_profile_id uuid,
  p_credits integer
)
returns table (
  balance integer,
  monthly_used integer,
  purchased_used integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.practitioner_credit_accounts%rowtype;
  v_monthly_to_use integer := 0;
  v_purchased_to_use integer := 0;
  v_remaining integer := greatest(coalesce(p_credits, 0), 0);
begin
  if v_remaining <= 0 then
    return query
    select
      public.ensure_practitioner_credit_account(p_profile_id, false),
      0,
      0;
    return;
  end if;

  perform public.expire_practitioner_monthly_credits(p_profile_id);

  select *
  into v_account
  from public.practitioner_credit_accounts
  where profile_id = p_profile_id
  for update;

  if v_account.profile_id is null then
    raise exception 'Practitioner credit account not found.';
  end if;

  v_monthly_to_use := least(v_account.monthly_credits_remaining, v_remaining);
  v_remaining := v_remaining - v_monthly_to_use;
  v_purchased_to_use := least(v_account.purchased_credits_balance, v_remaining);
  v_remaining := v_remaining - v_purchased_to_use;

  if v_remaining > 0 then
    raise exception 'You need % credits to complete this action. Please purchase more credits.', p_credits;
  end if;

  update public.practitioner_credit_accounts
  set
    monthly_credits_remaining = monthly_credits_remaining - v_monthly_to_use,
    purchased_credits_balance = purchased_credits_balance - v_purchased_to_use,
    total_used_credits = total_used_credits + p_credits,
    updated_at = now()
  where profile_id = p_profile_id;

  return query
  select
    public.refresh_practitioner_credit_balance(p_profile_id),
    v_monthly_to_use,
    v_purchased_to_use;
end;
$$;

create or replace function public.get_service_request_base_credit_cost(
  p_service_needed public.service_request_service_needed
)
returns integer
language plpgsql
immutable
as $$
begin
  return case p_service_needed
    when 'individual_personal_income_tax_returns' then 2
    when 'individual_sars_debt_assistance' then 5
    when 'individual_tax_compliance_issues' then 3
    when 'individual_tax_clearance_certificates' then 3
    when 'individual_objections_and_disputes' then 7
    when 'individual_late_return_submissions' then 2
    when 'individual_tax_number_registration' then 2
    when 'individual_tax_status_corrections' then 2
    when 'business_company_income_tax' then 5
    when 'business_vat_registration' then 3
    when 'business_vat_returns' then 4
    when 'business_paye_registration' then 3
    when 'business_paye_compliance' then 5
    when 'business_sars_debt_arrangements' then 6
    when 'business_tax_clearance_certificates' then 3
    when 'business_sars_audits_support' then 7
    when 'accounting_bookkeeping' then 5
    when 'accounting_financial_statements' then 6
    when 'accounting_management_accounts' then 6
    when 'accounting_payroll_services' then 5
    when 'accounting_monthly_accounting_services' then 5
    when 'accounting_annual_financial_reporting' then 6
    when 'support_company_registration' then 4
    when 'support_business_compliance' then 5
    when 'support_cipc_services' then 4
    when 'support_business_advisory' then 6
    when 'support_financial_compliance' then 6
    else 4
  end;
end;
$$;

create or replace function public.get_service_request_credit_cost(
  p_service_needed public.service_request_service_needed
)
returns integer
language sql
immutable
as $$
  select public.get_service_request_base_credit_cost(p_service_needed)
$$;

create or replace function public.get_service_request_credit_cost_for_services(
  p_services public.service_request_service_needed[]
)
returns integer
language plpgsql
immutable
as $$
declare
  v_services public.service_request_service_needed[];
  v_max_cost integer := 4;
  v_service public.service_request_service_needed;
begin
  v_services := coalesce(p_services, '{}'::public.service_request_service_needed[]);

  if coalesce(array_length(v_services, 1), 0) = 0 then
    return 4;
  end if;

  foreach v_service in array v_services loop
    v_max_cost := greatest(v_max_cost, public.get_service_request_base_credit_cost(v_service));
  end loop;

  if array_length(v_services, 1) >= 3 then
    v_max_cost := v_max_cost + 1;
  end if;

  return least(v_max_cost, 10);
end;
$$;

create or replace function public.refresh_practitioner_usage_metrics(
  p_profile_id uuid
)
returns table (
  storage_used_bytes bigint,
  storage_limit_bytes bigint,
  tracked_client_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_storage_used_bytes bigint := 0;
  v_storage_limit_bytes bigint := 0;
  v_tracked_client_count integer := 0;
  v_account public.practitioner_credit_accounts%rowtype;
  v_ratio numeric := 0;
  v_previous_ratio numeric := 0;
begin
  perform public.ensure_practitioner_credit_account(p_profile_id, false);

  select *
  into v_account
  from public.practitioner_credit_accounts
  where profile_id = p_profile_id
  for update;

  select
    coalesce((
      select sum(coalesce(d.file_size, 0))
      from public.documents d
      where d.uploaded_by = p_profile_id
    ), 0)
    + coalesce((
      select sum(coalesce(pvd.file_size, 0))
      from public.practitioner_verification_documents pvd
      where pvd.practitioner_profile_id = p_profile_id
    ), 0)
  into v_storage_used_bytes;

  select count(*)
  into v_tracked_client_count
  from public.clients c
  where not coalesce(c.is_archived, false)
    and (c.assigned_consultant_id = p_profile_id or c.created_by = p_profile_id);

  v_storage_limit_bytes := coalesce(public.get_practitioner_storage_limit_mb(p_profile_id), 0)::bigint * 1024 * 1024;
  v_previous_ratio := case when v_storage_limit_bytes > 0 then v_account.storage_used_bytes::numeric / v_storage_limit_bytes else 0 end;
  v_ratio := case when v_storage_limit_bytes > 0 then v_storage_used_bytes::numeric / v_storage_limit_bytes else 0 end;

  update public.practitioner_credit_accounts
  set
    storage_used_bytes = v_storage_used_bytes,
    tracked_client_count = v_tracked_client_count,
    storage_warning_sent_at = case
      when v_ratio >= 0.8 and (storage_warning_sent_at is null or v_previous_ratio < 0.8) then now()
      when v_ratio < 0.8 then null
      else storage_warning_sent_at
    end,
    updated_at = now()
  where profile_id = p_profile_id;

  if v_ratio >= 0.8 and (v_account.storage_warning_sent_at is null or v_previous_ratio < 0.8) then
    perform public.create_notification(
      p_profile_id,
      null,
      'storage_usage_warning',
      'credits',
      'Storage usage warning',
      'You have reached at least 80% of your current storage allocation. Review your uploads or upgrade your storage.',
      '/dashboard/staff/credits',
      'profile',
      p_profile_id,
      jsonb_build_object(
        'storage_used_bytes', v_storage_used_bytes,
        'storage_limit_bytes', v_storage_limit_bytes,
        'tracked_client_count', v_tracked_client_count
      )
    );
  end if;

  return query
  select
    v_storage_used_bytes,
    v_storage_limit_bytes,
    v_tracked_client_count;
end;
$$;

create or replace function public.ensure_practitioner_storage_capacity(
  p_profile_id uuid,
  p_additional_bytes bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_storage_used_bytes bigint;
  v_storage_limit_bytes bigint;
  v_tracked_client_count integer;
begin
  select storage_used_bytes, storage_limit_bytes, tracked_client_count
  into v_storage_used_bytes, v_storage_limit_bytes, v_tracked_client_count
  from public.refresh_practitioner_usage_metrics(p_profile_id);

  if coalesce(v_storage_limit_bytes, 0) <= 0 then
    return true;
  end if;

  if coalesce(v_storage_used_bytes, 0) + greatest(coalesce(p_additional_bytes, 0), 0) > v_storage_limit_bytes then
    raise exception 'Storage limit reached. Upgrade your storage or remove existing files before uploading more documents.';
  end if;

  return true;
end;
$$;

create or replace function public.enforce_documents_fair_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_count integer;
begin
  if coalesce(new.file_size, 0) > 10 * 1024 * 1024 then
    raise exception 'Files larger than 10 MB are not allowed.';
  end if;

  if new.client_id is not null then
    select count(*)
    into v_existing_count
    from public.documents d
    where d.client_id = new.client_id
      and d.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if tg_op = 'INSERT' and v_existing_count >= 50 then
      raise exception 'This client has reached the maximum of 50 uploaded files.';
    end if;
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = new.uploaded_by
      and p.role = 'consultant'
  ) then
    perform public.ensure_practitioner_storage_capacity(new.uploaded_by, coalesce(new.file_size, 0));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_documents_fair_usage on public.documents;
create trigger trg_documents_fair_usage
before insert or update on public.documents
for each row execute function public.enforce_documents_fair_usage();

create or replace function public.refresh_document_uploader_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.uploaded_by is not null then
    if exists (
      select 1
      from public.profiles p
      where p.id = new.uploaded_by
        and p.role = 'consultant'
    ) then
      perform public.refresh_practitioner_usage_metrics(new.uploaded_by);
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.uploaded_by is not null then
    if exists (
      select 1
      from public.profiles p
      where p.id = old.uploaded_by
        and p.role = 'consultant'
    ) then
      perform public.refresh_practitioner_usage_metrics(old.uploaded_by);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_documents_refresh_practitioner_usage on public.documents;
create trigger trg_documents_refresh_practitioner_usage
after insert or update or delete on public.documents
for each row execute function public.refresh_document_uploader_usage();

create or replace function public.enforce_practitioner_verification_document_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.file_size, 0) > 10 * 1024 * 1024 then
    raise exception 'Files larger than 10 MB are not allowed.';
  end if;

  perform public.ensure_practitioner_storage_capacity(new.practitioner_profile_id, coalesce(new.file_size, 0));
  return new;
end;
$$;

drop trigger if exists trg_practitioner_verification_documents_usage on public.practitioner_verification_documents;
create trigger trg_practitioner_verification_documents_usage
before insert or update on public.practitioner_verification_documents
for each row execute function public.enforce_practitioner_verification_document_usage();

create or replace function public.refresh_practitioner_verification_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.practitioner_profile_id is not null then
    perform public.refresh_practitioner_usage_metrics(new.practitioner_profile_id);
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.practitioner_profile_id is not null then
    perform public.refresh_practitioner_usage_metrics(old.practitioner_profile_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_practitioner_verification_documents_refresh_usage on public.practitioner_verification_documents;
create trigger trg_practitioner_verification_documents_refresh_usage
after insert or update or delete on public.practitioner_verification_documents
for each row execute function public.refresh_practitioner_verification_usage();

create or replace function public.enforce_service_request_document_attachment_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.file_size, 0) > 10 * 1024 * 1024 then
    raise exception 'Files larger than 10 MB are not allowed.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_service_request_documents_attachment_limit on public.service_request_documents;
create trigger trg_service_request_documents_attachment_limit
before insert or update on public.service_request_documents
for each row execute function public.enforce_service_request_document_attachment_limit();

create or replace function public.complete_practitioner_credit_purchase(
  p_purchase_id uuid,
  p_provider_payment_id text default null,
  p_payment_status text default 'completed',
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.practitioner_credit_purchases%rowtype;
  v_balance integer;
  v_existing_credit boolean;
begin
  select *
  into v_purchase
  from public.practitioner_credit_purchases
  where id = p_purchase_id
  for update;

  if v_purchase.id is null then
    raise exception 'Credit purchase not found.';
  end if;

  perform public.ensure_practitioner_credit_account(v_purchase.practitioner_profile_id, false);

  if lower(coalesce(p_payment_status, 'completed')) <> 'completed' then
    update public.practitioner_credit_purchases
    set
      payment_status = lower(p_payment_status),
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
    where id = p_purchase_id;

    return null;
  end if;

  select exists (
    select 1
    from public.practitioner_credit_transactions
    where purchase_id = p_purchase_id
      and transaction_type = 'package_purchase'
  )
  into v_existing_credit;

  update public.practitioner_credit_purchases
  set
    payment_status = 'completed',
    provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
  where id = p_purchase_id;

  if not v_existing_credit then
    v_balance := public.grant_practitioner_purchased_credits(v_purchase.practitioner_profile_id, v_purchase.credits);

    insert into public.practitioner_credit_transactions (
      practitioner_profile_id,
      purchase_id,
      transaction_type,
      credits_delta,
      balance_after,
      description,
      metadata,
      credit_bucket,
      purchased_credits_used
    )
    values (
      v_purchase.practitioner_profile_id,
      v_purchase.id,
      'package_purchase',
      v_purchase.credits,
      v_balance,
      v_purchase.package_name || ' credit purchase',
      jsonb_build_object(
        'amount_zar', v_purchase.amount_zar,
        'currency', v_purchase.currency,
        'payment_provider', v_purchase.payment_provider
      ) || coalesce(p_metadata, '{}'::jsonb),
      'purchased',
      0
    );
  else
    select balance
    into v_balance
    from public.practitioner_credit_accounts
    where profile_id = v_purchase.practitioner_profile_id;
  end if;

  return coalesce(v_balance, 0);
end;
$$;

create or replace function public.complete_practitioner_storage_addon_purchase(
  p_purchase_id uuid,
  p_provider_payment_id text default null,
  p_payment_status text default 'completed',
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.practitioner_storage_addon_purchases%rowtype;
  v_storage_limit_mb integer;
begin
  select *
  into v_purchase
  from public.practitioner_storage_addon_purchases
  where id = p_purchase_id
  for update;

  if v_purchase.id is null then
    raise exception 'Storage add-on purchase not found.';
  end if;

  perform public.ensure_practitioner_credit_account(v_purchase.practitioner_profile_id, false);

  if lower(coalesce(p_payment_status, 'completed')) <> 'completed' then
    update public.practitioner_storage_addon_purchases
    set
      payment_status = lower(p_payment_status),
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
    where id = p_purchase_id;

    return public.get_practitioner_storage_limit_mb(v_purchase.practitioner_profile_id);
  end if;

  if not exists (
    select 1
    from public.practitioner_credit_transactions
    where metadata ->> 'storage_addon_purchase_id' = v_purchase.id::text
  ) then
    update public.practitioner_storage_addon_purchases
    set
      payment_status = 'completed',
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
    where id = p_purchase_id;

    update public.practitioner_credit_accounts
    set
      storage_addon_limit_mb = storage_addon_limit_mb + v_purchase.storage_mb,
      updated_at = now()
    where profile_id = v_purchase.practitioner_profile_id;

    insert into public.practitioner_credit_transactions (
      practitioner_profile_id,
      transaction_type,
      credits_delta,
      balance_after,
      description,
      metadata,
      credit_bucket
    )
    values (
      v_purchase.practitioner_profile_id,
      'storage_addon_purchase',
      0,
      public.refresh_practitioner_credit_balance(v_purchase.practitioner_profile_id),
      v_purchase.addon_name || ' storage add-on activated',
      jsonb_build_object(
        'storage_mb', v_purchase.storage_mb,
        'amount_zar', v_purchase.amount_zar,
        'storage_addon_purchase_id', v_purchase.id
      ) || coalesce(p_metadata, '{}'::jsonb),
      'purchased'
    );
  end if;

  v_storage_limit_mb := public.get_practitioner_storage_limit_mb(v_purchase.practitioner_profile_id);
  perform public.refresh_practitioner_usage_metrics(v_purchase.practitioner_profile_id);
  return v_storage_limit_mb;
end;
$$;

create or replace function public.activate_practitioner_subscription(
  p_profile_id uuid,
  p_plan_code text,
  p_payment_provider text default 'test',
  p_provider_subscription_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.practitioner_subscription_plans%rowtype;
  v_subscription_id uuid;
  v_balance integer;
begin
  select *
  into v_plan
  from public.practitioner_subscription_plans
  where code = p_plan_code;

  if v_plan.code is null then
    raise exception 'Subscription plan not found.';
  end if;

  perform public.ensure_practitioner_credit_account(p_profile_id, false);

  update public.practitioner_subscriptions
  set
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  where practitioner_profile_id = p_profile_id
    and status = 'active';

  insert into public.practitioner_subscriptions (
    practitioner_profile_id,
    plan_code,
    status,
    payment_provider,
    provider_subscription_id,
    started_at,
    current_period_start,
    current_period_end,
    next_renewal_at,
    last_credited_at
  )
  values (
    p_profile_id,
    v_plan.code,
    'active',
    p_payment_provider,
    p_provider_subscription_id,
    now(),
    now(),
    now() + interval '1 month',
    now() + interval '1 month',
    now()
  )
  returning id into v_subscription_id;

  update public.practitioner_credit_accounts
  set
    storage_base_limit_mb = v_plan.storage_limit_mb,
    updated_at = now()
  where profile_id = p_profile_id;

  v_balance := public.grant_practitioner_monthly_credits(
    p_profile_id,
    v_plan.credits_per_month,
    now() + interval '1 month'
  );

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    subscription_id,
    transaction_type,
    credits_delta,
    balance_after,
    description,
    metadata,
    credit_bucket
  )
  values (
    p_profile_id,
    v_subscription_id,
    'subscription_credit',
    v_plan.credits_per_month,
    v_balance,
    'Monthly subscription credits reset for the current billing cycle.',
    jsonb_build_object('plan_code', v_plan.code, 'plan_name', v_plan.name, 'expires_at', now() + interval '1 month'),
    'monthly'
  );

  perform public.refresh_practitioner_usage_metrics(p_profile_id);

  return v_subscription_id;
end;
$$;

create or replace function public.process_practitioner_subscription_renewal(
  p_subscription_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.practitioner_subscriptions%rowtype;
  v_plan public.practitioner_subscription_plans%rowtype;
  v_balance integer;
begin
  select *
  into v_subscription
  from public.practitioner_subscriptions
  where id = p_subscription_id
  for update;

  if v_subscription.id is null or v_subscription.status <> 'active' then
    return false;
  end if;

  if v_subscription.next_renewal_at > now() then
    return false;
  end if;

  select *
  into v_plan
  from public.practitioner_subscription_plans
  where code = v_subscription.plan_code;

  if v_plan.code is null then
    return false;
  end if;

  update public.practitioner_subscriptions
  set
    current_period_start = v_subscription.next_renewal_at,
    current_period_end = v_subscription.next_renewal_at + interval '1 month',
    next_renewal_at = v_subscription.next_renewal_at + interval '1 month',
    last_credited_at = now(),
    updated_at = now()
  where id = v_subscription.id;

  update public.practitioner_credit_accounts
  set
    storage_base_limit_mb = v_plan.storage_limit_mb,
    updated_at = now()
  where profile_id = v_subscription.practitioner_profile_id;

  v_balance := public.grant_practitioner_monthly_credits(
    v_subscription.practitioner_profile_id,
    v_plan.credits_per_month,
    v_subscription.next_renewal_at + interval '1 month'
  );

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    subscription_id,
    transaction_type,
    credits_delta,
    balance_after,
    description,
    metadata,
    credit_bucket
  )
  values (
    v_subscription.practitioner_profile_id,
    v_subscription.id,
    'subscription_credit',
    v_plan.credits_per_month,
    v_balance,
    'Monthly subscription credits reset for the new billing cycle.',
    jsonb_build_object('plan_code', v_plan.code, 'plan_name', v_plan.name, 'expires_at', v_subscription.next_renewal_at + interval '1 month'),
    'monthly'
  );

  perform public.refresh_practitioner_usage_metrics(v_subscription.practitioner_profile_id);

  return true;
end;
$$;

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
  if p_issued_by_id is null then
    v_current_user_id := auth.uid();
  else
    v_current_user_id := p_issued_by_id;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_current_user_id and role = 'admin'
  ) then
    raise exception 'Only admins can grant credits';
  end if;

  perform public.ensure_practitioner_credit_account(p_practitioner_profile_id, false);
  v_balance := public.grant_practitioner_purchased_credits(p_practitioner_profile_id, p_credits);

  if p_credit_type in ('bonus', 'referral') then
    update public.practitioner_credit_accounts
    set total_bonus_credits = total_bonus_credits + p_credits
    where profile_id = p_practitioner_profile_id;
  end if;

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
    metadata,
    credit_bucket
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
    ),
    case when p_credit_type = 'referral' then 'referral' else 'bonus' end
  );

  return v_balance;
end;
$$;

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
  v_monthly_used integer;
  v_purchased_used integer;
begin
  if p_issued_by_id is null then
    v_current_user_id := auth.uid();
  else
    v_current_user_id := p_issued_by_id;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_current_user_id and role = 'admin'
  ) then
    raise exception 'Only admins can deduct credits';
  end if;

  select balance, monthly_used, purchased_used
  into v_balance, v_monthly_used, v_purchased_used
  from public.consume_practitioner_credit_wallet(p_practitioner_profile_id, p_credits);

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    transaction_type,
    credits_delta,
    balance_after,
    description,
    issued_by,
    reason,
    metadata,
    credit_bucket,
    monthly_credits_used,
    purchased_credits_used
  )
  values (
    p_practitioner_profile_id,
    'admin_deduction',
    -p_credits,
    v_balance,
    'Admin deducted ' || p_credits || ' credits: ' || p_reason,
    v_current_user_id,
    p_reason,
    jsonb_build_object('reason', p_reason),
    case
      when v_monthly_used > 0 and v_purchased_used > 0 then 'mixed'
      when v_monthly_used > 0 then 'monthly'
      else 'purchased'
    end,
    v_monthly_used,
    v_purchased_used
  );

  return v_balance;
end;
$$;

create or replace function public.admin_update_practitioner_storage_limits(
  p_practitioner_profile_id uuid,
  p_storage_override_limit_mb integer default null,
  p_storage_addon_delta_mb integer default 0,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_limit_mb integer;
begin
  if not exists (
    select 1
    from public.profiles
    where id = v_current_user_id
      and role = 'admin'
  ) then
    raise exception 'Only admins can update practitioner storage limits';
  end if;

  perform public.ensure_practitioner_credit_account(p_practitioner_profile_id, false);

  update public.practitioner_credit_accounts
  set
    storage_override_limit_mb = coalesce(p_storage_override_limit_mb, storage_override_limit_mb),
    storage_addon_limit_mb = greatest(storage_addon_limit_mb + coalesce(p_storage_addon_delta_mb, 0), 0),
    updated_at = now()
  where profile_id = p_practitioner_profile_id;

  v_limit_mb := public.get_practitioner_storage_limit_mb(p_practitioner_profile_id);

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    transaction_type,
    credits_delta,
    balance_after,
    description,
    issued_by,
    reason,
    metadata,
    credit_bucket
  )
  values (
    p_practitioner_profile_id,
    'admin_grant',
    0,
    public.refresh_practitioner_credit_balance(p_practitioner_profile_id),
    'Admin updated storage allocation.',
    v_current_user_id,
    coalesce(p_reason, 'Manual storage allocation update'),
    jsonb_build_object(
      'storage_override_limit_mb', p_storage_override_limit_mb,
      'storage_addon_delta_mb', p_storage_addon_delta_mb,
      'effective_storage_limit_mb', v_limit_mb
    ),
    'purchased'
  );

  perform public.refresh_practitioner_usage_metrics(p_practitioner_profile_id);
  return v_limit_mb;
end;
$$;

create or replace function public.admin_update_practitioner_subscription_plan(
  p_plan_code text,
  p_name text,
  p_price_zar numeric,
  p_credits_per_month integer,
  p_storage_limit_mb integer,
  p_listing_priority_level integer,
  p_includes_verified_badge boolean default true,
  p_includes_standard_listing boolean default true,
  p_includes_priority_listing boolean default false,
  p_includes_featured_profile boolean default false,
  p_includes_highlighted_profile boolean default false,
  p_includes_upgrade_support boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Only admins can update subscription plans.';
  end if;

  update public.practitioner_subscription_plans
  set
    name = p_name,
    price_zar = p_price_zar,
    credits_per_month = p_credits_per_month,
    storage_limit_mb = p_storage_limit_mb,
    listing_priority_level = p_listing_priority_level,
    includes_verified_badge = p_includes_verified_badge,
    includes_standard_listing = p_includes_standard_listing,
    includes_priority_listing = p_includes_priority_listing,
    includes_featured_profile = p_includes_featured_profile,
    includes_highlighted_profile = p_includes_highlighted_profile,
    includes_upgrade_support = p_includes_upgrade_support,
    updated_at = now()
  where code = p_plan_code;

  if not found then
    raise exception 'Subscription plan not found.';
  end if;

  return true;
end;
$$;

create or replace function public.unlock_service_request_access(
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_access public.service_request_access_requests%rowtype;
  v_balance integer;
  v_cost integer;
  v_response_count integer;
  v_monthly_used integer;
  v_purchased_used integer;
  v_service_list public.service_request_service_needed[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if public.get_my_role() <> 'consultant' then
    raise exception 'Only practitioners can unlock leads.';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if v_request.id is null then
    raise exception 'Service request not found.';
  end if;

  select *
  into v_access
  from public.service_request_access_requests
  where service_request_id = p_request_id
    and practitioner_profile_id = auth.uid()
  for update;

  if v_access.id is not null and v_access.credit_deducted then
    if v_access.status <> 'approved' then
      update public.service_request_access_requests
      set
        status = 'approved',
        responded_at = coalesce(responded_at, now()),
        updated_at = now()
      where id = v_access.id;
    end if;

    return 'already_unlocked';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_request_id::text));

  select count(*)
  into v_response_count
  from public.service_request_responses
  where service_request_id = p_request_id;

  if v_response_count >= 4 then
    raise exception 'Response limit reached.';
  end if;

  v_service_list := case
    when coalesce(array_length(v_request.service_needed_list, 1), 0) > 0 then v_request.service_needed_list
    when v_request.service_needed is not null then array[v_request.service_needed]
    else '{}'::public.service_request_service_needed[]
  end;

  v_cost := coalesce(v_access.credit_cost, public.get_service_request_credit_cost_for_services(v_service_list));

  select balance, monthly_used, purchased_used
  into v_balance, v_monthly_used, v_purchased_used
  from public.consume_practitioner_credit_wallet(auth.uid(), v_cost);

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    service_request_id,
    transaction_type,
    credits_delta,
    balance_after,
    description,
    metadata,
    credit_bucket,
    monthly_credits_used,
    purchased_credits_used
  )
  values (
    auth.uid(),
    p_request_id,
    'lead_unlock',
    -v_cost,
    v_balance,
    'Credits used to unlock service request',
    jsonb_build_object('credit_cost', v_cost, 'service_list', v_service_list),
    case
      when v_monthly_used > 0 and v_purchased_used > 0 then 'mixed'
      when v_monthly_used > 0 then 'monthly'
      else 'purchased'
    end,
    v_monthly_used,
    v_purchased_used
  );

  if v_access.id is null then
    insert into public.service_request_access_requests (
      service_request_id,
      practitioner_profile_id,
      status,
      credit_cost,
      credit_deducted,
      requested_at,
      responded_at
    )
    values (
      p_request_id,
      auth.uid(),
      'approved',
      v_cost,
      true,
      now(),
      now()
    );
  else
    update public.service_request_access_requests
    set
      status = 'approved',
      credit_cost = v_cost,
      credit_deducted = true,
      responded_at = coalesce(responded_at, now()),
      updated_at = now()
    where id = v_access.id;
  end if;

  update public.service_requests
  set
    status = case
      when status = 'new' then 'viewed'::public.service_request_status
      else status
    end,
    updated_at = now()
  where id = p_request_id;

  return 'approved';
end;
$$;

create or replace function public.consume_practitioner_credit_on_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_cost integer;
  v_response_count integer;
  v_service_list public.service_request_service_needed[];
  v_access public.service_request_access_requests%rowtype;
  v_monthly_used integer;
  v_purchased_used integer;
begin
  select count(*)
  into v_response_count
  from public.service_request_responses
  where service_request_id = new.service_request_id;

  if v_response_count > 4 then
    raise exception 'This lead has reached the maximum of 4 practitioner responses.';
  end if;

  select *
  into v_access
  from public.service_request_access_requests
  where service_request_id = new.service_request_id
    and practitioner_profile_id = new.practitioner_profile_id;

  if v_access.id is null or v_access.status <> 'approved' then
    raise exception 'Unlock this lead before responding.';
  end if;

  if v_access.credit_deducted then
    return new;
  end if;

  select case
      when coalesce(array_length(sr.service_needed_list, 1), 0) > 0 then sr.service_needed_list
      when sr.service_needed is not null then array[sr.service_needed]
      else '{}'::public.service_request_service_needed[]
    end
  into v_service_list
  from public.service_requests sr
  where sr.id = new.service_request_id;

  v_cost := coalesce(v_access.credit_cost, public.get_service_request_credit_cost_for_services(v_service_list));

  select balance, monthly_used, purchased_used
  into v_balance, v_monthly_used, v_purchased_used
  from public.consume_practitioner_credit_wallet(new.practitioner_profile_id, v_cost);

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    service_request_id,
    response_id,
    transaction_type,
    credits_delta,
    balance_after,
    description,
    metadata,
    credit_bucket,
    monthly_credits_used,
    purchased_credits_used
  )
  values (
    new.practitioner_profile_id,
    new.service_request_id,
    new.id,
    'lead_unlock',
    -v_cost,
    v_balance,
    'Lead unlock credit deduction.',
    jsonb_build_object('credit_cost', v_cost, 'service_list', v_service_list),
    case
      when v_monthly_used > 0 and v_purchased_used > 0 then 'mixed'
      when v_monthly_used > 0 then 'monthly'
      else 'purchased'
    end,
    v_monthly_used,
    v_purchased_used
  );

  update public.service_request_access_requests
  set
    status = 'approved',
    credit_cost = v_cost,
    credit_deducted = true,
    responded_at = coalesce(responded_at, now()),
    updated_at = now()
  where id = v_access.id;

  return new;
end;
$$;

update public.practitioner_subscription_plans
set
  name = case code
    when 'starter' then 'Starter'
    when 'professional' then 'Professional'
    when 'business' then 'Business'
    else name
  end,
  price_zar = case code
    when 'starter' then 299
    when 'professional' then 499
    when 'business' then 899
    else price_zar
  end,
  credits_per_month = case code
    when 'starter' then 10
    when 'professional' then 20
    when 'business' then 40
    else credits_per_month
  end,
  storage_limit_mb = case code
    when 'starter' then 2048
    when 'professional' then 8192
    when 'business' then 20480
    else storage_limit_mb
  end,
  listing_priority_level = case code
    when 'starter' then 1
    when 'professional' then 2
    when 'business' then 3
    else listing_priority_level
  end,
  includes_verified_badge = true,
  includes_standard_listing = true,
  includes_priority_listing = case when code in ('professional', 'business') then true else false end,
  includes_featured_profile = case when code in ('professional', 'business') then true else false end,
  includes_highlighted_profile = case when code = 'business' then true else false end,
  includes_upgrade_support = true,
  updated_at = now()
where code in ('starter', 'professional', 'business');

update public.practitioner_credit_accounts pca
set
  storage_base_limit_mb = coalesce((
    select psp.storage_limit_mb
    from public.practitioner_subscriptions ps
    join public.practitioner_subscription_plans psp on psp.code = ps.plan_code
    where ps.practitioner_profile_id = pca.profile_id
      and ps.status = 'active'
    order by ps.created_at desc
    limit 1
  ), pca.storage_base_limit_mb),
  updated_at = now();

do $$
declare
  v_profile_id uuid;
begin
  for v_profile_id in
    select id
    from public.profiles
    where role = 'consultant'
  loop
    perform public.ensure_practitioner_credit_account(v_profile_id, false);
    perform public.refresh_practitioner_usage_metrics(v_profile_id);
  end loop;
end;
$$;

alter table public.practitioner_storage_addon_purchases enable row level security;

drop policy if exists "practitioner_storage_addon_purchases_select_own_or_admin" on public.practitioner_storage_addon_purchases;
create policy "practitioner_storage_addon_purchases_select_own_or_admin"
on public.practitioner_storage_addon_purchases
for select
using (
  auth.uid() = practitioner_profile_id
  or public.get_my_role() = 'admin'
);

drop policy if exists "practitioner_storage_addon_purchases_insert_own" on public.practitioner_storage_addon_purchases;
create policy "practitioner_storage_addon_purchases_insert_own"
on public.practitioner_storage_addon_purchases
for insert
with check (
  auth.uid() = practitioner_profile_id
  and public.get_my_role() = 'consultant'
  and payment_status = 'pending'
  and payment_provider in ('paystack', 'test')
);

drop policy if exists "practitioner_storage_addon_purchases_update_own_pending" on public.practitioner_storage_addon_purchases;
create policy "practitioner_storage_addon_purchases_update_own_pending"
on public.practitioner_storage_addon_purchases
for update
using (
  auth.uid() = practitioner_profile_id
  and public.get_my_role() = 'consultant'
)
with check (
  auth.uid() = practitioner_profile_id
  and public.get_my_role() = 'consultant'
  and payment_provider in ('paystack', 'test')
);
