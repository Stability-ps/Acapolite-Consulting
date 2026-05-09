revoke execute on function public.grant_practitioner_purchased_credits(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.grant_practitioner_purchased_credits(uuid, integer)
  to service_role;

revoke execute on function public.grant_practitioner_monthly_credits(uuid, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grant_practitioner_monthly_credits(uuid, integer, timestamptz)
  to service_role;

revoke execute on function public.consume_practitioner_credit_wallet(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.consume_practitioner_credit_wallet(uuid, integer)
  to service_role;

revoke execute on function public.complete_practitioner_credit_purchase(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_practitioner_credit_purchase(uuid, text, text, jsonb)
  to service_role;

revoke execute on function public.complete_practitioner_storage_addon_purchase(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_practitioner_storage_addon_purchase(uuid, text, text, jsonb)
  to service_role;

revoke execute on function public.activate_practitioner_subscription(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.activate_practitioner_subscription(uuid, text, text, text)
  to service_role;
