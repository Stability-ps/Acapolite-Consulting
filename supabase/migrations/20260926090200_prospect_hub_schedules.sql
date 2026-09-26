-- Prospect Hub schedules (all times UTC; SAST = UTC+2).
--
-- The eTenders OCDS API is slow (~20 s per 5-release page) and often
-- returns HTTP 500, so a single daily run cannot keep up with the volume of
-- releases. Discovery therefore runs every 20 minutes; each run resumes from
-- a stored day/page cursor and exits immediately (no run logged) once every
-- completed day has been scanned, so the load on the public API stays low.
--   discovery   every 20 minutes (:00, :20, :40 UTC/SAST)
--   enrichment  02:45, 03:45, 04:45, 05:45 UTC  (04:45-07:45 SAST)
--   campaign worker every 5 minutes (sends nothing unless sending is enabled
--   in prospect_campaign_settings AND a campaign has been approved/queued).

do $$
declare v_job bigint;
begin
  for v_job in select jobid from cron.job where jobname in ('prospect-hub-daily-discovery','prospect-hub-web-enrichment','prospect-hub-campaign-worker') loop
    perform cron.unschedule(v_job);
  end loop;
end $$;

select cron.schedule('prospect-hub-daily-discovery', '*/20 * * * *', $$
  select net.http_post(
    url := 'https://frormnagythfpiuzgfkz.supabase.co/functions/v1/prospect-discovery-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='social_cron_secret')),
    body := '{"trigger":"scheduled"}'::jsonb,
    timeout_milliseconds := 150000
  );
$$);

select cron.schedule('prospect-hub-web-enrichment', '45 2-5 * * *', $$
  select net.http_post(
    url := 'https://frormnagythfpiuzgfkz.supabase.co/functions/v1/prospect-web-enrichment',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='social_cron_secret')),
    body := '{"trigger":"scheduled"}'::jsonb,
    timeout_milliseconds := 150000
  );
$$);

select cron.schedule('prospect-hub-campaign-worker', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://frormnagythfpiuzgfkz.supabase.co/functions/v1/prospect-campaign-worker',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='social_cron_secret')),
    body := '{"trigger":"scheduled"}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from public.prospect_campaign_settings where sending_enabled)
    and exists (select 1 from public.prospect_campaigns where status in ('queued','sending'));
$$);

update public.prospect_sources set schedule_cron = '*/20 * * * *', schedule_description = 'Every 20 minutes until caught up (resumable day/page cursor)'
where key = 'etenders_ocds';
update public.prospect_sources set schedule_cron = '45 2-5 * * *', schedule_description = 'Daily 04:45, 05:45, 06:45, 07:45 SAST'
where key = 'public_websites';
