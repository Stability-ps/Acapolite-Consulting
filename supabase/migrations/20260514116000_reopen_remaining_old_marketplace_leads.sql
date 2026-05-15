with reopened_expired_leads as (
  update public.service_requests sr
  set
    lifecycle_stage = 'open_marketplace'::public.service_request_lifecycle_stage,
    lifecycle_stage_started_at = now(),
    lifecycle_stage_expires_at = now() + interval '24 hours',
    lifecycle_reactivation_count = greatest(coalesce(sr.lifecycle_reactivation_count, 0), 0) + 1,
    client_confirmation_requested_at = null,
    client_confirmation_due_at = null,
    client_confirmation_answered_at = null,
    status = 'new'::public.service_request_status,
    is_archived = false,
    archive_reason = null,
    archived_at = null,
    expired_at = null,
    updated_at = now()
  where sr.status = 'expired'::public.service_request_status
    and sr.lifecycle_stage = 'expired'::public.service_request_lifecycle_stage
    and coalesce(sr.is_archived, false) = true
    and sr.assigned_practitioner_id is null
    and not exists (
      select 1
      from public.service_request_lifecycle_history history
      where history.service_request_id = sr.id
        and history.event_type = 'client_declined'
    )
  returning sr.id, sr.lifecycle_reactivation_count
),
reopened_hidden_restarts as (
  update public.service_requests sr
  set
    lifecycle_stage = 'open_marketplace'::public.service_request_lifecycle_stage,
    lifecycle_stage_started_at = now(),
    lifecycle_stage_expires_at = now() + interval '24 hours',
    client_confirmation_requested_at = null,
    client_confirmation_due_at = null,
    client_confirmation_answered_at = null,
    updated_at = now()
  where sr.lifecycle_stage in (
      'business_exclusive'::public.service_request_lifecycle_stage,
      'professional_access'::public.service_request_lifecycle_stage
    )
    and sr.status not in (
      'closed'::public.service_request_status,
      'converted_to_client'::public.service_request_status,
      'expired'::public.service_request_status,
      'pending_client_confirmation'::public.service_request_status
    )
    and coalesce(sr.is_archived, false) = false
    and greatest(coalesce(sr.lifecycle_reactivation_count, 0), 0) > 0
  returning sr.id, sr.lifecycle_reactivation_count
),
all_reopened as (
  select id, lifecycle_reactivation_count
  from reopened_expired_leads
  union all
  select id, lifecycle_reactivation_count
  from reopened_hidden_restarts
)
insert into public.service_request_lifecycle_history (
  service_request_id,
  lifecycle_stage,
  event_type,
  note,
  metadata
)
select
  all_reopened.id,
  'open_marketplace'::public.service_request_lifecycle_stage,
  'policy_reopened_remaining_old_leads',
  'Lead reopened in Open Marketplace so older restarted or expired marketplace leads become visible again.',
  jsonb_build_object('reactivation_count', all_reopened.lifecycle_reactivation_count)
from all_reopened;
