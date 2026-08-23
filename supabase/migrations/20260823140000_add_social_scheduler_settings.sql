-- Database-backed "Automatic Publishing" switch for the Social Media
-- Overview panel, replacing the secret-only operational workflow. This
-- table is deliberately a strict singleton (unique index on a constant
-- expression) - there is exactly one row, ever.
--
-- Security model: admins may SELECT this row directly (RLS below), but
-- there is NO insert/update/delete policy for authenticated users at all.
-- The row can only be mutated through the social-scheduler-settings edge
-- function, which uses the service role key after independently
-- re-verifying admin role - a plain client-side `.update()` call is
-- structurally impossible, not just discouraged by convention.
--
-- The effective auto-publish decision is (env kill switch) AND (this
-- row's auto_publish_enabled) - see _shared/socialSchedulerSettings.ts.
-- This migration never touches SOCIAL_AUTO_PUBLISH_ENABLED.

create table if not exists public.social_scheduler_settings (
  id uuid primary key default gen_random_uuid(),
  auto_publish_enabled boolean not null default false,
  timezone text not null default 'Africa/Johannesburg',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enforces at most one row can ever exist.
create unique index if not exists social_scheduler_settings_singleton_idx
  on public.social_scheduler_settings ((true));

alter table public.social_scheduler_settings enable row level security;

drop policy if exists "social_scheduler_settings_admin_select" on public.social_scheduler_settings;
create policy "social_scheduler_settings_admin_select"
on public.social_scheduler_settings
for select
to authenticated
using (public.get_my_role() = 'admin'::public.app_role);

-- Seed the single row, defaulting to OFF, only if it doesn't exist yet.
insert into public.social_scheduler_settings (auto_publish_enabled, timezone)
select false, 'Africa/Johannesburg'
where not exists (select 1 from public.social_scheduler_settings);
