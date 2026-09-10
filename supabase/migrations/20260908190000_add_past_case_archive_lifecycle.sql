alter table public.past_cases
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_past_cases_archived on public.past_cases(is_archived, updated_at desc);
