-- Durable invoice payment ledger.
-- Payments are append-only business events; invoice totals are synchronised by trigger.

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date timestamptz not null default now(),
  payment_method text not null default 'eft',
  reference text,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invoice_payments_invoice_id_idx on public.invoice_payments(invoice_id);
create index if not exists invoice_payments_payment_date_idx on public.invoice_payments(payment_date desc);

alter table public.invoice_payments enable row level security;

drop policy if exists "invoice_payments_select_staff" on public.invoice_payments;
create policy "invoice_payments_select_staff"
on public.invoice_payments
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'consultant')
  )
);

drop policy if exists "invoice_payments_insert_managers" on public.invoice_payments;
create policy "invoice_payments_insert_managers"
on public.invoice_payments
for insert
with check (
  recorded_by = auth.uid()
  and (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
    or exists (
      select 1
      from public.staff_permissions sp
      where sp.profile_id = auth.uid() and sp.can_manage_invoices = true
    )
  )
);

drop policy if exists "invoice_payments_delete_admin" on public.invoice_payments;
create policy "invoice_payments_delete_admin"
on public.invoice_payments
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create or replace function public.sync_invoice_payment_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invoice_id uuid;
  paid_total numeric(12,2);
  invoice_total numeric(12,2);
  next_balance numeric(12,2);
begin
  target_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select coalesce(sum(amount), 0)
  into paid_total
  from public.invoice_payments
  where invoice_id = target_invoice_id;

  select total_amount
  into invoice_total
  from public.invoices
  where id = target_invoice_id;

  next_balance := greatest(invoice_total - paid_total, 0);

  update public.invoices
  set
    amount_paid = paid_total,
    balance_due = next_balance,
    paid_at = case when paid_total >= invoice_total and invoice_total > 0 then coalesce(paid_at, now()) else null end,
    status = case
      when status = 'cancelled' then status
      when paid_total >= invoice_total and invoice_total > 0 then 'paid'::public.invoice_status
      when paid_total > 0 then 'partially_paid'::public.invoice_status
      when status in ('paid', 'partially_paid') then 'issued'::public.invoice_status
      else status
    end,
    updated_at = now()
  where id = target_invoice_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_invoice_payment_totals on public.invoice_payments;
create trigger trg_sync_invoice_payment_totals
after insert or update or delete on public.invoice_payments
for each row execute function public.sync_invoice_payment_totals();
