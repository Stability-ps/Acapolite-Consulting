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
  elsif v_role = 'consultant' then
    insert into public.staff_permissions (
      profile_id,
      assigned_clients_only,
      can_view_overview,
      can_view_clients,
      can_manage_clients,
      can_view_client_workspace,
      can_view_cases,
      can_manage_cases,
      can_view_documents,
      can_review_documents,
      can_view_invoices,
      can_manage_invoices,
      can_view_messages,
      can_reply_messages
    )
    values (
      new.id,
      true,
      true,
      true,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      true,
      true
    )
    on conflict (profile_id) do nothing;

    insert into public.practitioner_profiles (
      profile_id,
      business_name
    )
    values (
      new.id,
      nullif(new.raw_user_meta_data ->> 'organization_name', '')
    )
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;
