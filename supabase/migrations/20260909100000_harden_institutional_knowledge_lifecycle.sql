-- Protect institutional knowledge deletion even when an application path is bypassed.
-- This table intentionally stores lifecycle metadata only; never document contents.
create table if not exists public.institutional_knowledge_delete_audit (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  target_id uuid not null,
  title text,
  file_path text,
  checksum_sha256 text,
  actor_db_user text not null,
  auth_user_id uuid,
  deleted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_institutional_knowledge_delete_audit_target
  on public.institutional_knowledge_delete_audit(table_name, target_id, deleted_at desc);

alter table public.institutional_knowledge_delete_audit enable row level security;
revoke all on public.institutional_knowledge_delete_audit from anon, authenticated;

create or replace function public.audit_institutional_knowledge_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_json jsonb := to_jsonb(old);
  source_path text := coalesce(old_json->>'file_path', old_json->>'source_file_path');
  source_checksum text := coalesce(old_json->>'checksum_sha256', old_json->>'source_checksum_sha256');
  record_title text := coalesce(old_json->>'title', old_json->>'name');
begin
  insert into public.institutional_knowledge_delete_audit (
    table_name,
    target_id,
    title,
    file_path,
    checksum_sha256,
    actor_db_user,
    auth_user_id,
    metadata
  ) values (
    tg_table_name,
    (old_json->>'id')::uuid,
    nullif(record_title, ''),
    nullif(source_path, ''),
    nullif(source_checksum, ''),
    current_user,
    auth.uid(),
    jsonb_strip_nulls(jsonb_build_object(
      'domain', case tg_table_name
        when 'tax_knowledge_library' then 'tax_knowledge'
        when 'past_cases' then 'past_cases'
        when 'past_case_documents' then 'past_case_documents'
        when 'correspondence_templates' then 'correspondence_templates'
        else tg_table_name
      end,
      'file_name', coalesce(old_json->>'file_name', old_json->>'source_file_name'),
      'past_case_id', old_json->>'past_case_id',
      'source_mime_type', old_json->>'source_mime_type'
    ))
  );
  return old;
end;
$$;

drop trigger if exists trg_audit_tax_knowledge_delete on public.tax_knowledge_library;
create trigger trg_audit_tax_knowledge_delete
before delete on public.tax_knowledge_library
for each row execute function public.audit_institutional_knowledge_delete();

drop trigger if exists trg_audit_past_case_delete on public.past_cases;
create trigger trg_audit_past_case_delete
before delete on public.past_cases
for each row execute function public.audit_institutional_knowledge_delete();

drop trigger if exists trg_audit_past_case_document_delete on public.past_case_documents;
create trigger trg_audit_past_case_document_delete
before delete on public.past_case_documents
for each row execute function public.audit_institutional_knowledge_delete();

drop trigger if exists trg_audit_correspondence_template_delete on public.correspondence_templates;
create trigger trg_audit_correspondence_template_delete
before delete on public.correspondence_templates
for each row execute function public.audit_institutional_knowledge_delete();

-- Application users must use the authenticated server-side lifecycle operation.
-- service_role/postgres retain access for the Edge Function and maintenance.
revoke delete on public.tax_knowledge_library from anon, authenticated;
revoke delete on public.past_cases from anon, authenticated;
revoke delete on public.past_case_documents from anon, authenticated;
revoke delete on public.correspondence_templates from anon, authenticated;
