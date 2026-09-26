-- Prospect Hub v2 schema: source registry, procurement evidence,
-- deduplication, transparent fit scoring, suppression, audit trail, richer
-- follow-ups/campaign queue columns.
--
-- Terminology: "score" is a *fit score* - how relevant a business is as a
-- potential Acapolite customer. It is never a statement about a business's
-- SARS compliance status.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Normalisation helpers
-- ---------------------------------------------------------------------------

create or replace function public.normalize_company_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(trim(regexp_replace(
    regexp_replace(
      regexp_replace(lower(coalesce(p_name, '')), '\((pty|proprietary)\)|\(rf\)|\(soc\)', ' ', 'g'),
      '\m(pty|proprietary|ltd|limited|cc|inc|incorporated|npc|soc|rf|the)\M', ' ', 'g'),
    '[^a-z0-9]+', ' ', 'g')), '');
$$;

create or replace function public.normalize_registration_number(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(upper(regexp_replace(coalesce(p_value, ''), '[^0-9A-Za-z]', '', 'g')), '');
$$;

create or replace function public.website_domain(p_url text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(regexp_replace(
    regexp_replace(lower(coalesce(p_url, '')), '^[a-z]+://', ''),
    '^www\.|[/:?#].*$', '', 'g'), '');
$$;

create or replace function public.normalize_sa_phone(p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
begin
  if d like '0027%' then d := substr(d, 5);
  elsif d like '27%' and length(d) >= 11 then d := substr(d, 3);
  elsif d like '0%' then d := substr(d, 2);
  else return nullif(d, '');
  end if;
  if d like '0%' then d := substr(d, 2); end if;
  if d ~ '^[1-8][0-9]{8}$' then return '+27' || d; end if;
  return nullif(regexp_replace(coalesce(p_value, ''), '[^0-9+]', '', 'g'), '');
end;
$$;

-- ---------------------------------------------------------------------------
-- Prospects: new columns
-- ---------------------------------------------------------------------------

alter table public.prospects
  add column if not exists normalized_name text,
  add column if not exists website_domain text,
  add column if not exists industry text,
  add column if not exists physical_address text,
  add column if not exists website_source text,
  add column if not exists email_source_url text,
  add column if not exists phone_source_url text,
  add column if not exists email_verified_at timestamptz,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists website_verified_at timestamptz,
  add column if not exists contact_verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists score_reasons jsonb not null default '[]'::jsonb,
  add column if not exists score_updated_at timestamptz,
  add column if not exists procurement_record_count integer not null default 0,
  add column if not exists first_procurement_at timestamptz,
  add column if not exists last_procurement_at timestamptz,
  add column if not exists total_award_value numeric(18,2),
  add column if not exists supplier_size text,
  add column if not exists source_supplier_id text,
  add column if not exists lead_at timestamptz,
  add column if not exists lead_by uuid references public.profiles(id) on delete set null,
  add column if not exists lead_service_interest text,
  add column if not exists consultation_at timestamptz,
  add column if not exists converted_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists enrichment_attempts integer not null default 0;

alter table public.prospects drop constraint if exists prospects_status_check;
alter table public.prospects add constraint prospects_status_check
  check (status in ('new','contacted','follow_up','interested','qualified','consultation','disqualified','converted'));

alter table public.prospects drop constraint if exists prospects_enrichment_status_check;
alter table public.prospects add constraint prospects_enrichment_status_check
  check (enrichment_status in ('pending','processing','completed','partial','no_website','no_contacts','failed','needs_review','skipped'));

alter table public.prospects drop constraint if exists prospects_website_source_check;
alter table public.prospects add constraint prospects_website_source_check
  check (website_source is null or website_source in ('official_source','web_search','manual','import'));

alter table public.prospects drop constraint if exists prospects_company_name_not_blank;
alter table public.prospects add constraint prospects_company_name_not_blank check (length(trim(company_name)) > 0);

-- ---------------------------------------------------------------------------
-- Transparent fit score
-- ---------------------------------------------------------------------------

create or replace function public.prospect_fit_score(
  p_sector text,
  p_province text,
  p_email text,
  p_phone text,
  p_website text,
  p_procurement_count integer,
  p_last_procurement_at timestamptz,
  p_supplier_size text
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  reasons jsonb := '[]'::jsonb;
  total integer := 0;
  high_fit text[] := array['Construction','Security','Cleaning','Transport','Logistics','Engineering','Maintenance','Catering','IT'];
begin
  if coalesce(p_procurement_count, 0) >= 1 then
    reasons := reasons || jsonb_build_object('label', 'Government procurement award on record', 'points', 20); total := total + 20;
  end if;
  if p_last_procurement_at is not null and p_last_procurement_at >= now() - interval '365 days' then
    reasons := reasons || jsonb_build_object('label', 'Recent procurement activity (last 12 months)', 'points', 10); total := total + 10;
  end if;
  if coalesce(p_procurement_count, 0) >= 2 then
    reasons := reasons || jsonb_build_object('label', format('Multiple procurement records (%s)', p_procurement_count), 'points', 7); total := total + 7;
  end if;
  if p_sector = any(high_fit) then
    reasons := reasons || jsonb_build_object('label', p_sector || ' sector', 'points', 20); total := total + 20;
  elsif nullif(trim(p_sector), '') is not null then
    reasons := reasons || jsonb_build_object('label', p_sector || ' sector', 'points', 5); total := total + 5;
  end if;
  if upper(coalesce(p_supplier_size, '')) in ('EME','QSE') then
    reasons := reasons || jsonb_build_object('label', 'Small/medium enterprise (' || upper(p_supplier_size) || ')', 'points', 8); total := total + 8;
  end if;
  if p_province = 'Gauteng' then
    reasons := reasons || jsonb_build_object('label', 'Gauteng (Acapolite service area)', 'points', 10); total := total + 10;
  elsif nullif(trim(p_province), '') is not null then
    reasons := reasons || jsonb_build_object('label', p_province, 'points', 3); total := total + 3;
  end if;
  if nullif(trim(p_email), '') is not null then
    reasons := reasons || jsonb_build_object('label', 'Public business email', 'points', 10); total := total + 10;
  end if;
  if nullif(trim(p_phone), '') is not null then
    reasons := reasons || jsonb_build_object('label', 'Public business phone', 'points', 10); total := total + 10;
  end if;
  if nullif(trim(p_website), '') is not null then
    reasons := reasons || jsonb_build_object('label', 'Official website', 'points', 5); total := total + 5;
  end if;
  return jsonb_build_object('score', least(total, 100), 'reasons', reasons);
end;
$$;

create or replace function public.prospects_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_fit jsonb;
begin
  new.company_name := trim(new.company_name);
  new.normalized_name := public.normalize_company_name(new.company_name);
  new.email := nullif(lower(trim(new.email)), '');
  new.phone := case when nullif(trim(new.phone), '') is null then null else public.normalize_sa_phone(new.phone) end;
  new.whatsapp := case when nullif(trim(new.whatsapp), '') is null then null else public.normalize_sa_phone(new.whatsapp) end;
  new.website := nullif(trim(new.website), '');
  new.website_domain := public.website_domain(new.website);
  new.registration_number := nullif(trim(new.registration_number), '');

  v_fit := public.prospect_fit_score(new.sector, new.province, new.email, new.phone, new.website,
    new.procurement_record_count, new.last_procurement_at, new.supplier_size);
  if tg_op = 'INSERT'
     or (v_fit->>'score')::int is distinct from old.score
     or v_fit->'reasons' is distinct from old.score_reasons then
    new.score := (v_fit->>'score')::int;
    new.score_reasons := v_fit->'reasons';
    new.score_updated_at := now();
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status in ('qualified','consultation') and new.lead_at is null then
      new.lead_at := now();
      new.lead_by := coalesce(new.lead_by, auth.uid());
    end if;
    if new.status = 'consultation' and new.consultation_at is null then new.consultation_at := now(); end if;
    if new.status = 'contacted' and new.last_contacted_at is null then new.last_contacted_at := now(); end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prospects_before_write on public.prospects;
create trigger prospects_before_write before insert or update on public.prospects
  for each row execute function public.prospects_before_write();

-- Backfill (table is currently empty in production; safe either way).
update public.prospects set company_name = company_name;

create index if not exists prospects_normalized_name_idx on public.prospects(normalized_name);
create index if not exists prospects_website_domain_idx on public.prospects(website_domain) where website_domain is not null;
create index if not exists prospects_email_idx on public.prospects(email) where email is not null;
create index if not exists prospects_phone_idx on public.prospects(phone) where phone is not null;
create unique index if not exists prospects_registration_unique
  on public.prospects(public.normalize_registration_number(registration_number))
  where registration_number is not null;
create unique index if not exists prospects_source_supplier_unique
  on public.prospects(source_name, source_supplier_id)
  where source_name is not null and source_supplier_id is not null;
create index if not exists prospects_assigned_idx on public.prospects(assigned_to) where assigned_to is not null;
create index if not exists prospects_discovered_idx on public.prospects(discovered_at desc);
create index if not exists prospects_score_idx on public.prospects(score desc, discovered_at desc);
create index if not exists prospects_sector_idx on public.prospects(sector);
create index if not exists prospects_source_idx on public.prospects(source_name);
create index if not exists prospects_lead_idx on public.prospects(lead_at) where lead_at is not null;
create index if not exists prospects_company_trgm_idx on public.prospects using gin (company_name extensions.gin_trgm_ops);
create index if not exists prospects_city_trgm_idx on public.prospects using gin (city extensions.gin_trgm_ops);
-- The old per-tender uniqueness (source_url) would block attaching several
-- tenders to one company; evidence now lives in prospect_source_records.
drop index if exists public.prospects_source_url_unique;

-- ---------------------------------------------------------------------------
-- Source registry
-- ---------------------------------------------------------------------------

create table if not exists public.prospect_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  source_type text not null check (source_type in ('procurement_api','website_enrichment','directory','manual','import')),
  enabled boolean not null default true,
  status text not null default 'unknown' check (status in ('healthy','degraded','failing','disabled','unknown')),
  schedule_cron text,
  schedule_description text,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_failures integer not null default 0,
  total_runs integer not null default 0,
  total_failures integer not null default 0,
  records_discovered integer not null default 0,
  prospects_created integer not null default 0,
  terms_url text,
  notes text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists prospect_sources_set_updated_at on public.prospect_sources;
create trigger prospect_sources_set_updated_at before update on public.prospect_sources
  for each row execute function public.update_updated_at_column();

insert into public.prospect_sources (key, name, source_type, schedule_cron, schedule_description, terms_url, notes)
values
  ('etenders_ocds', 'National Treasury eTenders OCDS', 'procurement_api', '15 2 * * *', 'Daily 04:15 SAST (02:15 UTC)',
   'https://ocds-api.etenders.gov.za/swagger/',
   'Official Open Contracting (OCDS) API published by National Treasury. Only awarded suppliers are imported. Supplier contactPoint fields in this feed contain the procuring entity''s contact, so they are never used as supplier contact details.'),
  ('public_websites', 'Public company websites', 'website_enrichment', '45 2 * * *', 'Daily 04:45 SAST (02:45 UTC)',
   null, 'Contact details published on a company''s own website. Respects robots.txt. Search results are suggestions only and must pass a company-identity check.'),
  ('manual', 'Manual entry', 'manual', null, 'On demand', null, 'Prospects added by staff.'),
  ('import', 'Spreadsheet import', 'import', null, 'On demand', null, 'Prospects imported from CSV/XLSX by authorised staff.')
on conflict (key) do nothing;

alter table public.prospect_discovery_settings
  add column if not exists source_id uuid references public.prospect_sources(id) on delete set null,
  add column if not exists window_cursor date,
  add column if not exists lookback_days integer not null default 30 check (lookback_days between 1 and 365),
  add column if not exists windows_per_run integer not null default 3 check (windows_per_run between 1 and 14),
  add column if not exists max_new_per_run integer not null default 100 check (max_new_per_run between 1 and 1000),
  add column if not exists min_fit_score integer not null default 0 check (min_fit_score between 0 and 100);
alter table public.prospect_discovery_settings drop constraint if exists prospect_discovery_settings_page_size_check;
alter table public.prospect_discovery_settings add constraint prospect_discovery_settings_page_size_check check (page_size between 5 and 100);
update public.prospect_discovery_settings
  set source_id = (select id from public.prospect_sources where key = 'etenders_ocds'),
      page_size = 20
  where source_name = 'National Treasury eTenders OCDS';

alter table public.prospect_discovery_runs add column if not exists source_id uuid references public.prospect_sources(id) on delete set null;
alter table public.prospect_discovery_runs add column if not exists triggered_by uuid references public.profiles(id) on delete set null;
create index if not exists prospect_discovery_runs_started_idx on public.prospect_discovery_runs(started_at desc);

-- ---------------------------------------------------------------------------
-- Procurement / source evidence (many records -> one prospect)
-- ---------------------------------------------------------------------------

create table if not exists public.prospect_source_records (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  source_id uuid not null references public.prospect_sources(id) on delete restrict,
  source_record_id text not null,
  record_type text not null default 'award' check (record_type in ('award','tender','directory','website','import','manual')),
  ocid text,
  tender_reference text,
  tender_title text,
  tender_description text,
  tender_category text,
  tender_status text,
  buyer_name text,
  award_status text,
  award_value numeric(18,2),
  award_currency text,
  award_date timestamptz,
  supplier_name text,
  supplier_size text,
  province text,
  source_url text,
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source_id, source_record_id)
);
create index if not exists prospect_source_records_prospect_idx on public.prospect_source_records(prospect_id, award_date desc);

create or replace function public.refresh_prospect_procurement_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prospect uuid := coalesce(new.prospect_id, old.prospect_id);
begin
  update public.prospects p set
    procurement_record_count = s.cnt,
    first_procurement_at = s.first_at,
    last_procurement_at = s.last_at,
    total_award_value = s.total_value,
    supplier_size = coalesce(p.supplier_size, s.size)
  from (
    select count(*) filter (where record_type = 'award') cnt,
           min(coalesce(award_date, first_seen_at)) filter (where record_type = 'award') first_at,
           max(coalesce(award_date, first_seen_at)) filter (where record_type = 'award') last_at,
           sum(award_value) filter (where record_type = 'award') total_value,
           (array_agg(supplier_size order by last_seen_at desc) filter (where supplier_size is not null))[1] size
    from public.prospect_source_records where prospect_id = v_prospect
  ) s
  where p.id = v_prospect;
  return null;
end;
$$;
drop trigger if exists prospect_source_records_stats on public.prospect_source_records;
create trigger prospect_source_records_stats after insert or update or delete on public.prospect_source_records
  for each row execute function public.refresh_prospect_procurement_stats();

-- ---------------------------------------------------------------------------
-- Possible duplicates (flagged for human review, never auto-merged)
-- ---------------------------------------------------------------------------

create table if not exists public.prospect_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  candidate_prospect_id uuid not null references public.prospects(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','dismissed','merged')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (prospect_id <> candidate_prospect_id),
  unique (prospect_id, candidate_prospect_id)
);
create index if not exists prospect_duplicate_candidates_pending_idx on public.prospect_duplicate_candidates(status) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Marketing suppression list (prospect outreach only - never consulted for
-- transactional/client service email)
-- ---------------------------------------------------------------------------

create table if not exists public.prospect_email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text not null check (reason in ('unsubscribed','do_not_contact','invalid_email','hard_bounce','manually_blocked','complaint','converted_client')),
  prospect_id uuid references public.prospects(id) on delete set null,
  campaign_id uuid,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id) on delete set null,
  lift_reason text
);
create unique index if not exists prospect_email_suppressions_active_unique
  on public.prospect_email_suppressions(lower(email)) where lifted_at is null;

create or replace function public.is_prospect_email_suppressed(p_email text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select reason from public.prospect_email_suppressions
  where lower(email) = lower(trim(p_email)) and lifted_at is null
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table if not exists public.prospect_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  prospect_id uuid references public.prospects(id) on delete set null,
  campaign_id uuid references public.prospect_campaigns(id) on delete set null,
  source_id uuid references public.prospect_sources(id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists prospect_audit_log_prospect_idx on public.prospect_audit_log(prospect_id, created_at desc);
create index if not exists prospect_audit_log_campaign_idx on public.prospect_audit_log(campaign_id, created_at desc);
create index if not exists prospect_audit_log_created_idx on public.prospect_audit_log(created_at desc);

create or replace function public.log_prospect_audit(
  p_action text, p_prospect_id uuid, p_campaign_id uuid, p_old jsonb, p_new jsonb, p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.prospect_audit_log (actor_id, action, prospect_id, campaign_id, old_values, new_values, metadata)
  values (auth.uid(), p_action, p_prospect_id, p_campaign_id, p_old, p_new, coalesce(p_metadata, '{}'::jsonb));
$$;
revoke all on function public.log_prospect_audit(text, uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Activity + follow-up enrichments
-- ---------------------------------------------------------------------------

alter table public.prospect_activities drop constraint if exists prospect_activities_activity_type_check;
alter table public.prospect_activities add constraint prospect_activities_activity_type_check
  check (activity_type in ('call','email','whatsapp','meeting','note','status_change','campaign','system',
                           'discovery','enrichment','follow_up','assignment','lead','conversion','reply','suppression'));

alter table public.prospect_follow_ups
  add column if not exists priority text not null default 'medium',
  add column if not exists task_type text not null default 'call',
  add column if not exists notes text,
  add column if not exists completed_by uuid references public.profiles(id) on delete set null,
  add column if not exists outcome text;
alter table public.prospect_follow_ups drop constraint if exists prospect_follow_ups_priority_check;
alter table public.prospect_follow_ups add constraint prospect_follow_ups_priority_check check (priority in ('low','medium','high','urgent'));
alter table public.prospect_follow_ups drop constraint if exists prospect_follow_ups_task_type_check;
alter table public.prospect_follow_ups add constraint prospect_follow_ups_task_type_check
  check (task_type in ('call','email','whatsapp','meeting','quote','other'));
create index if not exists prospect_follow_ups_assigned_idx on public.prospect_follow_ups(assigned_to, status, due_at);
create index if not exists prospect_follow_ups_prospect_idx on public.prospect_follow_ups(prospect_id, due_at);

-- Keep prospects.next_follow_up_at in sync with the earliest open follow-up.
create or replace function public.sync_prospect_next_follow_up()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prospect uuid := coalesce(new.prospect_id, old.prospect_id);
begin
  update public.prospects set next_follow_up_at = (
    select min(due_at) from public.prospect_follow_ups where prospect_id = v_prospect and status = 'open'
  ) where id = v_prospect;
  return null;
end;
$$;
drop trigger if exists prospect_follow_ups_sync_next on public.prospect_follow_ups;
create trigger prospect_follow_ups_sync_next after insert or update or delete on public.prospect_follow_ups
  for each row execute function public.sync_prospect_next_follow_up();

-- Automatic timeline + audit for stage, assignment, suppression and contact edits.
create or replace function public.prospects_after_update_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_actor uuid := auth.uid();
begin
  if new.status is distinct from old.status then
    v_old := v_old || jsonb_build_object('status', old.status); v_new := v_new || jsonb_build_object('status', new.status);
    insert into public.prospect_activities (prospect_id, activity_type, summary, performed_by, metadata)
    values (new.id, 'status_change', format('Stage changed from %s to %s', replace(old.status,'_',' '), replace(new.status,'_',' ')), v_actor,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    v_old := v_old || jsonb_build_object('assigned_to', old.assigned_to); v_new := v_new || jsonb_build_object('assigned_to', new.assigned_to);
    insert into public.prospect_activities (prospect_id, activity_type, summary, performed_by, metadata)
    values (new.id, 'assignment',
            case when new.assigned_to is null then 'Unassigned'
                 else 'Assigned to ' || coalesce((select full_name from public.profiles where id = new.assigned_to), 'staff member') end,
            v_actor, jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to));
  end if;
  if new.do_not_contact is distinct from old.do_not_contact then
    v_old := v_old || jsonb_build_object('do_not_contact', old.do_not_contact); v_new := v_new || jsonb_build_object('do_not_contact', new.do_not_contact);
    insert into public.prospect_activities (prospect_id, activity_type, summary, performed_by, metadata)
    values (new.id, 'suppression', case when new.do_not_contact then 'Marked do-not-contact' else 'Do-not-contact removed' end, v_actor,
            jsonb_build_object('reason', new.opt_out_reason));
  end if;
  if v_actor is not null then
    if new.email is distinct from old.email then v_old := v_old || jsonb_build_object('email', old.email); v_new := v_new || jsonb_build_object('email', new.email); end if;
    if new.phone is distinct from old.phone then v_old := v_old || jsonb_build_object('phone', old.phone); v_new := v_new || jsonb_build_object('phone', new.phone); end if;
    if new.website is distinct from old.website then v_old := v_old || jsonb_build_object('website', old.website); v_new := v_new || jsonb_build_object('website', new.website); end if;
    if new.company_name is distinct from old.company_name then v_old := v_old || jsonb_build_object('company_name', old.company_name); v_new := v_new || jsonb_build_object('company_name', new.company_name); end if;
    if new.registration_number is distinct from old.registration_number then v_old := v_old || jsonb_build_object('registration_number', old.registration_number); v_new := v_new || jsonb_build_object('registration_number', new.registration_number); end if;
  end if;
  if v_new <> '{}'::jsonb then
    insert into public.prospect_audit_log (actor_id, action, prospect_id, old_values, new_values)
    values (v_actor, case when v_actor is null then 'prospect.system_update' else 'prospect.update' end, new.id, v_old, v_new);
  end if;
  return null;
end;
$$;
drop trigger if exists prospects_after_update_audit on public.prospects;
create trigger prospects_after_update_audit after update on public.prospects
  for each row execute function public.prospects_after_update_audit();

-- ---------------------------------------------------------------------------
-- Campaign queue columns
-- ---------------------------------------------------------------------------

alter table public.prospect_campaigns drop constraint if exists prospect_campaigns_status_check;
alter table public.prospect_campaigns add constraint prospect_campaigns_status_check
  check (status in ('draft','ready','queued','sending','paused','completed','cancelled','failed'));
alter table public.prospect_campaigns
  add column if not exists description text,
  add column if not exists filters jsonb not null default '{}'::jsonb,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists queued_by uuid references public.profiles(id) on delete set null,
  add column if not exists queued_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists skipped_count integer not null default 0,
  add column if not exists unsubscribed_count integer not null default 0,
  add column if not exists last_error text;

alter table public.prospect_campaign_recipients drop constraint if exists prospect_campaign_recipients_status_check;
alter table public.prospect_campaign_recipients add constraint prospect_campaign_recipients_status_check
  check (status in ('pending','queued','sending','sent','delivered','opened','replied','bounced','failed','skipped','unsubscribed'));
alter table public.prospect_campaign_recipients
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists skip_reason text,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid(),
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists last_event_at timestamptz,
  add column if not exists override_by uuid references public.profiles(id) on delete set null,
  add column if not exists override_reason text,
  add column if not exists rendered_subject text,
  add column if not exists rendered_body_text text;
create unique index if not exists prospect_campaign_recipients_unsubscribe_token_idx on public.prospect_campaign_recipients(unsubscribe_token);
create unique index if not exists prospect_campaign_recipients_provider_msg_idx on public.prospect_campaign_recipients(provider_message_id) where provider_message_id is not null;
create index if not exists prospect_campaign_recipients_queue_idx on public.prospect_campaign_recipients(status, next_attempt_at) where status in ('queued','sending');
create index if not exists prospect_campaign_recipients_prospect_idx on public.prospect_campaign_recipients(prospect_id, sent_at desc);
create index if not exists prospect_campaign_recipients_email_idx on public.prospect_campaign_recipients(lower(email));

create table if not exists public.prospect_campaign_settings (
  id uuid primary key default gen_random_uuid(),
  sending_enabled boolean not null default false,
  batch_size integer not null default 20 check (batch_size between 1 and 100),
  daily_limit integer not null default 200 check (daily_limit between 1 and 5000),
  min_days_between_contact integer not null default 30 check (min_days_between_contact between 0 and 365),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  from_name text not null default 'Acapolite Consulting',
  reply_to text,
  mailtrap_stream text not null default 'transactional' check (mailtrap_stream in ('transactional','bulk')),
  footer_text text not null default 'Acapolite Consulting (Pty) Ltd · Pretoria, Gauteng, South Africa · acapoliteconsulting.co.za',
  unsubscribe_base_url text not null default 'https://acapoliteconsulting.co.za/unsubscribe',
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists prospect_campaign_settings_set_updated_at on public.prospect_campaign_settings;
create trigger prospect_campaign_settings_set_updated_at before update on public.prospect_campaign_settings
  for each row execute function public.update_updated_at_column();
insert into public.prospect_campaign_settings (sending_enabled)
select false where not exists (select 1 from public.prospect_campaign_settings);

alter table public.prospect_email_templates
  add column if not exists description text;

-- ---------------------------------------------------------------------------
-- RLS for new tables and tightened writes on campaign tables
-- ---------------------------------------------------------------------------

alter table public.prospect_sources enable row level security;
alter table public.prospect_source_records enable row level security;
alter table public.prospect_duplicate_candidates enable row level security;
alter table public.prospect_email_suppressions enable row level security;
alter table public.prospect_audit_log enable row level security;
alter table public.prospect_campaign_settings enable row level security;

grant select, update on public.prospect_sources to authenticated;
grant select on public.prospect_source_records to authenticated;
grant select, update on public.prospect_duplicate_candidates to authenticated;
grant select on public.prospect_email_suppressions to authenticated;
grant select on public.prospect_audit_log to authenticated;
grant select, update on public.prospect_campaign_settings to authenticated;

drop policy if exists prospect_sources_select_staff on public.prospect_sources;
create policy prospect_sources_select_staff on public.prospect_sources for select to authenticated using (public.can_view_prospect_hub());
drop policy if exists prospect_sources_update_staff on public.prospect_sources;
create policy prospect_sources_update_staff on public.prospect_sources for update to authenticated
  using (public.can_manage_prospect_hub()) with check (public.can_manage_prospect_hub());

drop policy if exists prospect_source_records_select_staff on public.prospect_source_records;
create policy prospect_source_records_select_staff on public.prospect_source_records for select to authenticated using (public.can_view_prospect_hub());

drop policy if exists prospect_duplicate_candidates_select_staff on public.prospect_duplicate_candidates;
create policy prospect_duplicate_candidates_select_staff on public.prospect_duplicate_candidates for select to authenticated using (public.can_view_prospect_hub());
drop policy if exists prospect_duplicate_candidates_update_staff on public.prospect_duplicate_candidates;
create policy prospect_duplicate_candidates_update_staff on public.prospect_duplicate_candidates for update to authenticated
  using (public.can_manage_prospect_hub()) with check (public.can_manage_prospect_hub());

drop policy if exists prospect_email_suppressions_select_staff on public.prospect_email_suppressions;
create policy prospect_email_suppressions_select_staff on public.prospect_email_suppressions for select to authenticated using (public.can_view_prospect_hub());

drop policy if exists prospect_audit_log_select_staff on public.prospect_audit_log;
create policy prospect_audit_log_select_staff on public.prospect_audit_log for select to authenticated using (public.can_view_prospect_hub());

drop policy if exists prospect_campaign_settings_select_staff on public.prospect_campaign_settings;
create policy prospect_campaign_settings_select_staff on public.prospect_campaign_settings for select to authenticated using (public.can_view_prospect_hub());
-- Only admins change sending limits / enable sending.
drop policy if exists prospect_campaign_settings_update_admin on public.prospect_campaign_settings;
create policy prospect_campaign_settings_update_admin on public.prospect_campaign_settings for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'::public.app_role))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'::public.app_role));

-- Discovery settings remain editable by Prospect Hub managers.
drop policy if exists prospect_discovery_settings_update_staff on public.prospect_discovery_settings;
create policy prospect_discovery_settings_update_staff on public.prospect_discovery_settings for update to authenticated
  using (public.can_manage_prospect_hub()) with check (public.can_manage_prospect_hub());

-- Campaign recipients are written only through SECURITY DEFINER RPCs and
-- the queue worker, so eligibility/suppression checks cannot be bypassed via
-- the REST API.
drop policy if exists "prospect_campaign_recipients_write_staff" on public.prospect_campaign_recipients;
revoke insert, update, delete on public.prospect_campaign_recipients from authenticated;

-- Campaign rows: drafts may be created/edited by managers or senders, but
-- status transitions into the send pipeline only happen via RPC.
drop policy if exists "prospect_campaigns_write_staff" on public.prospect_campaigns;
drop policy if exists prospect_campaigns_insert_staff on public.prospect_campaigns;
create policy prospect_campaigns_insert_staff on public.prospect_campaigns for insert to authenticated
  with check ((public.can_manage_prospect_hub() or public.can_send_prospect_campaigns()) and status = 'draft');
drop policy if exists prospect_campaigns_update_staff on public.prospect_campaigns;
create policy prospect_campaigns_update_staff on public.prospect_campaigns for update to authenticated
  using ((public.can_manage_prospect_hub() or public.can_send_prospect_campaigns()) and status in ('draft','ready'))
  with check ((public.can_manage_prospect_hub() or public.can_send_prospect_campaigns()) and status in ('draft','ready'));
drop policy if exists prospect_campaigns_delete_staff on public.prospect_campaigns;
create policy prospect_campaigns_delete_staff on public.prospect_campaigns for delete to authenticated
  using ((public.can_manage_prospect_hub() or public.can_send_prospect_campaigns()) and status = 'draft');

-- Templates: managers/senders create and edit.
drop policy if exists "prospect_email_templates_write_staff" on public.prospect_email_templates;
drop policy if exists prospect_email_templates_write_staff on public.prospect_email_templates;
create policy prospect_email_templates_write_staff on public.prospect_email_templates for all to authenticated
  using (public.can_manage_prospect_hub() or public.can_send_prospect_campaigns())
  with check (public.can_manage_prospect_hub() or public.can_send_prospect_campaigns());

-- Activities are append-only history for staff (no edits or deletes of
-- another person's record through the API).
drop policy if exists "prospect_activities_write_staff" on public.prospect_activities;
drop policy if exists prospect_activities_insert_staff on public.prospect_activities;
create policy prospect_activities_insert_staff on public.prospect_activities for insert to authenticated
  with check (public.can_manage_prospect_hub() and performed_by = (select auth.uid()));
revoke update, delete on public.prospect_activities from authenticated;

drop policy if exists "prospect_notes_write_staff" on public.prospect_notes;
drop policy if exists prospect_notes_insert_staff on public.prospect_notes;
create policy prospect_notes_insert_staff on public.prospect_notes for insert to authenticated
  with check (public.can_manage_prospect_hub() and created_by = (select auth.uid()));
revoke update, delete on public.prospect_notes from authenticated;

-- Prospect deletes are admin-only (history must not disappear casually).
drop policy if exists "prospects_delete_staff" on public.prospects;
drop policy if exists prospects_delete_admin on public.prospects;
create policy prospects_delete_admin on public.prospects for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'::public.app_role));

-- Nothing in Prospect Hub is visible to anonymous users.
revoke all on public.prospects, public.prospect_contacts, public.prospect_notes, public.prospect_activities,
  public.prospect_follow_ups, public.prospect_email_templates, public.prospect_campaigns,
  public.prospect_campaign_recipients, public.prospect_discovery_runs, public.prospect_discovery_settings,
  public.prospect_enrichment_runs, public.prospect_enrichment_settings, public.prospect_sources,
  public.prospect_source_records, public.prospect_duplicate_candidates, public.prospect_email_suppressions,
  public.prospect_audit_log, public.prospect_campaign_settings
from anon;
