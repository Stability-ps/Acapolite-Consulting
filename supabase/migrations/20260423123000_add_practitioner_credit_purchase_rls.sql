drop policy if exists "practitioner_credit_purchases_insert_own" on public.practitioner_credit_purchases;
create policy "practitioner_credit_purchases_insert_own"
on public.practitioner_credit_purchases
for insert
with check (
  auth.uid() = practitioner_profile_id
  and public.get_my_role() = 'consultant'
  and payment_status = 'pending'
  and payment_provider in ('paystack', 'test')
);

drop policy if exists "practitioner_credit_purchases_update_own_pending" on public.practitioner_credit_purchases;
create policy "practitioner_credit_purchases_update_own_pending"
on public.practitioner_credit_purchases
for update
using (
  auth.uid() = practitioner_profile_id
  and public.get_my_role() = 'consultant'
)
with check (
  auth.uid() = practitioner_profile_id
  and public.get_my_role() = 'consultant'
  and payment_provider in ('paystack', 'test')
);
