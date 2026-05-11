delete from public.notifications n
using public.profiles p
where p.id = n.recipient_profile_id
  and p.role = 'consultant'
  and n.section = 'documents'
  and n.category = 'document_uploaded'
  and coalesce(n.metadata ->> 'assigned_practitioner_id', '') <> n.recipient_profile_id::text;

delete from public.notifications n
using public.profiles p
where p.id = n.recipient_profile_id
  and p.role = 'consultant'
  and n.section = 'documents'
  and n.category = 'document_status_changed';
