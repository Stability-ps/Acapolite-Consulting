create table if not exists public.practitioner_subscription_plans (
  code text primary key,
  name text not null,
  price_zar numeric not null check (price_zar >= 0),
  credits_per_month integer not null check (credits_per_month > 0),
  includes_verified_badge boolean not null default true,
  includes_standard_listing boolean not null default false,
  includes_priority_listing boolean not null default false,
  includes_featured_profile boolean not null default false,
  includes_highlighted_profile boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_practitioner_subscription_plans_updated_at on public.practitioner_subscription_plans;
create trigger trg_practitioner_subscription_plans_updated_at
before update on public.practitioner_subscription_plans
for each row execute function public.set_updated_at();

create table if not exists public.practitioner_subscriptions (
  id uuid primary key default gen_random_uuid(),
  practitioner_profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_code text not null references public.practitioner_subscription_plans(code) on delete restrict,
  status text not null default 'active' check (status in ('active', 'cancelled', 'paused', 'past_due')),
  payment_provider text not null default 'test' check (payment_provider in ('test', 'payfast')),
  provider_subscription_id text,
  started_at timestamptz not null default now(),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '1 month'),
  next_renewal_at timestamptz not null default (now() + interval '1 month'),
  last_credited_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_practitioner_subscriptions_active
  on public.practitioner_subscriptions(practitioner_profile_id)
  where status = 'active';

create index if not exists idx_practitioner_subscriptions_next_renewal
  on public.practitioner_subscriptions(next_renewal_at);

drop trigger if exists trg_practitioner_subscriptions_updated_at on public.practitioner_subscriptions;
create trigger trg_practitioner_subscriptions_updated_at
before update on public.practitioner_subscriptions
for each row execute function public.set_updated_at();

alter table public.practitioner_credit_transactions
  add column if not exists subscription_id uuid references public.practitioner_subscriptions(id) on delete set null;

alter table public.practitioner_credit_transactions
  drop constraint if exists practitioner_credit_transactions_transaction_type_check;

alter table public.practitioner_credit_transactions
  add constraint practitioner_credit_transactions_transaction_type_check
  check (transaction_type in ('signup_bonus', 'signup_bonus_adjustment', 'package_purchase', 'lead_response', 'subscription_credit', 'admin_grant', 'admin_deduction', 'refund'));

create or replace function public.get_service_request_credit_cost(
  p_service_needed public.service_request_service_needed
)
returns integer
language plpgsql
immutable
as $$
begin
  return case p_service_needed
    when 'tax_return' then 2
    when 'sars_debt_assistance' then 5
    when 'vat_registration' then 3
    when 'company_tax' then 4
    when 'paye_issues' then 4
    when 'objection_dispute' then 6
    when 'bookkeeping' then 5
    else 4;
end;
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
      balance = balance + 10,
      total_bonus_credits = total_bonus_credits + 10,
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
      10,
      coalesce(v_balance, 10),
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
  v_service_needed public.service_request_service_needed;
begin
  select count(*)
  into v_response_count
  from public.service_request_responses
  where service_request_id = new.service_request_id;

  if v_response_count >= 4 then
    raise exception 'This lead has reached the maximum of 4 practitioner responses.';
  end if;

  select service_needed
  into v_service_needed
  from public.service_requests
  where id = new.service_request_id;

  v_cost := public.get_service_request_credit_cost(v_service_needed);

  perform public.ensure_practitioner_credit_account(new.practitioner_profile_id, false);

  select balance
  into v_balance
  from public.practitioner_credit_accounts
  where profile_id = new.practitioner_profile_id
  for update;

  if coalesce(v_balance, 0) < v_cost then
    raise exception 'You need % credits to respond to this request. Please purchase more credits.', v_cost;
  end if;

  update public.practitioner_credit_accounts
  set
    balance = balance - v_cost,
    total_used_credits = total_used_credits + v_cost,
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
    description,
    metadata
  )
  values (
    new.practitioner_profile_id,
    new.service_request_id,
    new.id,
    'lead_response',
    -v_cost,
    v_balance,
    'Lead response credit deduction.',
    jsonb_build_object('credit_cost', v_cost, 'service_needed', v_service_needed::text)
  );

  return new;
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
    balance = balance + v_plan.credits_per_month,
    total_purchased_credits = total_purchased_credits + v_plan.credits_per_month,
    updated_at = now()
  where profile_id = p_profile_id
  returning balance into v_balance;

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    subscription_id,
    transaction_type,
    credits_delta,
    balance_after,
    description,
    metadata
  )
  values (
    p_profile_id,
    v_subscription_id,
    'subscription_credit',
    v_plan.credits_per_month,
    v_balance,
    'Monthly subscription credits.',
    jsonb_build_object('plan_code', v_plan.code, 'plan_name', v_plan.name)
  );

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
    balance = balance + v_plan.credits_per_month,
    total_purchased_credits = total_purchased_credits + v_plan.credits_per_month,
    updated_at = now()
  where profile_id = v_subscription.practitioner_profile_id
  returning balance into v_balance;

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    subscription_id,
    transaction_type,
    credits_delta,
    balance_after,
    description,
    metadata
  )
  values (
    v_subscription.practitioner_profile_id,
    v_subscription.id,
    'subscription_credit',
    v_plan.credits_per_month,
    v_balance,
    'Monthly subscription credits.',
    jsonb_build_object('plan_code', v_plan.code, 'plan_name', v_plan.name)
  );

  return true;
end;
$$;

create or replace function public.process_practitioner_subscription_renewals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_id uuid;
  v_processed integer := 0;
begin
  for v_subscription_id in
    select id
    from public.practitioner_subscriptions
    where status = 'active'
      and next_renewal_at <= now()
  loop
    if public.process_practitioner_subscription_renewal(v_subscription_id) then
      v_processed := v_processed + 1;
    end if;
  end loop;

  return v_processed;
end;
$$;

insert into public.practitioner_subscription_plans (
  code, name, price_zar, credits_per_month,
  includes_verified_badge, includes_standard_listing, includes_priority_listing,
  includes_featured_profile, includes_highlighted_profile
)
values
  ('starter', 'Starter Plan', 299, 15, true, true, false, false, false),
  ('professional', 'Professional Plan', 499, 25, true, true, true, true, false),
  ('business', 'Business Plan', 899, 50, true, true, true, true, true)
on conflict (code) do update
set
  name = excluded.name,
  price_zar = excluded.price_zar,
  credits_per_month = excluded.credits_per_month,
  includes_verified_badge = excluded.includes_verified_badge,
  includes_standard_listing = excluded.includes_standard_listing,
  includes_priority_listing = excluded.includes_priority_listing,
  includes_featured_profile = excluded.includes_featured_profile,
  includes_highlighted_profile = excluded.includes_highlighted_profile,
  updated_at = now();

do $$
declare
  v_profile_id uuid;
  v_balance integer;
begin
  for v_profile_id in
    select p.id
    from public.profiles p
    where p.role = 'consultant'
  loop
    if exists (
      select 1
      from public.practitioner_credit_transactions t
      where t.practitioner_profile_id = v_profile_id
        and t.transaction_type = 'signup_bonus'
        and t.credits_delta = 3
    ) then
      update public.practitioner_credit_accounts
      set
        balance = balance + 7,
        total_bonus_credits = total_bonus_credits + 7,
        updated_at = now()
      where profile_id = v_profile_id
      returning balance into v_balance;

      insert into public.practitioner_credit_transactions (
        practitioner_profile_id,
        transaction_type,
        credits_delta,
        balance_after,
        description
      )
      values (
        v_profile_id,
        'signup_bonus_adjustment',
        7,
        coalesce(v_balance, 7),
        'Signup bonus adjustment to 10 credits.'
      );
    end if;
  end loop;
end;
$$;

alter table public.practitioner_subscription_plans enable row level security;
alter table public.practitioner_subscriptions enable row level security;

drop policy if exists "practitioner_subscription_plans_select" on public.practitioner_subscription_plans;
create policy "practitioner_subscription_plans_select"
on public.practitioner_subscription_plans
for select
using (auth.uid() is not null);

drop policy if exists "practitioner_subscriptions_select_own_or_admin" on public.practitioner_subscriptions;
create policy "practitioner_subscriptions_select_own_or_admin"
on public.practitioner_subscriptions
for select
using (
  auth.uid() = practitioner_profile_id
  or public.get_my_role() = 'admin'
);
