create table if not exists public.staff_permissions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  assigned_clients_only boolean not null default false,
  can_view_overview boolean not null default true,
  can_view_clients boolean not null default true,
  can_manage_clients boolean not null default false,
  can_view_client_workspace boolean not null default true,
  can_view_cases boolean not null default true,
  can_manage_cases boolean not null default true,
  can_view_documents boolean not null default true,
  can_review_documents boolean not null default true,
  can_view_invoices boolean not null default true,
  can_manage_invoices boolean not null default false,
  can_view_messages boolean not null default true,
  can_reply_messages boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_staff_permissions_updated_at on public.staff_permissions;
create trigger trg_staff_permissions_updated_at
before update on public.staff_permissions
for each row execute function public.set_updated_at();

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
select
  p.id,
  false,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true
from public.profiles p
where p.role in ('admin', 'consultant')
  and not exists (
    select 1
    from public.staff_permissions sp
    where sp.profile_id = p.id
  );

alter table public.staff_permissions enable row level security;

drop policy if exists "staff_permissions_select_own_or_admin" on public.staff_permissions;
create policy "staff_permissions_select_own_or_admin"
on public.staff_permissions
for select
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "staff_permissions_insert_admin_only" on public.staff_permissions;
create policy "staff_permissions_insert_admin_only"
on public.staff_permissions
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "staff_permissions_update_admin_only" on public.staff_permissions;
create policy "staff_permissions_update_admin_only"
on public.staff_permissions
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
