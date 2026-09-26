-- Prospect Hub public-website enrichment: run history, settings and the
-- daily schedule (02:45 UTC = 04:45 SAST, 30 minutes after discovery).
-- Written to be idempotent: production already has these objects from the
-- original rollout, so every statement tolerates re-application.

create table if not exists public.prospect_enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'scheduled' check (run_type in ('scheduled','manual')),
  status text not null default 'running' check (status in ('running','completed','failed','partial')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  prospects_checked integer not null default 0,
  websites_fetched integer not null default 0,
  emails_found integer not null default 0,
  phones_found integer not null default 0,
  prospects_updated integer not null default 0,
  skipped integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);
alter table public.prospect_enrichment_runs enable row level security;
grant select on public.prospect_enrichment_runs to authenticated;
drop policy if exists prospect_enrichment_runs_select_staff on public.prospect_enrichment_runs;
create policy prospect_enrichment_runs_select_staff on public.prospect_enrichment_runs
  for select to authenticated using (public.can_view_prospect_hub());
create index if not exists prospect_enrichment_runs_started_idx on public.prospect_enrichment_runs(started_at desc);

alter table public.prospects add column if not exists enrichment_status text not null default 'pending';
alter table public.prospects add column if not exists enrichment_error text;
alter table public.prospects add column if not exists enrichment_source_url text;
alter table public.prospects add column if not exists enrichment_checked_at timestamptz;
create index if not exists prospects_enrichment_queue_idx on public.prospects(enrichment_status, enrichment_checked_at);

create table if not exists public.prospect_enrichment_settings (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  batch_size integer not null default 8 check (batch_size between 1 and 25),
  recheck_days integer not null default 14 check (recheck_days between 1 and 90),
  use_openai_web_search boolean not null default true,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.prospect_enrichment_settings enable row level security;
grant select, update on public.prospect_enrichment_settings to authenticated;
drop policy if exists prospect_enrichment_settings_select_staff on public.prospect_enrichment_settings;
create policy prospect_enrichment_settings_select_staff on public.prospect_enrichment_settings
  for select to authenticated using (public.can_view_prospect_hub());
drop policy if exists prospect_enrichment_settings_update_staff on public.prospect_enrichment_settings;
create policy prospect_enrichment_settings_update_staff on public.prospect_enrichment_settings
  for update to authenticated using (public.can_manage_prospect_hub()) with check (public.can_manage_prospect_hub());
drop trigger if exists prospect_enrichment_settings_set_updated_at on public.prospect_enrichment_settings;
create trigger prospect_enrichment_settings_set_updated_at before update on public.prospect_enrichment_settings
  for each row execute function public.update_updated_at_column();
insert into public.prospect_enrichment_settings (enabled)
select true where not exists (select 1 from public.prospect_enrichment_settings);

do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname = 'prospect-hub-web-enrichment' limit 1;
  if v_job is not null then perform cron.unschedule(v_job); end if;
end $$;
select cron.schedule('prospect-hub-web-enrichment', '45 2 * * *', $$
  select net.http_post(
    url := 'https://frormnagythfpiuzgfkz.supabase.co/functions/v1/prospect-web-enrichment',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='social_cron_secret')),
    body := '{"trigger":"scheduled"}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
