create or replace function public.handle_service_request_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_profile_id uuid;
begin
  if tg_op = 'INSERT' then
    perform public.create_notifications(
      public.staff_profile_ids(array['admin']::public.app_role[]),
      auth.uid(),
      'new_service_request',
      'requests',
      'New service request',
      coalesce(new.full_name, 'Client') || ' submitted a new request.',
      '/dashboard/staff/service-requests?leadId=' || new.id::text,
      'service_request',
      new.id,
      jsonb_build_object(
        'priority_level', new.priority_level,
        'service_needed', new.service_needed,
        'province', new.province
      )
    );

    perform public.create_notifications(
      public.staff_profile_ids(array['consultant']::public.app_role[]),
      auth.uid(),
      'new_service_request',
      'requests',
      'New service request',
      'A new service request is available in the marketplace.',
      '/dashboard/staff/service-requests?leadId=' || new.id::text,
      'service_request',
      new.id,
      jsonb_build_object(
        'priority_level', new.priority_level,
        'service_needed', new.service_needed,
        'province', new.province
      )
    );

    return new;
  end if;

  if new.selected_response_id is distinct from old.selected_response_id
    or new.assigned_practitioner_id is distinct from old.assigned_practitioner_id
  then
    v_client_profile_id := public.find_client_profile_id_by_email(new.email);

    perform public.create_notification(
      v_client_profile_id,
      auth.uid(),
      'practitioner_assignment',
      'requests',
      'Practitioner assignment updated',
      'Your service request has an updated practitioner assignment.',
      '/dashboard/client/requests',
      'service_request',
      new.id,
      jsonb_build_object(
        'assigned_practitioner_id', new.assigned_practitioner_id
      )
    );

    perform public.create_notification(
      new.assigned_practitioner_id,
      auth.uid(),
      'practitioner_assignment',
      'requests',
      'You were assigned to a service request',
      'You were assigned to a service request.',
      '/dashboard/staff/service-requests?leadId=' || new.id::text,
      'service_request',
      new.id,
      jsonb_build_object(
        'service_request_id', new.id
      )
    );
  end if;

  if new.status is distinct from old.status then
    v_client_profile_id := public.find_client_profile_id_by_email(new.email);

    perform public.create_notification(
      v_client_profile_id,
      auth.uid(),
      'request_status_changed',
      'requests',
      'Service request updated',
      'Your service request status changed to ' || replace(new.status::text, '_', ' ') || '.',
      '/dashboard/client/requests',
      'service_request',
      new.id,
      jsonb_build_object(
        'previous_status', old.status,
        'new_status', new.status
      )
    );
  end if;

  return new;
end;
$$;
