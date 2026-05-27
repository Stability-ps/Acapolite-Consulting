with ranked_logs as (
  select
    id,
    row_number() over (
      partition by
        notification_type,
        recipient_email,
        (metadata ->> 'notification_key')
      order by created_at asc, id asc
    ) as row_num
  from public.email_notification_logs
  where metadata ? 'notification_key'
)
delete from public.email_notification_logs
where id in (
  select id
  from ranked_logs
  where row_num > 1
);

create unique index if not exists email_notification_logs_notification_key_unique_idx
  on public.email_notification_logs (
    notification_type,
    recipient_email,
    (metadata ->> 'notification_key')
  )
  where metadata ? 'notification_key';
