alter table public.whatsapp_conversations
  add column if not exists inbox_status text not null default 'new',
  add column if not exists priority_level text not null default 'normal',
  add column if not exists first_staff_reply_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid;

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_inbox_status_check,
  drop constraint if exists whatsapp_conversations_priority_level_check;

alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_inbox_status_check
    check (inbox_status in ('new', 'unassigned', 'assigned', 'waiting_client', 'resolved')),
  add constraint whatsapp_conversations_priority_level_check
    check (priority_level in ('normal', 'high', 'urgent'));

alter table public.whatsapp_staff_actions
  drop constraint if exists whatsapp_staff_actions_action_check;
alter table public.whatsapp_staff_actions
  add constraint whatsapp_staff_actions_action_check
    check (action in ('assigned', 'reassigned', 'staff_reply', 'returned_to_ai', 'resolved', 'reopened', 'marked_waiting'));

create table if not exists public.whatsapp_conversation_reads (
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  staff_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, staff_id)
);

create table if not exists public.whatsapp_alerts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  alert_type text not null check (alert_type in ('human_handoff', 'unassigned_overdue', 'customer_reply', 'high_priority', 'message_failed')),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text,
  message_id uuid references public.whatsapp_messages(id) on delete cascade,
  assigned_staff_id uuid,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_conversations_inbox_idx
  on public.whatsapp_conversations (inbox_status, priority_level, updated_at desc);
create index if not exists whatsapp_reads_staff_idx
  on public.whatsapp_conversation_reads (staff_id, last_read_at desc);
create index if not exists whatsapp_alerts_open_idx
  on public.whatsapp_alerts (is_resolved, severity, created_at desc);
create unique index if not exists whatsapp_alerts_unique_message_idx
  on public.whatsapp_alerts (alert_type, message_id)
  where message_id is not null;
create unique index if not exists whatsapp_alerts_unique_open_conversation_idx
  on public.whatsapp_alerts (alert_type, conversation_id)
  where message_id is null and is_resolved = false;

alter table public.whatsapp_conversation_reads enable row level security;
alter table public.whatsapp_alerts enable row level security;

create or replace function public.sync_whatsapp_inbox_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'human_handoff' and (old.status is distinct from 'human_handoff' or old.ai_enabled is distinct from false) then
    new.inbox_status := case when new.assigned_staff_id is null then 'new' else 'assigned' end;
    new.resolved_at := null;
    new.resolved_by := null;
  end if;

  if new.status = 'human_handoff' and new.assigned_staff_id is distinct from old.assigned_staff_id and new.inbox_status <> 'waiting_client' then
    new.inbox_status := case when new.assigned_staff_id is null then 'unassigned' else 'assigned' end;
  end if;

  if lower(coalesce(new.intake_payload->>'urgency', '')) like '%urgent%'
     or coalesce(nullif(regexp_replace(coalesce(new.intake_payload->>'sars_debt_amount', ''), '[^0-9.]', '', 'g'), ''), '0')::numeric >= 1000000
     or lower(coalesce(new.intake_payload->>'enforcement_stage', '')) ~ '(levy|attachment|judgment|final demand|bank)' then
    new.priority_level := 'urgent';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_whatsapp_inbox_state on public.whatsapp_conversations;
create trigger trg_sync_whatsapp_inbox_state
before update on public.whatsapp_conversations
for each row execute function public.sync_whatsapp_inbox_state();

create or replace function public.create_whatsapp_conversation_alerts()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'human_handoff' and (old.status is distinct from 'human_handoff' or old.ai_enabled is distinct from false) then
    insert into public.whatsapp_alerts (conversation_id, alert_type, severity, title, body, assigned_staff_id)
    values (new.id, 'human_handoff', 'warning', 'New human handoff', coalesce(new.display_name, new.wa_id) || ' requested human assistance.', new.assigned_staff_id)
    on conflict do nothing;
  end if;

  if new.priority_level in ('high', 'urgent') and old.priority_level is distinct from new.priority_level then
    insert into public.whatsapp_alerts (conversation_id, alert_type, severity, title, body, assigned_staff_id)
    values (new.id, 'high_priority', 'critical', 'High-priority WhatsApp matter', coalesce(new.display_name, new.wa_id) || ' requires urgent review.', new.assigned_staff_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_whatsapp_conversation_alerts on public.whatsapp_conversations;
create trigger trg_whatsapp_conversation_alerts
after update on public.whatsapp_conversations
for each row execute function public.create_whatsapp_conversation_alerts();

create or replace function public.handle_whatsapp_message_operations()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_conversation public.whatsapp_conversations%rowtype;
begin
  select * into v_conversation from public.whatsapp_conversations where id = new.conversation_id;

  if new.direction = 'inbound' and v_conversation.status = 'human_handoff' and v_conversation.ai_enabled = false then
    update public.whatsapp_conversations
    set inbox_status = case when assigned_staff_id is null then 'unassigned' else 'assigned' end,
        updated_at = greatest(updated_at, new.created_at)
    where id = new.conversation_id and inbox_status <> 'resolved';

    insert into public.whatsapp_alerts (conversation_id, alert_type, severity, title, body, message_id, assigned_staff_id)
    values (new.conversation_id, 'customer_reply', 'info', 'Customer replied during human control', coalesce(v_conversation.display_name, v_conversation.wa_id) || ' sent a new WhatsApp message.', new.id, v_conversation.assigned_staff_id)
    on conflict do nothing;
  end if;

  if new.direction = 'outbound' and new.sender_type = 'staff' then
    update public.whatsapp_conversations
    set first_staff_reply_at = coalesce(first_staff_reply_at, new.created_at)
    where id = new.conversation_id;
  end if;

  if new.direction = 'outbound' and new.delivery_status = 'failed' then
    insert into public.whatsapp_alerts (conversation_id, alert_type, severity, title, body, message_id, assigned_staff_id)
    values (new.conversation_id, 'message_failed', 'critical', 'WhatsApp message failed', 'A WhatsApp reply could not be delivered.', new.id, v_conversation.assigned_staff_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_whatsapp_message_operations on public.whatsapp_messages;
create trigger trg_whatsapp_message_operations
after insert on public.whatsapp_messages
for each row execute function public.handle_whatsapp_message_operations();

drop trigger if exists trg_whatsapp_message_delivery_alerts on public.whatsapp_messages;
create trigger trg_whatsapp_message_delivery_alerts
after update of delivery_status on public.whatsapp_messages
for each row
when (new.delivery_status = 'failed' and old.delivery_status is distinct from new.delivery_status)
execute function public.handle_whatsapp_message_operations();

update public.whatsapp_conversations conversation
set inbox_status = case
      when conversation.status <> 'human_handoff' then 'resolved'
      when conversation.assigned_staff_id is null then 'unassigned'
      when conversation.last_staff_reply_at is not null
        and (conversation.last_inbound_at is null or conversation.last_staff_reply_at >= conversation.last_inbound_at) then 'waiting_client'
      else 'assigned'
    end,
    first_staff_reply_at = coalesce(conversation.first_staff_reply_at, (
      select min(message.created_at)
      from public.whatsapp_messages message
      where message.conversation_id = conversation.id
        and message.sender_type = 'staff'
        and message.direction = 'outbound'
    )),
    intake_payload = conversation.intake_payload;

insert into public.whatsapp_alerts (conversation_id, alert_type, severity, title, body, assigned_staff_id)
select conversation.id, 'human_handoff', 'warning', 'New human handoff',
  coalesce(conversation.display_name, conversation.wa_id) || ' is waiting for human assistance.',
  conversation.assigned_staff_id
from public.whatsapp_conversations conversation
where conversation.status = 'human_handoff' and conversation.inbox_status <> 'resolved'
on conflict do nothing;

insert into public.whatsapp_alerts (conversation_id, alert_type, severity, title, body, assigned_staff_id)
select conversation.id, 'high_priority', 'critical', 'High-priority WhatsApp matter',
  coalesce(conversation.display_name, conversation.wa_id) || ' requires urgent review.',
  conversation.assigned_staff_id
from public.whatsapp_conversations conversation
where conversation.priority_level in ('high', 'urgent') and conversation.inbox_status <> 'resolved'
on conflict do nothing;

comment on table public.whatsapp_conversation_reads is 'Per-admin read position for the admin-only WhatsApp inbox.';
comment on table public.whatsapp_alerts is 'Durable operational alerts for the admin-only WhatsApp inbox.';
