alter table public.service_requests enable row level security;

drop policy if exists "service_requests_admin_delete" on public.service_requests;
create policy "service_requests_admin_delete"
on public.service_requests
for delete
using (public.get_my_role() = 'admin');
