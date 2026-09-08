-- PR 4A of feature/tax-ai-case-knowledge: real document-content retrieval.
-- Purely additive. Adds server-side tracking for OpenAI vector store /
-- file identifiers so uploaded document CONTENT (not just structured
-- metadata) becomes searchable via OpenAI's native File Search tool.
--
-- Architecture: per-case vector stores for confidential client documents
-- (hard isolation - the only way to leak across cases is to pass the wrong
-- store id, and passing none returns zero results), shared global vector
-- stores for Tax Knowledge Library and Past Cases (non-confidential,
-- domain-level). Supabase remains the authoritative copy of every file;
-- OpenAI only ever holds a derived, re-creatable copy for search.

create table if not exists public.ai_vector_stores (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  openai_vector_store_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_vector_stores_domain_chk check (domain in ('tax_knowledge', 'past_cases'))
);

drop trigger if exists trg_ai_vector_stores_updated_at on public.ai_vector_stores;
create trigger trg_ai_vector_stores_updated_at
before update on public.ai_vector_stores
for each row execute function public.set_updated_at();

alter table public.ai_vector_stores enable row level security;

drop policy if exists "ai_vector_stores_select_staff" on public.ai_vector_stores;
create policy "ai_vector_stores_select_staff"
on public.ai_vector_stores
for select
using (public.is_admin_or_consultant());

drop policy if exists "ai_vector_stores_manage_admin_only" on public.ai_vector_stores;
create policy "ai_vector_stores_manage_admin_only"
on public.ai_vector_stores
for all
using (public.get_my_role() = 'admin'::public.app_role)
with check (public.get_my_role() = 'admin'::public.app_role);

-- Per-case vector store id, lazily created on first indexed case document.
alter table public.cases
  add column if not exists openai_vector_store_id text;

-- Per-file OpenAI identifiers and confirmed-indexed timestamp. A row is
-- only ever marked 'indexed' once OpenAI confirms the file is actually
-- searchable, never merely "uploaded".
alter table public.documents
  add column if not exists openai_file_id text,
  add column if not exists ai_indexed_at timestamptz;

alter table public.tax_knowledge_library
  add column if not exists openai_file_id text,
  add column if not exists ai_indexed_at timestamptz;

alter table public.past_case_documents
  add column if not exists openai_file_id text,
  add column if not exists ai_indexed_at timestamptz;

create index if not exists idx_documents_openai_file_id
  on public.documents (openai_file_id)
  where openai_file_id is not null;

create index if not exists idx_tax_knowledge_library_openai_file_id
  on public.tax_knowledge_library (openai_file_id)
  where openai_file_id is not null;

create index if not exists idx_past_case_documents_openai_file_id
  on public.past_case_documents (openai_file_id)
  where openai_file_id is not null;
