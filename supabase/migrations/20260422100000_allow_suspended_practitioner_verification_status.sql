alter table public.practitioner_profiles
  drop constraint if exists practitioner_profiles_verification_status_check;

alter table public.practitioner_profiles
  add constraint practitioner_profiles_verification_status_check
  check (verification_status in ('pending', 'verified', 'rejected', 'suspended'));
