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
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if public.get_my_role() <> 'consultant' then
    raise exception 'Only practitioners can unlock leads.';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if v_request.id is null then
    raise exception 'Service request not found.';
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

  if v_response_count >= 4 then
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

create or replace function public.consume_practitioner_credit_on_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_cost integer;
  v_response_count integer;
  v_service_list public.service_request_service_needed[];
  v_access public.service_request_access_requests%rowtype;
  v_monthly_used integer;
  v_purchased_used integer;
begin
  select count(*)
  into v_response_count
  from public.service_request_responses
  where service_request_id = new.service_request_id;

  if v_response_count > 4 then
    raise exception 'This lead has reached the maximum of 4 practitioner responses.';
  end if;

  select *
  into v_access
  from public.service_request_access_requests
  where service_request_id = new.service_request_id
    and practitioner_profile_id = new.practitioner_profile_id;

  if v_access.id is null or v_access.status <> 'approved' then
    raise exception 'Unlock this lead before responding.';
  end if;

  if v_access.credit_deducted then
    return new;
  end if;

  select case
      when coalesce(array_length(sr.service_needed_list, 1), 0) > 0 then sr.service_needed_list
      when sr.service_needed is not null then array[sr.service_needed]
      else '{}'::public.service_request_service_needed[]
    end
  into v_service_list
  from public.service_requests sr
  where sr.id = new.service_request_id;

  v_cost := public.get_service_request_credit_cost_for_services(v_service_list);

  select balance, monthly_used, purchased_used
  into v_balance, v_monthly_used, v_purchased_used
  from public.consume_practitioner_credit_wallet(new.practitioner_profile_id, v_cost);

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    service_request_id,
    response_id,
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
    new.practitioner_profile_id,
    new.service_request_id,
    new.id,
    'lead_unlock',
    -v_cost,
    v_balance,
    'Lead unlock credit deduction.',
    jsonb_build_object('credit_cost', v_cost, 'service_list', v_service_list),
    case
      when v_monthly_used > 0 and v_purchased_used > 0 then 'mixed'
      when v_monthly_used > 0 then 'monthly'
      else 'purchased'
    end,
    v_monthly_used,
    v_purchased_used
  );

  update public.service_request_access_requests
  set
    status = 'approved',
    credit_cost = v_cost,
    credit_deducted = true,
    responded_at = coalesce(responded_at, now()),
    updated_at = now()
  where id = v_access.id;

  return new;
end;
$$;

update public.service_request_access_requests as sra
set
  credit_cost = public.get_service_request_credit_cost_for_services(
    case
      when coalesce(array_length(sr.service_needed_list, 1), 0) > 0 then sr.service_needed_list
      when sr.service_needed is not null then array[sr.service_needed]
      else '{}'::public.service_request_service_needed[]
    end
  ),
  updated_at = now()
from public.service_requests as sr
where sr.id = sra.service_request_id
  and sra.credit_deducted = false;
