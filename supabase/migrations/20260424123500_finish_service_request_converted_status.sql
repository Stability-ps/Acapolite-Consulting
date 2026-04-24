do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'service_request_status'
      and e.enumlabel = 'converted_to_client'
  ) then
    raise exception 'Run 20260424123000_add_lead_client_case_archiving.sql first so the converted_to_client enum value exists.';
  end if;
end $$;

update public.service_requests
set status = 'converted_to_client'
where converted_case_id is not null
  and status = 'assigned';

create or replace function public.convert_service_request_to_case(
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_client_id uuid;
  v_case_id uuid;
  v_conversation_id uuid;
begin
  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if v_request.id is null then
    raise exception 'Service request not found.';
  end if;

  if v_request.converted_case_id is not null then
    return v_request.converted_case_id;
  end if;

  if public.get_my_role() <> 'admin' and lower(coalesce(auth.jwt()->>'email', '')) <> lower(v_request.email) then
    raise exception 'You cannot convert this service request.';
  end if;

  if v_request.assigned_practitioner_id is null then
    raise exception 'Assign a practitioner before converting this request into a case.';
  end if;

  if auth.uid() is not null then
    select id into v_client_id
    from public.clients
    where profile_id = auth.uid()
    limit 1;
  end if;

  if v_client_id is null then
    select c.id
    into v_client_id
    from public.clients c
    join public.profiles p on p.id = c.profile_id
    where lower(coalesce(p.email, '')) = lower(v_request.email)
    limit 1;
  end if;

  if v_client_id is null then
    raise exception 'No portal client record matches this service request email.';
  end if;

  insert into public.cases (
    client_id,
    assigned_consultant_id,
    case_title,
    case_type,
    status,
    description,
    priority,
    created_by
  )
  values (
    v_client_id,
    v_request.assigned_practitioner_id,
    initcap(replace(v_request.service_needed::text, '_', ' ')) || ' Request',
    public.map_service_request_to_case_type(v_request.service_needed),
    'new',
    v_request.description,
    case v_request.priority_level
      when 'urgent' then 1
      when 'high' then 1
      when 'medium' then 2
      else 3
    end,
    auth.uid()
  )
  returning id into v_case_id;

  insert into public.conversations (
    client_id,
    case_id,
    subject,
    created_by
  )
  values (
    v_client_id,
    v_case_id,
    'Lead Request: ' || initcap(replace(v_request.service_needed::text, '_', ' ')),
    auth.uid()
  )
  returning id into v_conversation_id;

  update public.service_requests
  set
    converted_case_id = v_case_id,
    status = 'converted_to_client',
    assigned_at = coalesce(assigned_at, now()),
    updated_at = now()
  where id = p_request_id;

  return v_case_id;
end;
$$;
