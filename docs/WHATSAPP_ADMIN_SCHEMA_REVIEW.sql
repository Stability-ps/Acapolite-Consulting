-- REVIEW-ONLY SCHEMA DRAFT.
-- Do not run this file directly against production.
-- Generate the real Supabase migration through the normal migration workflow after review.

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique,
  phone_number text not null,
  display_name text,
  status text not null default 'active' check (status in ('active', 'human_handoff', 'closed')),
  ai_enabled boolean not null default true,
  human_handoff_requested_at timestamptz,
  service_request_id uuid references public.service_requests(id) on delete set null,
  source text not null default 'whatsapp',
  referral_source text,
  referral_campaign_id text,
  referral_ad_id text,
  referral_headline text,
  ai_summary text,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  meta_message_id text unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('customer', 'ai', 'admin', 'system')),
  message_type text not null default 'text',
  content text,
  delivery_status text,
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_conversations_updated_at
  on public.whatsapp_conversations(updated_at desc);
create index if not exists idx_whatsapp_conversations_status
  on public.whatsapp_conversations(status);
create index if not exists idx_whatsapp_messages_conversation_created
  on public.whatsapp_messages(conversation_id, created_at);

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

-- Admin only. Do not reuse is_admin_or_consultant(): consultants/practitioners must not have access.
create policy "whatsapp_conversations_admin_select"
on public.whatsapp_conversations
for select
to authenticated
using (public.get_my_role() = 'admin');

create policy "whatsapp_conversations_admin_update"
on public.whatsapp_conversations
for update
to authenticated
using (public.get_my_role() = 'admin')
with check (public.get_my_role() = 'admin');

create policy "whatsapp_messages_admin_select"
on public.whatsapp_messages
for select
to authenticated
using (public.get_my_role() = 'admin');

create policy "whatsapp_messages_admin_insert"
on public.whatsapp_messages
for insert
to authenticated
with check (public.get_my_role() = 'admin');

-- No anon policies and no consultant policies by design.
-- The webhook Edge Function uses server-side service-role credentials.

-- Reuse the platform's existing updated-at trigger function only after verifying the
-- currently deployed function name/signature during migration generation.
