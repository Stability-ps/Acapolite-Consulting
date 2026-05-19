alter table public.service_requests
  alter column lifecycle_stage set default 'open_marketplace'::public.service_request_lifecycle_stage;

alter table public.service_request_lifecycle_settings
  alter column business_stage_hours set default 12;

update public.service_request_lifecycle_settings
set
  business_stage_hours = 12,
  updated_at = now()
where settings_key = 'default'
  and business_stage_hours = 48;

create or replace function public.get_initial_service_request_lifecycle_stage(
  p_lead_tier public.lead_access_tier
)
returns public.service_request_lifecycle_stage
language sql
stable
as $$
  select case coalesce(p_lead_tier, 'basic'::public.lead_access_tier)
    when 'business'::public.lead_access_tier then 'business_exclusive'::public.service_request_lifecycle_stage
    when 'professional'::public.lead_access_tier then 'professional_access'::public.service_request_lifecycle_stage
    else 'open_marketplace'::public.service_request_lifecycle_stage
  end
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
          lifecycle_stage = 'open_marketplace'::public.service_request_lifecycle_stage,
          lifecycle_stage_started_at = now(),
          lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration('open_marketplace'::public.service_request_lifecycle_stage),
          lifecycle_reactivation_count = 0,
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
          'open_marketplace'::public.service_request_lifecycle_stage,
          'client_confirmation_timeout_restart',
          'Client confirmation window expired. Lead restarted in Open Marketplace with its lifecycle cycle reset.',
          jsonb_build_object(
            'reactivation_count', 0,
            'previous_stage', v_request.lifecycle_stage,
            'restart_reason', 'client_confirmation_timeout'
          )
        );

        perform public.create_notifications(
          public.get_marketplace_practitioner_profile_ids('basic'::public.lead_access_tier),
          auth.uid(),
          'lead_reactivated',
          'requests',
          'Lead reopened in Open Marketplace',
          'A lead timed out during client confirmation and has been returned to Open Marketplace.',
          '/dashboard/staff/service-requests?leadId=' || v_request.id::text,
          'service_request',
          v_request.id,
          jsonb_build_object(
            'reactivation_count', 0,
            'lifecycle_stage', 'open_marketplace',
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
      if coalesce(v_request.lifecycle_reactivation_count, 0) = 0 then
        update public.service_requests
        set
          lifecycle_stage = public.get_initial_service_request_lifecycle_stage(coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier)),
          lifecycle_stage_started_at = now(),
          lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration(
            public.get_initial_service_request_lifecycle_stage(coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier))
          ),
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
          public.get_initial_service_request_lifecycle_stage(coalesce(v_request.lead_tier, 'basic'::public.lead_access_tier)),
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

with tiered_open_leads as (
  update public.service_requests sr
  set
    lifecycle_stage = public.get_initial_service_request_lifecycle_stage(coalesce(sr.lead_tier, 'basic'::public.lead_access_tier)),
    lifecycle_stage_started_at = now(),
    lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration(
      public.get_initial_service_request_lifecycle_stage(coalesce(sr.lead_tier, 'basic'::public.lead_access_tier))
    ),
    client_confirmation_origin_stage = null,
    updated_at = now()
  where sr.lifecycle_stage = 'open_marketplace'::public.service_request_lifecycle_stage
    and coalesce(sr.lead_tier, 'basic'::public.lead_access_tier) in (
      'business'::public.lead_access_tier,
      'professional'::public.lead_access_tier
    )
    and coalesce(sr.is_archived, false) = false
    and sr.assigned_practitioner_id is null
    and sr.status not in (
      'closed'::public.service_request_status,
      'converted_to_client'::public.service_request_status,
      'expired'::public.service_request_status,
      'pending_client_confirmation'::public.service_request_status
    )
    and not exists (
      select 1
      from public.service_request_responses responses
      where responses.service_request_id = sr.id
    )
  returning sr.id, sr.lifecycle_stage, sr.lead_tier
)
insert into public.service_request_lifecycle_history (
  service_request_id,
  lifecycle_stage,
  event_type,
  note,
  metadata
)
select
  tiered_open_leads.id,
  tiered_open_leads.lifecycle_stage,
  'policy_restore_tiered_lifecycle',
  'Lead moved from Open Marketplace back to its tiered lifecycle starting stage.',
  jsonb_build_object(
    'lead_tier', tiered_open_leads.lead_tier,
    'lifecycle_stage', tiered_open_leads.lifecycle_stage
  )
from tiered_open_leads;
