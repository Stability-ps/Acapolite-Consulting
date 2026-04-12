alter table public.invoices
  add column if not exists client_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'invoices'
      and constraint_name = 'invoices_client_id_fkey'
  ) then
    alter table public.invoices
      add constraint invoices_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null;
  end if;
end $$;

create index if not exists idx_invoices_client_id
  on public.invoices(client_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'user_id'
  ) then
    update public.invoices i
    set client_id = c.id
    from public.clients c
    where i.client_id is null
      and i.user_id is not null
      and c.profile_id = i.user_id;
  end if;

  if not exists (select 1 from public.invoices where client_id is null) then
    alter table public.invoices
      alter column client_id set not null;
  end if;
end $$;

drop policy if exists "Clients can view own invoices" on public.invoices;
create policy "Clients can view own invoices"
on public.invoices
for select
using (
  exists (
    select 1
    from public.clients c
    where c.id = invoices.client_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Clients can update own invoices" on public.invoices;
create policy "Clients can update own invoices"
on public.invoices
for update
using (
  exists (
    select 1
    from public.clients c
    where c.id = invoices.client_id
      and c.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = invoices.client_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Admins can view all invoices" on public.invoices;
create policy "Admins can view all invoices"
on public.invoices
for select
using (public.is_admin_or_consultant());

drop policy if exists "Admins can manage all invoices" on public.invoices;
create policy "Admins can manage all invoices"
on public.invoices
for all
using (public.is_admin_or_consultant());
