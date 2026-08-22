-- Cron -> Edge Function wiring for the social media scheduler, mirroring
-- the existing service-request-lifecycle-processor pg_cron pattern in this
-- repo, but via pg_net (HTTP) since publishing requires calling the Meta
-- Graph API, which a plain SQL function cannot do.
--
-- The shared secret used to authenticate this call to the edge function is
-- stored in Supabase Vault (social_cron_secret) rather than embedded as
-- plaintext in this migration or in cron.job.command.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'social-media-publish-worker' limit 1;
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
exception
  when undefined_table or invalid_schema_name then
    null;
end
$$;

select cron.schedule(
  'social-media-publish-worker',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://frormnagythfpiuzgfkz.supabase.co/functions/v1/social-publish-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
