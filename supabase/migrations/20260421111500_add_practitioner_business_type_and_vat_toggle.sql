alter table public.practitioner_profiles
  add column if not exists business_type text not null default 'individual'
    check (business_type in ('individual', 'company')),
  add column if not exists is_vat_registered boolean not null default false;

update public.practitioner_profiles
set business_type = 'company'
where business_type = 'individual'
  and (
    nullif(trim(coalesce(business_name, '')), '') is not null
    or nullif(trim(coalesce(registration_number, '')), '') is not null
  );

update public.practitioner_profiles
set is_vat_registered = true
where nullif(trim(coalesce(vat_number, '')), '') is not null;
