alter table public.practitioner_profiles
  add column if not exists banking_verification_status text not null default 'pending'
    check (banking_verification_status in ('pending', 'verified', 'rejected')),
  add column if not exists banking_verified_at timestamptz,
  add column if not exists banking_verified_by uuid references public.profiles(id) on delete set null;

create or replace function public.handle_practitioner_banking_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bank_fields_changed boolean;
begin
  v_bank_fields_changed :=
    new.bank_account_holder_name is distinct from old.bank_account_holder_name
    or new.bank_name is distinct from old.bank_name
    or new.bank_branch_name is distinct from old.bank_branch_name
    or new.bank_branch_code is distinct from old.bank_branch_code
    or new.bank_account_number is distinct from old.bank_account_number
    or new.bank_account_type is distinct from old.bank_account_type
    or new.vat_number is distinct from old.vat_number;

  if new.banking_verification_status = 'verified' then
    if new.bank_account_holder_name is null
      or new.bank_name is null
      or new.bank_branch_name is null
      or new.bank_branch_code is null
      or new.bank_account_number is null
      or new.bank_account_type is null
    then
      raise exception 'Complete banking details are required before banking details can be verified.';
    end if;
  end if;

  if tg_op = 'UPDATE' and v_bank_fields_changed and new.banking_verification_status = old.banking_verification_status then
    new.banking_verification_status := 'pending';
    new.banking_verified_at := null;
    new.banking_verified_by := null;
  end if;

  if new.banking_verification_status = 'verified' then
    if old.banking_verification_status is distinct from 'verified' or new.banking_verified_at is null then
      new.banking_verified_at := coalesce(new.banking_verified_at, now());
    end if;
  elsif new.banking_verification_status <> 'verified' then
    new.banking_verified_at := null;
    if new.banking_verification_status = 'pending' then
      new.banking_verified_by := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_practitioner_profiles_banking_verification on public.practitioner_profiles;
create trigger trg_practitioner_profiles_banking_verification
before update on public.practitioner_profiles
for each row execute function public.handle_practitioner_banking_verification();
