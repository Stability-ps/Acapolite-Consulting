update public.profiles p
set is_active = false
from public.practitioner_profiles pp
where p.id = pp.profile_id
  and p.role = 'consultant'
  and coalesce(pp.is_verified, false) = false;

update public.profiles p
set is_active = true
from public.practitioner_profiles pp
where p.id = pp.profile_id
  and p.role = 'consultant'
  and coalesce(pp.is_verified, false) = true;
