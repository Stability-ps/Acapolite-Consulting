with reopened_from_expired as (
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
    and exists (
      select 1
      from public.service_request_lifecycle_history history
      where history.service_request_id = sr.id
        and history.event_type = 'client_confirmation_timeout'
    )
  returning sr.id, sr.lifecycle_reactivation_count
),
reopened_from_hidden_restart as (
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
    and exists (
      select 1
      from public.service_request_lifecycle_history history
      where history.service_request_id = sr.id
        and history.event_type in (
          'client_confirmation_timeout_restart',
          'policy_restart_from_timeout'
        )
    )
  returning sr.id, sr.lifecycle_reactivation_count
),
all_reopened as (
  select id, lifecycle_reactivation_count
  from reopened_from_expired
  union all
  select id, lifecycle_reactivation_count
  from reopened_from_hidden_restart
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
  'policy_reopened_to_open_marketplace',
  'Lead reopened in Open Marketplace so previously timed-out confirmation leads become visible again.',
  jsonb_build_object('reactivation_count', all_reopened.lifecycle_reactivation_count)
from all_reopened;
