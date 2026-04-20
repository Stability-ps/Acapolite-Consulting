drop policy if exists "staff_can_create_documents" on public.practitioner_verification_documents;
create policy "staff_can_create_documents"
  on public.practitioner_verification_documents for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "practitioners_can_insert_own_documents" on public.practitioner_verification_documents;
create policy "practitioners_can_insert_own_documents"
  on public.practitioner_verification_documents for insert
  with check (
    practitioner_profile_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'consultant'
    )
    and status = 'pending_review'
    and reviewed_at is null
    and reviewed_by is null
  );

drop policy if exists "practitioners_can_update_own_pending_documents" on public.practitioner_verification_documents;
create policy "practitioners_can_update_own_pending_documents"
  on public.practitioner_verification_documents for update
  using (
    practitioner_profile_id = auth.uid()
    and status in ('pending_review', 'rejected')
  )
  with check (
    practitioner_profile_id = auth.uid()
    and status in ('pending_review', 'rejected')
    and reviewed_by is null
  );

insert into public.practitioner_verification_documents (
  practitioner_profile_id,
  document_type,
  display_name,
  file_path,
  status,
  is_required,
  uploaded_at
)
select
  pp.profile_id,
  'id_copy'::public.practitioner_document_type,
  'ID Copy',
  pp.id_document_path,
  case
    when pp.verification_status = 'verified' then 'approved'::public.practitioner_document_status
    when pp.verification_status = 'rejected' then 'rejected'::public.practitioner_document_status
    else 'pending_review'::public.practitioner_document_status
  end,
  true,
  coalesce(pp.verification_submitted_at, pp.updated_at, pp.created_at, now())
from public.practitioner_profiles pp
where pp.id_document_path is not null
  and not exists (
    select 1
    from public.practitioner_verification_documents pvd
    where pvd.practitioner_profile_id = pp.profile_id
      and pvd.document_type = 'id_copy'
  )
on conflict (file_path) do nothing;

insert into public.practitioner_verification_documents (
  practitioner_profile_id,
  document_type,
  display_name,
  file_path,
  status,
  is_required,
  uploaded_at
)
select
  pp.profile_id,
  'tax_registration_certificate'::public.practitioner_document_type,
  'Tax Practitioner Registration Certificate',
  pp.certificate_document_path,
  case
    when pp.verification_status = 'verified' then 'approved'::public.practitioner_document_status
    when pp.verification_status = 'rejected' then 'rejected'::public.practitioner_document_status
    else 'pending_review'::public.practitioner_document_status
  end,
  true,
  coalesce(pp.verification_submitted_at, pp.updated_at, pp.created_at, now())
from public.practitioner_profiles pp
where pp.certificate_document_path is not null
  and not exists (
    select 1
    from public.practitioner_verification_documents pvd
    where pvd.practitioner_profile_id = pp.profile_id
      and pvd.document_type = 'tax_registration_certificate'
  )
on conflict (file_path) do nothing;

insert into public.practitioner_verification_documents (
  practitioner_profile_id,
  document_type,
  display_name,
  file_path,
  status,
  is_required,
  uploaded_at
)
select
  pp.profile_id,
  'proof_of_address'::public.practitioner_document_type,
  'Proof of Address',
  pp.proof_of_address_path,
  case
    when pp.verification_status = 'verified' then 'approved'::public.practitioner_document_status
    when pp.verification_status = 'rejected' then 'rejected'::public.practitioner_document_status
    else 'pending_review'::public.practitioner_document_status
  end,
  true,
  coalesce(pp.verification_submitted_at, pp.updated_at, pp.created_at, now())
from public.practitioner_profiles pp
where pp.proof_of_address_path is not null
  and not exists (
    select 1
    from public.practitioner_verification_documents pvd
    where pvd.practitioner_profile_id = pp.profile_id
      and pvd.document_type = 'proof_of_address'
  )
on conflict (file_path) do nothing;

insert into public.practitioner_verification_documents (
  practitioner_profile_id,
  document_type,
  display_name,
  file_path,
  status,
  is_required,
  uploaded_at
)
select
  pp.profile_id,
  'bank_confirmation_letter'::public.practitioner_document_type,
  'Bank Confirmation Letter',
  pp.bank_confirmation_document_path,
  case
    when pp.verification_status = 'verified' then 'approved'::public.practitioner_document_status
    when pp.verification_status = 'rejected' then 'rejected'::public.practitioner_document_status
    else 'pending_review'::public.practitioner_document_status
  end,
  true,
  coalesce(pp.verification_submitted_at, pp.updated_at, pp.created_at, now())
from public.practitioner_profiles pp
where pp.bank_confirmation_document_path is not null
  and not exists (
    select 1
    from public.practitioner_verification_documents pvd
    where pvd.practitioner_profile_id = pp.profile_id
      and pvd.document_type = 'bank_confirmation_letter'
  )
on conflict (file_path) do nothing;
