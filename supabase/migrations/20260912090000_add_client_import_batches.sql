-- Idempotency + audit trail for the bulk client-import edge function
-- (import-clients). Dual purpose:
--
-- 1. Idempotency: the caller generates `id` client-side (a UUID) once,
--    before the first request attempt, and resends the same id on any
--    retry. The edge function checks this table's status first ('completed'
--    batches are replayed, not re-executed) and the
--    unique (batch_id, row_number) constraint on client_import_batch_rows
--    is the hard, structural backstop — even a concurrent duplicate request
--    that raced past the status check cannot insert the same row twice.
--
-- 2. Audit: one row per submitted CSV/XLSX row, recording the final
--    outcome (imported / skipped by staff / blocked for validation,
--    duplicate, or portal-collision reasons / failed), which existing
--    client(s) it matched against, and whether it was force-imported past
--    a duplicate warning via "Import Anyway".
--
-- Reconstructed to match the live production schema after the original
-- local source for this migration was lost (never committed).

create table if not exists public.client_import_batches (
  id uuid primary key,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'processing' check (status in ('processing', 'completed')),
  source_filename text,
  total_rows integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  blocked_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.client_import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.client_import_batches(id) on delete cascade,
  row_number integer not null,
  status text not null check (status in (
    'imported',
    'skipped_user',
    'blocked_validation',
    'blocked_duplicate_changed',
    'blocked_portal_collision',
    'failed'
  )),
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  reason text,
  duplicate_reason text,
  matched_client_ids uuid[],
  forced_import_anyway boolean not null default false,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

alter table public.client_import_batches enable row level security;
alter table public.client_import_batch_rows enable row level security;

create policy client_import_batches_select_staff
  on public.client_import_batches
  for select
  using (is_admin_or_consultant());

create policy client_import_batch_rows_select_staff
  on public.client_import_batch_rows
  for select
  using (is_admin_or_consultant());

-- No insert/update/delete policies for staff: writes happen only through
-- the import-clients edge function's service-role client.
