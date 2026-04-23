create or replace function public.enforce_service_request_response_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.service_request_id::text));

  select count(*)
  into v_response_count
  from public.service_request_responses
  where service_request_id = new.service_request_id;

  if v_response_count >= 4 then
    raise exception 'Response limit reached.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_service_request_responses_limit on public.service_request_responses;
create trigger trg_service_request_responses_limit
before insert on public.service_request_responses
for each row execute function public.enforce_service_request_response_limit();

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

  v_cost := coalesce(v_access.credit_cost, public.get_service_request_credit_cost(v_request.service_needed));

  perform public.ensure_practitioner_credit_account(auth.uid(), false);

  select balance
  into v_balance
  from public.practitioner_credit_accounts
  where profile_id = auth.uid()
  for update;

  if coalesce(v_balance, 0) < v_cost then
    raise exception 'You need % credits to unlock this lead. Please purchase more credits.', v_cost;
  end if;

  update public.practitioner_credit_accounts
  set
    balance = balance - v_cost,
    total_used_credits = total_used_credits + v_cost,
    updated_at = now()
  where profile_id = auth.uid()
  returning balance into v_balance;

  insert into public.practitioner_credit_transactions (
    practitioner_profile_id,
    service_request_id,
    transaction_type,
    credits_delta,
    balance_after,
    description
  )
  values (
    auth.uid(),
    p_request_id,
    'lead_unlock',
    -v_cost,
    v_balance,
    'Credits used to unlock service request'
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
