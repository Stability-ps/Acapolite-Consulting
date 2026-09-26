-- Reduce public-record discovery frequency so SAFLII/Gazette discovery does not
-- repeatedly hit OpenAI Responses API rate limits. eTenders remains independent.
select cron.unschedule(jobid)
from cron.job
where command ilike '%prospect-public-record-discovery%';

select cron.schedule(
  'prospect-public-record-discovery-hourly',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://frormnagythfpiuzgfkz.supabase.co/functions/v1/prospect-public-record-discovery',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='social_cron_secret' limit 1)
    ),
    body := '{"trigger":"scheduled"}'::jsonb,
    timeout_milliseconds := 180000
  );
  $$
);
