create table if not exists public.service_request_access_requests (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  practitioner_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  credit_cost integer not null default 1,
  credit_deducted boolean not null default false,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_request_id, practitioner_profile_id)
);

create index if not exists idx_service_request_access_requests_request
  on public.service_request_access_requests(service_request_id);

create index if not exists idx_service_request_access_requests_practitioner
  on public.service_request_access_requests(practitioner_profile_id);

drop trigger if exists trg_service_request_access_requests_updated_at on public.service_request_access_requests;
create trigger trg_service_request_access_requests_updated_at
before update on public.service_request_access_requests
for each row execute function public.set_updated_at();

alter table public.service_request_access_requests enable row level security;

drop policy if exists "service_request_access_requests_select" on public.service_request_access_requests;
create policy "service_request_access_requests_select"
on public.service_request_access_requests
for select
using (
  public.is_admin_or_consultant()
  or auth.uid() = practitioner_profile_id
  or exists (
    select 1
    from public.service_requests sr
    where sr.id = service_request_id
      and lower(coalesce(sr.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
  )
);

drop policy if exists "service_request_access_requests_insert" on public.service_request_access_requests;
create policy "service_request_access_requests_insert"
on public.service_request_access_requests
for insert
with check (
  auth.uid() = practitioner_profile_id
  and public.get_my_role() = 'consultant'
);

drop policy if exists "service_request_access_requests_update_admin" on public.service_request_access_requests;
create policy "service_request_access_requests_update_admin"
on public.service_request_access_requests
for update
using (public.is_admin_or_consultant())
with check (public.is_admin_or_consultant());

alter table public.practitioner_credit_transactions
  drop constraint if exists practitioner_credit_transactions_transaction_type_check;

alter table public.practitioner_credit_transactions
  add constraint practitioner_credit_transactions_transaction_type_check
  check (transaction_type in ('signup_bonus', 'signup_bonus_adjustment', 'package_purchase', 'lead_response', 'lead_unlock', 'subscription_credit', 'admin_grant', 'admin_deduction', 'refund'));

create or replace function public.respond_to_service_request_access(
  p_access_request_id uuid,
  p_action text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_request_access_requests%rowtype;
  v_service public.service_requests%rowtype;
  v_balance integer;
  v_cost integer;
  v_action text;
begin
  v_action := lower(coalesce(p_action, ''));

  select *
  into v_request
  from public.service_request_access_requests
  where id = p_access_request_id
  for update;

  if v_request.id is null then
    raise exception 'Access request not found.';
  end if;

  select *
  into v_service
  from public.service_requests
  where id = v_request.service_request_id;

  if v_service.id is null then
    raise exception 'Service request not found.';
  end if;

  if public.get_my_role() <> 'admin'
    and lower(coalesce(v_service.email, '')) <> lower(coalesce(auth.jwt()->>'email', ''))
  then
    raise exception 'You are not authorized to respond to this request.';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This access request has already been resolved.';
  end if;

  if v_action = 'approve' then
    v_cost := coalesce(v_request.credit_cost, public.get_service_request_credit_cost(v_service.service_needed));

    perform public.ensure_practitioner_credit_account(v_request.practitioner_profile_id, false);

    select balance
    into v_balance
    from public.practitioner_credit_accounts
    where profile_id = v_request.practitioner_profile_id
    for update;

    if coalesce(v_balance, 0) < v_cost then
      raise exception 'Practitioner does not have enough credits to unlock this lead.';
    end if;

    update public.practitioner_credit_accounts
    set
      balance = balance - v_cost,
      total_used_credits = total_used_credits + v_cost,
      updated_at = now()
    where profile_id = v_request.practitioner_profile_id
    returning balance into v_balance;

    insert into public.practitioner_credit_transactions (
      practitioner_profile_id,
      service_request_id,
      transaction_type,
      credits_delta,
      balance_after,
      description,
      metadata
    )
    values (
      v_request.practitioner_profile_id,
      v_request.service_request_id,
      'lead_unlock',
      -v_cost,
      v_balance,
      'Lead unlock credit deduction.',
      jsonb_build_object('credit_cost', v_cost, 'service_needed', v_service.service_needed::text)
    );

    update public.service_request_access_requests
    set
      status = 'approved',
      credit_cost = v_cost,
      credit_deducted = true,
      responded_at = now(),
      updated_at = now()
    where id = v_request.id;

    return 'approved';
  elsif v_action = 'decline' then
    update public.service_request_access_requests
    set
      status = 'declined',
      responded_at = now(),
      updated_at = now()
    where id = v_request.id;

    return 'declined';
  else
    raise exception 'Invalid action. Use approve or decline.';
  end if;
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
  v_access public.service_request_access_requests%rowtype;
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

  select *
  into v_access
  from public.service_request_access_requests
  where service_request_id = new.service_request_id
    and practitioner_profile_id = new.practitioner_profile_id;

  if v_access.id is null or v_access.status <> 'approved' then
    raise exception 'Client approval is required before responding to this lead.';
  end if;

  if v_access.credit_deducted then
    return new;
  end if;

  v_cost := coalesce(v_access.credit_cost, public.get_service_request_credit_cost(v_service_needed));

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
    'lead_unlock',
    -v_cost,
    v_balance,
    'Lead unlock credit deduction.',
    jsonb_build_object('credit_cost', v_cost, 'service_needed', v_service_needed::text)
  );

  update public.service_request_access_requests
  set
    credit_cost = v_cost,
    credit_deducted = true,
    updated_at = now()
  where id = v_access.id;

  return new;
end;
$$;
