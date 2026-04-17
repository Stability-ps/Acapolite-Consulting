-- Create enum for document types
create type public.practitioner_document_type as enum (
  'id_copy',
  'tax_registration_certificate',
  'proof_of_address',
  'bank_confirmation_letter',
  'professional_body_membership',
  'company_registration',
  'vat_number_proof',
  'profile_photo',
  'cv_professional_summary',
  'other'
);

-- Create enum for document status
create type public.practitioner_document_status as enum (
  'pending_review',
  'approved',
  'rejected'
);

-- Create table for practitioner verification documents
create table if not exists public.practitioner_verification_documents (
  id uuid primary key default gen_random_uuid(),
  practitioner_profile_id uuid not null references public.practitioner_profiles(profile_id) on delete cascade,
  document_type public.practitioner_document_type not null,
  display_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  status public.practitioner_document_status not null default 'pending_review',
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  rejection_reason text,
  admin_notes text,
  is_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practitioner_verification_documents_file_path_key unique (file_path)
);

-- Create indexes
create index if not exists idx_practitioner_verification_documents_profile_id
  on public.practitioner_verification_documents(practitioner_profile_id);

create index if not exists idx_practitioner_verification_documents_status
  on public.practitioner_verification_documents(status);

create index if not exists idx_practitioner_verification_documents_reviewed_at
  on public.practitioner_verification_documents(reviewed_at desc);

-- Create function to update updated_at timestamp
create or replace function public.set_practitioner_doc_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Create trigger for updated_at
drop trigger if exists trg_practitioner_verification_documents_updated_at on public.practitioner_verification_documents;
create trigger trg_practitioner_verification_documents_updated_at
before update on public.practitioner_verification_documents
for each row execute function public.set_practitioner_doc_updated_at();

-- Add helper function to check if all required documents are approved
create or replace function public.practitioner_has_all_required_documents_approved(practitioner_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending_required_count int;
  v_required_docs_count int;
begin
  -- Count required documents that are NOT approved
  select count(*)
  into v_pending_required_count
  from public.practitioner_verification_documents
  where practitioner_profile_id = practitioner_id
    and is_required = true
    and status != 'approved';

  -- Get total required document count
  select count(*)
  into v_required_docs_count
  from public.practitioner_verification_documents
  where practitioner_profile_id = practitioner_id
    and is_required = true;

  -- Return true if all required documents exist and are approved (no pending required docs)
  return v_required_docs_count > 0 and v_pending_required_count = 0;
end;
$$;

-- Modify the verification status check to include document approval requirement
create or replace function public.ensure_practitioner_verification_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status = 'verified' then
    -- Check all required verification documents
    if new.id_document_path is null
      or new.certificate_document_path is null
      or new.proof_of_address_path is null
      or new.bank_confirmation_document_path is null
      or new.tax_practitioner_number is null
    then
      raise exception 'All verification documents and tax practitioner number are required before approval.';
    end if;

    -- Check if all required verification documents are approved in the new table
    if not public.practitioner_has_all_required_documents_approved(new.profile_id) then
      raise exception 'All required verification documents must be approved by admin before marking practitioner as verified.';
    end if;
  end if;

  return new;
end;
$$;

-- Create a view to summarize document status for each practitioner
create or replace view public.practitioner_document_summary as
select
  practitioner_profile_id,
  count(*) filter (where is_required) as total_required_docs,
  count(*) filter (where is_required and status = 'approved') as approved_required_docs,
  count(*) filter (where is_required and status = 'rejected') as rejected_required_docs,
  count(*) filter (where is_required and status = 'pending_review') as pending_required_docs,
  count(*) filter (where not is_required) as total_optional_docs,
  count(*) filter (where not is_required and status = 'approved') as approved_optional_docs,
  count(*) filter (where status = 'rejected') as total_rejected_docs,
  count(*) filter (where status = 'pending_review') as total_pending_docs,
  max(updated_at) as last_updated
from public.practitioner_verification_documents
group by practitioner_profile_id;

-- Enable RLS on new table
alter table public.practitioner_verification_documents enable row level security;

-- RLS policies for practitioner verification documents
-- Admins and staff can view all documents
create policy "staff_can_view_all_verification_documents"
  on public.practitioner_verification_documents for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'consultant')
    )
  );

-- Practitioners can view their own documents
create policy "practitioners_can_view_own_documents"
  on public.practitioner_verification_documents for select
  using (
    practitioner_profile_id = auth.uid()
  );

-- Only admins/staff can create documents
create policy "staff_can_create_documents"
  on public.practitioner_verification_documents for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Only admins/staff can update documents
create policy "staff_can_update_documents"
  on public.practitioner_verification_documents for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Only admins can delete documents
create policy "admins_can_delete_documents"
  on public.practitioner_verification_documents for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
