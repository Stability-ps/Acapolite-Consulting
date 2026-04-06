insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "documents_bucket_select_own_or_staff" on storage.objects;
create policy "documents_bucket_select_own_or_staff"
on storage.objects
for select
using (
  bucket_id = 'documents'
  and (
    public.is_admin_or_consultant()
    or (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.profile_id = auth.uid()
    )
  )
);

drop policy if exists "documents_bucket_insert_own_or_staff" on storage.objects;
create policy "documents_bucket_insert_own_or_staff"
on storage.objects
for insert
with check (
  bucket_id = 'documents'
  and (
    public.is_admin_or_consultant()
    or (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.profile_id = auth.uid()
    )
  )
);

drop policy if exists "documents_bucket_update_own_or_staff" on storage.objects;
create policy "documents_bucket_update_own_or_staff"
on storage.objects
for update
using (
  bucket_id = 'documents'
  and (
    public.is_admin_or_consultant()
    or owner = auth.uid()
    or (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.profile_id = auth.uid()
    )
  )
)
with check (
  bucket_id = 'documents'
  and (
    public.is_admin_or_consultant()
    or owner = auth.uid()
    or (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.profile_id = auth.uid()
    )
  )
);

drop policy if exists "documents_bucket_delete_own_or_staff" on storage.objects;
create policy "documents_bucket_delete_own_or_staff"
on storage.objects
for delete
using (
  bucket_id = 'documents'
  and (
    public.is_admin_or_consultant()
    or owner = auth.uid()
    or (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.profile_id = auth.uid()
    )
  )
);
