alter table public.staff_permissions
  add column if not exists can_use_tax_coach_ai boolean not null default false;

-- Administrators are unrestricted. Existing and future practitioners remain
-- opted out until an administrator explicitly enables Tax Coach AI for them.
update public.staff_permissions sp
set can_use_tax_coach_ai = true
from public.profiles p
where p.id = sp.profile_id
  and p.role = 'admin'
  and sp.can_use_tax_coach_ai = false;
