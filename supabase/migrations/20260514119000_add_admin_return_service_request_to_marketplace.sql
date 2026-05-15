create or replace function public.admin_return_service_request_to_marketplace(
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_return_stage public.service_request_lifecycle_stage;
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Only admins can return leads to the marketplace.';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Service request not found.';
  end if;

  if v_request.lifecycle_stage <> 'pending_client_confirmation'::public.service_request_lifecycle_stage then
    raise exception 'Only pending client confirmation leads can be returned to the marketplace.';
  end if;

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
    'admin_returned_to_marketplace',
    'Lead was manually returned to the marketplace by admin from pending client confirmation.',
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
    'Lead returned to marketplace by admin',
    'A pending client confirmation lead was manually returned to the marketplace.',
    '/dashboard/staff/service-requests?leadId=' || v_request.id::text,
    'service_request',
    v_request.id,
    jsonb_build_object(
      'lifecycle_stage', v_return_stage,
      'restart_reason', 'admin_return_to_marketplace'
    )
  );

  return 'returned';
end;
$$;
