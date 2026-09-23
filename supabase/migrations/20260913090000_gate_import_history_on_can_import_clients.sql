-- The original SELECT policies on client_import_batches/client_import_batch_rows
-- (added alongside the tables themselves) only checked is_admin_or_consultant(),
-- i.e. staff role + active. That lets ANY active consultant read the entire
-- import history regardless of their staff_permissions.can_import_clients flag
-- - the same permission that already gates the Import Clients button in the UI.
--
-- Import history is closely tied to the import feature itself (it shows who
-- imported what, and downloadable reports of the resulting client data), so
-- it should be gated the same way: admins always see it; consultants only see
-- it if can_import_clients is true for them.

create or replace function public.can_view_client_import_history()
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role = 'admin'
        or (
          p.role = 'consultant'
          and exists (
            select 1
            from public.staff_permissions sp
            where sp.profile_id = p.id
              and sp.can_import_clients = true
          )
        )
      )
  );
$$;

drop policy if exists client_import_batches_select_staff on public.client_import_batches;
create policy client_import_batches_select_staff
  on public.client_import_batches
  for select
  using (public.can_view_client_import_history());

drop policy if exists client_import_batch_rows_select_staff on public.client_import_batch_rows;
create policy client_import_batch_rows_select_staff
  on public.client_import_batch_rows
  for select
  using (public.can_view_client_import_history());
