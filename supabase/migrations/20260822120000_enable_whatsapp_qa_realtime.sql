-- The WhatsApp QA dashboard now subscribes to postgres_changes on these
-- tables so the feed refreshes as soon as an inbound message, AI reply, or
-- service request creation lands, instead of waiting on the poll interval
-- or a manual refresh. Realtime only broadcasts changes for tables added to
-- the supabase_realtime publication, so make sure all three are in it.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'whatsapp_conversations'
  ) then
    alter publication supabase_realtime add table public.whatsapp_conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'whatsapp_messages'
  ) then
    alter publication supabase_realtime add table public.whatsapp_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'whatsapp_alerts'
  ) then
    alter publication supabase_realtime add table public.whatsapp_alerts;
  end if;
end $$;
