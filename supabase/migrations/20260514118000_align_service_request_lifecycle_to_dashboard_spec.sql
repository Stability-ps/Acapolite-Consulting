create table if not exists public.service_request_lifecycle_settings (
  settings_key text primary key default 'default'
    check (settings_key = 'default'),
  business_stage_hours integer not null default 48
    check (business_stage_hours > 0),
  professional_stage_hours integer not null default 48
    check (professional_stage_hours > 0),
  open_marketplace_hours integer not null default 72
    check (open_marketplace_hours > 0),
  pending_client_confirmation_hours integer not null default 24
    check (pending_client_confirmation_hours > 0),
  reminder_hours integer not null default 6
    check (reminder_hours >= 0),
  reactivation_alert_threshold integer not null default 3
    check (reactivation_alert_threshold > 0),
  updated_at timestamptz not null default now()
);

insert into public.service_request_lifecycle_settings (settings_key)
values ('default')
on conflict (settings_key) do nothing;

alter table public.service_request_lifecycle_settings enable row level security;

drop policy if exists "service_request_lifecycle_settings_select_authenticated" on public.service_request_lifecycle_settings;
create policy "service_request_lifecycle_settings_select_authenticated"
on public.service_request_lifecycle_settings
for select
using (auth.uid() is not null);

drop policy if exists "service_request_lifecycle_settings_update_admin" on public.service_request_lifecycle_settings;
create policy "service_request_lifecycle_settings_update_admin"
on public.service_request_lifecycle_settings
for update
using (public.get_my_role() = 'admin')
with check (public.get_my_role() = 'admin');

alter table public.service_requests
  add column if not exists client_confirmation_origin_stage public.service_request_lifecycle_stage;

update public.service_requests
set client_confirmation_origin_stage = coalesce(
  client_confirmation_origin_stage,
  'open_marketplace'::public.service_request_lifecycle_stage
)
where lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage;

create or replace function public.get_initial_service_request_lifecycle_stage(
  p_lead_tier public.lead_access_tier
)
returns public.service_request_lifecycle_stage
language sql
stable
as $$
  select 'business_exclusive'::public.service_request_lifecycle_stage
$$;

create or replace function public.get_service_request_lifecycle_stage_duration(
  p_stage public.service_request_lifecycle_stage
)
returns interval
language sql
stable
as $$
  with settings as (
    select *
    from public.service_request_lifecycle_settings
    where settings_key = 'default'
    limit 1
  )
  select case p_stage
    when 'business_exclusive'::public.service_request_lifecycle_stage then coalesce((select business_stage_hours from settings), 48) * interval '1 hour'
    when 'professional_access'::public.service_request_lifecycle_stage then coalesce((select professional_stage_hours from settings), 48) * interval '1 hour'
    when 'open_marketplace'::public.service_request_lifecycle_stage then coalesce((select open_marketplace_hours from settings), 72) * interval '1 hour'
    when 'pending_client_confirmation'::public.service_request_lifecycle_stage then coalesce((select pending_client_confirmation_hours from settings), 24) * interval '1 hour'
    else null
  end
$$;

create or replace function public.set_service_request_lifecycle_schedule()
returns trigger
language plpgsql
as $$
declare
  v_effective_lead_tier public.lead_access_tier;
begin
  v_effective_lead_tier := coalesce(
    new.lead_tier,
    public.classify_service_request_lead_tier(
      new.service_needed,
      new.service_needed_list,
      new.sars_debt_amount,
      new.has_sars_audit,
      new.has_adr,
      new.has_vat_investigation,
      new.has_payroll_dispute,
      new.has_multiple_tax_types,
      new.has_legal_complexity
    )
  );

  if tg_op = 'INSERT' and new.lifecycle_stage not in (
    'pending_client_confirmation'::public.service_request_lifecycle_stage,
    'expired'::public.service_request_lifecycle_stage
  ) then
    new.lifecycle_stage := public.get_initial_service_request_lifecycle_stage(v_effective_lead_tier);
  end if;

  if new.lifecycle_stage_started_at is null then
    new.lifecycle_stage_started_at := coalesce(new.created_at, now());
  end if;

  if new.lifecycle_last_client_activity_at is null then
    new.lifecycle_last_client_activity_at := coalesce(new.updated_at, new.created_at, now());
  end if;

  if new.lifecycle_stage = 'expired'::public.service_request_lifecycle_stage then
    new.lifecycle_stage_expires_at := null;
    new.client_confirmation_origin_stage := null;
  elsif new.lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage then
    new.client_confirmation_origin_stage := coalesce(
      new.client_confirmation_origin_stage,
      'open_marketplace'::public.service_request_lifecycle_stage
    );
    new.lifecycle_stage_expires_at := coalesce(
      new.client_confirmation_due_at,
      new.lifecycle_stage_started_at + public.get_service_request_lifecycle_stage_duration(new.lifecycle_stage)
    );
  elsif new.lifecycle_stage_expires_at is null then
    new.lifecycle_stage_expires_at := new.lifecycle_stage_started_at + public.get_service_request_lifecycle_stage_duration(new.lifecycle_stage);
    new.client_confirmation_origin_stage := null;
  else
    new.client_confirmation_origin_stage := null;
  end if;

  return new;
end;
$$;

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
  v_return_stage public.service_request_lifecycle_stage;
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
        v_return_stage := case
          when v_request.client_confirmation_origin_stage in (
            'business_exclusive'::public.service_request_lifecycle_stage,
            'professional_access'::public.service_request_lifecycle_stage,
            'open_marketplace'::public.service_request_lifecycle_stage
          ) then v_request.client_confirmation_origin_stage
          else 'open_marketplace'::public.service_request_lifecycle_stage
        end;

        update public.service_requests
        set
          lifecycle_stage = v_return_stage,
          lifecycle_stage_started_at = now(),
          lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration(v_return_stage),
          client_confirmation_requested_at = null,
          client_confirmation_due_at = null,
          client_confirmation_answered_at = null,
          client_confirmation_origin_stage = null,
          status = 'new'::public.service_request_status,
          is_archived = false,
          archive_reason = null,
          archived_at = null,
          expired_at = null,
          updated_at = now()
        where id = v_request.id;

        perform public.log_service_request_lifecycle_event(
          v_request.id,
          v_return_stage,
          'client_confirmation_timeout',
          'Client confirmation window expired. The lead returned to its prior marketplace stage with a reset timer.',
          jsonb_build_object(
            'previous_stage', v_request.lifecycle_stage,
            'return_stage', v_return_stage,
            'reactivation_count', v_request.lifecycle_reactivation_count
          )
        );

        perform public.create_notifications(
          public.get_marketplace_practitioner_profile_ids(public.get_service_request_marketplace_required_tier(v_return_stage)),
          auth.uid(),
          'lead_reactivated',
          'requests',
          'Lead returned to the marketplace',
          'A lead timed out during client confirmation and returned to its prior marketplace stage.',
          '/dashboard/staff/service-requests?leadId=' || v_request.id::text,
          'service_request',
          v_request.id,
          jsonb_build_object(
            'lifecycle_stage', v_return_stage,
            'restart_reason', 'client_confirmation_timeout'
          )
        );
        continue;
      end if;

      return v_request.lifecycle_stage;
    end if;

    if v_request.lifecycle_stage_expires_at is null or v_request.lifecycle_stage_started_at is null then
      update public.service_requests
      set
        lifecycle_stage_started_at = coalesce(v_request.lifecycle_stage_started_at, v_request.created_at, now()),
        lifecycle_stage_expires_at = coalesce(v_request.lifecycle_stage_started_at, v_request.created_at, now())
          + public.get_service_request_lifecycle_stage_duration(v_request.lifecycle_stage),
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
        lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration(v_new_stage),
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
        lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration(v_new_stage),
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
      v_client_profile_id := public.find_client_profile_id_by_email(v_request.email);

      update public.service_requests
      set
        lifecycle_stage = 'expired'::public.service_request_lifecycle_stage,
        lifecycle_stage_started_at = now(),
        lifecycle_stage_expires_at = null,
        client_confirmation_origin_stage = null,
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
        'lead_expired',
        'Lead expired after exhausting Business, Professional, and Open Marketplace timers without a confirmed claim.',
        jsonb_build_object('reactivation_count', v_request.lifecycle_reactivation_count)
      );

      perform public.create_notification(
        v_client_profile_id,
        auth.uid(),
        'lead_expired',
        'requests',
        'Your lead expired in this cycle',
        'Your request did not receive a confirmed match before the marketplace timer ended. Staff can reactivate it if needed.',
        '/dashboard/client/requests?requestId=' || v_request.id::text,
        'service_request',
        v_request.id,
        jsonb_build_object('expired_at', now())
      );

      return 'expired'::public.service_request_lifecycle_stage;
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
  v_return_stage public.service_request_lifecycle_stage;
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
    raise exception 'The confirmation window closed and the lead returned to the marketplace.';
  end if;

  if p_requires_assistance then
    v_return_stage := case
      when v_request.client_confirmation_origin_stage in (
        'business_exclusive'::public.service_request_lifecycle_stage,
        'professional_access'::public.service_request_lifecycle_stage,
        'open_marketplace'::public.service_request_lifecycle_stage
      ) then v_request.client_confirmation_origin_stage
      else 'open_marketplace'::public.service_request_lifecycle_stage
    end;

    update public.service_requests
    set
      lifecycle_stage = v_return_stage,
      lifecycle_stage_started_at = now(),
      lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration(v_return_stage),
      lifecycle_reactivation_count = coalesce(v_request.lifecycle_reactivation_count, 0) + 1,
      client_confirmation_answered_at = now(),
      client_confirmation_due_at = null,
      client_confirmation_requested_at = null,
      client_confirmation_origin_stage = null,
      status = 'new'::public.service_request_status,
      is_archived = false,
      archive_reason = null,
      archived_at = null,
      expired_at = null,
      updated_at = now()
    where id = v_request.id;

    perform public.log_service_request_lifecycle_event(
      v_request.id,
      v_return_stage,
      'client_confirmed',
      'Client confirmed that assistance is still required. The lead returned to its prior marketplace stage.',
      jsonb_build_object(
        'reactivation_count', coalesce(v_request.lifecycle_reactivation_count, 0) + 1,
        'return_stage', v_return_stage
      )
    );

    perform public.create_notifications(
      public.staff_profile_ids(array['admin', 'consultant']::public.app_role[]),
      auth.uid(),
      'lead_reactivated',
      'requests',
      'Lead reactivated by client confirmation',
      'A client confirmed they still need assistance. The lead returned to the marketplace.',
      '/dashboard/staff/service-requests?leadId=' || v_request.id::text,
      'service_request',
      v_request.id,
      jsonb_build_object(
        'reactivation_count', coalesce(v_request.lifecycle_reactivation_count, 0) + 1,
        'lifecycle_stage', v_return_stage
      )
    );

    return 'reactivated';
  end if;

  update public.service_requests
  set
    lifecycle_stage = 'expired'::public.service_request_lifecycle_stage,
    lifecycle_stage_started_at = now(),
    lifecycle_stage_expires_at = null,
    client_confirmation_answered_at = now(),
    client_confirmation_origin_stage = null,
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
  p_request_id uuid,
  p_restart_stage public.service_request_lifecycle_stage default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_reactivation_count integer;
  v_restart_stage public.service_request_lifecycle_stage;
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

  v_restart_stage := case
    when p_restart_stage in (
      'business_exclusive'::public.service_request_lifecycle_stage,
      'professional_access'::public.service_request_lifecycle_stage,
      'open_marketplace'::public.service_request_lifecycle_stage
    ) then p_restart_stage
    else public.get_initial_service_request_lifecycle_stage(coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier))
  end;

  v_reactivation_count := greatest(coalesce(v_request.lifecycle_reactivation_count, 0), 0) + 1;

  update public.service_requests
  set
    lifecycle_stage = v_restart_stage,
    lifecycle_stage_started_at = now(),
    lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration(v_restart_stage),
    lifecycle_reactivation_count = v_reactivation_count,
    client_confirmation_requested_at = null,
    client_confirmation_due_at = null,
    client_confirmation_answered_at = null,
    client_confirmation_origin_stage = null,
    status = 'new'::public.service_request_status,
    is_archived = false,
    archive_reason = null,
    archived_at = null,
    expired_at = null,
    updated_at = now()
  where id = v_request.id;

  perform public.log_service_request_lifecycle_event(
    v_request.id,
    v_restart_stage,
    'admin_revived',
    'Lead was manually revived by admin.',
    jsonb_build_object(
      'reactivation_count', v_reactivation_count,
      'restart_stage', v_restart_stage
    )
  );

  return 'revived';
end;
$$;

create or replace function public.admin_reset_service_request_lifecycle_timer(
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_new_expiry timestamptz;
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Only admins can reset lead timers.';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Service request not found.';
  end if;

  if v_request.lifecycle_stage = 'expired'::public.service_request_lifecycle_stage
    or v_request.status in (
      'expired'::public.service_request_status,
      'closed'::public.service_request_status,
      'converted_to_client'::public.service_request_status
    ) then
    raise exception 'Only active leads can have their timer reset.';
  end if;

  if v_request.lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage then
    v_new_expiry := now() + public.get_service_request_lifecycle_stage_duration(v_request.lifecycle_stage);

    update public.service_requests
    set
      lifecycle_stage_started_at = now(),
      lifecycle_stage_expires_at = v_new_expiry,
      client_confirmation_requested_at = coalesce(client_confirmation_requested_at, now()),
      client_confirmation_due_at = v_new_expiry,
      updated_at = now()
    where id = v_request.id;
  else
    v_new_expiry := now() + public.get_service_request_lifecycle_stage_duration(v_request.lifecycle_stage);

    update public.service_requests
    set
      lifecycle_stage_started_at = now(),
      lifecycle_stage_expires_at = v_new_expiry,
      updated_at = now()
    where id = v_request.id;
  end if;

  perform public.log_service_request_lifecycle_event(
    v_request.id,
    v_request.lifecycle_stage,
    'timer_reset',
    'Lead timer was manually reset by admin.',
    jsonb_build_object(
      'previous_expires_at', v_request.lifecycle_stage_expires_at,
      'new_expires_at', v_new_expiry
    )
  );

  return 'reset';
end;
$$;

create or replace function public.admin_apply_service_request_lifecycle_settings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer := 0;
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Only admins can apply lifecycle settings.';
  end if;

  update public.service_requests
  set
    lifecycle_stage_expires_at = case
      when lifecycle_stage = 'business_exclusive'::public.service_request_lifecycle_stage then coalesce(lifecycle_stage_started_at, created_at, now()) + public.get_service_request_lifecycle_stage_duration('business_exclusive'::public.service_request_lifecycle_stage)
      when lifecycle_stage = 'professional_access'::public.service_request_lifecycle_stage then coalesce(lifecycle_stage_started_at, created_at, now()) + public.get_service_request_lifecycle_stage_duration('professional_access'::public.service_request_lifecycle_stage)
      when lifecycle_stage = 'open_marketplace'::public.service_request_lifecycle_stage then coalesce(lifecycle_stage_started_at, created_at, now()) + public.get_service_request_lifecycle_stage_duration('open_marketplace'::public.service_request_lifecycle_stage)
      when lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage then coalesce(lifecycle_stage_started_at, created_at, now()) + public.get_service_request_lifecycle_stage_duration('pending_client_confirmation'::public.service_request_lifecycle_stage)
      else lifecycle_stage_expires_at
    end,
    client_confirmation_due_at = case
      when lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage then coalesce(lifecycle_stage_started_at, created_at, now()) + public.get_service_request_lifecycle_stage_duration('pending_client_confirmation'::public.service_request_lifecycle_stage)
      else client_confirmation_due_at
    end,
    updated_at = now()
  where status not in (
    'assigned'::public.service_request_status,
    'in_progress'::public.service_request_status,
    'closed'::public.service_request_status,
    'converted_to_client'::public.service_request_status,
    'expired'::public.service_request_status
  )
    and lifecycle_stage <> 'expired'::public.service_request_lifecycle_stage;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

update public.service_requests
set
  lifecycle_stage_expires_at = case
    when lifecycle_stage = 'business_exclusive'::public.service_request_lifecycle_stage then coalesce(lifecycle_stage_started_at, created_at, now()) + public.get_service_request_lifecycle_stage_duration('business_exclusive'::public.service_request_lifecycle_stage)
    when lifecycle_stage = 'professional_access'::public.service_request_lifecycle_stage then coalesce(lifecycle_stage_started_at, created_at, now()) + public.get_service_request_lifecycle_stage_duration('professional_access'::public.service_request_lifecycle_stage)
    when lifecycle_stage = 'open_marketplace'::public.service_request_lifecycle_stage then coalesce(lifecycle_stage_started_at, created_at, now()) + public.get_service_request_lifecycle_stage_duration('open_marketplace'::public.service_request_lifecycle_stage)
    when lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage then coalesce(client_confirmation_due_at, coalesce(lifecycle_stage_started_at, created_at, now()) + public.get_service_request_lifecycle_stage_duration('pending_client_confirmation'::public.service_request_lifecycle_stage))
    else null
  end,
  client_confirmation_origin_stage = case
    when lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage then coalesce(client_confirmation_origin_stage, 'open_marketplace'::public.service_request_lifecycle_stage)
    else null
  end,
  updated_at = now()
where status not in (
  'assigned'::public.service_request_status,
  'in_progress'::public.service_request_status,
  'closed'::public.service_request_status,
  'converted_to_client'::public.service_request_status
);

select public.process_service_request_lifecycles();
