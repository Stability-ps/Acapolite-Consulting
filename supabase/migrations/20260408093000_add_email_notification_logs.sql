create table if not exists public.email_notification_logs (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null,
  recipient_email text not null,
  profile_id uuid references public.profiles(id) on delete cascade,
  contact_email text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists email_notification_logs_signup_unique_idx
  on public.email_notification_logs (notification_type, profile_id)
  where profile_id is not null;
