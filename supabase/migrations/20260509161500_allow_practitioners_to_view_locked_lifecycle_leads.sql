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
  v_request public.service_requests%rowtype;
begin
  if not public.practitioner_can_access_leads(p_profile_id) then
    return false;
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if v_request.id is null then
    return false;
  end if;

  if coalesce(v_request.is_archived, false) then
    return false;
  end if;

  if v_request.status in (
    'closed'::public.service_request_status,
    'converted_to_client'::public.service_request_status,
    'expired'::public.service_request_status
  ) then
    return false;
  end if;

  if v_request.lifecycle_stage in (
    'pending_client_confirmation'::public.service_request_lifecycle_stage,
    'expired'::public.service_request_lifecycle_stage
  ) then
    return false;
  end if;

  return true;
end;
$$;
