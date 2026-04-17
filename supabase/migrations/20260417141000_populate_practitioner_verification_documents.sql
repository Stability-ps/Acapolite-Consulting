-- This migration populates initial practitioner verification documents
-- from the document paths that were previously stored in practitioner_profiles

-- For each practitioner, create document records from the paths in practitioner_profiles
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
  pp.created_at
from public.practitioner_profiles pp
where pp.id_document_path is not null
  and not exists (
    select 1 from public.practitioner_verification_documents pvd
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
  pp.created_at
from public.practitioner_profiles pp
where pp.certificate_document_path is not null
  and not exists (
    select 1 from public.practitioner_verification_documents pvd
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
  pp.created_at
from public.practitioner_profiles pp
where pp.proof_of_address_path is not null
  and not exists (
    select 1 from public.practitioner_verification_documents pvd
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
  pp.created_at
from public.practitioner_profiles pp
where pp.bank_confirmation_document_path is not null
  and not exists (
    select 1 from public.practitioner_verification_documents pvd
    where pvd.practitioner_profile_id = pp.profile_id
      and pvd.document_type = 'bank_confirmation_letter'
  )
on conflict (file_path) do nothing;
