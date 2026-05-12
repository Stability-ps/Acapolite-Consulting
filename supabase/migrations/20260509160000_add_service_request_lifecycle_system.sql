alter type public.service_request_status add value if not exists 'pending_client_confirmation';
alter type public.service_request_status add value if not exists 'expired';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'service_request_lifecycle_stage') then
    create type public.service_request_lifecycle_stage as enum (
      'business_exclusive',
      'professional_access',
      'open_marketplace',
      'pending_client_confirmation',
      'expired'
    );
  end if;
end
$$;

alter table public.service_requests
  add column if not exists lifecycle_stage public.service_request_lifecycle_stage not null default 'business_exclusive',
  add column if not exists lifecycle_stage_started_at timestamptz,
  add column if not exists lifecycle_stage_expires_at timestamptz,
  add column if not exists lifecycle_reactivation_count integer not null default 0,
  add column if not exists lifecycle_last_client_activity_at timestamptz,
  add column if not exists client_confirmation_requested_at timestamptz,
  add column if not exists client_confirmation_due_at timestamptz,
  add column if not exists client_confirmation_answered_at timestamptz,
  add column if not exists expired_at timestamptz;

create table if not exists public.service_request_lifecycle_history (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  lifecycle_stage public.service_request_lifecycle_stage,
  event_type text not null,
  note text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_service_request_lifecycle_history_request_id
  on public.service_request_lifecycle_history(service_request_id, created_at desc);

create index if not exists idx_service_requests_lifecycle_stage
  on public.service_requests(lifecycle_stage, lifecycle_stage_expires_at, created_at desc);

update public.service_requests
set
  lifecycle_stage_started_at = coalesce(lifecycle_stage_started_at, created_at),
  lifecycle_last_client_activity_at = coalesce(lifecycle_last_client_activity_at, responded_at, viewed_at, updated_at, created_at),
  lifecycle_reactivation_count = coalesce(lifecycle_reactivation_count, 0),
  lifecycle_stage = case
    when status = 'pending_client_confirmation'::public.service_request_status then 'pending_client_confirmation'::public.service_request_lifecycle_stage
    when status in ('expired'::public.service_request_status, 'dead_lead'::public.service_request_status) then 'expired'::public.service_request_lifecycle_stage
    else coalesce(lifecycle_stage, 'business_exclusive'::public.service_request_lifecycle_stage)
  end,
  lifecycle_stage_expires_at = case
    when status = 'pending_client_confirmation'::public.service_request_status then coalesce(client_confirmation_due_at, coalesce(lifecycle_stage_started_at, created_at) + interval '24 hours')
    when status in ('expired'::public.service_request_status, 'dead_lead'::public.service_request_status, 'closed'::public.service_request_status, 'converted_to_client'::public.service_request_status) then null
    else coalesce(lifecycle_stage_expires_at, coalesce(lifecycle_stage_started_at, created_at) + interval '12 hours')
  end,
  expired_at = case
    when status in ('expired'::public.service_request_status, 'dead_lead'::public.service_request_status) then coalesce(expired_at, archived_at, updated_at, now())
    else expired_at
  end;

create or replace function public.log_service_request_lifecycle_event(
  p_request_id uuid,
  p_stage public.service_request_lifecycle_stage,
  p_event_type text,
  p_note text default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.service_request_lifecycle_history (
    service_request_id,
    lifecycle_stage,
    event_type,
    note,
    metadata
  )
  values (
    p_request_id,
    p_stage,
    p_event_type,
    p_note,
    p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_service_request_marketplace_required_tier(
  p_stage public.service_request_lifecycle_stage
)
returns public.lead_access_tier
language sql
immutable
as $$
  select case p_stage
    when 'business_exclusive' then 'business'::public.lead_access_tier
    when 'professional_access' then 'professional'::public.lead_access_tier
    else 'basic'::public.lead_access_tier
  end
$$;

create or replace function public.get_marketplace_practitioner_profile_ids(
  p_min_tier public.lead_access_tier default 'basic'::public.lead_access_tier
)
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(profile_id), '{}'::uuid[])
  from (
    select pp.profile_id
    from public.practitioner_profiles pp
    join public.profiles p on p.id = pp.profile_id
    where p.role = 'consultant'
      and p.is_active = true
      and public.practitioner_can_access_leads(pp.profile_id)
      and public.lead_access_tier_rank(public.get_practitioner_lead_access_tier(pp.profile_id)) >= public.lead_access_tier_rank(p_min_tier)
  ) eligible
$$;

create or replace function public.set_service_request_lifecycle_schedule()
returns trigger
language plpgsql
as $$
begin
  if new.lifecycle_stage_started_at is null then
    new.lifecycle_stage_started_at := coalesce(new.created_at, now());
  end if;

  if new.lifecycle_last_client_activity_at is null then
    new.lifecycle_last_client_activity_at := coalesce(new.updated_at, new.created_at, now());
  end if;

  if new.lifecycle_stage = 'business_exclusive'::public.service_request_lifecycle_stage and new.lifecycle_stage_expires_at is null then
    new.lifecycle_stage_expires_at := new.lifecycle_stage_started_at + interval '12 hours';
  elsif new.lifecycle_stage in ('professional_access'::public.service_request_lifecycle_stage, 'open_marketplace'::public.service_request_lifecycle_stage) and new.lifecycle_stage_expires_at is null then
    new.lifecycle_stage_expires_at := new.lifecycle_stage_started_at + interval '24 hours';
  elsif new.lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage then
    new.lifecycle_stage_expires_at := coalesce(new.client_confirmation_due_at, new.lifecycle_stage_started_at + interval '24 hours');
  elsif new.lifecycle_stage = 'expired'::public.service_request_lifecycle_stage then
    new.lifecycle_stage_expires_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_service_requests_lifecycle_schedule on public.service_requests;
create trigger trg_service_requests_lifecycle_schedule
before insert or update on public.service_requests
for each row execute function public.set_service_request_lifecycle_schedule();

create or replace function public.process_service_request_lifecycle(
  p_request_id uuid
)
returns public.service_request_lifecycle_stage
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_response_count integer;
  v_client_profile_id uuid;
  v_new_stage public.service_request_lifecycle_stage;
  v_loop_guard integer := 0;
begin
  loop
    v_loop_guard := v_loop_guard + 1;
    exit when v_loop_guard > 8;

    select *
    into v_request
    from public.service_requests
    where id = p_request_id
    for update;

    if v_request.id is null then
      return null;
    end if;

    select count(*)
    into v_response_count
    from public.service_request_responses
    where service_request_id = p_request_id;

    if v_request.status in (
      'assigned'::public.service_request_status,
      'in_progress'::public.service_request_status,
      'converted_to_client'::public.service_request_status,
      'closed'::public.service_request_status
    ) or v_request.assigned_practitioner_id is not null or v_response_count > 0 then
      return v_request.lifecycle_stage;
    end if;

    if v_request.lifecycle_stage = 'expired'::public.service_request_lifecycle_stage then
      return v_request.lifecycle_stage;
    end if;

    if v_request.lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage then
      if v_request.client_confirmation_due_at is not null and v_request.client_confirmation_due_at <= now() then
        update public.service_requests
        set
          lifecycle_stage = 'expired'::public.service_request_lifecycle_stage,
          status = 'expired'::public.service_request_status,
          expired_at = now(),
          is_archived = true,
          archive_reason = 'expired',
          archived_at = coalesce(archived_at, now()),
          lifecycle_stage_started_at = now(),
          lifecycle_stage_expires_at = null,
          updated_at = now()
        where id = v_request.id;

        perform public.log_service_request_lifecycle_event(
          v_request.id,
          'expired'::public.service_request_lifecycle_stage,
          'client_confirmation_timeout',
          'Lead expired after the client did not confirm assistance within 24 hours.',
          jsonb_build_object('reactivation_count', v_request.lifecycle_reactivation_count)
        );
        continue;
      end if;

      return v_request.lifecycle_stage;
    end if;

    if v_request.lifecycle_stage_expires_at is null or v_request.lifecycle_stage_started_at is null then
      update public.service_requests
      set
        lifecycle_stage_started_at = coalesce(v_request.lifecycle_stage_started_at, v_request.created_at, now()),
        lifecycle_stage_expires_at = case
          when v_request.lifecycle_stage = 'business_exclusive'::public.service_request_lifecycle_stage then coalesce(v_request.lifecycle_stage_started_at, v_request.created_at, now()) + interval '12 hours'
          when v_request.lifecycle_stage in ('professional_access'::public.service_request_lifecycle_stage, 'open_marketplace'::public.service_request_lifecycle_stage) then coalesce(v_request.lifecycle_stage_started_at, v_request.created_at, now()) + interval '24 hours'
          else v_request.lifecycle_stage_expires_at
        end,
        updated_at = now()
      where id = v_request.id;
      continue;
    end if;

    if v_request.lifecycle_stage_expires_at > now() then
      return v_request.lifecycle_stage;
    end if;

    if v_request.lifecycle_stage = 'business_exclusive'::public.service_request_lifecycle_stage then
      v_new_stage := 'professional_access'::public.service_request_lifecycle_stage;

      update public.service_requests
      set
        lifecycle_stage = v_new_stage,
        lifecycle_stage_started_at = now(),
        lifecycle_stage_expires_at = now() + interval '24 hours',
        updated_at = now()
      where id = v_request.id;

      perform public.log_service_request_lifecycle_event(
        v_request.id,
        v_new_stage,
        'stage_advanced',
        'Lead advanced from Business Exclusive to Professional Access.',
        jsonb_build_object('previous_stage', v_request.lifecycle_stage)
      );

      perform public.create_notifications(
        public.get_marketplace_practitioner_profile_ids('professional'::public.lead_access_tier),
        auth.uid(),
        'lead_lifecycle_advanced',
        'requests',
        'Lead moved to Professional Access',
        'An unattended lead is now visible to Professional practitioners.',
        '/dashboard/staff/service-requests?leadId=' || v_request.id::text,
        'service_request',
        v_request.id,
        jsonb_build_object('lifecycle_stage', v_new_stage)
      );

      continue;
    end if;

    if v_request.lifecycle_stage = 'professional_access'::public.service_request_lifecycle_stage then
      v_new_stage := 'open_marketplace'::public.service_request_lifecycle_stage;

      update public.service_requests
      set
        lifecycle_stage = v_new_stage,
        lifecycle_stage_started_at = now(),
        lifecycle_stage_expires_at = now() + interval '24 hours',
        updated_at = now()
      where id = v_request.id;

      perform public.log_service_request_lifecycle_event(
        v_request.id,
        v_new_stage,
        'stage_advanced',
        'Lead advanced from Professional Access to Open Marketplace.',
        jsonb_build_object('previous_stage', v_request.lifecycle_stage)
      );

      perform public.create_notifications(
        public.get_marketplace_practitioner_profile_ids('basic'::public.lead_access_tier),
        auth.uid(),
        'lead_lifecycle_advanced',
        'requests',
        'Lead moved to Open Marketplace',
        'An unattended lead is now open to all qualifying practitioners.',
        '/dashboard/staff/service-requests?leadId=' || v_request.id::text,
        'service_request',
        v_request.id,
        jsonb_build_object('lifecycle_stage', v_new_stage)
      );

      continue;
    end if;

    if v_request.lifecycle_stage = 'open_marketplace'::public.service_request_lifecycle_stage then
      if coalesce(v_request.lifecycle_reactivation_count, 0) = 0 then
        update public.service_requests
        set
          lifecycle_stage = 'business_exclusive'::public.service_request_lifecycle_stage,
          lifecycle_stage_started_at = now(),
          lifecycle_stage_expires_at = now() + interval '12 hours',
          lifecycle_reactivation_count = 1,
          status = case
            when status in ('viewed'::public.service_request_status, 'responded'::public.service_request_status) then 'new'::public.service_request_status
            else status
          end,
          updated_at = now()
        where id = v_request.id;

        perform public.log_service_request_lifecycle_event(
          v_request.id,
          'business_exclusive'::public.service_request_lifecycle_stage,
          'reactivated',
          'Lead restarted its lifecycle after the first unattended cycle.',
          jsonb_build_object('reactivation_count', 1)
        );

        perform public.create_notifications(
          public.staff_profile_ids(array['admin', 'consultant']::public.app_role[]),
          auth.uid(),
          'lead_reactivated',
          'requests',
          'Lead reactivated',
          'An unattended lead has been reactivated and returned to the top of the marketplace.',
          '/dashboard/staff/service-requests?leadId=' || v_request.id::text,
          'service_request',
          v_request.id,
          jsonb_build_object('reactivation_count', 1)
        );

        continue;
      end if;

      v_client_profile_id := public.find_client_profile_id_by_email(v_request.email);

      update public.service_requests
      set
        lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage,
        lifecycle_stage_started_at = now(),
        lifecycle_stage_expires_at = now() + interval '24 hours',
        client_confirmation_requested_at = now(),
        client_confirmation_due_at = now() + interval '24 hours',
        client_confirmation_answered_at = null,
        status = 'pending_client_confirmation'::public.service_request_status,
        updated_at = now()
      where id = v_request.id;

      perform public.log_service_request_lifecycle_event(
        v_request.id,
        'pending_client_confirmation'::public.service_request_lifecycle_stage,
        'client_confirmation_requested',
        'Lead completed a second unattended lifecycle and now requires client confirmation.',
        jsonb_build_object('reactivation_count', v_request.lifecycle_reactivation_count)
      );

      perform public.create_notification(
        v_client_profile_id,
        auth.uid(),
        'lead_confirmation_required',
        'requests',
        'Do you still require assistance?',
        'Please confirm whether you still require assistance with this service request.',
        '/dashboard/client/requests?requestId=' || v_request.id::text,
        'service_request',
        v_request.id,
        jsonb_build_object(
          'client_confirmation_due_at', now() + interval '24 hours',
          'reactivation_count', v_request.lifecycle_reactivation_count
        )
      );

      return 'pending_client_confirmation'::public.service_request_lifecycle_stage;
    end if;

    return v_request.lifecycle_stage;
  end loop;

  select lifecycle_stage
  into v_new_stage
  from public.service_requests
  where id = p_request_id;

  return v_new_stage;
end;
$$;

create or replace function public.process_service_request_lifecycles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_count integer := 0;
begin
  for v_request in
    select id
    from public.service_requests
    where status not in (
      'closed'::public.service_request_status,
      'converted_to_client'::public.service_request_status,
      'expired'::public.service_request_status
    )
      and coalesce(is_archived, false) = false
  loop
    perform public.process_service_request_lifecycle(v_request.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.respond_service_request_confirmation(
  p_request_id uuid,
  p_requires_assistance boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_profile public.profiles%rowtype;
  v_reactivation_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = auth.uid();

  select *
  into v_request
  from public.service_requests
  where id = p_request_id
    and lower(coalesce(email, '')) = lower(coalesce(v_profile.email, ''))
  for update;

  if v_request.id is null then
    raise exception 'Service request not found.';
  end if;

  perform public.process_service_request_lifecycle(v_request.id);

  select *
  into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if v_request.lifecycle_stage <> 'pending_client_confirmation'::public.service_request_lifecycle_stage then
    raise exception 'This service request does not require client confirmation.';
  end if;

  if v_request.client_confirmation_due_at is not null and v_request.client_confirmation_due_at <= now() then
    perform public.process_service_request_lifecycle(v_request.id);
    raise exception 'The confirmation window has expired.';
  end if;

  if p_requires_assistance then
    v_reactivation_count := coalesce(v_request.lifecycle_reactivation_count, 0) + 1;

    update public.service_requests
    set
      lifecycle_stage = 'business_exclusive'::public.service_request_lifecycle_stage,
      lifecycle_stage_started_at = now(),
      lifecycle_stage_expires_at = now() + interval '12 hours',
      lifecycle_reactivation_count = v_reactivation_count,
      client_confirmation_answered_at = now(),
      client_confirmation_due_at = null,
      client_confirmation_requested_at = null,
      status = 'new'::public.service_request_status,
      is_archived = false,
      archive_reason = null,
      archived_at = null,
      expired_at = null,
      updated_at = now()
    where id = v_request.id;

    perform public.log_service_request_lifecycle_event(
      v_request.id,
      'business_exclusive'::public.service_request_lifecycle_stage,
      'client_confirmed',
      'Client confirmed that assistance is still required.',
      jsonb_build_object('reactivation_count', v_reactivation_count)
    );

    perform public.create_notifications(
      public.staff_profile_ids(array['admin', 'consultant']::public.app_role[]),
      auth.uid(),
      'lead_reactivated',
      'requests',
      'Lead reactivated by client confirmation',
      'A client confirmed they still need assistance. The lead has returned to the marketplace.',
      '/dashboard/staff/service-requests?leadId=' || v_request.id::text,
      'service_request',
      v_request.id,
      jsonb_build_object('reactivation_count', v_reactivation_count)
    );

    return 'reactivated';
  end if;

  update public.service_requests
  set
    lifecycle_stage = 'expired'::public.service_request_lifecycle_stage,
    lifecycle_stage_started_at = now(),
    lifecycle_stage_expires_at = null,
    client_confirmation_answered_at = now(),
    status = 'expired'::public.service_request_status,
    expired_at = now(),
    is_archived = true,
    archive_reason = 'expired',
    archived_at = coalesce(archived_at, now()),
    updated_at = now()
  where id = v_request.id;

  perform public.log_service_request_lifecycle_event(
    v_request.id,
    'expired'::public.service_request_lifecycle_stage,
    'client_declined',
    'Client declined further assistance.',
    jsonb_build_object('reactivation_count', v_request.lifecycle_reactivation_count)
  );

  return 'expired';
end;
$$;

create or replace function public.admin_revive_service_request(
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_reactivation_count integer;
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Only admins can revive leads.';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Service request not found.';
  end if;

  v_reactivation_count := greatest(coalesce(v_request.lifecycle_reactivation_count, 0), 0) + 1;

  update public.service_requests
  set
    lifecycle_stage = 'business_exclusive'::public.service_request_lifecycle_stage,
    lifecycle_stage_started_at = now(),
    lifecycle_stage_expires_at = now() + interval '12 hours',
    lifecycle_reactivation_count = v_reactivation_count,
    client_confirmation_requested_at = null,
    client_confirmation_due_at = null,
    client_confirmation_answered_at = null,
    status = 'new'::public.service_request_status,
    is_archived = false,
    archive_reason = null,
    archived_at = null,
    expired_at = null,
    updated_at = now()
  where id = v_request.id;

  perform public.log_service_request_lifecycle_event(
    v_request.id,
    'business_exclusive'::public.service_request_lifecycle_stage,
    'admin_revived',
    'Lead was manually revived by admin.',
    jsonb_build_object('reactivation_count', v_reactivation_count)
  );

  return 'revived';
end;
$$;

create or replace function public.touch_service_request_lifecycle_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.service_requests
  set
    lifecycle_last_client_activity_at = coalesce(new.uploaded_at, new.created_at, now()),
    updated_at = now()
  where id = new.service_request_id;

  return new;
end;
$$;

drop trigger if exists trg_service_request_documents_touch_lifecycle on public.service_request_documents;
create trigger trg_service_request_documents_touch_lifecycle
after insert on public.service_request_documents
for each row execute function public.touch_service_request_lifecycle_activity();

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
  v_lifecycle_stage public.service_request_lifecycle_stage;
  v_access_tier public.lead_access_tier;
  v_required_tier public.lead_access_tier;
begin
  if not public.practitioner_can_access_leads(p_profile_id) then
    return false;
  end if;

  select lifecycle_stage
  into v_lifecycle_stage
  from public.service_requests
  where id = p_request_id;

  if v_lifecycle_stage is null or v_lifecycle_stage in (
    'pending_client_confirmation'::public.service_request_lifecycle_stage,
    'expired'::public.service_request_lifecycle_stage
  ) then
    return false;
  end if;

  v_access_tier := public.get_practitioner_lead_access_tier(p_profile_id);
  v_required_tier := public.get_service_request_marketplace_required_tier(v_lifecycle_stage);

  return public.lead_access_tier_rank(v_access_tier) >= public.lead_access_tier_rank(v_required_tier);
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

  if not public.practitioner_has_active_subscription(auth.uid()) then
    raise exception 'You need an active subscription before using credits. Please subscribe first.';
  end if;

  perform public.process_service_request_lifecycle(p_request_id);

  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if v_request.id is null then
    raise exception 'Service request not found.';
  end if;

  if v_request.lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage then
    raise exception 'This lead is waiting for client confirmation before it can return to the marketplace.';
  end if;

  if v_request.lifecycle_stage = 'expired'::public.service_request_lifecycle_stage then
    raise exception 'This lead has expired and is no longer available.';
  end if;

  v_required_tier := public.get_service_request_marketplace_required_tier(v_request.lifecycle_stage);
  v_access_tier := public.get_practitioner_lead_access_tier(auth.uid());

  if public.lead_access_tier_rank(v_access_tier) < public.lead_access_tier_rank(v_required_tier) then
    if v_required_tier = 'business'::public.lead_access_tier then
      raise exception 'This lead is currently in Business Exclusive access.';
    end if;
    raise exception 'This lead is currently in Professional Access.';
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
    viewed_at = coalesce(viewed_at, now()),
    updated_at = now()
  where id = p_request_id;

  return 'approved';
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
    and public.can_practitioner_view_service_request(auth.uid(), id)
  )
);

insert into public.service_request_lifecycle_history (
  service_request_id,
  lifecycle_stage,
  event_type,
  note,
  created_at
)
select
  sr.id,
  sr.lifecycle_stage,
  'initialized',
  'Lifecycle initialized for existing lead.',
  sr.created_at
from public.service_requests sr
where not exists (
  select 1
  from public.service_request_lifecycle_history history
  where history.service_request_id = sr.id
);
