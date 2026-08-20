alter table public.whatsapp_staff_actions
  drop constraint if exists whatsapp_staff_actions_action_check;

alter table public.whatsapp_staff_actions
  add constraint whatsapp_staff_actions_action_check
    check (action in (
      'assigned',
      'reassigned',
      'staff_reply',
      'returned_to_ai',
      'resolved',
      'reopened',
      'marked_waiting',
      'service_request_created',
      'service_request_synced'
    ));

comment on constraint whatsapp_staff_actions_action_check on public.whatsapp_staff_actions is
  'Allowed staff-side WhatsApp inbox actions, including manual service request bridge events.';
