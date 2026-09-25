-- Prospect Hub schedules (all times UTC; SAST = UTC+2).
--
-- The eTenders OCDS API is slow (15-35 s per request) and intermittently
-- returns HTTP 500, so one run per day cannot keep up. Discovery and
-- enrichment therefore run four times each morning; every run resumes from
-- where the previous one stopped and is idempotent.
--   discovery   02:15, 03:15, 04:15, 05:15 UTC  (04:15-07:15 SAST)
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

select cron.schedule('prospect-hub-daily-discovery', '15 2-5 * * *', $$
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

update public.prospect_sources set schedule_cron = '15 2-5 * * *', schedule_description = 'Daily 04:15, 05:15, 06:15, 07:15 SAST (resumable catch-up runs)'
where key = 'etenders_ocds';
update public.prospect_sources set schedule_cron = '45 2-5 * * *', schedule_description = 'Daily 04:45, 05:45, 06:45, 07:45 SAST'
where key = 'public_websites';
