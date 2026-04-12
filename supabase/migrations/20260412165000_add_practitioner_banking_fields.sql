alter table public.practitioner_profiles
  add column if not exists bank_account_holder_name text,
  add column if not exists bank_name text,
  add column if not exists bank_branch_name text,
  add column if not exists bank_branch_code text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_type text,
  add column if not exists vat_number text;
