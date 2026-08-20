create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique,
  phone_number text not null,
  display_name text,
  status text not null default 'active',
  ai_enabled boolean not null default true,
  human_handoff_requested_at timestamptz,
  service_request_id uuid references public.service_requests(id) on delete set null,
  source text not null default 'whatsapp',
  referral_source text,
  referral_campaign_id text,
  referral_ad_id text,
  referral_headline text,
  ai_summary text,
  intake_payload jsonb not null default '{}'::jsonb,
  intake_missing_fields text[] not null default '{}'::text[],
  intake_ready boolean not null default false,
  intake_updated_at timestamptz,
  submission_state text not null default 'collecting',
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_conversations_status_check check (status in ('active', 'human_handoff', 'closed')),
  constraint whatsapp_conversations_submission_state_check check (submission_state in ('collecting', 'awaiting_confirmation', 'submitted'))
);

alter table public.whatsapp_conversations
  add column if not exists phone_number text,
  add column if not exists display_name text,
  add column if not exists status text not null default 'active',
  add column if not exists ai_enabled boolean not null default true,
  add column if not exists human_handoff_requested_at timestamptz,
  add column if not exists service_request_id uuid references public.service_requests(id) on delete set null,
  add column if not exists source text not null default 'whatsapp',
  add column if not exists referral_source text,
  add column if not exists referral_campaign_id text,
  add column if not exists referral_ad_id text,
  add column if not exists referral_headline text,
  add column if not exists ai_summary text,
  add column if not exists intake_payload jsonb not null default '{}'::jsonb,
  add column if not exists intake_missing_fields text[] not null default '{}'::text[],
  add column if not exists intake_ready boolean not null default false,
  add column if not exists intake_updated_at timestamptz,
  add column if not exists submission_state text not null default 'collecting',
  add column if not exists last_inbound_at timestamptz,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  meta_message_id text unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('customer', 'ai', 'staff', 'admin', 'system')),
  message_type text not null default 'text',
  content text,
  delivery_status text,
  media_id text,
  media_mime_type text,
  media_filename text,
  media_sha256 text,
  media_size_bytes integer,
  media_storage_path text,
  created_at timestamptz not null default now()
);

alter table public.whatsapp_messages
  add column if not exists meta_message_id text,
  add column if not exists delivery_status text,
  add column if not exists media_id text,
  add column if not exists media_mime_type text,
  add column if not exists media_filename text,
  add column if not exists media_sha256 text,
  add column if not exists media_size_bytes integer,
  add column if not exists media_storage_path text,
  add column if not exists created_at timestamptz not null default now();

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_status_check,
  add constraint whatsapp_conversations_status_check check (status in ('active', 'human_handoff', 'closed'));

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_submission_state_check,
  add constraint whatsapp_conversations_submission_state_check check (submission_state in ('collecting', 'awaiting_confirmation', 'submitted'));

alter table public.whatsapp_messages
  drop constraint if exists whatsapp_messages_direction_check,
  add constraint whatsapp_messages_direction_check check (direction in ('inbound', 'outbound'));

alter table public.whatsapp_messages
  drop constraint if exists whatsapp_messages_sender_type_check,
  add constraint whatsapp_messages_sender_type_check check (sender_type in ('customer', 'ai', 'staff', 'admin', 'system'));

create index if not exists idx_whatsapp_conversations_updated_at
  on public.whatsapp_conversations (updated_at desc);

create unique index if not exists whatsapp_conversations_wa_id_key
  on public.whatsapp_conversations (wa_id);

create index if not exists idx_whatsapp_conversations_status
  on public.whatsapp_conversations (status);

create index if not exists idx_whatsapp_conversations_submission_state
  on public.whatsapp_conversations (submission_state);

create index if not exists idx_whatsapp_messages_conversation_created
  on public.whatsapp_messages (conversation_id, created_at);

create unique index if not exists whatsapp_messages_meta_message_id_key
  on public.whatsapp_messages (meta_message_id)
  where meta_message_id is not null;

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_conversations'
      and policyname = 'whatsapp_conversations_admin_select'
  ) then
    create policy "whatsapp_conversations_admin_select"
    on public.whatsapp_conversations
    for select
    to authenticated
    using (public.get_my_role() = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_conversations'
      and policyname = 'whatsapp_conversations_admin_update'
  ) then
    create policy "whatsapp_conversations_admin_update"
    on public.whatsapp_conversations
    for update
    to authenticated
    using (public.get_my_role() = 'admin')
    with check (public.get_my_role() = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_messages'
      and policyname = 'whatsapp_messages_admin_select'
  ) then
    create policy "whatsapp_messages_admin_select"
    on public.whatsapp_messages
    for select
    to authenticated
    using (public.get_my_role() = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_messages'
      and policyname = 'whatsapp_messages_admin_insert'
  ) then
    create policy "whatsapp_messages_admin_insert"
    on public.whatsapp_messages
    for insert
    to authenticated
    with check (public.get_my_role() = 'admin');
  end if;
end
$$;
