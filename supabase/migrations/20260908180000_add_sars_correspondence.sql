-- PR 5 of feature/tax-ai-case-knowledge: SARS correspondence drafting.
-- Purely additive. Correspondence always belongs to one client + case
-- (never a "general" draft with no case), and templates are global
-- (no client_id/case_id) matching the existing knowledge-domain pattern.

create type public.correspondence_status as enum (
  'draft',
  'under_review',
  'approved',
  'sent',
  'superseded',
  'archived'
);

create type public.correspondence_template_status as enum (
  'draft',
  'active',
  'archived'
);

-- 1. Two new granular permissions, additive on the existing staff_permissions
--    table. Both default false for consultants (opt-in), matching the
--    existing can_use_tax_coach_ai default. Admins already bypass all
--    staff_permissions checks via is_admin_or_consultant()/get_my_role().
alter table public.staff_permissions
  add column if not exists can_generate_sars_correspondence boolean not null default false,
  add column if not exists can_approve_sars_correspondence boolean not null default false;

-- 2. Case correspondence. Always scoped to one client + case - there is no
--    "general" correspondence draft, matching the requirement that live
--    case letters can never be produced without an authorised case context.
create table if not exists public.case_correspondence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  correspondence_type text not null,
  purpose text,
  recipient text,
  subject text,
  body text not null,
  tone text,
  status public.correspondence_status not null default 'draft',
  version integer not null default 1,
  supersedes_id uuid references public.case_correspondence(id),
  generated_by_ai boolean not null default false,
  model_used text,
  source_snapshot jsonb,
  missing_information text[],
  warnings text[],
  annexure_manifest jsonb,
  sars_reference text,
  tax_type text,
  tax_period text,
  deadline date,
  created_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_case_correspondence_case_id
  on public.case_correspondence (case_id);
create index if not exists idx_case_correspondence_client_id
  on public.case_correspondence (client_id);
create index if not exists idx_case_correspondence_status
  on public.case_correspondence (status);
create index if not exists idx_case_correspondence_supersedes_id
  on public.case_correspondence (supersedes_id)
  where supersedes_id is not null;

drop trigger if exists trg_case_correspondence_updated_at on public.case_correspondence;
create trigger trg_case_correspondence_updated_at
before update on public.case_correspondence
for each row execute function public.set_updated_at();

-- Hard safety net, not just app-level discipline: an approved or sent
-- letter's body/type/recipient/subject can never be silently overwritten.
-- The application must create a new version row instead. Status/review
-- metadata transitions (e.g. sent -> superseded/archived) are still
-- allowed through this same row.
create or replace function public.protect_approved_correspondence()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('approved', 'sent') and (
    new.body is distinct from old.body
    or new.correspondence_type is distinct from old.correspondence_type
    or new.recipient is distinct from old.recipient
    or new.subject is distinct from old.subject
  ) then
    raise exception 'Approved or sent correspondence cannot be edited in place. Create a new version instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_approved_correspondence on public.case_correspondence;
create trigger trg_protect_approved_correspondence
before update on public.case_correspondence
for each row execute function public.protect_approved_correspondence();

alter table public.case_correspondence enable row level security;

drop policy if exists "case_correspondence_select_staff" on public.case_correspondence;
create policy "case_correspondence_select_staff"
on public.case_correspondence
for select
using (public.is_admin_or_consultant());

drop policy if exists "case_correspondence_insert_generate_permission" on public.case_correspondence;
create policy "case_correspondence_insert_generate_permission"
on public.case_correspondence
for insert
with check (
  public.get_my_role() = 'admin'::public.app_role
  or (
    public.get_my_role() = 'consultant'::public.app_role
    and exists (
      select 1 from public.staff_permissions sp
      where sp.profile_id = auth.uid()
        and sp.can_generate_sars_correspondence = true
    )
  )
);

drop policy if exists "case_correspondence_update_staff" on public.case_correspondence;
create policy "case_correspondence_update_staff"
on public.case_correspondence
for update
using (public.is_admin_or_consultant())
with check (public.is_admin_or_consultant());

-- 3. Correspondence Templates: global, structural guidance only. No
--    client_id/case_id, same non-negotiable separation as the other
--    AI Knowledge domains.
create table if not exists public.correspondence_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  correspondence_type text not null,
  tax_type text,
  case_type text,
  purpose text,
  body_structure text,
  approved boolean not null default false,
  version integer not null default 1,
  status public.correspondence_template_status not null default 'draft',
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_correspondence_templates_type
  on public.correspondence_templates (correspondence_type);
create index if not exists idx_correspondence_templates_status
  on public.correspondence_templates (status);

drop trigger if exists trg_correspondence_templates_updated_at on public.correspondence_templates;
create trigger trg_correspondence_templates_updated_at
before update on public.correspondence_templates
for each row execute function public.set_updated_at();

alter table public.correspondence_templates enable row level security;

drop policy if exists "correspondence_templates_select_staff" on public.correspondence_templates;
create policy "correspondence_templates_select_staff"
on public.correspondence_templates
for select
using (public.is_admin_or_consultant());

drop policy if exists "correspondence_templates_manage_admin_only" on public.correspondence_templates;
create policy "correspondence_templates_manage_admin_only"
on public.correspondence_templates
for all
using (public.get_my_role() = 'admin'::public.app_role)
with check (public.get_my_role() = 'admin'::public.app_role);
