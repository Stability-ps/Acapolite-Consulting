create table if not exists public.whatsapp_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  actor_id uuid not null,
  actor_name text not null,
  preserved_service_request_id uuid,
  message_count integer not null default 0,
  attachment_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_deletion_audit_created_at_idx
  on public.whatsapp_deletion_audit (created_at desc);

alter table public.whatsapp_deletion_audit enable row level security;

comment on table public.whatsapp_deletion_audit is
  'Server-only, privacy-minimised audit of WhatsApp conversation deletions. Client content is not retained.';
