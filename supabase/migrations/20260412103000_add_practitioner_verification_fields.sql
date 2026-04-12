alter table public.practitioner_profiles
  add column if not exists id_number text,
  add column if not exists tax_practitioner_number text,
  add column if not exists professional_body text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists id_document_path text,
  add column if not exists certificate_document_path text,
  add column if not exists proof_of_address_path text,
  add column if not exists bank_confirmation_document_path text;

alter table public.invoices
  add column if not exists practitioner_bank_details text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_full_name text;
  v_first_name text;
  v_last_name text;
  v_phone text;
  v_id_number text;
  v_tax_practitioner_number text;
begin
  v_full_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  v_id_number := nullif(trim(coalesce(new.raw_user_meta_data ->> 'id_number', '')), '');
  v_tax_practitioner_number := nullif(trim(coalesce(new.raw_user_meta_data ->> 'tax_practitioner_number', '')), '');

  begin
    v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'client');
  exception
    when others then
      v_role := 'client';
  end;

  insert into public.profiles (id, email, full_name, role, phone, is_active)
  values (
    new.id,
    new.email,
    nullif(v_full_name, ''),
    v_role,
    v_phone,
    case when v_role = 'consultant' then false else true end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = excluded.role,
    phone = coalesce(excluded.phone, public.profiles.phone),
    is_active = case when excluded.role = 'consultant' then false else coalesce(public.profiles.is_active, true) end,
    updated_at = now();

  if v_full_name = '' then
    v_first_name := null;
    v_last_name := null;
  elsif position(' ' in v_full_name) > 0 then
    v_first_name := split_part(v_full_name, ' ', 1);
    v_last_name := nullif(trim(substr(v_full_name, length(split_part(v_full_name, ' ', 1)) + 1)), '');
  else
    v_first_name := v_full_name;
    v_last_name := null;
  end if;

  if v_role = 'client' then
    insert into public.clients (
      profile_id,
      first_name,
      last_name,
      company_name,
      id_number,
      province
    )
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'first_name', ''), v_first_name),
      coalesce(nullif(new.raw_user_meta_data ->> 'last_name', ''), v_last_name),
      nullif(new.raw_user_meta_data ->> 'organization_name', ''),
      v_id_number,
      nullif(new.raw_user_meta_data ->> 'province', '')
    )
    on conflict (profile_id) do update
    set
      first_name = coalesce(excluded.first_name, public.clients.first_name),
      last_name = coalesce(excluded.last_name, public.clients.last_name),
      company_name = coalesce(excluded.company_name, public.clients.company_name),
      id_number = coalesce(excluded.id_number, public.clients.id_number),
      province = coalesce(excluded.province, public.clients.province),
      updated_at = now();
  elsif v_role = 'consultant' then
    insert into public.staff_permissions (
      profile_id,
      assigned_clients_only,
      can_view_overview,
      can_view_clients,
      can_manage_clients,
      can_view_client_workspace,
      can_view_cases,
      can_manage_cases,
      can_view_documents,
      can_review_documents,
      can_view_invoices,
      can_manage_invoices,
      can_view_messages,
      can_reply_messages
    )
    values (
      new.id,
      true,
      true,
      true,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true
    )
    on conflict (profile_id) do nothing;

    insert into public.practitioner_profiles (
      profile_id,
      business_name,
      registration_number,
      years_of_experience,
      id_number,
      tax_practitioner_number,
      professional_body,
      city,
      province,
      verification_status,
      is_verified
    )
    values (
      new.id,
      nullif(new.raw_user_meta_data ->> 'organization_name', ''),
      nullif(new.raw_user_meta_data ->> 'registration_number', ''),
      coalesce((new.raw_user_meta_data ->> 'years_of_experience')::int, 0),
      v_id_number,
      v_tax_practitioner_number,
      nullif(new.raw_user_meta_data ->> 'professional_body', ''),
      nullif(new.raw_user_meta_data ->> 'city', ''),
      nullif(new.raw_user_meta_data ->> 'province', ''),
      'pending',
      false
    )
    on conflict (profile_id) do update
    set
      registration_number = coalesce(excluded.registration_number, public.practitioner_profiles.registration_number),
      years_of_experience = coalesce(excluded.years_of_experience, public.practitioner_profiles.years_of_experience),
      id_number = coalesce(excluded.id_number, public.practitioner_profiles.id_number),
      tax_practitioner_number = coalesce(excluded.tax_practitioner_number, public.practitioner_profiles.tax_practitioner_number),
      professional_body = coalesce(excluded.professional_body, public.practitioner_profiles.professional_body),
      city = coalesce(excluded.city, public.practitioner_profiles.city),
      province = coalesce(excluded.province, public.practitioner_profiles.province),
      verification_status = coalesce(public.practitioner_profiles.verification_status, 'pending'),
      is_verified = false,
      updated_at = now();
  end if;

  return new;
end;
$$;

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
      or new.bank_confirmation_document_path is null
      or new.tax_practitioner_number is null
    then
      raise exception 'All verification documents and tax practitioner number are required before approval.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_practitioner_profiles_require_verification_docs on public.practitioner_profiles;
create trigger trg_practitioner_profiles_require_verification_docs
before update on public.practitioner_profiles
for each row execute function public.ensure_practitioner_verification_documents();
