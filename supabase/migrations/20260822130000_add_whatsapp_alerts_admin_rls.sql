-- whatsapp_alerts had row level security enabled (see
-- 20260817194500_add_whatsapp_inbox_alerts_and_reporting.sql) but no policy
-- was ever added for it, so it was fully locked to every role including
-- admin staff. This went unnoticed because whatsapp-qa-feed reads/writes it
-- with the service role key, which bypasses RLS - but Supabase Realtime
-- postgres_changes always evaluates RLS as the connected browser user, so no
-- realtime alert event could ever reach the WhatsApp QA dashboard.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_alerts'
      and policyname = 'whatsapp_alerts_admin_select'
  ) then
    create policy "whatsapp_alerts_admin_select"
    on public.whatsapp_alerts
    for select
    to authenticated
    using (public.get_my_role() = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_alerts'
      and policyname = 'whatsapp_alerts_admin_update'
  ) then
    create policy "whatsapp_alerts_admin_update"
    on public.whatsapp_alerts
    for update
    to authenticated
    using (public.get_my_role() = 'admin')
    with check (public.get_my_role() = 'admin');
  end if;
end
$$;
