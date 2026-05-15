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
  v_restart_count integer;
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
        v_restart_count := greatest(coalesce(v_request.lifecycle_reactivation_count, 0), 0) + 1;

        update public.service_requests
        set
          lifecycle_stage = 'business_exclusive'::public.service_request_lifecycle_stage,
          lifecycle_stage_started_at = now(),
          lifecycle_stage_expires_at = now() + interval '12 hours',
          lifecycle_reactivation_count = v_restart_count,
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
          'client_confirmation_timeout_restart',
          'Client confirmation window expired. Lead restarted from the beginning of the lifecycle.',
          jsonb_build_object(
            'reactivation_count', v_restart_count,
            'previous_stage', v_request.lifecycle_stage
          )
        );

        perform public.create_notifications(
          public.staff_profile_ids(array['admin', 'consultant']::public.app_role[]),
          auth.uid(),
          'lead_reactivated',
          'requests',
          'Lead restarted after confirmation timeout',
          'A lead did not receive client confirmation in time and restarted from the beginning of the marketplace lifecycle.',
          '/dashboard/staff/service-requests?leadId=' || v_request.id::text,
          'service_request',
          v_request.id,
          jsonb_build_object(
            'reactivation_count', v_restart_count,
            'lifecycle_stage', 'business_exclusive',
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
  v_was_pending_confirmation boolean := false;
  v_confirmation_due_at timestamptz;
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

  v_was_pending_confirmation := v_request.lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage;
  v_confirmation_due_at := v_request.client_confirmation_due_at;

  perform public.process_service_request_lifecycle(v_request.id);

  select *
  into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if v_request.lifecycle_stage <> 'pending_client_confirmation'::public.service_request_lifecycle_stage then
    if v_was_pending_confirmation and v_confirmation_due_at is not null and v_confirmation_due_at <= now() then
      raise exception 'The confirmation window expired and the lead restarted from the beginning.';
    end if;

    raise exception 'This service request does not require client confirmation.';
  end if;

  if v_request.client_confirmation_due_at is not null and v_request.client_confirmation_due_at <= now() then
    perform public.process_service_request_lifecycle(v_request.id);
    raise exception 'The confirmation window expired and the lead restarted from the beginning.';
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

with timed_out_expired_requests as (
  select
    sr.id,
    greatest(coalesce(sr.lifecycle_reactivation_count, 0), 0) + 1 as next_reactivation_count
  from public.service_requests sr
  where sr.status = 'expired'::public.service_request_status
    and sr.lifecycle_stage = 'expired'::public.service_request_lifecycle_stage
    and coalesce(sr.is_archived, false) = true
    and sr.assigned_practitioner_id is null
    and not exists (
      select 1
      from public.service_request_responses responses
      where responses.service_request_id = sr.id
    )
    and exists (
      select 1
      from public.service_request_lifecycle_history history
      where history.service_request_id = sr.id
        and history.event_type = 'client_confirmation_timeout'
    )
),
restarted_requests as (
  update public.service_requests sr
  set
    lifecycle_stage = 'business_exclusive'::public.service_request_lifecycle_stage,
    lifecycle_stage_started_at = now(),
    lifecycle_stage_expires_at = now() + interval '12 hours',
    lifecycle_reactivation_count = timed_out_expired_requests.next_reactivation_count,
    client_confirmation_requested_at = null,
    client_confirmation_due_at = null,
    client_confirmation_answered_at = null,
    status = 'new'::public.service_request_status,
    is_archived = false,
    archive_reason = null,
    archived_at = null,
    expired_at = null,
    updated_at = now()
  from timed_out_expired_requests
  where sr.id = timed_out_expired_requests.id
  returning sr.id, sr.lifecycle_reactivation_count
)
insert into public.service_request_lifecycle_history (
  service_request_id,
  lifecycle_stage,
  event_type,
  note,
  metadata
)
select
  restarted_requests.id,
  'business_exclusive'::public.service_request_lifecycle_stage,
  'policy_restart_from_timeout',
  'Lead restarted from the beginning after the pending client confirmation timeout policy changed.',
  jsonb_build_object('reactivation_count', restarted_requests.lifecycle_reactivation_count)
from restarted_requests;
