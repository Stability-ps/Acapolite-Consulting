create table if not exists public.practitioner_credit_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  total_bonus_credits integer not null default 0 check (total_bonus_credits >= 0),
  total_purchased_credits integer not null default 0 check (total_purchased_credits >= 0),
  total_used_credits integer not null default 0 check (total_used_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_practitioner_credit_accounts_updated_at on public.practitioner_credit_accounts;
create trigger trg_practitioner_credit_accounts_updated_at
before update on public.practitioner_credit_accounts
for each row execute function public.set_updated_at();

create table if not exists public.practitioner_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  practitioner_profile_id uuid not null references public.profiles(id) on delete cascade,
  package_code text not null,
  package_name text not null,
  credits integer not null check (credits > 0),
  amount_zar numeric not null check (amount_zar >= 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  payment_provider text not null default 'test' check (payment_provider in ('test', 'payfast')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'completed', 'failed', 'cancelled')),
  provider_payment_id text unique,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

drop trigger if exists trg_practitioner_credit_purchases_updated_at on public.practitioner_credit_purchases;
create trigger trg_practitioner_credit_purchases_updated_at
before update on public.practitioner_credit_purchases
for each row execute function public.set_updated_at();

create table if not exists public.practitioner_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  practitioner_profile_id uuid not null references public.profiles(id) on delete cascade,
  purchase_id uuid references public.practitioner_credit_purchases(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  response_id uuid references public.service_request_responses(id) on delete set null,
  transaction_type text not null check (transaction_type in ('signup_bonus', 'package_purchase', 'lead_response', 'admin_grant', 'admin_deduction', 'refund')),
  credits_delta integer not null,
  balance_after integer not null check (balance_after >= 0),
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_practitioner_credit_purchases_profile_id
  on public.practitioner_credit_purchases(practitioner_profile_id);

create index if not exists idx_practitioner_credit_purchases_status
  on public.practitioner_credit_purchases(payment_status);

create index if not exists idx_practitioner_credit_transactions_profile_id
  on public.practitioner_credit_transactions(practitioner_profile_id);

create index if not exists idx_practitioner_credit_transactions_created_at
  on public.practitioner_credit_transactions(created_at desc);

create unique index if not exists idx_practitioner_credit_transactions_purchase_unique
  on public.practitioner_credit_transactions(purchase_id)
  where purchase_id is not null and transaction_type = 'package_purchase';

create unique index if not exists idx_practitioner_credit_transactions_response_unique
  on public.practitioner_credit_transactions(response_id)
  where response_id is not null and transaction_type = 'lead_response';

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
  insert into public.practitioner_credit_accounts (profile_id)
  values (p_profile_id)
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
      balance = balance + 3,
      total_bonus_credits = total_bonus_credits + 3,
      updated_at = now()
    where profile_id = p_profile_id
    returning balance into v_balance;

    insert into public.practitioner_credit_transactions (
      practitioner_profile_id,
      transaction_type,
      credits_delta,
      balance_after,
      description
    )
    values (
      p_profile_id,
      'signup_bonus',
      3,
      coalesce(v_balance, 3),
      'New practitioner signup bonus credits.'
    );
  end if;

  select balance
  into v_balance
  from public.practitioner_credit_accounts
  where profile_id = p_profile_id;

  return coalesce(v_balance, 0);
end;
$$;

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
    update public.practitioner_credit_accounts
    set
      balance = balance + v_purchase.credits,
      total_purchased_credits = total_purchased_credits + v_purchase.credits,
      updated_at = now()
    where profile_id = v_purchase.practitioner_profile_id
    returning balance into v_balance;

    insert into public.practitioner_credit_transactions (
      practitioner_profile_id,
      purchase_id,
      transaction_type,
      credits_delta,
      balance_after,
      description,
      metadata
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
      ) || coalesce(p_metadata, '{}'::jsonb)
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

create or replace function public.handle_practitioner_credit_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'consultant'
    and (tg_op = 'INSERT' or old.role is distinct from new.role)
  then
    perform public.ensure_practitioner_credit_account(new.id, true);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_practitioner_credit_setup on public.profiles;
create trigger trg_profiles_practitioner_credit_setup
after insert or update of role on public.profiles
for each row execute function public.handle_practitioner_credit_profile_change();

create or replace function public.consume_practitioner_credit_on_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  perform public.ensure_practitioner_credit_account(new.practitioner_profile_id, false);

  select balance
  into v_balance
  from public.practitioner_credit_accounts
  where profile_id = new.practitioner_profile_id
  for update;

  if coalesce(v_balance, 0) < 1 then
    raise exception 'You have no credits remaining. Purchase more credits before responding to a lead.';
  end if;

  update public.practitioner_credit_accounts
  set
    balance = balance - 1,
    total_used_credits = total_used_credits + 1,
    updated_at = now()
  where profile_id = new.practitioner_profile_id
  returning balance into v_balance;

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    service_request_id,
    response_id,
    transaction_type,
    credits_delta,
    balance_after,
    description
  )
  values (
    new.practitioner_profile_id,
    new.service_request_id,
    new.id,
    'lead_response',
    -1,
    v_balance,
    'Lead response credit deduction.'
  );

  return new;
end;
$$;

drop trigger if exists trg_service_request_responses_consume_credit on public.service_request_responses;
create trigger trg_service_request_responses_consume_credit
before insert on public.service_request_responses
for each row execute function public.consume_practitioner_credit_on_response();

select public.ensure_practitioner_credit_account(id, true)
from public.profiles
where role = 'consultant';

alter table public.practitioner_credit_accounts enable row level security;
alter table public.practitioner_credit_purchases enable row level security;
alter table public.practitioner_credit_transactions enable row level security;

drop policy if exists "practitioner_credit_accounts_select_own_or_admin" on public.practitioner_credit_accounts;
create policy "practitioner_credit_accounts_select_own_or_admin"
on public.practitioner_credit_accounts
for select
using (
  auth.uid() = profile_id
  or public.get_my_role() = 'admin'
);

drop policy if exists "practitioner_credit_purchases_select_own_or_admin" on public.practitioner_credit_purchases;
create policy "practitioner_credit_purchases_select_own_or_admin"
on public.practitioner_credit_purchases
for select
using (
  auth.uid() = practitioner_profile_id
  or public.get_my_role() = 'admin'
);

drop policy if exists "practitioner_credit_transactions_select_own_or_admin" on public.practitioner_credit_transactions;
create policy "practitioner_credit_transactions_select_own_or_admin"
on public.practitioner_credit_transactions
for select
using (
  auth.uid() = practitioner_profile_id
  or public.get_my_role() = 'admin'
);
