alter table public.service_requests
  alter column lifecycle_stage set default 'open_marketplace'::public.service_request_lifecycle_stage;

create or replace function public.get_initial_service_request_lifecycle_stage(
  p_lead_tier public.lead_access_tier
)
returns public.service_request_lifecycle_stage
language sql
stable
as $$
  select 'open_marketplace'::public.service_request_lifecycle_stage
$$;

with reopened_marketplace_leads as (
  update public.service_requests sr
  set
    lifecycle_stage = 'open_marketplace'::public.service_request_lifecycle_stage,
    lifecycle_stage_started_at = now(),
    lifecycle_stage_expires_at = now() + public.get_service_request_lifecycle_stage_duration('open_marketplace'::public.service_request_lifecycle_stage),
    client_confirmation_origin_stage = null,
    updated_at = now()
  where sr.lifecycle_stage in (
      'business_exclusive'::public.service_request_lifecycle_stage,
      'professional_access'::public.service_request_lifecycle_stage
    )
    and coalesce(sr.is_archived, false) = false
    and sr.assigned_practitioner_id is null
    and sr.status not in (
      'closed'::public.service_request_status,
      'converted_to_client'::public.service_request_status,
      'expired'::public.service_request_status,
      'pending_client_confirmation'::public.service_request_status
    )
    and not exists (
      select 1
      from public.service_request_responses responses
      where responses.service_request_id = sr.id
    )
  returning sr.id
)
insert into public.service_request_lifecycle_history (
  service_request_id,
  lifecycle_stage,
  event_type,
  note,
  metadata
)
select
  reopened_marketplace_leads.id,
  'open_marketplace'::public.service_request_lifecycle_stage,
  'policy_default_open_marketplace',
  'Lead moved to Open Marketplace after the default entry policy changed so new leads become visible to all practitioners immediately.',
  jsonb_build_object(
    'lifecycle_stage', 'open_marketplace',
    'policy', 'default_open_marketplace'
  )
from reopened_marketplace_leads;
