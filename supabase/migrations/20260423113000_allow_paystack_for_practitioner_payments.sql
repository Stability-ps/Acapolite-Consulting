alter table public.practitioner_credit_purchases
  drop constraint if exists practitioner_credit_purchases_payment_provider_check;

alter table public.practitioner_credit_purchases
  add constraint practitioner_credit_purchases_payment_provider_check
  check (payment_provider in ('test', 'payfast', 'paystack'));

alter table public.practitioner_subscriptions
  drop constraint if exists practitioner_subscriptions_payment_provider_check;

alter table public.practitioner_subscriptions
  add constraint practitioner_subscriptions_payment_provider_check
  check (payment_provider in ('test', 'payfast', 'paystack'));
