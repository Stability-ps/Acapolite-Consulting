create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_full_name text;
  v_first_name text;
  v_last_name text;
begin
  v_full_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  begin
    v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'client');
  exception
    when others then
      v_role := 'client';
  end;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(v_full_name, ''),
    v_role
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = excluded.role,
    updated_at = now();

  if v_full_name = '' then
    v_first_name := null;
    v_last_name := null;
  elsif position(' ' in v_full_name) > 0 then
    v_first_name := split_part(v_full_name, ' ', 1);
    v_last_name := nullif(trim(substr(v_full_name, length(split_part(v_full_name, ' ', 1)) + 1)), '');
  else
    v_first_name := v_full_name;
    v_last_name := null;
  end if;

  if v_role = 'client' then
    insert into public.clients (
      profile_id,
      first_name,
      last_name,
      company_name
    )
    values (
      new.id,
      v_first_name,
      v_last_name,
      nullif(new.raw_user_meta_data ->> 'organization_name', '')
    )
    on conflict (profile_id) do update
    set
      first_name = coalesce(excluded.first_name, public.clients.first_name),
      last_name = coalesce(excluded.last_name, public.clients.last_name),
      company_name = coalesce(excluded.company_name, public.clients.company_name),
      updated_at = now();
  end if;

  return new;
end;
$$;

insert into public.clients (
  profile_id,
  first_name,
  last_name,
  company_name
)
select
  p.id,
  case
    when p.full_name is null or trim(p.full_name) = '' then null
    when position(' ' in trim(p.full_name)) > 0 then split_part(trim(p.full_name), ' ', 1)
    else trim(p.full_name)
  end as first_name,
  case
    when p.full_name is null or trim(p.full_name) = '' then null
    when position(' ' in trim(p.full_name)) > 0 then nullif(trim(substr(trim(p.full_name), length(split_part(trim(p.full_name), ' ', 1)) + 1)), '')
    else null
  end as last_name,
  null
from public.profiles p
where p.role = 'client'
  and not exists (
    select 1
    from public.clients c
    where c.profile_id = p.id
  );
