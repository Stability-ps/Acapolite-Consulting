-- Lock down practitioner_credit_purchases writes (audit C2).
--
-- Previously the frontend could insert and update credit purchase rows
-- directly, letting a malicious practitioner specify any credits/amount
-- combination before paying. The webhook then trusted those values when
-- granting credits.
--
-- After this migration, only the service role (used by the new
-- create-practitioner-credit-purchase edge function and the paystack-webhook
-- edge function) can write to this table. Authenticated users can still
-- SELECT their own purchases via the existing select policy.
--
-- A side effect: when a user closes the Paystack popup before paying, the
-- pending row is no longer flipped to 'cancelled' from the browser. It just
-- stays 'pending'. A future cleanup job can mark abandoned pending rows
-- older than 24h as 'expired' if needed.

drop policy if exists "practitioner_credit_purchases_insert_own"
  on public.practitioner_credit_purchases;

drop policy if exists "practitioner_credit_purchases_update_own_pending"
  on public.practitioner_credit_purchases;
