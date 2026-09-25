-- Prospect Hub foundation: prospects, CRM activity, follow-ups and bulk email campaigns.

alter table public.staff_permissions
  add column if not exists can_view_prospect_hub boolean not null default false,
  add column if not exists can_manage_prospect_hub boolean not null default false,
  add column if not exists can_send_prospect_campaigns boolean not null default false;

create or replace function public.can_view_prospect_hub()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'::public.app_role
    )
    or exists (
      select 1 from public.staff_permissions sp
      where sp.profile_id = (select auth.uid())
        and sp.can_view_prospect_hub = true
    );
$$;

create or replace function public.can_manage_prospect_hub()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'::public.app_role
    )
    or exists (
      select 1 from public.staff_permissions sp
      where sp.profile_id = (select auth.uid())
        and sp.can_manage_prospect_hub = true
    );
$$;

create or replace function public.can_send_prospect_campaigns()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'::public.app_role
    )
    or exists (
      select 1 from public.staff_permissions sp
      where sp.profile_id = (select auth.uid())
        and sp.can_send_prospect_campaigns = true
    );
$$;

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  registration_number text,
  sector text,
  city text,
  province text,
  country text not null default 'South Africa',
  phone text,
  whatsapp text,
  email text,
  website text,
  contact_name text,
  contact_title text,
  source_name text,
  source_url text,
  source_record_id text,
  source_last_seen_at timestamptz,
  discovered_at timestamptz not null default now(),
  last_enriched_at timestamptz,
  status text not null default 'new'
    check (status in ('new','contacted','follow_up','interested','qualified','disqualified','converted')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  score integer not null default 0 check (score between 0 and 100),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  do_not_contact boolean not null default false,
  email_opt_out_at timestamptz,
  opt_out_reason text,
  converted_client_id uuid references public.clients(id) on delete set null,
  converted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists prospects_source_record_unique
  on public.prospects(source_name, source_record_id)
  where source_name is not null and source_record_id is not null;
create index if not exists prospects_status_idx on public.prospects(status);
create index if not exists prospects_priority_score_idx on public.prospects(priority, score desc);
create index if not exists prospects_location_idx on public.prospects(province, city);
create index if not exists prospects_follow_up_idx on public.prospects(next_follow_up_at) where next_follow_up_at is not null;
create index if not exists prospects_company_name_lower_idx on public.prospects(lower(company_name));

create table if not exists public.prospect_contacts (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  contact_type text not null check (contact_type in ('email','phone','whatsapp','website','person')),
  value text not null,
  label text,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  source_url text,
  created_at timestamptz not null default now()
);
create index if not exists prospect_contacts_prospect_idx on public.prospect_contacts(prospect_id);

create table if not exists public.prospect_notes (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  body text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists prospect_notes_prospect_created_idx on public.prospect_notes(prospect_id, created_at desc);

create table if not exists public.prospect_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  activity_type text not null
    check (activity_type in ('call','email','whatsapp','meeting','note','status_change','campaign','system')),
  direction text check (direction is null or direction in ('inbound','outbound')),
  summary text not null,
  outcome text,
  performed_by uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists prospect_activities_prospect_occurred_idx on public.prospect_activities(prospect_id, occurred_at desc);

create table if not exists public.prospect_follow_ups (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prospect_follow_ups_due_idx on public.prospect_follow_ups(status, due_at);

create table if not exists public.prospect_email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body_html text,
  body_text text not null,
  category text not null default 'general',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospect_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id uuid references public.prospect_email_templates(id) on delete set null,
  subject text not null,
  body_html text,
  body_text text not null,
  status text not null default 'draft'
    check (status in ('draft','queued','sending','paused','completed','cancelled','failed')),
  created_by uuid references public.profiles(id) on delete set null,
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total_recipients integer not null default 0,
  sent_count integer not null default 0,
  delivered_count integer not null default 0,
  opened_count integer not null default 0,
  replied_count integer not null default 0,
  bounced_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospect_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.prospect_campaigns(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending','queued','sent','delivered','opened','replied','bounced','failed','skipped','unsubscribed')),
  provider_message_id text,
  error_message text,
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, prospect_id)
);
create index if not exists prospect_campaign_recipients_status_idx
  on public.prospect_campaign_recipients(campaign_id, status);

create trigger prospects_set_updated_at before update on public.prospects
for each row execute function public.update_updated_at_column();
create trigger prospect_follow_ups_set_updated_at before update on public.prospect_follow_ups
for each row execute function public.update_updated_at_column();
create trigger prospect_email_templates_set_updated_at before update on public.prospect_email_templates
for each row execute function public.update_updated_at_column();
create trigger prospect_campaigns_set_updated_at before update on public.prospect_campaigns
for each row execute function public.update_updated_at_column();

alter table public.prospects enable row level security;
alter table public.prospect_contacts enable row level security;
alter table public.prospect_notes enable row level security;
alter table public.prospect_activities enable row level security;
alter table public.prospect_follow_ups enable row level security;
alter table public.prospect_email_templates enable row level security;
alter table public.prospect_campaigns enable row level security;
alter table public.prospect_campaign_recipients enable row level security;

grant select, insert, update, delete on public.prospects to authenticated;
grant select, insert, update, delete on public.prospect_contacts to authenticated;
grant select, insert, update, delete on public.prospect_notes to authenticated;
grant select, insert, update, delete on public.prospect_activities to authenticated;
grant select, insert, update, delete on public.prospect_follow_ups to authenticated;
grant select, insert, update, delete on public.prospect_email_templates to authenticated;
grant select, insert, update, delete on public.prospect_campaigns to authenticated;
grant select, insert, update, delete on public.prospect_campaign_recipients to authenticated;

create policy "prospects_select_staff" on public.prospects for select to authenticated using (public.can_view_prospect_hub());
create policy "prospects_insert_staff" on public.prospects for insert to authenticated with check (public.can_manage_prospect_hub());
create policy "prospects_update_staff" on public.prospects for update to authenticated using (public.can_manage_prospect_hub()) with check (public.can_manage_prospect_hub());
create policy "prospects_delete_staff" on public.prospects for delete to authenticated using (public.can_manage_prospect_hub());

create policy "prospect_contacts_select_staff" on public.prospect_contacts for select to authenticated using (public.can_view_prospect_hub());
create policy "prospect_contacts_write_staff" on public.prospect_contacts for all to authenticated using (public.can_manage_prospect_hub()) with check (public.can_manage_prospect_hub());

create policy "prospect_notes_select_staff" on public.prospect_notes for select to authenticated using (public.can_view_prospect_hub());
create policy "prospect_notes_write_staff" on public.prospect_notes for all to authenticated using (public.can_manage_prospect_hub()) with check (public.can_manage_prospect_hub());

create policy "prospect_activities_select_staff" on public.prospect_activities for select to authenticated using (public.can_view_prospect_hub());
create policy "prospect_activities_write_staff" on public.prospect_activities for all to authenticated using (public.can_manage_prospect_hub()) with check (public.can_manage_prospect_hub());

create policy "prospect_follow_ups_select_staff" on public.prospect_follow_ups for select to authenticated using (public.can_view_prospect_hub());
create policy "prospect_follow_ups_write_staff" on public.prospect_follow_ups for all to authenticated using (public.can_manage_prospect_hub()) with check (public.can_manage_prospect_hub());

create policy "prospect_email_templates_select_staff" on public.prospect_email_templates for select to authenticated using (public.can_view_prospect_hub());
create policy "prospect_email_templates_write_staff" on public.prospect_email_templates for all to authenticated
using (public.can_manage_prospect_hub() or public.can_send_prospect_campaigns())
with check (public.can_manage_prospect_hub() or public.can_send_prospect_campaigns());

create policy "prospect_campaigns_select_staff" on public.prospect_campaigns for select to authenticated using (public.can_view_prospect_hub());
create policy "prospect_campaigns_write_staff" on public.prospect_campaigns for all to authenticated
using (public.can_send_prospect_campaigns())
with check (public.can_send_prospect_campaigns());

create policy "prospect_campaign_recipients_select_staff" on public.prospect_campaign_recipients for select to authenticated using (public.can_view_prospect_hub());
create policy "prospect_campaign_recipients_write_staff" on public.prospect_campaign_recipients for all to authenticated
using (public.can_send_prospect_campaigns())
with check (public.can_send_prospect_campaigns());

insert into public.prospect_email_templates (name, subject, body_text, category)
select
  'SARS Compliance Review',
  'SARS Tax Compliance Support for {{company_name}}',
  'Good day,\n\nMy name is Patric Sibande from Acapolite Consulting. We assist businesses with SARS tax compliance matters, including Tax Compliance Status, outstanding returns, VAT/PAYE issues, SARS debt and related eFiling compliance matters.\n\nIf {{company_name}} is currently experiencing a SARS compliance issue, we can review the position, identify the underlying cause and advise on the appropriate corrective process.\n\nKind regards,\nAcapolite Consulting',
  'sars_compliance'
where not exists (
  select 1 from public.prospect_email_templates where name = 'SARS Compliance Review'
);
