alter table public.whatsapp_messages
  drop constraint if exists whatsapp_messages_sender_type_check;

alter table public.whatsapp_messages
  add constraint whatsapp_messages_sender_type_check
  check (sender_type in ('customer', 'ai', 'admin', 'staff', 'system'));
