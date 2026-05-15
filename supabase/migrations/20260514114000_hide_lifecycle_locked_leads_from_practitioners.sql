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
