alter table public.invoices
  add column if not exists delivery_recipient_mode text not null default 'client',
  add column if not exists delivery_recipient_client_id uuid null references public.clients(id) on delete set null,
  add column if not exists delivery_recipient_name text null,
  add column if not exists delivery_recipient_email text null,
  add column if not exists delivery_cc_emails text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_delivery_recipient_mode_check'
  ) then
    alter table public.invoices
      add constraint invoices_delivery_recipient_mode_check
      check (delivery_recipient_mode in ('client', 'existing_client', 'custom'));
  end if;
end $$;

create index if not exists invoices_delivery_recipient_client_id_idx
  on public.invoices(delivery_recipient_client_id);
