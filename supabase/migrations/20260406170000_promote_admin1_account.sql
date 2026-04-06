do $$
declare
  v_user_id uuid;
begin
  select id
  into v_user_id
  from auth.users
  where email = 'admin1@acapolite.com'
  limit 1;

  if v_user_id is null then
    raise notice 'No auth.users row found for admin1@acapolite.com';
    return;
  end if;

  insert into public.profiles (id, email, role)
  values (v_user_id, 'admin1@acapolite.com', 'admin')
  on conflict (id) do update
  set
    email = excluded.email,
    role = 'admin',
    updated_at = now();

  delete from public.clients
  where profile_id = v_user_id;
end
$$;
