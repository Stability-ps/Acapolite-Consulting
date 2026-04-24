create table if not exists public.practitioner_change_requests (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  client_profile_id uuid not null references public.profiles(id) on delete cascade,
  current_practitioner_profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  reason text,
  practitioner_response text,
  practitioner_responded_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  admin_response text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_practitioner_change_requests_pending_unique
  on public.practitioner_change_requests(service_request_id)
  where status = 'pending';

create index if not exists idx_practitioner_change_requests_case_id
  on public.practitioner_change_requests(case_id, created_at desc);

create index if not exists idx_practitioner_change_requests_practitioner
  on public.practitioner_change_requests(current_practitioner_profile_id, created_at desc);

drop trigger if exists trg_practitioner_change_requests_updated_at on public.practitioner_change_requests;
create trigger trg_practitioner_change_requests_updated_at
before update on public.practitioner_change_requests
for each row execute function public.set_updated_at();

alter table public.practitioner_change_requests enable row level security;

drop policy if exists "practitioner_change_requests_select_scoped" on public.practitioner_change_requests;
create policy "practitioner_change_requests_select_scoped"
on public.practitioner_change_requests
for select
using (
  public.get_my_role() = 'admin'
  or client_profile_id = auth.uid()
  or current_practitioner_profile_id = auth.uid()
);

drop policy if exists "practitioner_change_requests_insert_client" on public.practitioner_change_requests;
create policy "practitioner_change_requests_insert_client"
on public.practitioner_change_requests
for insert
with check (
  requested_by = auth.uid()
  and client_profile_id = auth.uid()
);

drop policy if exists "practitioner_change_requests_update_scoped" on public.practitioner_change_requests;
create policy "practitioner_change_requests_update_scoped"
on public.practitioner_change_requests
for update
using (
  public.get_my_role() = 'admin'
  or current_practitioner_profile_id = auth.uid()
)
with check (
  public.get_my_role() = 'admin'
  or current_practitioner_profile_id = auth.uid()
);

create or replace function public.request_practitioner_change(
  p_request_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_case public.cases%rowtype;
  v_deadline timestamptz;
  v_client_profile_id uuid;
  v_change_request_id uuid;
  v_case_link text;
begin
  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if v_request.id is null then
    raise exception 'Service request not found.';
  end if;

  if public.get_my_role() <> 'admin'
    and lower(coalesce(v_request.email, '')) <> lower(coalesce(auth.jwt()->>'email', ''))
  then
    raise exception 'You cannot change this practitioner assignment.';
  end if;

  if v_request.assigned_practitioner_id is null then
    raise exception 'No practitioner is assigned to this request.';
  end if;

  select c.profile_id
  into v_client_profile_id
  from public.clients c
  where c.id = (
    select ca.client_id
    from public.cases ca
    where ca.id = v_request.converted_case_id
    limit 1
  )
  limit 1;

  if v_client_profile_id is null then
    v_client_profile_id := coalesce(auth.uid(), public.find_client_profile_id_by_email(v_request.email));
  end if;

  if v_client_profile_id is null then
    raise exception 'No client profile was found for this practitioner change request.';
  end if;

  if exists (
    select 1
    from public.practitioner_change_requests
    where service_request_id = v_request.id
      and status = 'pending'
  ) then
    raise exception 'A practitioner change request is already pending admin review.';
  end if;

  v_deadline := coalesce(v_request.assigned_at, v_request.updated_at, now()) + interval '24 hours';
  if now() > v_deadline then
    raise exception 'Practitioner changes are only available within 24 hours of assignment.';
  end if;

  if v_request.converted_case_id is not null then
    select *
    into v_case
    from public.cases
    where id = v_request.converted_case_id;

    if v_case.id is not null and v_case.status not in ('new', 'under_review') then
      raise exception 'This case is already in progress and cannot be reassigned online.';
    end if;
  end if;

  insert into public.practitioner_change_requests (
    service_request_id,
    case_id,
    client_profile_id,
    current_practitioner_profile_id,
    requested_by,
    reason
  )
  values (
    v_request.id,
    v_request.converted_case_id,
    v_client_profile_id,
    v_request.assigned_practitioner_id,
    coalesce(auth.uid(), v_client_profile_id),
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_change_request_id;

  v_case_link := case
    when v_request.converted_case_id is not null then '/dashboard/staff/cases?caseId=' || v_request.converted_case_id::text
    else '/dashboard/staff/service-requests?leadId=' || v_request.id::text
  end;

  perform public.create_notifications(
    public.staff_profile_ids(array['admin']::public.app_role[]),
    coalesce(auth.uid(), v_client_profile_id),
    'practitioner_change_requested',
    'cases',
    'Practitioner change request submitted',
    'A client requested a practitioner change and the case requires admin review.',
    v_case_link,
    'case',
    v_request.converted_case_id,
    jsonb_build_object(
      'service_request_id', v_request.id,
      'case_id', v_request.converted_case_id,
      'change_request_id', v_change_request_id
    )
  );

  perform public.create_notification(
    v_request.assigned_practitioner_id,
    coalesce(auth.uid(), v_client_profile_id),
    'practitioner_change_requested',
    'cases',
    'Client requested a practitioner change',
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Please review the case and submit your response for admin review.'),
    case
      when v_request.converted_case_id is not null then '/dashboard/staff/cases?caseId=' || v_request.converted_case_id::text
      else '/dashboard/staff/service-requests?leadId=' || v_request.id::text
    end,
    'case',
    v_request.converted_case_id,
    jsonb_build_object(
      'service_request_id', v_request.id,
      'case_id', v_request.converted_case_id,
      'change_request_id', v_change_request_id
    )
  );

  perform public.create_notification(
    v_client_profile_id,
    coalesce(auth.uid(), v_client_profile_id),
    'practitioner_change_requested',
    'cases',
    'Your change request was submitted',
    'Your request is now with admin for review. Your current practitioner remains assigned until a decision is made.',
    case
      when v_request.converted_case_id is not null then '/dashboard/client/cases?caseId=' || v_request.converted_case_id::text
      else '/dashboard/client/requests?requestId=' || v_request.id::text
    end,
    'case',
    v_request.converted_case_id,
    jsonb_build_object(
      'service_request_id', v_request.id,
      'case_id', v_request.converted_case_id,
      'change_request_id', v_change_request_id
    )
  );

  return true;
end;
$$;

create or replace function public.submit_practitioner_change_response(
  p_change_request_id uuid,
  p_response text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change_request public.practitioner_change_requests%rowtype;
begin
  select *
  into v_change_request
  from public.practitioner_change_requests
  where id = p_change_request_id;

  if v_change_request.id is null then
    raise exception 'Practitioner change request not found.';
  end if;

  if public.get_my_role() <> 'consultant' or v_change_request.current_practitioner_profile_id <> auth.uid() then
    raise exception 'You cannot respond to this practitioner change request.';
  end if;

  if v_change_request.status <> 'pending' then
    raise exception 'This practitioner change request has already been reviewed.';
  end if;

  update public.practitioner_change_requests
  set
    practitioner_response = nullif(trim(coalesce(p_response, '')), ''),
    practitioner_responded_at = now(),
    updated_at = now()
  where id = p_change_request_id;

  perform public.create_notifications(
    public.staff_profile_ids(array['admin']::public.app_role[]),
    auth.uid(),
    'practitioner_change_response_submitted',
    'cases',
    'Practitioner submitted a change response',
    'The current practitioner added a response for admin review.',
    case
      when v_change_request.case_id is not null then '/dashboard/staff/cases?caseId=' || v_change_request.case_id::text
      else '/dashboard/staff/service-requests?leadId=' || v_change_request.service_request_id::text
    end,
    'case',
    v_change_request.case_id,
    jsonb_build_object(
      'service_request_id', v_change_request.service_request_id,
      'case_id', v_change_request.case_id,
      'change_request_id', v_change_request.id
    )
  );

  return true;
end;
$$;

create or replace function public.review_practitioner_change_request(
  p_change_request_id uuid,
  p_decision text,
  p_admin_response text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change_request public.practitioner_change_requests%rowtype;
  v_request public.service_requests%rowtype;
  v_case public.cases%rowtype;
  v_client_profile_id uuid;
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Only admins can review practitioner change requests.';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision.';
  end if;

  select *
  into v_change_request
  from public.practitioner_change_requests
  where id = p_change_request_id
  for update;

  if v_change_request.id is null then
    raise exception 'Practitioner change request not found.';
  end if;

  if v_change_request.status <> 'pending' then
    raise exception 'This practitioner change request has already been reviewed.';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = v_change_request.service_request_id
  for update;

  if v_request.id is null then
    raise exception 'Service request not found.';
  end if;

  select *
  into v_case
  from public.cases
  where id = v_change_request.case_id;

  v_client_profile_id := v_change_request.client_profile_id;

  update public.practitioner_change_requests
  set
    status = p_decision,
    admin_response = nullif(trim(coalesce(p_admin_response, '')), ''),
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = p_change_request_id;

  if p_decision = 'approved' then
    if v_case.id is not null then
      update public.cases
      set
        assigned_consultant_id = null,
        status = 'new',
        updated_at = now()
      where id = v_case.id;
    end if;

    update public.clients
    set
      assigned_consultant_id = null,
      updated_at = now()
    where profile_id = v_client_profile_id
      and assigned_consultant_id = v_request.assigned_practitioner_id;

    update public.service_request_responses
    set
      response_status = case
        when response_status = 'withdrawn' then response_status
        else 'submitted'
      end,
      selected_at = null,
      declined_at = null,
      updated_at = now()
    where service_request_id = v_request.id
      and response_status in ('selected', 'declined');

    update public.service_requests
    set
      selected_response_id = null,
      assigned_practitioner_id = null,
      status = case
        when exists (
          select 1 from public.service_request_responses
          where service_request_id = v_request.id
        ) then 'responded'::public.service_request_status
        else 'new'::public.service_request_status
      end,
      updated_at = now()
    where id = v_request.id;

    insert into public.service_request_assignment_history (
      service_request_id,
      practitioner_profile_id,
      previous_practitioner_id,
      assignment_type,
      note,
      assigned_by
    )
    values (
      v_request.id,
      null,
      v_change_request.current_practitioner_profile_id,
      'reassigned',
      coalesce(nullif(trim(coalesce(p_admin_response, '')), ''), 'Admin approved the practitioner change request.'),
      auth.uid()
    );
  end if;

  perform public.create_notification(
    v_client_profile_id,
    auth.uid(),
    'practitioner_change_' || p_decision,
    'cases',
    case when p_decision = 'approved' then 'Your change request was approved' else 'Your change request was not approved' end,
    case
      when p_decision = 'approved' then 'Admin approved your request. You may now choose another practitioner response.'
      else coalesce(nullif(trim(coalesce(p_admin_response, '')), ''), 'Admin reviewed your request and kept the current practitioner assignment in place.')
    end,
    case
      when v_change_request.case_id is not null then '/dashboard/client/cases?caseId=' || v_change_request.case_id::text
      else '/dashboard/client/requests?requestId=' || v_request.id::text
    end,
    'case',
    v_change_request.case_id,
    jsonb_build_object(
      'service_request_id', v_request.id,
      'case_id', v_change_request.case_id,
      'change_request_id', v_change_request.id,
      'decision', p_decision
    )
  );

  perform public.create_notification(
    v_change_request.current_practitioner_profile_id,
    auth.uid(),
    'practitioner_change_' || p_decision,
    'cases',
    case when p_decision = 'approved' then 'Practitioner change approved by admin' else 'Practitioner change request closed' end,
    coalesce(nullif(trim(coalesce(p_admin_response, '')), ''), 'Admin reviewed the client request and recorded a final decision.'),
    case
      when v_change_request.case_id is not null then '/dashboard/staff/cases?caseId=' || v_change_request.case_id::text
      else '/dashboard/staff/service-requests?leadId=' || v_request.id::text
    end,
    'case',
    v_change_request.case_id,
    jsonb_build_object(
      'service_request_id', v_request.id,
      'case_id', v_change_request.case_id,
      'change_request_id', v_change_request.id,
      'decision', p_decision
    )
  );

  return true;
end;
$$;
