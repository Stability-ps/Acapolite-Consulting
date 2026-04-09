do $$
begin
  if not exists (select 1 from pg_type where typname = 'service_request_status') then
    create type public.service_request_status as enum (
      'new',
      'viewed',
      'responded',
      'assigned',
      'closed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'service_request_client_type') then
    create type public.service_request_client_type as enum (
      'individual',
      'company'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'service_request_service_needed') then
    create type public.service_request_service_needed as enum (
      'tax_return',
      'sars_debt_assistance',
      'vat_registration',
      'company_tax',
      'paye_issues',
      'objection_dispute',
      'bookkeeping',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'service_request_priority') then
    create type public.service_request_priority as enum (
      'low',
      'medium',
      'high',
      'urgent'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'service_request_risk_indicator') then
    create type public.service_request_risk_indicator as enum (
      'low',
      'medium',
      'high'
    );
  end if;
end $$;

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  client_type public.service_request_client_type not null,
  id_number text,
  company_registration_number text,
  service_needed public.service_request_service_needed not null,
  priority_level public.service_request_priority not null default 'medium',
  description text not null,
  sars_debt_amount numeric(12,2) not null default 0,
  returns_filed boolean not null default true,
  status public.service_request_status not null default 'new',
  has_debt_flag boolean not null default false,
  missing_returns_flag boolean not null default false,
  missing_documents_flag boolean not null default true,
  risk_indicator public.service_request_risk_indicator not null default 'low',
  viewed_at timestamptz,
  responded_at timestamptz,
  assigned_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_requests_identity_chk check (
    (client_type = 'individual' and id_number is not null and company_registration_number is null)
    or
    (client_type = 'company' and company_registration_number is not null and id_number is null)
  )
);

create table if not exists public.service_request_documents (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  title text not null,
  file_name text not null,
  file_path text not null unique,
  file_size bigint,
  mime_type text,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_service_requests_status on public.service_requests(status);
create index if not exists idx_service_requests_created_at on public.service_requests(created_at desc);
create index if not exists idx_service_requests_service_needed on public.service_requests(service_needed);
create index if not exists idx_service_requests_risk_indicator on public.service_requests(risk_indicator);
create index if not exists idx_service_request_documents_request_id on public.service_request_documents(service_request_id);

drop trigger if exists trg_service_requests_updated_at on public.service_requests;
create trigger trg_service_requests_updated_at
before update on public.service_requests
for each row execute function public.set_updated_at();

create or replace function public.refresh_service_request_risk()
returns trigger
language plpgsql
as $$
declare
  attachment_count integer := 0;
begin
  if tg_table_name = 'service_request_documents' then
    select count(*)
    into attachment_count
    from public.service_request_documents
    where service_request_id = coalesce(new.service_request_id, old.service_request_id);

    update public.service_requests
    set
      missing_documents_flag = attachment_count = 0,
      risk_indicator = case
        when has_debt_flag and missing_returns_flag then 'high'::public.service_request_risk_indicator
        when has_debt_flag or missing_returns_flag or attachment_count = 0 then 'medium'::public.service_request_risk_indicator
        else 'low'::public.service_request_risk_indicator
      end,
      updated_at = now()
    where id = coalesce(new.service_request_id, old.service_request_id);

    return coalesce(new, old);
  end if;

  new.has_debt_flag := coalesce(new.sars_debt_amount, 0) > 0;
  new.missing_returns_flag := not coalesce(new.returns_filed, false);

  select count(*)
  into attachment_count
  from public.service_request_documents
  where service_request_id = coalesce(new.id, old.id);

  new.missing_documents_flag := attachment_count = 0;
  new.risk_indicator := case
    when new.has_debt_flag and new.missing_returns_flag then 'high'::public.service_request_risk_indicator
    when new.has_debt_flag or new.missing_returns_flag or attachment_count = 0 then 'medium'::public.service_request_risk_indicator
    else 'low'::public.service_request_risk_indicator
  end;

  return new;
end;
$$;

drop trigger if exists trg_service_requests_refresh_risk on public.service_requests;
create trigger trg_service_requests_refresh_risk
before insert or update on public.service_requests
for each row execute function public.refresh_service_request_risk();

drop trigger if exists trg_service_request_documents_refresh_risk on public.service_request_documents;
create trigger trg_service_request_documents_refresh_risk
after insert or delete on public.service_request_documents
for each row execute function public.refresh_service_request_risk();

alter table public.service_requests enable row level security;
alter table public.service_request_documents enable row level security;

drop policy if exists "service_requests_public_insert" on public.service_requests;
create policy "service_requests_public_insert"
on public.service_requests
for insert
with check (true);

drop policy if exists "service_requests_staff_select" on public.service_requests;
create policy "service_requests_staff_select"
on public.service_requests
for select
using (public.is_admin_or_consultant());

drop policy if exists "service_requests_staff_update" on public.service_requests;
create policy "service_requests_staff_update"
on public.service_requests
for update
using (public.is_admin_or_consultant())
with check (public.is_admin_or_consultant());

drop policy if exists "service_request_documents_public_insert" on public.service_request_documents;
create policy "service_request_documents_public_insert"
on public.service_request_documents
for insert
with check (true);

drop policy if exists "service_request_documents_staff_select" on public.service_request_documents;
create policy "service_request_documents_staff_select"
on public.service_request_documents
for select
using (public.is_admin_or_consultant());

drop policy if exists "documents_bucket_insert_service_requests_public" on storage.objects;
create policy "documents_bucket_insert_service_requests_public"
on storage.objects
for insert
with check (
  bucket_id = 'documents'
  and (
    split_part(name, '/', 1) = 'service-requests'
    or split_part(name, '/', 2) = 'service-requests'
  )
);

drop policy if exists "documents_bucket_select_service_requests_staff" on storage.objects;
create policy "documents_bucket_select_service_requests_staff"
on storage.objects
for select
using (
  bucket_id = 'documents'
  and (
    public.is_admin_or_consultant()
    or auth.uid()::text = split_part(name, '/', 1)
    or auth.uid()::text = split_part(name, '/', 2)
  )
);
