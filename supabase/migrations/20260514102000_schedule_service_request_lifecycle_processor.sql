create extension if not exists pg_cron;

do $$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'service-request-lifecycle-processor'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
exception
  when undefined_table or invalid_schema_name then
    null;
end
$$;

select cron.schedule(
  'service-request-lifecycle-processor',
  '*/5 * * * *',
  $$select public.process_service_request_lifecycles();$$
);

select public.process_service_request_lifecycles();
