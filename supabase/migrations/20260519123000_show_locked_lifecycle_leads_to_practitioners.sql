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

  if v_request.assigned_practitioner_id is not null then
    return false;
  end if;

  if v_request.status in (
    'assigned'::public.service_request_status,
    'in_progress'::public.service_request_status,
    'closed'::public.service_request_status,
    'converted_to_client'::public.service_request_status,
    'expired'::public.service_request_status,
    'pending_client_confirmation'::public.service_request_status
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

create or replace function public.unlock_service_request_access(
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_access public.service_request_access_requests%rowtype;
  v_balance integer;
  v_cost integer;
  v_response_count integer;
  v_monthly_used integer;
  v_purchased_used integer;
  v_service_list public.service_request_service_needed[];
  v_max_responses integer;
  v_required_tier public.lead_access_tier;
  v_access_tier public.lead_access_tier;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if public.get_my_role() <> 'consultant' then
    raise exception 'Only practitioners can unlock leads.';
  end if;

  if not public.practitioner_can_access_leads(auth.uid()) then
    raise exception 'Lead access is currently disabled for your practitioner profile.';
  end if;

  if not public.practitioner_has_active_subscription(auth.uid()) then
    raise exception 'You need an active subscription before using credits. Please subscribe first.';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if v_request.id is null then
    raise exception 'Service request not found.';
  end if;

  if coalesce(v_request.is_archived, false)
    or v_request.assigned_practitioner_id is not null
    or v_request.status in (
      'assigned'::public.service_request_status,
      'in_progress'::public.service_request_status,
      'closed'::public.service_request_status,
      'converted_to_client'::public.service_request_status,
      'expired'::public.service_request_status,
      'pending_client_confirmation'::public.service_request_status
    ) then
    raise exception 'This lead is no longer available in the marketplace.';
  end if;

  if v_request.lifecycle_stage = 'pending_client_confirmation'::public.service_request_lifecycle_stage then
    raise exception 'This lead is waiting for client confirmation before it can return to the marketplace.';
  end if;

  if v_request.lifecycle_stage = 'expired'::public.service_request_lifecycle_stage then
    raise exception 'This lead has expired and is no longer available.';
  end if;

  v_required_tier := public.get_service_request_marketplace_required_tier(v_request.lifecycle_stage);
  v_access_tier := public.get_practitioner_lead_access_tier(auth.uid());

  if public.lead_access_tier_rank(v_access_tier) < public.lead_access_tier_rank(v_required_tier) then
    if v_required_tier = 'business'::public.lead_access_tier then
      raise exception 'Upgrade to Business to access this lead during the Business Exclusive stage.';
    end if;
    raise exception 'Upgrade to Professional to access this lead during the Professional Access stage.';
  end if;

  select *
  into v_access
  from public.service_request_access_requests
  where service_request_id = p_request_id
    and practitioner_profile_id = auth.uid()
  for update;

  if v_access.id is not null and v_access.credit_deducted then
    if v_access.status <> 'approved' then
      update public.service_request_access_requests
      set
        status = 'approved',
        responded_at = coalesce(responded_at, now()),
        updated_at = now()
      where id = v_access.id;
    end if;

    return 'already_unlocked';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_request_id::text));

  select count(*)
  into v_response_count
  from public.service_request_responses
  where service_request_id = p_request_id;

  v_max_responses := public.get_service_request_max_responses(p_request_id);
  if v_response_count >= v_max_responses then
    raise exception 'Response limit reached.';
  end if;

  v_service_list := case
    when coalesce(array_length(v_request.service_needed_list, 1), 0) > 0 then v_request.service_needed_list
    when v_request.service_needed is not null then array[v_request.service_needed]
    else '{}'::public.service_request_service_needed[]
  end;

  v_cost := public.get_service_request_credit_cost_for_services(v_service_list);

  select balance, monthly_used, purchased_used
  into v_balance, v_monthly_used, v_purchased_used
  from public.consume_practitioner_credit_wallet(auth.uid(), v_cost);

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    service_request_id,
    transaction_type,
    credits_delta,
    balance_after,
    description,
    metadata,
    credit_bucket,
    monthly_credits_used,
    purchased_credits_used
  )
  values (
    auth.uid(),
    p_request_id,
    'lead_unlock',
    -v_cost,
    v_balance,
    'Credits used to unlock service request',
    jsonb_build_object('credit_cost', v_cost, 'service_list', v_service_list),
    case
      when v_monthly_used > 0 and v_purchased_used > 0 then 'mixed'
      when v_monthly_used > 0 then 'monthly'
      else 'purchased'
    end,
    v_monthly_used,
    v_purchased_used
  );

  if v_access.id is null then
    insert into public.service_request_access_requests (
      service_request_id,
      practitioner_profile_id,
      status,
      credit_cost,
      credit_deducted,
      requested_at,
      responded_at
    )
    values (
      p_request_id,
      auth.uid(),
      'approved',
      v_cost,
      true,
      now(),
      now()
    );
  else
    update public.service_request_access_requests
    set
      status = 'approved',
      credit_cost = v_cost,
      credit_deducted = true,
      responded_at = coalesce(responded_at, now()),
      updated_at = now()
    where id = v_access.id;
  end if;

  update public.service_requests
  set
    status = case
      when status = 'new' then 'viewed'::public.service_request_status
      else status
    end,
    updated_at = now()
  where id = p_request_id;

  return 'approved';
end;
$$;
