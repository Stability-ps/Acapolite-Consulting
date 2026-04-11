create or replace function public.consume_practitioner_credit_on_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  perform public.ensure_practitioner_credit_account(new.practitioner_profile_id, false);

  select balance
  into v_balance
  from public.practitioner_credit_accounts
  where profile_id = new.practitioner_profile_id
  for update;

  if coalesce(v_balance, 0) < 1 then
    raise exception 'You have no credits remaining. Purchase more credits before responding to a lead.';
  end if;

  update public.practitioner_credit_accounts
  set
    balance = balance - 1,
    total_used_credits = total_used_credits + 1,
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
    description
  )
  values (
    new.practitioner_profile_id,
    new.service_request_id,
    new.id,
    'lead_response',
    -1,
    v_balance,
    'Lead response credit deduction.'
  );

  return new;
end;
$$;

drop trigger if exists trg_service_request_responses_consume_credit on public.service_request_responses;
create trigger trg_service_request_responses_consume_credit
after insert on public.service_request_responses
for each row execute function public.consume_practitioner_credit_on_response();
