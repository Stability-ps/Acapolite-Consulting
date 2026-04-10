create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_subscriptions_profile_endpoint_unique unique (profile_id, endpoint)
);

drop trigger if exists trg_push_subscriptions_updated_at on public.push_subscriptions;
create trigger trg_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

create index if not exists idx_push_subscriptions_profile_id
  on public.push_subscriptions(profile_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
on public.push_subscriptions
for select
using (profile_id = auth.uid());

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
on public.push_subscriptions
for insert
with check (profile_id = auth.uid());

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
on public.push_subscriptions
for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
on public.push_subscriptions
for delete
using (profile_id = auth.uid());

create table if not exists public.practitioner_reviews (
  id uuid primary key default gen_random_uuid(),
  practitioner_profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practitioner_reviews_case_unique unique (case_id),
  constraint practitioner_reviews_client_case_unique unique (client_id, case_id)
);

drop trigger if exists trg_practitioner_reviews_updated_at on public.practitioner_reviews;
create trigger trg_practitioner_reviews_updated_at
before update on public.practitioner_reviews
for each row execute function public.set_updated_at();

create index if not exists idx_practitioner_reviews_practitioner_profile_id
  on public.practitioner_reviews(practitioner_profile_id);

create index if not exists idx_practitioner_reviews_client_id
  on public.practitioner_reviews(client_id);

alter table public.practitioner_reviews enable row level security;

drop policy if exists "practitioner_reviews_select_authenticated" on public.practitioner_reviews;
create policy "practitioner_reviews_select_authenticated"
on public.practitioner_reviews
for select
using (auth.uid() is not null);

drop policy if exists "practitioner_reviews_insert_client_own_case" on public.practitioner_reviews;
create policy "practitioner_reviews_insert_client_own_case"
on public.practitioner_reviews
for insert
with check (
  exists (
    select 1
    from public.clients c
    join public.cases case_row on case_row.client_id = c.id
    where c.id = practitioner_reviews.client_id
      and c.profile_id = auth.uid()
      and case_row.id = practitioner_reviews.case_id
      and case_row.assigned_consultant_id = practitioner_reviews.practitioner_profile_id
      and case_row.status in ('resolved', 'closed')
  )
);

drop policy if exists "practitioner_reviews_update_client_own_case" on public.practitioner_reviews;
create policy "practitioner_reviews_update_client_own_case"
on public.practitioner_reviews
for update
using (
  exists (
    select 1
    from public.clients c
    join public.cases case_row on case_row.client_id = c.id
    where c.id = practitioner_reviews.client_id
      and c.profile_id = auth.uid()
      and case_row.id = practitioner_reviews.case_id
      and case_row.assigned_consultant_id = practitioner_reviews.practitioner_profile_id
      and case_row.status in ('resolved', 'closed')
  )
)
with check (
  exists (
    select 1
    from public.clients c
    join public.cases case_row on case_row.client_id = c.id
    where c.id = practitioner_reviews.client_id
      and c.profile_id = auth.uid()
      and case_row.id = practitioner_reviews.case_id
      and case_row.assigned_consultant_id = practitioner_reviews.practitioner_profile_id
      and case_row.status in ('resolved', 'closed')
  )
);

drop policy if exists "practitioner_reviews_delete_admin_only" on public.practitioner_reviews;
create policy "practitioner_reviews_delete_admin_only"
on public.practitioner_reviews
for delete
using (public.get_my_role() = 'admin');
