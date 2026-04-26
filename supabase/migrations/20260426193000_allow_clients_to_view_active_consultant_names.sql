drop policy if exists "authenticated_users_can_view_active_consultant_profiles" on public.profiles;

create policy "authenticated_users_can_view_active_consultant_profiles"
on public.profiles
for select
using (
  auth.uid() is not null
  and role = 'consultant'
  and is_active = true
);
