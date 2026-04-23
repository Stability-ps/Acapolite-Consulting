update public.staff_permissions sp
set
  can_manage_clients = true,
  updated_at = now()
from public.profiles p
where p.id = sp.profile_id
  and p.role = 'consultant'
  and coalesce(sp.can_manage_clients, false) = false;
