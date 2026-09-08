-- Original template sources remain in the existing private documents bucket.
alter table public.correspondence_templates
  add column if not exists source_file_name text,
  add column if not exists source_file_path text,
  add column if not exists source_file_size bigint,
  add column if not exists source_mime_type text,
  add column if not exists source_checksum_sha256 text;
-- Existing table RLS and admin-only write policies continue to apply.

alter table public.tax_knowledge_library add column if not exists ai_index_started_at timestamptz;
alter table public.past_case_documents add column if not exists ai_index_started_at timestamptz;
alter table public.documents add column if not exists ai_index_started_at timestamptz;
