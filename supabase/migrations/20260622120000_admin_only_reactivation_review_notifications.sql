-- Reactivation-review threshold alerts are operational admin review items.
-- They should not be delivered to practitioner/consultant notification feeds.

delete from public.notifications notification
using public.profiles recipient
where notification.recipient_profile_id = recipient.id
  and recipient.role = 'consultant'::public.app_role
  and notification.section = 'requests'
  and notification.entity_type = 'service_request'
  and (
    notification.category = 'lead_reactivated'
    or notification.title in ('Lead reactivated', 'Lead reactivated by client confirmation')
    or notification.body ilike '%reactivated and returned%'
  );

delete from public.notifications notification
using public.profiles recipient
where notification.recipient_profile_id = recipient.id
  and recipient.role <> 'admin'::public.app_role
  and notification.section = 'requests'
  and notification.entity_type = 'service_request'
  and (
    notification.category = 'lead_reactivation_review'
    or notification.title = 'Lead needs reactivation review'
    or notification.body ilike '%repeated reactivation threshold%'
  );

create or replace function public.suppress_non_admin_reactivation_review_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_role public.app_role;
begin
  if new.section = 'requests'
    and new.entity_type = 'service_request'
    and (
      new.category = 'lead_reactivation_review'
      or new.title = 'Lead needs reactivation review'
      or new.body ilike '%repeated reactivation threshold%'
    )
  then
    select role
    into v_recipient_role
    from public.profiles
    where id = new.recipient_profile_id;

    if v_recipient_role is distinct from 'admin'::public.app_role then
      return null;
    end if;
  end if;

  if new.section = 'requests'
    and new.entity_type = 'service_request'
    and (
      new.category = 'lead_reactivated'
      or new.title in ('Lead reactivated', 'Lead reactivated by client confirmation')
      or new.body ilike '%reactivated and returned%'
    )
  then
    select role
    into v_recipient_role
    from public.profiles
    where id = new.recipient_profile_id;

    if v_recipient_role = 'consultant'::public.app_role then
      return null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_suppress_non_admin_reactivation_review_notifications on public.notifications;
create trigger trg_suppress_non_admin_reactivation_review_notifications
before insert on public.notifications
for each row execute function public.suppress_non_admin_reactivation_review_notifications();
