
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow service role, anon, and direct SQL access (auth.role() is null)
  if auth.role() is null or auth.role() <> 'authenticated' then
    return new;
  end if;

  -- Allow admins to change anything
  if public.get_my_role() = 'admin' then
    return new;
  end if;

  if old.role is distinct from new.role then
    raise exception 'Only admins can change a user role.' using errcode = '42501';
  end if;

  if old.is_active is distinct from new.is_active then
    raise exception 'Only admins can change account activation status.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_block_privilege_escalation on public.profiles;
create trigger trg_profiles_block_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();


create or replace function public.prevent_practitioner_self_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is null or auth.role() <> 'authenticated' then
    return new;
  end if;

  if public.get_my_role() = 'admin' then
    return new;
  end if;

  -- Identity verification: block promotion to verified, block flag flip to true.
  -- Downgrades / resets to 'pending' or false are allowed (not a vulnerability).
  if old.is_verified is distinct from new.is_verified and new.is_verified = true then
    raise exception 'Only admins can mark a practitioner as verified.' using errcode = '42501';
  end if;

  if old.verification_status is distinct from new.verification_status
    and new.verification_status in ('verified', 'rejected') then
    raise exception 'Only admins can set verification status to verified or rejected.' using errcode = '42501';
  end if;

  -- Banking verification: block promotion to verified or rejected.
  -- Auto-reset to 'pending' (by the existing banking-verification trigger
  -- when bank fields change) is allowed.
  if old.banking_verification_status is distinct from new.banking_verification_status
    and new.banking_verification_status in ('verified', 'rejected') then
    raise exception 'Only admins can verify or reject banking details.' using errcode = '42501';
  end if;

  -- Allow clearing banking_verified_at (auto-reset path) but block setting
  -- it to a non-null value.
  if old.banking_verified_at is distinct from new.banking_verified_at
    and new.banking_verified_at is not null then
    raise exception 'Only admins can set banking verification timestamp.' using errcode = '42501';
  end if;

  -- Allow clearing banking_verified_by; block setting it.
  if old.banking_verified_by is distinct from new.banking_verified_by
    and new.banking_verified_by is not null then
    raise exception 'Only admins can set banking verified-by.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_practitioner_profiles_block_self_verification on public.practitioner_profiles;
create trigger trg_practitioner_profiles_block_self_verification
before update on public.practitioner_profiles
for each row execute function public.prevent_practitioner_self_verification();

-- ─────────────────────────────────────────────
-- 3. invoices: block clients from tampering with financial / status fields
-- ─────────────────────────────────────────────
create or replace function public.prevent_client_invoice_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  if auth.role() is null or auth.role() <> 'authenticated' then
    return new;
  end if;

  caller_role := public.get_my_role();

  -- Admins and consultants are platform staff; allow them
  if caller_role in ('admin', 'consultant') then
    return new;
  end if;

  -- Below this: client updating their own invoice
  if old.status is distinct from new.status then
    raise exception 'Clients cannot change invoice status.' using errcode = '42501';
  end if;

  if old.amount_paid is distinct from new.amount_paid then
    raise exception 'Clients cannot change amount paid.' using errcode = '42501';
  end if;

  if old.paid_at is distinct from new.paid_at then
    raise exception 'Clients cannot change paid-at timestamp.' using errcode = '42501';
  end if;

  if old.total_amount is distinct from new.total_amount then
    raise exception 'Clients cannot change total amount.' using errcode = '42501';
  end if;

  if old.subtotal is distinct from new.subtotal then
    raise exception 'Clients cannot change subtotal.' using errcode = '42501';
  end if;

  if old.tax_amount is distinct from new.tax_amount then
    raise exception 'Clients cannot change tax amount.' using errcode = '42501';
  end if;

  if old.discount_amount is distinct from new.discount_amount then
    raise exception 'Clients cannot change discount amount.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoices_block_client_tampering on public.invoices;
create trigger trg_invoices_block_client_tampering
before update on public.invoices
for each row execute function public.prevent_client_invoice_tampering();
