create or replace function public.get_initial_service_request_lifecycle_stage(
  p_lead_tier public.lead_access_tier
)
returns public.service_request_lifecycle_stage
language sql
immutable
as $$
  select case coalesce(p_lead_tier, 'basic'::public.lead_access_tier)
    when 'business'::public.lead_access_tier then 'business_exclusive'::public.service_request_lifecycle_stage
    when 'professional'::public.lead_access_tier then 'professional_access'::public.service_request_lifecycle_stage
    else 'open_marketplace'::public.service_request_lifecycle_stage
  end
$$;

create or replace function public.get_service_request_lifecycle_stage_duration(
  p_stage public.service_request_lifecycle_stage
)
returns interval
language sql
immutable
as $$
  select case p_stage
    when 'business_exclusive'::public.service_request_lifecycle_stage then interval '12 hours'
    when 'professional_access'::public.service_request_lifecycle_stage then interval '24 hours'
    when 'open_marketplace'::public.service_request_lifecycle_stage then interval '24 hours'
    when 'pending_client_confirmation'::public.service_request_lifecycle_stage then interval '24 hours'
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
  elsif new.lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage then
    new.lifecycle_stage_expires_at := coalesce(
      new.client_confirmation_due_at,
      new.lifecycle_stage_started_at + public.get_service_request_lifecycle_stage_duration(new.lifecycle_stage)
    );
  elsif new.lifecycle_stage_expires_at is null then
    new.lifecycle_stage_expires_at := new.lifecycle_stage_started_at + public.get_service_request_lifecycle_stage_duration(new.lifecycle_stage);
  end if;

  return new;
end;
$$;

update public.service_requests
set
  lifecycle_stage = case
    when status = 'pending_client_confirmation'::public.service_request_status then 'pending_client_confirmation'::public.service_request_lifecycle_stage
    when status in ('expired'::public.service_request_status, 'dead_lead'::public.service_request_status) then 'expired'::public.service_request_lifecycle_stage
    else public.get_initial_service_request_lifecycle_stage(coalesce(lead_tier, 'basic'::public.lead_access_tier))
  end,
  lifecycle_stage_started_at = coalesce(lifecycle_stage_started_at, created_at),
  lifecycle_stage_expires_at = case
    when status = 'pending_client_confirmation'::public.service_request_status then coalesce(
      client_confirmation_due_at,
      coalesce(lifecycle_stage_started_at, created_at) + interval '24 hours'
    )
    when status in (
      'expired'::public.service_request_status,
      'dead_lead'::public.service_request_status,
      'closed'::public.service_request_status,
      'converted_to_client'::public.service_request_status
    ) then null
    else coalesce(lifecycle_stage_started_at, created_at)
      + public.get_service_request_lifecycle_stage_duration(
        public.get_initial_service_request_lifecycle_stage(coalesce(lead_tier, 'basic'::public.lead_access_tier))
      )
  end,
  updated_at = now()
where coalesce(is_archived, false) = false
  and status not in (
    'assigned'::public.service_request_status,
    'in_progress'::public.service_request_status,
    'closed'::public.service_request_status,
    'converted_to_client'::public.service_request_status
  )
  and not exists (
    select 1
    from public.service_request_responses responses
    where responses.service_request_id = service_requests.id
  );

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
  v_restart_stage public.service_request_lifecycle_stage;
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
      if coalesce(v_request.lifecycle_reactivation_count, 0) = 0 then
        v_restart_stage := public.get_initial_service_request_lifecycle_stage(coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier));

        update public.service_requests
        set
          lifecycle_stage = v_restart_stage,
          lifecycle_stage_started_at = now(),
          lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration(v_restart_stage),
          lifecycle_reactivation_count = 1,
          status = case
            when status in ('viewed'::public.service_request_status, 'responded'::public.service_request_status) then 'new'::public.service_request_status
            else status
          end,
          updated_at = now()
        where id = v_request.id;

        perform public.log_service_request_lifecycle_event(
          v_request.id,
          v_restart_stage,
          'reactivated',
          'Lead restarted its lifecycle after the first unattended cycle and returned to its original package stage.',
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
          jsonb_build_object('reactivation_count', 1, 'lifecycle_stage', v_restart_stage)
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
  v_restart_stage public.service_request_lifecycle_stage;
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
    v_restart_stage := public.get_initial_service_request_lifecycle_stage(coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier));

    update public.service_requests
    set
      lifecycle_stage = v_restart_stage,
      lifecycle_stage_started_at = now(),
      lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration(v_restart_stage),
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
      v_restart_stage,
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
      jsonb_build_object('reactivation_count', v_reactivation_count, 'lifecycle_stage', v_restart_stage)
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

  v_reactivation_count := greatest(coalesce(v_request.lifecycle_reactivation_count, 0), 0) + 1;
  v_restart_stage := public.get_initial_service_request_lifecycle_stage(coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier));

  update public.service_requests
  set
    lifecycle_stage = v_restart_stage,
    lifecycle_stage_started_at = now(),
    lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration(v_restart_stage),
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
    v_restart_stage,
    'admin_revived',
    'Lead was manually revived by admin.',
    jsonb_build_object('reactivation_count', v_reactivation_count)
  );

  return 'revived';
end;
$$;

select public.process_service_request_lifecycles();
