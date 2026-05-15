create or replace function public.admin_move_service_request_to_open_marketplace(
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Only admins can move leads to Open Marketplace.';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Service request not found.';
  end if;

  if v_request.lifecycle_stage not in (
    'business_exclusive'::public.service_request_lifecycle_stage,
    'professional_access'::public.service_request_lifecycle_stage
  ) then
    raise exception 'Only Business Exclusive or Professional Access leads can be moved directly to Open Marketplace.';
  end if;

  if v_request.assigned_practitioner_id is not null then
    raise exception 'Assigned leads cannot be moved back to the open marketplace.';
  end if;

  if coalesce(v_request.is_archived, false) = true
    or v_request.status in (
      'closed'::public.service_request_status,
      'converted_to_client'::public.service_request_status,
      'expired'::public.service_request_status,
      'pending_client_confirmation'::public.service_request_status
    ) then
    raise exception 'This lead is not eligible for direct marketplace opening.';
  end if;

  update public.service_requests
  set
    lifecycle_stage = 'open_marketplace'::public.service_request_lifecycle_stage,
    lifecycle_stage_started_at = now(),
    lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration('open_marketplace'::public.service_request_lifecycle_stage),
    client_confirmation_requested_at = null,
    client_confirmation_due_at = null,
    client_confirmation_answered_at = null,
    client_confirmation_origin_stage = null,
    is_archived = false,
    archive_reason = null,
    archived_at = null,
    expired_at = null,
    updated_at = now()
  where id = v_request.id;

  perform public.log_service_request_lifecycle_event(
    v_request.id,
    'open_marketplace'::public.service_request_lifecycle_stage,
    'admin_moved_to_open_marketplace',
    'Lead was manually moved to Open Marketplace by admin.',
    jsonb_build_object(
      'previous_stage', v_request.lifecycle_stage,
      'reactivation_count', v_request.lifecycle_reactivation_count
    )
  );

  perform public.create_notifications(
    public.get_marketplace_practitioner_profile_ids('basic'::public.lead_access_tier),
    auth.uid(),
    'lead_lifecycle_advanced',
    'requests',
    'Lead moved to Open Marketplace',
    'A lead was manually opened to all qualifying practitioners by admin.',
    '/dashboard/staff/service-requests?leadId=' || v_request.id::text,
    'service_request',
    v_request.id,
    jsonb_build_object(
      'lifecycle_stage', 'open_marketplace',
      'restart_reason', 'admin_move_to_open_marketplace'
    )
  );

  return 'open_marketplace';
end;
$$;
