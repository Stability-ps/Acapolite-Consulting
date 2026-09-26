create table if not exists public.prospect_discovery_runs (
 id uuid primary key default gen_random_uuid(), source_name text not null,
 run_type text not null default 'scheduled' check(run_type in ('scheduled','manual')),
 status text not null default 'running' check(status in ('running','completed','failed','partial')),
 started_at timestamptz not null default now(), completed_at timestamptz,
 records_fetched integer not null default 0, suppliers_seen integer not null default 0,
 prospects_created integer not null default 0, prospects_updated integer not null default 0,
 skipped integer not null default 0, error_message text, metadata jsonb not null default '{}'::jsonb
);
alter table public.prospect_discovery_runs enable row level security;
grant select on public.prospect_discovery_runs to authenticated;
create policy prospect_discovery_runs_select_staff on public.prospect_discovery_runs for select to authenticated using(public.can_view_prospect_hub());

create table if not exists public.prospect_discovery_settings (
 id uuid primary key default gen_random_uuid(), source_name text not null unique, enabled boolean not null default true,
 provinces text[] not null default array['Gauteng']::text[],
 target_sectors text[] not null default array['Construction','Engineering','Security','Cleaning','Transport','Logistics','IT','Catering','Maintenance']::text[],
 page_size integer not null default 100 check(page_size between 10 and 100),
 pages_per_run integer not null default 1 check(pages_per_run between 1 and 10),
 next_page integer not null default 1 check(next_page >= 1), last_run_at timestamptz, last_success_at timestamptz,
 last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.prospect_discovery_settings enable row level security;
grant select,update on public.prospect_discovery_settings to authenticated;
create policy prospect_discovery_settings_select_staff on public.prospect_discovery_settings for select to authenticated using(public.can_view_prospect_hub());
create policy prospect_discovery_settings_update_staff on public.prospect_discovery_settings for update to authenticated using(public.can_manage_prospect_hub()) with check(public.can_manage_prospect_hub());
create trigger prospect_discovery_settings_set_updated_at before update on public.prospect_discovery_settings for each row execute function public.update_updated_at_column();
insert into public.prospect_discovery_settings(source_name,pages_per_run) values ('National Treasury eTenders OCDS',1) on conflict(source_name) do nothing;
create unique index if not exists prospects_source_url_unique on public.prospects(source_url) where source_url is not null;

do $$ declare v_job_id bigint; begin
 select jobid into v_job_id from cron.job where jobname='prospect-hub-daily-discovery' limit 1;
 if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end $$;
select cron.schedule('prospect-hub-daily-discovery','15 2 * * *',$$
 select net.http_post(
  url := 'https://frormnagythfpiuzgfkz.supabase.co/functions/v1/prospect-discovery-sync',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='social_cron_secret')),
  body := '{"trigger":"scheduled"}'::jsonb, timeout_milliseconds := 30000
 );
$$);
