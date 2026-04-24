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
  v_service_needed public.service_request_service_needed;
  v_access public.service_request_access_requests%rowtype;
begin
  select count(*)
  into v_response_count
  from public.service_request_responses
  where service_request_id = new.service_request_id;

  -- This trigger runs after insert in some environments, so the freshly inserted
  -- row is already included in the count. Allow the 4th response and only reject
  -- the 5th and beyond.
  if v_response_count > 4 then
    raise exception 'This lead has reached the maximum of 4 practitioner responses.';
  end if;

  select service_needed
  into v_service_needed
  from public.service_requests
  where id = new.service_request_id;

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

  v_cost := coalesce(v_access.credit_cost, public.get_service_request_credit_cost(v_service_needed));

  perform public.ensure_practitioner_credit_account(new.practitioner_profile_id, false);

  select balance
  into v_balance
  from public.practitioner_credit_accounts
  where profile_id = new.practitioner_profile_id
  for update;

  if coalesce(v_balance, 0) < v_cost then
    raise exception 'You need % credits to respond to this request. Please purchase more credits.', v_cost;
  end if;

  update public.practitioner_credit_accounts
  set
    balance = balance - v_cost,
    total_used_credits = total_used_credits + v_cost,
    updated_at = now()
  where profile_id = new.practitioner_profile_id
  returning balance into v_balance;

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    service_request_id,
    response_id,
    transaction_type,
    credits_delta,
    balance_after,
    description,
    metadata
  )
  values (
    new.practitioner_profile_id,
    new.service_request_id,
    new.id,
    'lead_unlock',
    -v_cost,
    v_balance,
    'Lead unlock credit deduction.',
    jsonb_build_object('credit_cost', v_cost, 'service_needed', v_service_needed::text)
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
