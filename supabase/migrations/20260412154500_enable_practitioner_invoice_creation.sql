update public.staff_permissions
set can_manage_invoices = true,
    updated_at = now()
where profile_id in (
  select id
  from public.profiles
  where role = 'consultant'
);
