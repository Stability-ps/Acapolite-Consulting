update public.practitioner_verification_documents
set is_required = false,
    updated_at = now()
where document_type = 'bank_confirmation_letter';

create or replace function public.ensure_practitioner_verification_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status = 'verified' then
    if new.id_document_path is null
      or new.certificate_document_path is null
      or new.proof_of_address_path is null
      or new.tax_practitioner_number is null
    then
      raise exception 'ID Copy, Practitioner Certificate, Proof of Address, and tax practitioner number are required before approval.';
    end if;

    if not public.practitioner_has_all_required_documents_approved(new.profile_id) then
      raise exception 'All required verification documents must be approved by admin before marking practitioner as verified.';
    end if;
  end if;

  return new;
end;
$$;
