alter table public.whatsapp_conversations
  add column if not exists linked_client_id uuid,
  add column if not exists linked_client_profile_id uuid,
  add column if not exists linked_client_at timestamptz,
  add column if not exists linked_client_by uuid;

create index if not exists whatsapp_conversations_linked_client_idx
  on public.whatsapp_conversations (linked_client_id, updated_at desc)
  where linked_client_id is not null;

create table if not exists public.whatsapp_internal_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  author_id uuid not null,
  author_name text not null,
  body text not null check (length(trim(body)) between 1 and 2000),
  mentioned_staff_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_internal_notes_conversation_idx
  on public.whatsapp_internal_notes (conversation_id, created_at desc);

alter table public.whatsapp_internal_notes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_internal_notes'
      and policyname = 'whatsapp_internal_notes_admin_select'
  ) then
    create policy "whatsapp_internal_notes_admin_select"
    on public.whatsapp_internal_notes
    for select
    to authenticated
    using (public.get_my_role() = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_internal_notes'
      and policyname = 'whatsapp_internal_notes_admin_insert'
  ) then
    create policy "whatsapp_internal_notes_admin_insert"
    on public.whatsapp_internal_notes
    for insert
    to authenticated
    with check (public.get_my_role() = 'admin');
  end if;
end
$$;

alter table public.whatsapp_staff_actions
  drop constraint if exists whatsapp_staff_actions_action_check;

alter table public.whatsapp_staff_actions
  add constraint whatsapp_staff_actions_action_check
    check (action in (
      'assigned',
      'reassigned',
      'staff_reply',
      'returned_to_ai',
      'resolved',
      'reopened',
      'marked_waiting',
      'service_request_created',
      'service_request_synced',
      'internal_note_added',
      'client_linked',
      'client_unlinked'
    ));

comment on table public.whatsapp_internal_notes is
  'Private staff-only notes attached to WhatsApp QA conversations.';

comment on column public.whatsapp_conversations.linked_client_id is
  'Main Acapolite clients.id selected by staff as the CRM match for this WhatsApp conversation.';

comment on column public.whatsapp_conversations.linked_client_profile_id is
  'Main Acapolite profiles.id for the linked client, stored for Client 360 and contact matching.';
