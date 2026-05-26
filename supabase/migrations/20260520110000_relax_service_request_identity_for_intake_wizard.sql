-- Intake wizard submits leads before ID / registration numbers are collected.
-- Extend identity rules for trust/NPO client types and allow pending identity fields.

alter table public.service_requests
  drop constraint if exists service_requests_identity_chk;

alter table public.service_requests
  add constraint service_requests_identity_chk check (
    (
      client_type = 'individual'
      and company_name is null
      and company_registration_number is null
      and (
        (identity_document_type is not null and id_number is not null)
        or (identity_document_type is null and id_number is null)
      )
    )
    or
    (
      client_type = 'company'
      and id_number is null
      and identity_document_type is null
      and (
        (company_name is not null and company_registration_number is not null)
        or company_registration_number is null
      )
    )
    or
    (
      client_type in ('trust', 'npo_organisation')
      and id_number is null
      and identity_document_type is null
      and company_registration_number is null
    )
  );
