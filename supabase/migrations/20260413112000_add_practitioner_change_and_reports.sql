create table if not exists public.practitioner_reports (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid references public.service_requests(id) on delete set null,
  practitioner_profile_id uuid references public.profiles(id) on delete set null,
  client_profile_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_practitioner_reports_created_at
  on public.practitioner_reports(created_at desc);

create index if not exists idx_practitioner_reports_practitioner
  on public.practitioner_reports(practitioner_profile_id);

drop trigger if exists trg_practitioner_reports_updated_at on public.practitioner_reports;
create trigger trg_practitioner_reports_updated_at
before update on public.practitioner_reports
for each row execute function public.set_updated_at();

alter table public.practitioner_reports enable row level security;

drop policy if exists "practitioner_reports_select_staff" on public.practitioner_reports;
create policy "practitioner_reports_select_staff"
on public.practitioner_reports
for select
using (public.is_admin_or_consultant());

drop policy if exists "practitioner_reports_insert_client" on public.practitioner_reports;
create policy "practitioner_reports_insert_client"
on public.practitioner_reports
for insert
with check (auth.uid() = client_profile_id);

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

    update public.cases
    set
      assigned_consultant_id = null,
      status = 'new',
      updated_at = now()
    where id = v_request.converted_case_id;
  end if;

  update public.clients
  set
    assigned_consultant_id = null,
    updated_at = now()
  where profile_id = auth.uid()
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
    v_request.assigned_practitioner_id,
    'reassigned',
    coalesce(p_reason, 'Client requested a practitioner change.'),
    auth.uid()
  );

  return true;
end;
$$;
