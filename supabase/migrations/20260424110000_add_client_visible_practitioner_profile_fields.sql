alter table public.practitioner_profiles
  add column if not exists professional_title text,
  add column if not exists profile_summary text,
  add column if not exists languages_spoken text[] not null default '{}'::text[],
  add column if not exists show_registration_number boolean not null default false;
