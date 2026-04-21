alter table public.documents
  alter column client_id drop not null,
  add column if not exists visibility text not null default 'shared'
    check (visibility in ('client', 'case', 'practitioner', 'admin', 'private', 'shared')),
  add column if not exists recipient_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists sender_profile_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_documents_recipient_profile_id
  on public.documents(recipient_profile_id);

create index if not exists idx_documents_visibility
  on public.documents(visibility);

update public.documents d
set sender_profile_id = coalesce(d.sender_profile_id, d.uploaded_by)
where d.sender_profile_id is null;

update public.documents d
set visibility = case
  when p.role = 'admin' and d.case_id is not null then 'case'
  when p.role = 'admin' then 'client'
  when p.role = 'consultant' then 'shared'
  else 'shared'
end
from public.profiles p
where p.id = d.uploaded_by
  and d.visibility = 'shared';

create or replace function public.can_access_document(
  p_client_id uuid,
  p_case_id uuid,
  p_uploaded_by uuid,
  p_recipient_profile_id uuid,
  p_visibility text
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    auth.uid() is not null
    and (
      public.get_my_role() = 'admin'
      or p_uploaded_by = auth.uid()
      or p_recipient_profile_id = auth.uid()
      or exists (
        select 1
        from public.clients c
        where c.id = p_client_id
          and c.profile_id = auth.uid()
          and coalesce(p_visibility, 'shared') in ('client', 'case', 'shared')
      )
      or exists (
        select 1
        from public.cases ca
        where ca.id = p_case_id
          and ca.assigned_consultant_id = auth.uid()
          and coalesce(p_visibility, 'shared') in ('case', 'practitioner', 'shared')
      )
      or exists (
        select 1
        from public.clients c
        where c.id = p_client_id
          and c.assigned_consultant_id = auth.uid()
          and coalesce(p_visibility, 'shared') in ('practitioner', 'shared')
      )
    )
$$;

create or replace function public.can_access_document_file(
  p_file_path text
)
returns boolean
language sql
security definer
set search_path = public, storage
stable
as $$
  select
    auth.uid() is not null
    and (
      public.get_my_role() = 'admin'
      or exists (
        select 1
        from public.documents d
        where d.file_path = p_file_path
          and public.can_access_document(
            d.client_id,
            d.case_id,
            d.uploaded_by,
            d.recipient_profile_id,
            d.visibility
          )
      )
      or exists (
        select 1
        from public.practitioner_verification_documents pvd
        where pvd.file_path = p_file_path
          and (
            pvd.practitioner_profile_id = auth.uid()
            or public.get_my_role() = 'admin'
          )
      )
    )
$$;

drop policy if exists "Clients can view own documents" on public.documents;
drop policy if exists "Clients can upload own documents" on public.documents;
drop policy if exists "Admins can view all documents" on public.documents;
drop policy if exists "Admins can manage all documents" on public.documents;
drop policy if exists "documents_select_scoped" on public.documents;
create policy "documents_select_scoped"
on public.documents
for select
using (
  public.can_access_document(
    client_id,
    case_id,
    uploaded_by,
    recipient_profile_id,
    visibility
  )
);

drop policy if exists "documents_insert_scoped" on public.documents;
create policy "documents_insert_scoped"
on public.documents
for insert
with check (
  auth.uid() = uploaded_by
  and (
    public.get_my_role() = 'admin'
    or exists (
      select 1
      from public.clients c
      where c.id = client_id
        and c.profile_id = auth.uid()
        and coalesce(visibility, 'shared') in ('client', 'case', 'shared')
    )
    or exists (
      select 1
      from public.cases ca
      where ca.id = case_id
        and ca.assigned_consultant_id = auth.uid()
        and coalesce(visibility, 'shared') in ('case', 'shared')
    )
    or exists (
      select 1
      from public.clients c
      where c.id = client_id
        and c.assigned_consultant_id = auth.uid()
        and coalesce(visibility, 'shared') in ('practitioner', 'shared')
    )
  )
);

drop policy if exists "documents_update_scoped" on public.documents;
create policy "documents_update_scoped"
on public.documents
for update
using (
  public.get_my_role() = 'admin'
  or uploaded_by = auth.uid()
)
with check (
  public.get_my_role() = 'admin'
  or uploaded_by = auth.uid()
);

drop policy if exists "documents_delete_scoped" on public.documents;
create policy "documents_delete_scoped"
on public.documents
for delete
using (
  public.get_my_role() = 'admin'
  or uploaded_by = auth.uid()
);

drop policy if exists "staff_can_view_all_verification_documents" on public.practitioner_verification_documents;
drop policy if exists "admin_can_view_all_verification_documents" on public.practitioner_verification_documents;
create policy "admin_can_view_all_verification_documents"
  on public.practitioner_verification_documents for select
  using (public.get_my_role() = 'admin');

drop policy if exists "documents_bucket_select_own_or_staff" on storage.objects;
drop policy if exists "documents_bucket_select_service_requests_staff" on storage.objects;
drop policy if exists "documents_bucket_select_scoped" on storage.objects;
create policy "documents_bucket_select_scoped"
on storage.objects
for select
using (
  bucket_id = 'documents'
  and (
    public.get_my_role() = 'admin'
    or owner = auth.uid()
    or (storage.foldername(name))[1] = auth.uid()::text
    or public.can_access_document_file(name)
  )
);

drop policy if exists "documents_bucket_update_own_or_staff" on storage.objects;
drop policy if exists "documents_bucket_update_scoped" on storage.objects;
create policy "documents_bucket_update_scoped"
on storage.objects
for update
using (
  bucket_id = 'documents'
  and (
    public.get_my_role() = 'admin'
    or owner = auth.uid()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
)
with check (
  bucket_id = 'documents'
  and (
    public.get_my_role() = 'admin'
    or owner = auth.uid()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "documents_bucket_delete_own_or_staff" on storage.objects;
drop policy if exists "documents_bucket_delete_scoped" on storage.objects;
create policy "documents_bucket_delete_scoped"
on storage.objects
for delete
using (
  bucket_id = 'documents'
  and (
    public.get_my_role() = 'admin'
    or owner = auth.uid()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);
