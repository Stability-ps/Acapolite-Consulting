alter table public.whatsapp_conversations
  add column if not exists assigned_staff_id uuid,
  add column if not exists assigned_staff_name text,
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by uuid,
  add column if not exists last_staff_reply_at timestamptz;

alter table public.whatsapp_messages
  add column if not exists staff_sender_id uuid,
  add column if not exists staff_sender_name text;

create table if not exists public.whatsapp_staff_actions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  actor_id uuid not null,
  actor_name text not null,
  action text not null check (action in ('assigned', 'reassigned', 'staff_reply', 'returned_to_ai')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_conversations_assigned_staff_idx
  on public.whatsapp_conversations (assigned_staff_id, updated_at desc);

create index if not exists whatsapp_staff_actions_conversation_idx
  on public.whatsapp_staff_actions (conversation_id, created_at desc);

alter table public.whatsapp_staff_actions enable row level security;

comment on table public.whatsapp_staff_actions is
  'Server-only audit trail for staff ownership and replies in WhatsApp human handoff conversations.';
