-- Tax AI foundations, PR 1 of feature/tax-ai-case-knowledge.
-- Purely additive: new nullable/defaulted columns on public.documents, plus two
-- new global tables (tax_knowledge_library, past_cases + past_case_documents)
-- that deliberately carry no client_id/case_id foreign key, per the
-- non-negotiable separation between confidential client case documents and
-- global Acapolite institutional AI knowledge.
--
-- Reuses existing helpers: public.is_admin_or_consultant(), public.get_my_role(),
-- public.set_updated_at() trigger function, and the existing "documents"
-- storage bucket / RLS conventions already in production.

-- 1. Shared AI-indexing lifecycle enum, reused across documents and the new
--    knowledge tables so indexing status is queryable/consistent everywhere.
create type public.ai_index_status as enum (
  'not_applicable',
  'pending',
  'processing',
  'indexed',
  'failed',
  'outdated',
  'removed'
);

create type public.knowledge_status as enum (
  'current',
  'superseded',
  'draft',
  'archived'
);

create type public.past_case_anonymisation_status as enum (
  'not_reviewed',
  'anonymised',
  'partially_anonymised',
  'contains_confidential_information'
);

-- 2. Extend the existing client-case documents table with tax-domain metadata
--    and dedup/indexing support. All new columns are nullable or defaulted,
--    so existing rows and existing app code remain valid.
alter table public.documents
  add column if not exists tax_type text,
  add column if not exists tax_period text,
  add column if not exists sars_reference text,
  add column if not exists assessment_reference text,
  add column if not exists document_date date,
  add column if not exists tags text[],
  add column if not exists checksum_sha256 text,
  add column if not exists ai_index_status public.ai_index_status not null default 'not_applicable',
  add column if not exists ai_index_error text;

create index if not exists idx_documents_checksum_per_client
  on public.documents (client_id, checksum_sha256)
  where checksum_sha256 is not null;

create index if not exists idx_documents_ai_index_status
  on public.documents (ai_index_status);

create index if not exists idx_documents_tax_type
  on public.documents (tax_type)
  where tax_type is not null;

-- 3. Tax Knowledge Library: global legislation/guidance/precedent-adjacent
--    reference material. Never linked to a client or case.
create table if not exists public.tax_knowledge_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  source text,
  issuing_authority text,
  tax_type text,
  legislation text,
  section_reference text,
  publication_date date,
  effective_from date,
  effective_to date,
  version text,
  jurisdiction text not null default 'South Africa',
  source_url text,
  summary text,
  tags text[],
  status public.knowledge_status not null default 'draft',
  approved_for_ai_use boolean not null default false,
  file_name text,
  file_path text,
  file_size bigint,
  mime_type text,
  checksum_sha256 text,
  ai_index_status public.ai_index_status not null default 'not_applicable',
  ai_index_error text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tax_knowledge_library_status
  on public.tax_knowledge_library (status);
create index if not exists idx_tax_knowledge_library_approved
  on public.tax_knowledge_library (approved_for_ai_use);
create index if not exists idx_tax_knowledge_library_checksum
  on public.tax_knowledge_library (checksum_sha256)
  where checksum_sha256 is not null;

drop trigger if exists trg_tax_knowledge_library_updated_at on public.tax_knowledge_library;
create trigger trg_tax_knowledge_library_updated_at
before update on public.tax_knowledge_library
for each row execute function public.set_updated_at();

alter table public.tax_knowledge_library enable row level security;

drop policy if exists "tax_knowledge_library_select_staff" on public.tax_knowledge_library;
create policy "tax_knowledge_library_select_staff"
on public.tax_knowledge_library
for select
using (public.is_admin_or_consultant());

drop policy if exists "tax_knowledge_library_manage_admin_only" on public.tax_knowledge_library;
create policy "tax_knowledge_library_manage_admin_only"
on public.tax_knowledge_library
for all
using (public.get_my_role() = 'admin'::public.app_role)
with check (public.get_my_role() = 'admin'::public.app_role);

-- 4. Past Cases / Precedents: global institutional knowledge. Deliberately
--    has NO client_id and NO case_id column — a historic precedent must
--    stand on its own and must never be reachable via a client's live
--    document set.
create table if not exists public.past_cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  case_type text,
  tax_type text,
  sars_stage text,
  issue text,
  outcome text,
  success_status text,
  summary text,
  facts_summary text,
  key_arguments text,
  supporting_documents_summary text,
  lessons_learned text,
  precedent_value text,
  tags text[],
  closed_date date,
  anonymisation_status public.past_case_anonymisation_status not null default 'not_reviewed',
  approved_for_ai_use boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_past_cases_approved
  on public.past_cases (approved_for_ai_use);
create index if not exists idx_past_cases_anonymisation
  on public.past_cases (anonymisation_status);

drop trigger if exists trg_past_cases_updated_at on public.past_cases;
create trigger trg_past_cases_updated_at
before update on public.past_cases
for each row execute function public.set_updated_at();

alter table public.past_cases enable row level security;

drop policy if exists "past_cases_select_staff" on public.past_cases;
create policy "past_cases_select_staff"
on public.past_cases
for select
using (public.is_admin_or_consultant());

drop policy if exists "past_cases_manage_admin_only" on public.past_cases;
create policy "past_cases_manage_admin_only"
on public.past_cases
for all
using (public.get_my_role() = 'admin'::public.app_role)
with check (public.get_my_role() = 'admin'::public.app_role);

-- 5. Documents attached to a Past Case precedent. Linked only to the
--    precedent, never to a client or case.
create table if not exists public.past_case_documents (
  id uuid primary key default gen_random_uuid(),
  past_case_id uuid not null references public.past_cases(id) on delete cascade,
  category text,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  checksum_sha256 text,
  ai_index_status public.ai_index_status not null default 'not_applicable',
  ai_index_error text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_past_case_documents_past_case_id
  on public.past_case_documents (past_case_id);
create index if not exists idx_past_case_documents_checksum
  on public.past_case_documents (checksum_sha256)
  where checksum_sha256 is not null;

alter table public.past_case_documents enable row level security;

drop policy if exists "past_case_documents_select_staff" on public.past_case_documents;
create policy "past_case_documents_select_staff"
on public.past_case_documents
for select
using (public.is_admin_or_consultant());

drop policy if exists "past_case_documents_manage_admin_only" on public.past_case_documents;
create policy "past_case_documents_manage_admin_only"
on public.past_case_documents
for all
using (public.get_my_role() = 'admin'::public.app_role)
with check (public.get_my_role() = 'admin'::public.app_role);
