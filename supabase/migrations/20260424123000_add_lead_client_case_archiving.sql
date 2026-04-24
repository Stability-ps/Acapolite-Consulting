alter type public.service_request_status add value if not exists 'in_progress';
alter type public.service_request_status add value if not exists 'waiting_response';
alter type public.service_request_status add value if not exists 'dead_lead';
alter type public.service_request_status add value if not exists 'converted_to_client';

alter table public.service_requests
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists archive_notes text;

alter table public.clients
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists archive_notes text;

alter table public.cases
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists archive_notes text;

alter table public.service_requests
  drop constraint if exists service_requests_archive_reason_check;

alter table public.service_requests
  add constraint service_requests_archive_reason_check
  check (
    archive_reason is null
    or archive_reason in ('completed', 'inactive', 'duplicate', 'spam', 'declined', 'other')
  );

alter table public.clients
  drop constraint if exists clients_archive_reason_check;

alter table public.clients
  add constraint clients_archive_reason_check
  check (
    archive_reason is null
    or archive_reason in ('completed', 'inactive', 'duplicate', 'other')
  );

alter table public.cases
  drop constraint if exists cases_archive_reason_check;

alter table public.cases
  add constraint cases_archive_reason_check
  check (
    archive_reason is null
    or archive_reason in ('completed', 'inactive', 'duplicate', 'other')
  );

create index if not exists idx_service_requests_archived
  on public.service_requests(is_archived, status, created_at desc);

create index if not exists idx_clients_archived
  on public.clients(is_archived, created_at desc);

create index if not exists idx_cases_archived
  on public.cases(is_archived, last_activity_at desc);

update public.service_requests
set status = 'assigned'
where converted_case_id is not null
  and status = 'assigned';
