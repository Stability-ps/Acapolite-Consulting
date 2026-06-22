create or replace function public.maybe_notify_service_request_reactivation_review(
  p_request_id uuid,
  p_reactivation_count integer,
  p_lifecycle_stage public.service_request_lifecycle_stage default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_threshold integer;
begin
  select reactivation_alert_threshold
  into v_threshold
  from public.service_request_lifecycle_settings
  where settings_key = 'default'
  limit 1;

  if coalesce(p_reactivation_count, 0) < coalesce(v_threshold, 3) then
    return;
  end if;

  if exists (
    select 1
    from public.service_request_lifecycle_history
    where service_request_id = p_request_id
      and event_type = 'reactivation_review_required'
      and coalesce((metadata ->> 'reactivation_count')::integer, -1) = p_reactivation_count
  ) then
    return;
  end if;

  perform public.log_service_request_lifecycle_event(
    p_request_id,
    p_lifecycle_stage,
    'reactivation_review_required',
    'Lead reached the repeated reactivation review threshold and should be checked by staff.',
    jsonb_build_object(
      'reactivation_count', p_reactivation_count,
      'reactivation_alert_threshold', v_threshold
    )
  );

  perform public.create_notifications(
    public.staff_profile_ids(array['admin']::public.app_role[]),
    auth.uid(),
    'lead_reactivation_review_required',
    'requests',
    'Lead needs reactivation review',
    'This lead hit the repeated reactivation threshold and should be reviewed by staff.',
    '/dashboard/staff/service-requests?leadId=' || p_request_id::text,
    'service_request',
    p_request_id,
    jsonb_build_object(
      'reactivation_count', p_reactivation_count,
      'lifecycle_stage', p_lifecycle_stage,
      'review_reason', 'threshold_reached'
    )
  );
end;
$$;

create or replace function public.maybe_send_service_request_confirmation_reminder(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_reminder_hours integer;
  v_client_profile_id uuid;
  v_reminder_due_at timestamptz;
begin
  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if v_request.id is null
    or v_request.lifecycle_stage <> 'pending_client_confirmation'::public.service_request_lifecycle_stage
    or v_request.client_confirmation_due_at is null then
    return;
  end if;

  select reminder_hours
  into v_reminder_hours
  from public.service_request_lifecycle_settings
  where settings_key = 'default'
  limit 1;

  v_reminder_hours := greatest(coalesce(v_reminder_hours, 6), 0);
  v_reminder_due_at := v_request.client_confirmation_due_at - (v_reminder_hours * interval '1 hour');

  if now() < v_reminder_due_at or now() >= v_request.client_confirmation_due_at then
    return;
  end if;

  if exists (
    select 1
    from public.service_request_lifecycle_history
    where service_request_id = p_request_id
      and event_type = 'client_confirmation_reminder_sent'
  ) then
    return;
  end if;

  v_client_profile_id := public.find_client_profile_id_by_email(v_request.email);

  perform public.create_notification(
    v_client_profile_id,
    auth.uid(),
    'lead_confirmation_reminder',
    'requests',
    'Reminder: confirm your request',
    'Please confirm whether you still need assistance before your request expires.',
    '/dashboard/client/requests?requestId=' || v_request.id::text,
    'service_request',
    v_request.id,
    jsonb_build_object(
      'client_confirmation_due_at', v_request.client_confirmation_due_at,
      'reminder_hours', v_reminder_hours
    )
  );

  perform public.log_service_request_lifecycle_event(
    v_request.id,
    v_request.lifecycle_stage,
    'client_confirmation_reminder_sent',
    'Client confirmation reminder sent before expiry.',
    jsonb_build_object(
      'client_confirmation_due_at', v_request.client_confirmation_due_at,
      'reminder_hours', v_reminder_hours
    )
  );
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

    if v_request.status in (
      'assigned'::public.service_request_status,
      'in_progress'::public.service_request_status,
      'converted_to_client'::public.service_request_status,
      'closed'::public.service_request_status
    ) or v_request.assigned_practitioner_id is not null or v_request.selected_response_id is not null then
      return v_request.lifecycle_stage;
    end if;

    if v_request.lifecycle_stage = 'expired'::public.service_request_lifecycle_stage then
      return v_request.lifecycle_stage;
    end if;

    if v_request.lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage then
      perform public.maybe_send_service_request_confirmation_reminder(v_request.id);

      if v_request.client_confirmation_due_at is not null and v_request.client_confirmation_due_at <= now() then
        v_client_profile_id := public.find_client_profile_id_by_email(v_request.email);

        update public.service_requests
        set
          lifecycle_stage = 'expired'::public.service_request_lifecycle_stage,
          lifecycle_stage_started_at = now(),
          lifecycle_stage_expires_at = null,
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
          'client_confirmation_timeout',
          'Lead expired after the client did not confirm assistance before the deadline.',
          jsonb_build_object('reactivation_count', v_request.lifecycle_reactivation_count)
        );

        perform public.create_notification(
          v_client_profile_id,
          auth.uid(),
          'lead_expired',
          'requests',
          'Your request expired',
          'Your request expired after the confirmation window closed. Staff can revive it if needed.',
          '/dashboard/client/requests?requestId=' || v_request.id::text,
          'service_request',
          v_request.id,
          jsonb_build_object(
            'expired_at', now(),
            'reactivation_count', v_request.lifecycle_reactivation_count
          )
        );

        return 'expired'::public.service_request_lifecycle_stage;
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
        v_new_stage := public.get_initial_service_request_lifecycle_stage(coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier));

        update public.service_requests
        set
          lifecycle_stage = v_new_stage,
          lifecycle_stage_started_at = now(),
          lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration(v_new_stage),
          lifecycle_reactivation_count = 1,
          client_confirmation_origin_stage = null,
          status = case
            when status in ('viewed'::public.service_request_status, 'responded'::public.service_request_status) then 'new'::public.service_request_status
            else status
          end,
          updated_at = now()
        where id = v_request.id;

        perform public.log_service_request_lifecycle_event(
          v_request.id,
          v_new_stage,
          'reactivated',
          'Lead restarted its lifecycle after the first unattended marketplace cycle.',
          jsonb_build_object('reactivation_count', 1)
        );

        perform public.create_notifications(
          public.staff_profile_ids(array['admin', 'consultant']::public.app_role[]),
          auth.uid(),
          'lead_reactivated',
          'requests',
          'Lead reactivated',
          'An unattended lead has been reactivated and returned to the start of its lifecycle.',
          '/dashboard/staff/service-requests?leadId=' || v_request.id::text,
          'service_request',
          v_request.id,
          jsonb_build_object('reactivation_count', 1)
        );

        perform public.maybe_notify_service_request_reactivation_review(
          v_request.id,
          1,
          v_new_stage
        );
        continue;
      end if;

      v_client_profile_id := public.find_client_profile_id_by_email(v_request.email);

      update public.service_requests
      set
        lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage,
        lifecycle_stage_started_at = now(),
        lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration('pending_client_confirmation'::public.service_request_lifecycle_stage),
        client_confirmation_requested_at = now(),
        client_confirmation_due_at = now() + public.get_service_request_lifecycle_stage_duration('pending_client_confirmation'::public.service_request_lifecycle_stage),
        client_confirmation_answered_at = null,
        client_confirmation_origin_stage = 'open_marketplace'::public.service_request_lifecycle_stage,
        status = 'pending_client_confirmation'::public.service_request_status,
        updated_at = now()
      where id = v_request.id;

      perform public.log_service_request_lifecycle_event(
        v_request.id,
        'pending_client_confirmation'::public.service_request_lifecycle_stage,
        'client_confirmation_requested',
        'Lead completed another unattended lifecycle and now requires client confirmation before it can stay active.',
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
          'client_confirmation_due_at', now() + public.get_service_request_lifecycle_stage_duration('pending_client_confirmation'::public.service_request_lifecycle_stage),
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
      lifecycle_stage = public.get_initial_service_request_lifecycle_stage(coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier)),
      lifecycle_stage_started_at = now(),
      lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration(
        public.get_initial_service_request_lifecycle_stage(coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier))
      ),
      lifecycle_reactivation_count = v_reactivation_count,
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
      public.get_initial_service_request_lifecycle_stage(coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier)),
      'client_confirmed',
      'Client confirmed that assistance is still required. The lead returned to the start of its lifecycle.',
      jsonb_build_object('reactivation_count', v_reactivation_count)
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
      jsonb_build_object('reactivation_count', v_reactivation_count)
    );

    perform public.maybe_notify_service_request_reactivation_review(
      v_request.id,
      v_reactivation_count,
      public.get_initial_service_request_lifecycle_stage(coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier))
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

  perform public.maybe_notify_service_request_reactivation_review(
    v_request.id,
    v_reactivation_count,
    v_restart_stage
  );

  return 'revived';
end;
$$;
