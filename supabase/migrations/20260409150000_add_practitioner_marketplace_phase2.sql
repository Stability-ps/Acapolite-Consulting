do $$
begin
  if not exists (select 1 from pg_type where typname = 'practitioner_availability_status') then
    create type public.practitioner_availability_status as enum (
      'available',
      'limited',
      'not_available'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'service_request_response_status') then
    create type public.service_request_response_status as enum (
      'submitted',
      'selected',
      'declined',
      'withdrawn'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'service_request_assignment_type') then
    create type public.service_request_assignment_type as enum (
      'manual',
      'automatic',
      'client_selected',
      'reassigned'
    );
  end if;
end $$;

create table if not exists public.practitioner_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  business_name text,
  registration_number text,
  services_offered text[] not null default '{}',
  years_of_experience integer not null default 0,
  availability_status public.practitioner_availability_status not null default 'available',
  is_verified boolean not null default false,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practitioner_profiles_years_chk check (years_of_experience >= 0)
);

drop trigger if exists trg_practitioner_profiles_updated_at on public.practitioner_profiles;
create trigger trg_practitioner_profiles_updated_at
before update on public.practitioner_profiles
for each row execute function public.set_updated_at();

create table if not exists public.service_request_responses (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  practitioner_profile_id uuid not null references public.profiles(id) on delete cascade,
  introduction_message text not null,
  service_pitch text,
  response_status public.service_request_response_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  selected_at timestamptz,
  declined_at timestamptz,
  constraint service_request_responses_unique unique (service_request_id, practitioner_profile_id)
);

drop trigger if exists trg_service_request_responses_updated_at on public.service_request_responses;
create trigger trg_service_request_responses_updated_at
before update on public.service_request_responses
for each row execute function public.set_updated_at();

create table if not exists public.service_request_assignment_history (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  practitioner_profile_id uuid references public.profiles(id) on delete set null,
  previous_practitioner_id uuid references public.profiles(id) on delete set null,
  assignment_type public.service_request_assignment_type not null,
  note text,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.service_requests
  add column if not exists assigned_practitioner_id uuid references public.profiles(id) on delete set null,
  add column if not exists selected_response_id uuid,
  add column if not exists converted_case_id uuid references public.cases(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'service_requests'
      and constraint_name = 'service_requests_selected_response_id_fkey'
  ) then
    alter table public.service_requests
      add constraint service_requests_selected_response_id_fkey
      foreign key (selected_response_id) references public.service_request_responses(id) on delete set null;
  end if;
end $$;

create index if not exists idx_practitioner_profiles_availability on public.practitioner_profiles(availability_status);
create index if not exists idx_practitioner_profiles_verified on public.practitioner_profiles(is_verified);
create index if not exists idx_service_request_responses_request_id on public.service_request_responses(service_request_id);
create index if not exists idx_service_request_responses_practitioner_id on public.service_request_responses(practitioner_profile_id);
create index if not exists idx_service_request_assignment_history_request_id on public.service_request_assignment_history(service_request_id);
create index if not exists idx_service_requests_assigned_practitioner_id on public.service_requests(assigned_practitioner_id);

create or replace function public.map_service_request_to_case_type(
  p_service_needed public.service_request_service_needed
)
returns public.case_type
language plpgsql
immutable
as $$
begin
  return case p_service_needed
    when 'tax_return' then 'individual_tax_return'::public.case_type
    when 'company_tax' then 'corporate_tax_return'::public.case_type
    when 'vat_registration' then 'vat_registration'::public.case_type
    when 'sars_debt_assistance' then 'sars_dispute_objection'::public.case_type
    when 'objection_dispute' then 'sars_dispute_objection'::public.case_type
    else 'other'::public.case_type
  end;
end;
$$;

create or replace function public.assign_service_request(
  p_request_id uuid,
  p_practitioner_id uuid,
  p_assignment_type public.service_request_assignment_type default 'manual',
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_practitioner uuid;
  v_request_exists boolean;
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Only admins can assign service requests.';
  end if;

  select exists(select 1 from public.service_requests where id = p_request_id)
  into v_request_exists;

  if not v_request_exists then
    raise exception 'Service request not found.';
  end if;

  select assigned_practitioner_id
  into v_previous_practitioner
  from public.service_requests
  where id = p_request_id;

  update public.service_requests
  set
    assigned_practitioner_id = p_practitioner_id,
    status = 'assigned',
    assigned_at = coalesce(assigned_at, now()),
    updated_at = now()
  where id = p_request_id;

  insert into public.service_request_assignment_history (
    service_request_id,
    practitioner_profile_id,
    previous_practitioner_id,
    assignment_type,
    note,
    assigned_by
  )
  values (
    p_request_id,
    p_practitioner_id,
    v_previous_practitioner,
    case
      when v_previous_practitioner is not null and v_previous_practitioner is distinct from p_practitioner_id
        then 'reassigned'::public.service_request_assignment_type
      else p_assignment_type
    end,
    p_note,
    auth.uid()
  );

  return p_practitioner_id;
end;
$$;

create or replace function public.auto_assign_service_request(
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_needed public.service_request_service_needed;
  v_practitioner_id uuid;
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Only admins can auto-assign service requests.';
  end if;

  select service_needed
  into v_service_needed
  from public.service_requests
  where id = p_request_id;

  if v_service_needed is null then
    raise exception 'Service request not found.';
  end if;

  select pp.profile_id
  into v_practitioner_id
  from public.practitioner_profiles pp
  join public.profiles p on p.id = pp.profile_id
  left join public.cases c
    on c.assigned_consultant_id = pp.profile_id
   and c.status not in ('resolved', 'closed')
  where p.role = 'consultant'
    and p.is_active = true
    and pp.is_verified = true
    and pp.availability_status <> 'not_available'
    and (
      cardinality(pp.services_offered) = 0
      or v_service_needed::text = any(pp.services_offered)
    )
  group by pp.profile_id, pp.availability_status, pp.years_of_experience
  order by
    case pp.availability_status
      when 'available' then 0
      when 'limited' then 1
      else 2
    end,
    count(c.id),
    pp.years_of_experience desc,
    pp.profile_id
  limit 1;

  if v_practitioner_id is null then
    raise exception 'No available verified practitioner matched this request.';
  end if;

  perform public.assign_service_request(
    p_request_id,
    v_practitioner_id,
    'automatic',
    'Automatically assigned based on verified availability and lowest active workload.'
  );

  return v_practitioner_id;
end;
$$;

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
    status = 'assigned',
    assigned_at = coalesce(assigned_at, now()),
    updated_at = now()
  where id = p_request_id;

  return v_case_id;
end;
$$;

create or replace function public.accept_service_request_response(
  p_response_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response public.service_request_responses%rowtype;
  v_case_id uuid;
begin
  select *
  into v_response
  from public.service_request_responses
  where id = p_response_id;

  if v_response.id is null then
    raise exception 'Response not found.';
  end if;

  if not exists (
    select 1
    from public.service_requests sr
    where sr.id = v_response.service_request_id
      and (
        public.get_my_role() = 'admin'
        or lower(sr.email) = lower(coalesce(auth.jwt()->>'email', ''))
      )
  ) then
    raise exception 'You cannot select this response.';
  end if;

  update public.service_request_responses
  set
    response_status = 'selected',
    selected_at = now(),
    updated_at = now()
  where id = p_response_id;

  update public.service_request_responses
  set
    response_status = 'declined',
    declined_at = now(),
    updated_at = now()
  where service_request_id = v_response.service_request_id
    and id <> p_response_id
    and response_status = 'submitted';

  update public.service_requests
  set
    selected_response_id = p_response_id,
    assigned_practitioner_id = v_response.practitioner_profile_id,
    status = 'assigned',
    assigned_at = coalesce(assigned_at, now()),
    updated_at = now()
  where id = v_response.service_request_id;

  insert into public.service_request_assignment_history (
    service_request_id,
    practitioner_profile_id,
    assignment_type,
    note,
    assigned_by
  )
  values (
    v_response.service_request_id,
    v_response.practitioner_profile_id,
    'client_selected',
    'Client selected a practitioner response.',
    auth.uid()
  );

  select public.convert_service_request_to_case(v_response.service_request_id)
  into v_case_id;

  return v_case_id;
end;
$$;

alter table public.practitioner_profiles enable row level security;
alter table public.service_request_responses enable row level security;
alter table public.service_request_assignment_history enable row level security;

drop policy if exists "practitioner_profiles_select_authenticated_or_staff" on public.practitioner_profiles;
create policy "practitioner_profiles_select_authenticated_or_staff"
on public.practitioner_profiles
for select
using (
  public.is_admin_or_consultant()
  or auth.uid() = profile_id
  or (auth.uid() is not null and is_verified = true)
);

drop policy if exists "practitioner_profiles_insert_admin_or_own" on public.practitioner_profiles;
create policy "practitioner_profiles_insert_admin_or_own"
on public.practitioner_profiles
for insert
with check (
  public.get_my_role() = 'admin'
  or auth.uid() = profile_id
);

drop policy if exists "practitioner_profiles_update_admin_or_own" on public.practitioner_profiles;
create policy "practitioner_profiles_update_admin_or_own"
on public.practitioner_profiles
for update
using (
  public.get_my_role() = 'admin'
  or auth.uid() = profile_id
)
with check (
  public.get_my_role() = 'admin'
  or auth.uid() = profile_id
);

drop policy if exists "service_requests_client_select" on public.service_requests;
create policy "service_requests_client_select"
on public.service_requests
for select
using (
  lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
);

drop policy if exists "service_request_responses_staff_select" on public.service_request_responses;
create policy "service_request_responses_staff_select"
on public.service_request_responses
for select
using (
  public.is_admin_or_consultant()
  or exists (
    select 1
    from public.service_requests sr
    where sr.id = service_request_responses.service_request_id
      and lower(sr.email) = lower(coalesce(auth.jwt()->>'email', ''))
  )
);

drop policy if exists "service_request_responses_consultant_insert" on public.service_request_responses;
create policy "service_request_responses_consultant_insert"
on public.service_request_responses
for insert
with check (
  auth.uid() = practitioner_profile_id
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'consultant'
  )
);

drop policy if exists "service_request_responses_admin_or_own_update" on public.service_request_responses;
create policy "service_request_responses_admin_or_own_update"
on public.service_request_responses
for update
using (
  public.get_my_role() = 'admin'
  or auth.uid() = practitioner_profile_id
)
with check (
  public.get_my_role() = 'admin'
  or auth.uid() = practitioner_profile_id
);

drop policy if exists "service_request_assignment_history_select" on public.service_request_assignment_history;
create policy "service_request_assignment_history_select"
on public.service_request_assignment_history
for select
using (
  public.is_admin_or_consultant()
  or exists (
    select 1
    from public.service_requests sr
    where sr.id = service_request_assignment_history.service_request_id
      and lower(sr.email) = lower(coalesce(auth.jwt()->>'email', ''))
  )
);

drop policy if exists "service_request_assignment_history_insert_admin_only" on public.service_request_assignment_history;
create policy "service_request_assignment_history_insert_admin_only"
on public.service_request_assignment_history
for insert
with check (
  public.get_my_role() = 'admin'
);
