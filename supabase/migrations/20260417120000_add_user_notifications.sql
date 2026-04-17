create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  category text not null,
  section text not null default 'general'
    check (section in ('general', 'messages', 'requests', 'cases', 'documents')),
  title text not null,
  body text,
  link text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_created_at
  on public.notifications(recipient_profile_id, created_at desc);

create index if not exists idx_notifications_recipient_unread
  on public.notifications(recipient_profile_id, is_read, created_at desc);

create index if not exists idx_notifications_section
  on public.notifications(section, created_at desc);

drop trigger if exists trg_notifications_updated_at on public.notifications;
create trigger trg_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
using (auth.uid() = recipient_profile_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
using (auth.uid() = recipient_profile_id)
with check (auth.uid() = recipient_profile_id);

create or replace function public.find_client_profile_id_by_email(
  p_email text
)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select c.profile_id
  from public.clients c
  join public.profiles p on p.id = c.profile_id
  where lower(coalesce(p.email, '')) = lower(coalesce(p_email, ''))
  limit 1
$$;

create or replace function public.create_notification(
  p_recipient_profile_id uuid,
  p_actor_profile_id uuid,
  p_category text,
  p_section text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
begin
  if p_recipient_profile_id is null then
    return null;
  end if;

  if p_actor_profile_id is not null and p_recipient_profile_id = p_actor_profile_id then
    return null;
  end if;

  insert into public.notifications (
    recipient_profile_id,
    actor_profile_id,
    category,
    section,
    title,
    body,
    link,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_recipient_profile_id,
    p_actor_profile_id,
    p_category,
    p_section,
    p_title,
    p_body,
    p_link,
    p_entity_type,
    p_entity_id,
    p_metadata
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

create or replace function public.create_notifications(
  p_recipient_profile_ids uuid[],
  p_actor_profile_id uuid,
  p_category text,
  p_section text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_id uuid;
  v_created_count integer := 0;
begin
  for v_recipient_id in
    select distinct recipient_id
    from unnest(coalesce(p_recipient_profile_ids, '{}'::uuid[])) as recipient_id
    where recipient_id is not null
  loop
    perform public.create_notification(
      v_recipient_id,
      p_actor_profile_id,
      p_category,
      p_section,
      p_title,
      p_body,
      p_link,
      p_entity_type,
      p_entity_id,
      p_metadata
    );
    v_created_count := v_created_count + 1;
  end loop;

  return v_created_count;
end;
$$;

create or replace function public.staff_profile_ids(
  p_roles public.app_role[] default array['admin', 'consultant']::public.app_role[]
)
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from public.profiles
  where role = any(p_roles)
    and is_active = true
$$;

create or replace function public.handle_message_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations%rowtype;
  v_client_profile_id uuid;
  v_staff_recipient_ids uuid[];
begin
  select *
  into v_conversation
  from public.conversations
  where id = new.conversation_id;

  if v_conversation.id is null then
    return new;
  end if;

  if v_conversation.client_id is not null then
    select profile_id
    into v_client_profile_id
    from public.clients
    where id = v_conversation.client_id;
  end if;

  if new.sender_type = 'client' then
    v_staff_recipient_ids := public.staff_profile_ids();

    if v_conversation.practitioner_profile_id is not null then
      v_staff_recipient_ids := array_append(v_staff_recipient_ids, v_conversation.practitioner_profile_id);
    end if;

    perform public.create_notifications(
      v_staff_recipient_ids,
      new.sender_profile_id,
      'new_message',
      'messages',
      'New client message',
      left(new.message_text, 160),
      '/dashboard/staff/messages?conversationId=' || new.conversation_id::text,
      'conversation',
      new.conversation_id,
      jsonb_build_object(
        'sender_type', new.sender_type,
        'conversation_id', new.conversation_id
      )
    );
  else
    perform public.create_notification(
      v_client_profile_id,
      new.sender_profile_id,
      'new_message',
      'messages',
      'New portal message',
      left(new.message_text, 160),
      '/dashboard/client/messages',
      'conversation',
      new.conversation_id,
      jsonb_build_object(
        'sender_type', new.sender_type,
        'conversation_id', new.conversation_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_messages_notifications on public.messages;
create trigger trg_messages_notifications
after insert on public.messages
for each row execute function public.handle_message_notifications();

create or replace function public.handle_service_request_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_profile_id uuid;
begin
  if tg_op = 'INSERT' then
    perform public.create_notifications(
      public.staff_profile_ids(),
      auth.uid(),
      'new_service_request',
      'requests',
      'New service request',
      coalesce(new.full_name, 'Client') || ' submitted a new request.',
      '/dashboard/staff/service-requests?leadId=' || new.id::text,
      'service_request',
      new.id,
      jsonb_build_object(
        'priority_level', new.priority_level,
        'service_needed', new.service_needed,
        'province', new.province
      )
    );

    return new;
  end if;

  if new.selected_response_id is distinct from old.selected_response_id
    or new.assigned_practitioner_id is distinct from old.assigned_practitioner_id
  then
    v_client_profile_id := public.find_client_profile_id_by_email(new.email);

    perform public.create_notification(
      v_client_profile_id,
      auth.uid(),
      'practitioner_assignment',
      'requests',
      'Practitioner assignment updated',
      'Your service request has an updated practitioner assignment.',
      '/dashboard/client/requests',
      'service_request',
      new.id,
      jsonb_build_object(
        'assigned_practitioner_id', new.assigned_practitioner_id
      )
    );

    perform public.create_notification(
      new.assigned_practitioner_id,
      auth.uid(),
      'practitioner_assignment',
      'requests',
      'You were assigned to a service request',
      coalesce(new.full_name, 'Client') || ' is now assigned to you.',
      '/dashboard/staff/service-requests?leadId=' || new.id::text,
      'service_request',
      new.id,
      jsonb_build_object(
        'service_request_id', new.id
      )
    );
  end if;

  if new.status is distinct from old.status then
    v_client_profile_id := public.find_client_profile_id_by_email(new.email);

    perform public.create_notification(
      v_client_profile_id,
      auth.uid(),
      'request_status_changed',
      'requests',
      'Service request updated',
      'Your service request status changed to ' || replace(new.status::text, '_', ' ') || '.',
      '/dashboard/client/requests',
      'service_request',
      new.id,
      jsonb_build_object(
        'previous_status', old.status,
        'new_status', new.status
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_service_requests_notifications on public.service_requests;
create trigger trg_service_requests_notifications
after insert or update on public.service_requests
for each row execute function public.handle_service_request_notifications();

create or replace function public.handle_service_request_response_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_client_profile_id uuid;
begin
  select *
  into v_request
  from public.service_requests
  where id = new.service_request_id;

  if v_request.id is null then
    return new;
  end if;

  v_client_profile_id := public.find_client_profile_id_by_email(v_request.email);

  perform public.create_notifications(
    public.staff_profile_ids(array['admin']::public.app_role[]),
    new.practitioner_profile_id,
    'new_practitioner_response',
    'requests',
    'New practitioner response',
    'A practitioner responded to a service request.',
    '/dashboard/staff/service-requests?leadId=' || new.service_request_id::text,
    'service_request',
    new.service_request_id,
    jsonb_build_object(
      'response_status', new.response_status
    )
  );

  perform public.create_notification(
    v_client_profile_id,
    new.practitioner_profile_id,
    'new_practitioner_response',
    'requests',
    'New practitioner response',
    'A practitioner responded to your service request.',
    '/dashboard/client/requests',
    'service_request',
    new.service_request_id,
    jsonb_build_object(
      'response_status', new.response_status
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_service_request_responses_notifications on public.service_request_responses;
create trigger trg_service_request_responses_notifications
after insert on public.service_request_responses
for each row execute function public.handle_service_request_response_notifications();

create or replace function public.handle_service_request_document_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_notifications(
    public.staff_profile_ids(),
    auth.uid(),
    'service_request_document_uploaded',
    'documents',
    'New request document uploaded',
    coalesce(new.title, new.file_name, 'A document') || ' was uploaded to a service request.',
    '/dashboard/staff/service-requests?leadId=' || new.service_request_id::text,
    'service_request',
    new.service_request_id,
    jsonb_build_object(
      'document_id', new.id
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_service_request_documents_notifications on public.service_request_documents;
create trigger trg_service_request_documents_notifications
after insert on public.service_request_documents
for each row execute function public.handle_service_request_document_notifications();

create or replace function public.handle_case_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_profile_id uuid;
begin
  select profile_id
  into v_client_profile_id
  from public.clients
  where id = new.client_id;

  if tg_op = 'INSERT' then
    perform public.create_notification(
      v_client_profile_id,
      auth.uid(),
      'case_created',
      'cases',
      'New case created',
      coalesce(new.case_title, 'A new case') || ' is now available in your portal.',
      '/dashboard/client/cases',
      'case',
      new.id,
      jsonb_build_object(
        'case_status', new.status
      )
    );

    perform public.create_notification(
      new.assigned_consultant_id,
      auth.uid(),
      'case_created',
      'cases',
      'New case assignment',
      coalesce(new.case_title, 'A new case') || ' has been assigned to you.',
      '/dashboard/staff/cases',
      'case',
      new.id,
      jsonb_build_object(
        'case_status', new.status
      )
    );

    return new;
  end if;

  if new.status is distinct from old.status then
    perform public.create_notification(
      v_client_profile_id,
      auth.uid(),
      'case_status_changed',
      'cases',
      'Case status updated',
      coalesce(new.case_title, 'Your case') || ' moved to ' || replace(new.status::text, '_', ' ') || '.',
      '/dashboard/client/cases',
      'case',
      new.id,
      jsonb_build_object(
        'previous_status', old.status,
        'new_status', new.status
      )
    );
  end if;

  if new.assigned_consultant_id is distinct from old.assigned_consultant_id then
    perform public.create_notification(
      new.assigned_consultant_id,
      auth.uid(),
      'case_assignment_changed',
      'cases',
      'Case assignment updated',
      coalesce(new.case_title, 'A case') || ' has been assigned to you.',
      '/dashboard/staff/cases',
      'case',
      new.id,
      jsonb_build_object(
        'assigned_consultant_id', new.assigned_consultant_id
      )
    );

    perform public.create_notification(
      v_client_profile_id,
      auth.uid(),
      'case_assignment_changed',
      'cases',
      'Assigned practitioner updated',
      'Your case practitioner assignment was updated by the admin team.',
      '/dashboard/client/cases',
      'case',
      new.id,
      jsonb_build_object(
        'assigned_consultant_id', new.assigned_consultant_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cases_notifications on public.cases;
create trigger trg_cases_notifications
after insert or update on public.cases
for each row execute function public.handle_case_notifications();

create or replace function public.handle_document_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
  v_actor_role public.app_role;
  v_recipient_ids uuid[];
begin
  select *
  into v_client
  from public.clients
  where id = new.client_id;

  if new.uploaded_by is not null then
    select role
    into v_actor_role
    from public.profiles
    where id = new.uploaded_by;
  end if;

  if tg_op = 'INSERT' then
    if v_actor_role = 'client' then
      v_recipient_ids := public.staff_profile_ids();

      if v_client.assigned_consultant_id is not null then
        v_recipient_ids := array_append(v_recipient_ids, v_client.assigned_consultant_id);
      end if;

      perform public.create_notifications(
        v_recipient_ids,
        new.uploaded_by,
        'document_uploaded',
        'documents',
        'New client document uploaded',
        coalesce(new.title, new.file_name, 'A document') || ' was uploaded by a client.',
        '/dashboard/staff/documents',
        'document',
        new.id,
        jsonb_build_object(
          'client_id', new.client_id,
          'case_id', new.case_id
        )
      );
    else
      perform public.create_notification(
        v_client.profile_id,
        new.uploaded_by,
        'document_uploaded',
        'documents',
        'New document available',
        coalesce(new.title, new.file_name, 'A document') || ' was uploaded to your portal.',
        '/dashboard/client/documents',
        'document',
        new.id,
        jsonb_build_object(
          'client_id', new.client_id,
          'case_id', new.case_id
        )
      );
    end if;

    return new;
  end if;

  if new.status is distinct from old.status then
    perform public.create_notification(
      v_client.profile_id,
      auth.uid(),
      'document_status_changed',
      'documents',
      'Document status updated',
      coalesce(new.title, new.file_name, 'A document') || ' is now ' || replace(new.status::text, '_', ' ') || '.',
      '/dashboard/client/documents',
      'document',
      new.id,
      jsonb_build_object(
        'previous_status', old.status,
        'new_status', new.status
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_documents_notifications on public.documents;
create trigger trg_documents_notifications
after insert or update on public.documents
for each row execute function public.handle_document_notifications();
