alter table public.practitioner_profiles
  add column if not exists invoice_logo_path text;

alter table public.invoices
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists notes_to_client text,
  add column if not exists terms_and_conditions text,
  add column if not exists viewed_at timestamptz,
  add column if not exists practitioner_name text,
  add column if not exists practice_name text,
  add column if not exists practitioner_number text,
  add column if not exists practitioner_email text,
  add column if not exists practitioner_phone text,
  add column if not exists practitioner_address text,
  add column if not exists practitioner_logo_path text,
  add column if not exists client_name text,
  add column if not exists client_email text,
  add column if not exists client_phone text,
  add column if not exists client_address text;

alter table public.invoices
  drop constraint if exists invoices_discount_amount_check;

alter table public.invoices
  add constraint invoices_discount_amount_check
  check (discount_amount >= 0);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  service_item text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  line_total numeric generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoice_items'
      and column_name = 'description'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoice_items'
      and column_name = 'service_item'
  ) then
    alter table public.invoice_items rename column description to service_item;
  end if;
end $$;

create index if not exists idx_invoice_items_invoice_id
  on public.invoice_items(invoice_id);

drop trigger if exists trg_invoice_items_updated_at on public.invoice_items;
create trigger trg_invoice_items_updated_at
before update on public.invoice_items
for each row
execute function public.update_updated_at_column();

create table if not exists public.invoice_attachments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  attachment_type text not null default 'supporting_document'
    check (attachment_type in ('tax_calculation', 'supporting_document', 'work_summary')),
  created_at timestamptz not null default now(),
  unique (invoice_id, document_id)
);

create index if not exists idx_invoice_attachments_invoice_id
  on public.invoice_attachments(invoice_id);

create index if not exists idx_invoice_attachments_document_id
  on public.invoice_attachments(document_id);

alter table public.invoice_items enable row level security;
alter table public.invoice_attachments enable row level security;

drop policy if exists "Clients can view own invoice items" on public.invoice_items;
create policy "Clients can view own invoice items"
on public.invoice_items
for select
using (
  exists (
    select 1
    from public.invoices i
    join public.clients c on c.id = i.client_id
    where i.id = invoice_items.invoice_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Staff can manage invoice items" on public.invoice_items;
create policy "Staff can manage invoice items"
on public.invoice_items
for all
using (public.is_admin_or_consultant())
with check (public.is_admin_or_consultant());

drop policy if exists "Clients can view own invoice attachments" on public.invoice_attachments;
create policy "Clients can view own invoice attachments"
on public.invoice_attachments
for select
using (
  exists (
    select 1
    from public.invoices i
    join public.clients c on c.id = i.client_id
    where i.id = invoice_attachments.invoice_id
      and c.profile_id = auth.uid()
  )
);

drop policy if exists "Staff can manage invoice attachments" on public.invoice_attachments;
create policy "Staff can manage invoice attachments"
on public.invoice_attachments
for all
using (public.is_admin_or_consultant())
with check (public.is_admin_or_consultant());

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

drop policy if exists "Public can view branding assets" on storage.objects;
create policy "Public can view branding assets"
on storage.objects
for select
using (bucket_id = 'branding');

drop policy if exists "Users can upload branding assets" on storage.objects;
create policy "Users can upload branding assets"
on storage.objects
for insert
with check (
  bucket_id = 'branding'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.has_role(auth.uid(), 'admin')
  )
);

drop policy if exists "Users can update branding assets" on storage.objects;
create policy "Users can update branding assets"
on storage.objects
for update
using (
  bucket_id = 'branding'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.has_role(auth.uid(), 'admin')
  )
)
with check (
  bucket_id = 'branding'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.has_role(auth.uid(), 'admin')
  )
);

drop policy if exists "Users can delete branding assets" on storage.objects;
create policy "Users can delete branding assets"
on storage.objects
for delete
using (
  bucket_id = 'branding'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.has_role(auth.uid(), 'admin')
  )
);

update public.invoices i
set
  client_name = coalesce(
    i.client_name,
    nullif(trim(coalesce(data.company_name, '')), ''),
    nullif(trim(coalesce(data.client_full_name, '')), ''),
    nullif(trim(concat_ws(' ', data.first_name, data.last_name)), ''),
    data.client_code
  ),
  client_email = coalesce(i.client_email, data.client_email),
  client_phone = coalesce(i.client_phone, data.client_phone),
  client_address = coalesce(
    i.client_address,
    nullif(trim(concat_ws(', ', data.address_line_1, data.address_line_2, data.city, data.province, data.postal_code, data.country)), '')
  ),
  practitioner_name = coalesce(i.practitioner_name, data.practitioner_full_name),
  practice_name = coalesce(i.practice_name, data.business_name),
  practitioner_number = coalesce(i.practitioner_number, data.tax_practitioner_number),
  practitioner_email = coalesce(i.practitioner_email, data.practitioner_email),
  practitioner_phone = coalesce(i.practitioner_phone, data.practitioner_phone),
  practitioner_address = coalesce(
    i.practitioner_address,
    nullif(trim(concat_ws(', ', data.practice_city, data.practice_province)), '')
  ),
  practitioner_logo_path = coalesce(i.practitioner_logo_path, data.invoice_logo_path)
from (
  select
    i.id as invoice_id,
    c.company_name,
    cp.full_name as client_full_name,
    c.first_name,
    c.last_name,
    c.client_code,
    cp.email as client_email,
    cp.phone as client_phone,
    c.address_line_1,
    c.address_line_2,
    c.city,
    c.province,
    c.postal_code,
    c.country,
    pp.full_name as practitioner_full_name,
    pp.email as practitioner_email,
    pp.phone as practitioner_phone,
    pr.business_name,
    pr.tax_practitioner_number,
    pr.city as practice_city,
    pr.province as practice_province,
    pr.invoice_logo_path
  from public.invoices i
  left join public.clients c on c.id = i.client_id
  left join public.profiles cp on cp.id = c.profile_id
  left join public.cases cs on cs.id = i.case_id
  left join public.profiles pp on pp.id = coalesce(cs.assigned_consultant_id, c.assigned_consultant_id, i.created_by)
  left join public.practitioner_profiles pr on pr.profile_id = pp.id
) data
where i.id = data.invoice_id;

insert into public.invoice_items (invoice_id, service_item, quantity, unit_price)
select
  i.id,
  coalesce(nullif(trim(coalesce(i.title, '')), ''), nullif(trim(coalesce(i.description, '')), ''), 'Service Item'),
  1,
  greatest(coalesce(i.subtotal, i.total_amount, 0), 0)
from public.invoices i
where not exists (
  select 1
  from public.invoice_items items
  where items.invoice_id = i.id
);
