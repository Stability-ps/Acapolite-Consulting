do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_access_tier') then
    create type public.lead_access_tier as enum ('basic', 'professional', 'business');
  end if;
end
$$;

alter table public.service_requests
  add column if not exists lead_tier public.lead_access_tier,
  add column if not exists has_sars_audit boolean not null default false,
  add column if not exists has_adr boolean not null default false,
  add column if not exists has_vat_investigation boolean not null default false,
  add column if not exists has_payroll_dispute boolean not null default false,
  add column if not exists has_multiple_tax_types boolean not null default false,
  add column if not exists has_legal_complexity boolean not null default false;

alter table public.practitioner_profiles
  add column if not exists lead_access_enabled boolean not null default true,
  add column if not exists lead_notifications_enabled boolean not null default true,
  add column if not exists lead_access_status text not null default 'active'
    check (lead_access_status in ('active', 'lead_paused', 'notifications_paused', 'suspended'));

create or replace function public.lead_access_tier_rank(
  p_tier public.lead_access_tier
)
returns integer
language sql
immutable
as $$
  select case p_tier
    when 'business' then 3
    when 'professional' then 2
    else 1
  end
$$;

create or replace function public.get_practitioner_lead_access_tier(
  p_profile_id uuid
)
returns public.lead_access_tier
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_plan_code text;
begin
  select ps.plan_code
  into v_plan_code
  from public.practitioner_subscriptions ps
  where ps.practitioner_profile_id = p_profile_id
    and ps.status = 'active'
  order by ps.created_at desc
  limit 1;

  if v_plan_code = 'business' then
    return 'business'::public.lead_access_tier;
  end if;

  if v_plan_code = 'professional' then
    return 'professional'::public.lead_access_tier;
  end if;

  return 'basic'::public.lead_access_tier;
end;
$$;

create or replace function public.get_service_request_min_access_tier(
  p_services public.service_request_service_needed[]
)
returns public.lead_access_tier
language plpgsql
immutable
as $$
declare
  v_service public.service_request_service_needed;
  v_required_tier public.lead_access_tier := 'basic'::public.lead_access_tier;
begin
  foreach v_service in array coalesce(p_services, '{}'::public.service_request_service_needed[]) loop
    if v_service = 'business_sars_audits_support' then
      return 'business'::public.lead_access_tier;
    end if;

    if v_service in (
      'individual_sars_debt_assistance',
      'individual_objections_and_disputes',
      'business_company_income_tax',
      'business_vat_registration',
      'business_vat_returns',
      'business_paye_registration',
      'business_paye_compliance',
      'business_sars_debt_arrangements',
      'business_tax_clearance_certificates',
      'accounting_bookkeeping',
      'accounting_financial_statements',
      'accounting_management_accounts',
      'accounting_payroll_services',
      'accounting_monthly_accounting_services',
      'accounting_annual_financial_reporting',
      'support_company_registration',
      'support_business_compliance',
      'support_cipc_services',
      'support_business_advisory',
      'support_financial_compliance'
    ) then
      v_required_tier := 'professional'::public.lead_access_tier;
    end if;
  end loop;

  return v_required_tier;
end;
$$;

create or replace function public.classify_service_request_lead_tier(
  p_service_needed public.service_request_service_needed,
  p_service_needed_list public.service_request_service_needed[],
  p_sars_debt_amount numeric,
  p_has_sars_audit boolean,
  p_has_adr boolean,
  p_has_vat_investigation boolean,
  p_has_payroll_dispute boolean,
  p_has_multiple_tax_types boolean,
  p_has_legal_complexity boolean
)
returns public.lead_access_tier
language plpgsql
immutable
as $$
declare
  v_tier public.lead_access_tier := 'basic'::public.lead_access_tier;
  v_services public.service_request_service_needed[];
  v_service_tier public.lead_access_tier;
begin
  if coalesce(p_sars_debt_amount, 0) > 500000 then
    v_tier := 'business'::public.lead_access_tier;
  elsif coalesce(p_sars_debt_amount, 0) > 20000 then
    v_tier := 'professional'::public.lead_access_tier;
  end if;

  if coalesce(p_has_sars_audit, false)
    or coalesce(p_has_vat_investigation, false)
    or coalesce(p_has_payroll_dispute, false)
    or coalesce(p_has_legal_complexity, false)
  then
    v_tier := 'business'::public.lead_access_tier;
  elsif coalesce(p_has_adr, false)
    or coalesce(p_has_multiple_tax_types, false)
  then
    if public.lead_access_tier_rank(v_tier) < public.lead_access_tier_rank('professional'::public.lead_access_tier) then
      v_tier := 'professional'::public.lead_access_tier;
    end if;
  end if;

  v_services := case
    when coalesce(array_length(p_service_needed_list, 1), 0) > 0 then p_service_needed_list
    when p_service_needed is not null then array[p_service_needed]
    else '{}'::public.service_request_service_needed[]
  end;

  v_service_tier := public.get_service_request_min_access_tier(v_services);
  if public.lead_access_tier_rank(v_service_tier) > public.lead_access_tier_rank(v_tier) then
    v_tier := v_service_tier;
  end if;

  return v_tier;
end;
$$;

create or replace function public.refresh_service_request_lead_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.lead_tier := public.classify_service_request_lead_tier(
    new.service_needed,
    new.service_needed_list,
    new.sars_debt_amount,
    new.has_sars_audit,
    new.has_adr,
    new.has_vat_investigation,
    new.has_payroll_dispute,
    new.has_multiple_tax_types,
    new.has_legal_complexity
  );
  return new;
end;
$$;

drop trigger if exists trg_service_requests_refresh_lead_tier on public.service_requests;
create trigger trg_service_requests_refresh_lead_tier
before insert or update on public.service_requests
for each row execute function public.refresh_service_request_lead_tier();

update public.service_requests sr
set lead_tier = public.classify_service_request_lead_tier(
  sr.service_needed,
  sr.service_needed_list,
  sr.sars_debt_amount,
  sr.has_sars_audit,
  sr.has_adr,
  sr.has_vat_investigation,
  sr.has_payroll_dispute,
  sr.has_multiple_tax_types,
  sr.has_legal_complexity
)
where sr.lead_tier is null;

create or replace function public.get_service_request_max_responses(
  p_request_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tier public.lead_access_tier;
begin
  select coalesce(lead_tier, 'basic'::public.lead_access_tier)
  into v_tier
  from public.service_requests
  where id = p_request_id;

  return case v_tier
    when 'business' then 2
    when 'professional' then 3
    else 4
  end;
end;
$$;

create or replace function public.practitioner_can_access_leads(
  p_profile_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    join public.practitioner_profiles pp on pp.profile_id = p.id
    where p.id = p_profile_id
      and p.role = 'consultant'
      and p.is_active = true
      and coalesce(pp.lead_access_enabled, true) = true
      and coalesce(pp.verification_status, 'pending') = 'verified'
  )
$$;

create or replace function public.can_practitioner_view_service_request(
  p_profile_id uuid,
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_lead_tier public.lead_access_tier;
  v_access_tier public.lead_access_tier;
begin
  if not public.practitioner_can_access_leads(p_profile_id) then
    return false;
  end if;

  select coalesce(lead_tier, 'basic'::public.lead_access_tier)
  into v_lead_tier
  from public.service_requests
  where id = p_request_id;

  v_access_tier := public.get_practitioner_lead_access_tier(p_profile_id);
  return public.lead_access_tier_rank(v_access_tier) >= public.lead_access_tier_rank(v_lead_tier);
end;
$$;

drop policy if exists "service_requests_staff_select" on public.service_requests;
create policy "service_requests_staff_select"
on public.service_requests
for select
using (
  public.get_my_role() = 'admin'
  or (
    public.get_my_role() = 'consultant'
    and public.practitioner_can_access_leads(auth.uid())
  )
);

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
  v_max_responses integer;
  v_required_tier public.lead_access_tier;
  v_access_tier public.lead_access_tier;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if public.get_my_role() <> 'consultant' then
    raise exception 'Only practitioners can unlock leads.';
  end if;

  if not public.practitioner_can_access_leads(auth.uid()) then
    raise exception 'Lead access is currently disabled for your practitioner profile.';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if v_request.id is null then
    raise exception 'Service request not found.';
  end if;

  v_required_tier := coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier);
  v_access_tier := public.get_practitioner_lead_access_tier(auth.uid());

  if public.lead_access_tier_rank(v_access_tier) < public.lead_access_tier_rank(v_required_tier) then
    if v_required_tier = 'business'::public.lead_access_tier then
      raise exception 'Upgrade to Business to access premium SARS business matters.';
    end if;
    raise exception 'Upgrade to Professional to unlock higher-value SARS matters.';
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

  v_max_responses := public.get_service_request_max_responses(p_request_id);
  if v_response_count >= v_max_responses then
    raise exception 'Response limit reached.';
  end if;

  v_service_list := case
    when coalesce(array_length(v_request.service_needed_list, 1), 0) > 0 then v_request.service_needed_list
    when v_request.service_needed is not null then array[v_request.service_needed]
    else '{}'::public.service_request_service_needed[]
  end;

  v_cost := public.get_service_request_credit_cost_for_services(v_service_list);

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
  v_max_responses integer;
begin
  if not public.practitioner_can_access_leads(new.practitioner_profile_id) then
    raise exception 'Lead access is currently disabled for your practitioner profile.';
  end if;

  select count(*)
  into v_response_count
  from public.service_request_responses
  where service_request_id = new.service_request_id;

  v_max_responses := public.get_service_request_max_responses(new.service_request_id);
  if v_response_count > v_max_responses then
    raise exception 'This lead has reached the maximum response limit.';
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

  v_cost := public.get_service_request_credit_cost_for_services(v_service_list);

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
