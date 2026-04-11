create or replace function public.cancel_practitioner_subscription(
  p_subscription_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.practitioner_subscriptions%rowtype;
begin
  select *
  into v_subscription
  from public.practitioner_subscriptions
  where id = p_subscription_id
  for update;

  if v_subscription.id is null then
    raise exception 'Subscription not found.';
  end if;

  if public.get_my_role() <> 'admin' and auth.uid() <> v_subscription.practitioner_profile_id then
    raise exception 'You cannot cancel this subscription.';
  end if;

  if v_subscription.status <> 'active' then
    return false;
  end if;

  update public.practitioner_subscriptions
  set
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  where id = v_subscription.id;

  return true;
end;
$$;
