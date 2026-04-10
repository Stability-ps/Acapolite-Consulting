do $$
begin
  if not exists (select 1 from pg_type where typname = 'service_request_identity_document_type') then
    create type public.service_request_identity_document_type as enum (
      'id_number',
      'passport_number'
    );
  end if;
end $$;

alter table public.service_requests
  add column if not exists identity_document_type public.service_request_identity_document_type;

update public.service_requests
set identity_document_type = 'id_number'::public.service_request_identity_document_type
where client_type = 'individual'
  and id_number is not null
  and identity_document_type is null;

alter table public.service_requests
  alter column identity_document_type drop default;

alter table public.service_requests
  drop constraint if exists service_requests_identity_chk;

alter table public.service_requests
  add constraint service_requests_identity_chk check (
    (
      client_type = 'individual'
      and identity_document_type is not null
      and id_number is not null
      and company_registration_number is null
    )
    or
    (
      client_type = 'company'
      and company_registration_number is not null
      and id_number is null
      and identity_document_type is null
    )
  );
