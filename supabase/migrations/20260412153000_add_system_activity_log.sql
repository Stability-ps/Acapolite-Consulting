create table if not exists public.system_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_role public.app_role not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_system_activity_log_created_at
  on public.system_activity_log(created_at desc);

create index if not exists idx_system_activity_log_target
  on public.system_activity_log(target_type, target_id);

alter table public.system_activity_log enable row level security;

drop policy if exists "system_activity_log_select_staff" on public.system_activity_log;
create policy "system_activity_log_select_staff"
on public.system_activity_log
for select
using (public.get_my_role() in ('admin', 'consultant'));

drop policy if exists "system_activity_log_insert_self" on public.system_activity_log;
create policy "system_activity_log_insert_self"
on public.system_activity_log
for insert
with check (auth.uid() = actor_profile_id);
