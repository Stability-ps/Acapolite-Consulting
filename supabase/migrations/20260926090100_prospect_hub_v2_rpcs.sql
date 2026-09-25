-- Prospect Hub v2 RPCs. Every user-callable function re-checks Prospect Hub
-- permissions itself (SECURITY DEFINER functions bypass RLS), writes an audit
-- entry for consequential actions, and is idempotent where a double click or
-- retry could otherwise create duplicates.

-- ---------------------------------------------------------------------------
-- Discovery upsert (service role only)
-- ---------------------------------------------------------------------------
-- Match order (first hit wins):
--   1. same source + source supplier id (stable eTenders supplier id)
--   2. normalised registration number
--   3. exact normalised company name
-- Weaker signals (same email / domain / phone with a different name) never
-- merge automatically; they are flagged in prospect_duplicate_candidates.

create or replace function public.upsert_discovered_prospect(
  p_source_key text,
  p_prospect jsonb,
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.prospect_sources%rowtype;
  v_id uuid;
  v_created boolean := false;
  v_name text := trim(p_prospect->>'company_name');
  v_norm text := public.normalize_company_name(p_prospect->>'company_name');
  v_reg text := public.normalize_registration_number(p_prospect->>'registration_number');
  v_supplier text := nullif(p_prospect->>'source_supplier_id', '');
  v_match_reason text;
  v_existing public.prospects%rowtype;
  v_record_new boolean;
begin
  if v_name is null or v_norm is null then
    return jsonb_build_object('status', 'skipped', 'reason', 'missing_company_name');
  end if;
  select * into v_source from public.prospect_sources where key = p_source_key;
  if not found then raise exception 'Unknown prospect source %', p_source_key; end if;

  if v_supplier is not null then
    select id into v_id from public.prospects where source_name = v_source.name and source_supplier_id = v_supplier limit 1;
    if v_id is not null then v_match_reason := 'source_supplier_id'; end if;
  end if;
  if v_id is null and v_reg is not null then
    select id into v_id from public.prospects where public.normalize_registration_number(registration_number) = v_reg limit 1;
    if v_id is not null then v_match_reason := 'registration_number'; end if;
  end if;
  if v_id is null then
    -- Same normalised name but a *different* registration number is two
    -- companies; only merge when registration numbers do not conflict.
    select id into v_id from public.prospects
    where normalized_name = v_norm
      and (v_reg is null or registration_number is null or public.normalize_registration_number(registration_number) = v_reg)
    order by created_at limit 1;
    if v_id is not null then v_match_reason := 'normalized_name'; end if;
  end if;

  if v_id is null then
    insert into public.prospects (
      company_name, registration_number, sector, industry, city, province, source_name, source_url,
      source_record_id, source_supplier_id, source_last_seen_at, supplier_size, status, priority, metadata
    ) values (
      v_name, nullif(p_prospect->>'registration_number', ''), nullif(p_prospect->>'sector', ''),
      nullif(p_prospect->>'industry', ''), nullif(p_prospect->>'city', ''), nullif(p_prospect->>'province', ''),
      v_source.name, nullif(p_prospect->>'source_url', ''), nullif(p_record->>'source_record_id', ''), v_supplier,
      now(), nullif(p_prospect->>'supplier_size', ''), 'new', 'medium',
      coalesce(p_prospect->'metadata', '{}'::jsonb) || jsonb_build_object('discovered_via', p_source_key)
    )
    returning id into v_id;
    v_created := true;
    insert into public.prospect_activities (prospect_id, activity_type, summary, metadata)
    values (v_id, 'discovery', 'Discovered via ' || v_source.name,
            jsonb_build_object('source_key', p_source_key, 'source_record_id', p_record->>'source_record_id',
                               'tender_title', p_record->>'tender_title', 'buyer_name', p_record->>'buyer_name'));
  else
    select * into v_existing from public.prospects where id = v_id;
    -- Only fill gaps; never overwrite staff-entered or verified values.
    update public.prospects set
      registration_number = coalesce(registration_number, nullif(p_prospect->>'registration_number', '')),
      sector = coalesce(sector, nullif(p_prospect->>'sector', '')),
      industry = coalesce(industry, nullif(p_prospect->>'industry', '')),
      city = coalesce(city, nullif(p_prospect->>'city', '')),
      province = coalesce(province, nullif(p_prospect->>'province', '')),
      source_supplier_id = coalesce(source_supplier_id, v_supplier),
      supplier_size = coalesce(supplier_size, nullif(p_prospect->>'supplier_size', '')),
      source_last_seen_at = now()
    where id = v_id;
  end if;

  -- Attach the source record as evidence (idempotent per source record id).
  insert into public.prospect_source_records (
    prospect_id, source_id, source_record_id, record_type, ocid, tender_reference, tender_title,
    tender_description, tender_category, tender_status, buyer_name, award_status, award_value, award_currency,
    award_date, supplier_name, supplier_size, province, source_url, raw
  ) values (
    v_id, v_source.id, p_record->>'source_record_id', coalesce(p_record->>'record_type', 'award'), p_record->>'ocid',
    p_record->>'tender_reference', p_record->>'tender_title', left(p_record->>'tender_description', 2000),
    p_record->>'tender_category', p_record->>'tender_status', p_record->>'buyer_name', p_record->>'award_status',
    nullif(p_record->>'award_value', '')::numeric, p_record->>'award_currency',
    nullif(p_record->>'award_date', '')::timestamptz, p_record->>'supplier_name', p_record->>'supplier_size',
    p_record->>'province', p_record->>'source_url', coalesce(p_record->'raw', '{}'::jsonb)
  )
  on conflict (source_id, source_record_id) do update set last_seen_at = now()
  returning (xmax = 0) into v_record_new;

  -- Flag (never merge) weaker duplicate signals for human review.
  if v_created then
    insert into public.prospect_duplicate_candidates (prospect_id, candidate_prospect_id, reason)
    select v_id, p.id, 'similar_name'
    from public.prospects p
    where p.id <> v_id
      and p.normalized_name is not null
      and length(v_norm) >= 6
      and (p.normalized_name like v_norm || ' %' or v_norm like p.normalized_name || ' %')
    limit 5
    on conflict do nothing;
  end if;

  return jsonb_build_object('status', case when v_created then 'created' else 'updated' end,
                            'prospect_id', v_id, 'match_reason', v_match_reason, 'new_record', coalesce(v_record_new, false));
end;
$$;
revoke all on function public.upsert_discovered_prospect(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_discovered_prospect(text, jsonb, jsonb) to service_role;

-- Flags contact-level duplicates (email/domain/phone shared with another
-- prospect). Called after enrichment/import/manual edits.
create or replace function public.flag_prospect_contact_duplicates(p_prospect_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.prospects%rowtype;
  n integer;
begin
  if auth.uid() is not null and not public.can_manage_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into v from public.prospects where id = p_prospect_id;
  if not found then return 0; end if;
  insert into public.prospect_duplicate_candidates (prospect_id, candidate_prospect_id, reason)
  select v.id, p.id,
    case when v.email is not null and p.email = v.email then 'same_email'
         when v.website_domain is not null and p.website_domain = v.website_domain then 'same_website_domain'
         else 'same_phone' end
  from public.prospects p
  where p.id <> v.id
    and ((v.email is not null and p.email = v.email)
      or (v.website_domain is not null and p.website_domain = v.website_domain)
      or (v.phone is not null and p.phone = v.phone))
    and not exists (select 1 from public.prospect_duplicate_candidates d
                    where (d.prospect_id = p.id and d.candidate_prospect_id = v.id))
  limit 10
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.flag_prospect_contact_duplicates(uuid) from public, anon;
grant execute on function public.flag_prospect_contact_duplicates(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Staff actions
-- ---------------------------------------------------------------------------

create or replace function public.log_prospect_call(
  p_prospect_id uuid,
  p_outcome text,
  p_note text default null,
  p_occurred_at timestamptz default now(),
  p_next_action text default null,
  p_follow_up_at timestamptz default null,
  p_new_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity uuid;
  v_follow uuid;
  v_status text;
begin
  if not public.can_manage_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_outcome is null or p_outcome not in ('no_answer','voicemail','call_back','interested','not_interested','has_accountant','wrong_number','requested_quote','meeting_booked','other') then
    raise exception 'Invalid call outcome';
  end if;
  insert into public.prospect_activities (prospect_id, activity_type, direction, summary, outcome, performed_by, occurred_at, metadata)
  values (p_prospect_id, 'call', 'outbound',
          coalesce(nullif(trim(p_note), ''), 'Call logged: ' || replace(p_outcome, '_', ' ')),
          p_outcome, auth.uid(), coalesce(p_occurred_at, now()),
          jsonb_build_object('next_action', p_next_action, 'follow_up_at', p_follow_up_at))
  returning id into v_activity;

  if p_follow_up_at is not null then
    insert into public.prospect_follow_ups (prospect_id, title, due_at, assigned_to, created_by, task_type, notes)
    values (p_prospect_id, coalesce(nullif(trim(p_next_action), ''), 'Follow up call'), p_follow_up_at, auth.uid(), auth.uid(), 'call', p_note)
    returning id into v_follow;
  end if;

  select status into v_status from public.prospects where id = p_prospect_id;
  update public.prospects set
    last_contacted_at = coalesce(p_occurred_at, now()),
    status = case
      when p_new_status is not null then p_new_status
      when v_status = 'new' then 'contacted'
      when p_follow_up_at is not null and v_status = 'contacted' then 'follow_up'
      else v_status end
  where id = p_prospect_id;
  return v_activity;
end;
$$;
revoke all on function public.log_prospect_call(uuid, text, text, timestamptz, text, timestamptz, text) from public, anon;
grant execute on function public.log_prospect_call(uuid, text, text, timestamptz, text, timestamptz, text) to authenticated;

create or replace function public.bulk_update_prospects(
  p_ids uuid[],
  p_status text default null,
  p_assigned_to uuid default null,
  p_unassign boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.can_manage_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then return 0; end if;
  if array_length(p_ids, 1) > 500 then raise exception 'Bulk updates are limited to 500 prospects'; end if;
  if p_status = 'converted' then raise exception 'Use Convert to Client to convert prospects'; end if;
  if p_assigned_to is not null and not exists (
    select 1 from public.profiles where id = p_assigned_to and role in ('admin','consultant') and is_active
  ) then raise exception 'Assignee must be an active staff member'; end if;
  update public.prospects set
    status = coalesce(p_status, status),
    assigned_to = case when p_unassign then null else coalesce(p_assigned_to, assigned_to) end
  where id = any(p_ids) and status <> 'converted';
  get diagnostics n = row_count;
  perform public.log_prospect_audit('prospect.bulk_update', null, null, null,
    jsonb_build_object('status', p_status, 'assigned_to', p_assigned_to, 'unassign', p_unassign),
    jsonb_build_object('count', n, 'ids', to_jsonb(p_ids)));
  return n;
end;
$$;
revoke all on function public.bulk_update_prospects(uuid[], text, uuid, boolean) from public, anon;
grant execute on function public.bulk_update_prospects(uuid[], text, uuid, boolean) to authenticated;

create or replace function public.set_prospects_do_not_contact(
  p_ids uuid[],
  p_do_not_contact boolean,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  r record;
begin
  if not public.can_manage_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then return 0; end if;
  if array_length(p_ids, 1) > 500 then raise exception 'Bulk updates are limited to 500 prospects'; end if;
  update public.prospects set
    do_not_contact = p_do_not_contact,
    opt_out_reason = case when p_do_not_contact then coalesce(nullif(trim(p_reason), ''), 'Marked do-not-contact by staff') else null end
  where id = any(p_ids);
  get diagnostics n = row_count;
  if p_do_not_contact then
    for r in select id, email from public.prospects where id = any(p_ids) and email is not null loop
      insert into public.prospect_email_suppressions (email, reason, prospect_id, notes, created_by)
      values (r.email, 'do_not_contact', r.id, p_reason, auth.uid())
      on conflict (lower(email)) where lifted_at is null do nothing;
    end loop;
  else
    update public.prospect_email_suppressions s set lifted_at = now(), lifted_by = auth.uid(), lift_reason = coalesce(p_reason, 'Do-not-contact removed')
    where s.lifted_at is null and s.reason in ('do_not_contact','manually_blocked')
      and s.prospect_id = any(p_ids);
  end if;
  perform public.log_prospect_audit(case when p_do_not_contact then 'suppression.add' else 'suppression.lift' end, null, null, null,
    jsonb_build_object('do_not_contact', p_do_not_contact, 'reason', p_reason), jsonb_build_object('count', n, 'ids', to_jsonb(p_ids)));
  return n;
end;
$$;
revoke all on function public.set_prospects_do_not_contact(uuid[], boolean, text) from public, anon;
grant execute on function public.set_prospects_do_not_contact(uuid[], boolean, text) to authenticated;

create or replace function public.add_prospect_suppression(p_email text, p_reason text, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.can_manage_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_email is null or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Invalid email address'; end if;
  if p_reason not in ('do_not_contact','invalid_email','hard_bounce','manually_blocked','complaint','unsubscribed') then raise exception 'Invalid reason'; end if;
  insert into public.prospect_email_suppressions (email, reason, notes, created_by, prospect_id)
  values (lower(trim(p_email)), p_reason, p_notes, auth.uid(), (select id from public.prospects where email = lower(trim(p_email)) limit 1))
  on conflict (lower(email)) where lifted_at is null do nothing
  returning id into v_id;
  perform public.log_prospect_audit('suppression.add', null, null, null, jsonb_build_object('email', lower(trim(p_email)), 'reason', p_reason), '{}'::jsonb);
  return v_id;
end;
$$;
revoke all on function public.add_prospect_suppression(text, text, text) from public, anon;
grant execute on function public.add_prospect_suppression(text, text, text) to authenticated;

-- Lifting a suppression is an admin override (e.g. a recipient asks to
-- receive email again); it is always audited.
create or replace function public.lift_prospect_suppression(p_suppression_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.prospect_email_suppressions%rowtype;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only an admin can lift a suppression' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A reason is required'; end if;
  update public.prospect_email_suppressions set lifted_at = now(), lifted_by = auth.uid(), lift_reason = p_reason
  where id = p_suppression_id and lifted_at is null
  returning * into v_row;
  if not found then raise exception 'Suppression not found or already lifted'; end if;
  perform public.log_prospect_audit('suppression.lift_override', v_row.prospect_id, null, to_jsonb(v_row), jsonb_build_object('reason', p_reason), '{}'::jsonb);
end;
$$;
revoke all on function public.lift_prospect_suppression(uuid, text) from public, anon;
grant execute on function public.lift_prospect_suppression(uuid, text) to authenticated;

create or replace function public.verify_prospect_contact(p_prospect_id uuid, p_field text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_field = 'email' then update public.prospects set email_verified_at = now(), contact_verified_by = auth.uid() where id = p_prospect_id and email is not null;
  elsif p_field = 'phone' then update public.prospects set phone_verified_at = now(), contact_verified_by = auth.uid() where id = p_prospect_id and phone is not null;
  elsif p_field = 'website' then update public.prospects set website_verified_at = now(), contact_verified_by = auth.uid() where id = p_prospect_id and website is not null;
  else raise exception 'Invalid field'; end if;
  perform public.log_prospect_audit('prospect.contact_verified', p_prospect_id, null, null, jsonb_build_object('field', p_field), '{}'::jsonb);
end;
$$;
revoke all on function public.verify_prospect_contact(uuid, text) from public, anon;
grant execute on function public.verify_prospect_contact(uuid, text) to authenticated;

create or replace function public.resolve_prospect_duplicate(p_candidate_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_status not in ('dismissed','merged') then raise exception 'Invalid status'; end if;
  update public.prospect_duplicate_candidates set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_candidate_id and status = 'pending';
end;
$$;
revoke all on function public.resolve_prospect_duplicate(uuid, text) from public, anon;
grant execute on function public.resolve_prospect_duplicate(uuid, text) to authenticated;

-- Merges a confirmed duplicate into the surviving prospect: history,
-- evidence, contacts and campaign membership move across; blank fields are
-- filled from the duplicate; the duplicate is deleted. Admin/manager only.
create or replace function public.merge_prospects(p_keep_id uuid, p_merge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep public.prospects%rowtype;
  v_merge public.prospects%rowtype;
begin
  if not public.can_manage_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_keep_id = p_merge_id then raise exception 'Cannot merge a prospect into itself'; end if;
  select * into v_keep from public.prospects where id = p_keep_id for update;
  select * into v_merge from public.prospects where id = p_merge_id for update;
  if v_keep.id is null or v_merge.id is null then raise exception 'Prospect not found'; end if;
  if v_merge.converted_client_id is not null and v_keep.converted_client_id is not null and v_merge.converted_client_id <> v_keep.converted_client_id then
    raise exception 'Both prospects are linked to different clients';
  end if;
  if v_keep.registration_number is not null and v_merge.registration_number is not null
     and public.normalize_registration_number(v_keep.registration_number) <> public.normalize_registration_number(v_merge.registration_number) then
    raise exception 'Registration numbers differ - these are different companies';
  end if;

  update public.prospect_notes set prospect_id = p_keep_id where prospect_id = p_merge_id;
  update public.prospect_activities set prospect_id = p_keep_id where prospect_id = p_merge_id;
  update public.prospect_follow_ups set prospect_id = p_keep_id where prospect_id = p_merge_id;
  update public.prospect_contacts set prospect_id = p_keep_id where prospect_id = p_merge_id;
  update public.prospect_source_records set prospect_id = p_keep_id where prospect_id = p_merge_id;
  update public.prospect_campaign_recipients r set prospect_id = p_keep_id
    where r.prospect_id = p_merge_id
      and not exists (select 1 from public.prospect_campaign_recipients k where k.campaign_id = r.campaign_id and k.prospect_id = p_keep_id);
  update public.prospect_email_suppressions set prospect_id = p_keep_id where prospect_id = p_merge_id;
  delete from public.prospect_duplicate_candidates where prospect_id = p_merge_id or candidate_prospect_id = p_merge_id;

  -- Clear the unique keys on the duplicate before copying them across.
  update public.prospects set registration_number = null, source_supplier_id = null where id = p_merge_id;
  update public.prospects set
    registration_number = coalesce(v_keep.registration_number, v_merge.registration_number),
    source_supplier_id = coalesce(v_keep.source_supplier_id, v_merge.source_supplier_id),
    email = coalesce(v_keep.email, v_merge.email),
    phone = coalesce(v_keep.phone, v_merge.phone),
    whatsapp = coalesce(v_keep.whatsapp, v_merge.whatsapp),
    website = coalesce(v_keep.website, v_merge.website),
    contact_name = coalesce(v_keep.contact_name, v_merge.contact_name),
    sector = coalesce(v_keep.sector, v_merge.sector),
    city = coalesce(v_keep.city, v_merge.city),
    province = coalesce(v_keep.province, v_merge.province),
    do_not_contact = v_keep.do_not_contact or v_merge.do_not_contact,
    converted_client_id = coalesce(v_keep.converted_client_id, v_merge.converted_client_id)
  where id = p_keep_id;
  perform public.log_prospect_audit('prospect.merge', p_keep_id, null, to_jsonb(v_merge), jsonb_build_object('merged_into', p_keep_id), '{}'::jsonb);
  delete from public.prospects where id = p_merge_id;
  insert into public.prospect_activities (prospect_id, activity_type, summary, performed_by, metadata)
  values (p_keep_id, 'system', 'Merged duplicate prospect "' || v_merge.company_name || '"', auth.uid(), jsonb_build_object('merged_id', p_merge_id));
end;
$$;
revoke all on function public.merge_prospects(uuid, uuid) from public, anon;
grant execute on function public.merge_prospects(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Prospect -> Lead -> Client
-- ---------------------------------------------------------------------------
-- A "lead" is a prospect that staff have qualified. It stays in Prospect Hub
-- (it is deliberately NOT inserted into service_requests, because inserting
-- a service request broadcasts it to external practitioners as a
-- marketplace lead). Conversion to a client uses the existing clients table.

create or replace function public.mark_prospect_as_lead(
  p_prospect_id uuid,
  p_service_interest text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v public.prospects%rowtype;
begin
  if not public.can_manage_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into v from public.prospects where id = p_prospect_id for update;
  if not found then raise exception 'Prospect not found'; end if;
  if v.status = 'converted' then return jsonb_build_object('status', 'already_client', 'client_id', v.converted_client_id); end if;
  if v.lead_at is not null and v.status in ('qualified','consultation') then
    return jsonb_build_object('status', 'already_lead', 'lead_at', v.lead_at);
  end if;
  update public.prospects set
    status = 'qualified',
    lead_at = coalesce(lead_at, now()),
    lead_by = coalesce(lead_by, auth.uid()),
    lead_service_interest = coalesce(nullif(trim(p_service_interest), ''), lead_service_interest)
  where id = p_prospect_id;
  insert into public.prospect_activities (prospect_id, activity_type, summary, performed_by, metadata)
  values (p_prospect_id, 'lead', 'Converted to qualified lead' || coalesce(': ' || nullif(trim(p_service_interest), ''), ''),
          auth.uid(), jsonb_build_object('service_interest', p_service_interest, 'note', p_note));
  if nullif(trim(p_note), '') is not null then
    insert into public.prospect_notes (prospect_id, body, created_by) values (p_prospect_id, p_note, auth.uid());
  end if;
  perform public.log_prospect_audit('prospect.lead', p_prospect_id, null, jsonb_build_object('status', v.status),
    jsonb_build_object('status', 'qualified', 'service_interest', p_service_interest), '{}'::jsonb);
  return jsonb_build_object('status', 'lead', 'prospect_id', p_prospect_id);
end;
$$;
revoke all on function public.mark_prospect_as_lead(uuid, text, text) from public, anon;
grant execute on function public.mark_prospect_as_lead(uuid, text, text) to authenticated;

create or replace function public.find_client_matches_for_prospect(p_prospect_id uuid)
returns table (client_id uuid, display_name text, email text, phone text, company_registration_number text, match_reasons text[])
language plpgsql
stable
security definer
set search_path = public
as $$
declare v public.prospects%rowtype;
begin
  if not public.can_view_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into v from public.prospects where id = p_prospect_id;
  if not found then return; end if;
  return query
  select c.id,
         coalesce(nullif(c.company_name, ''), trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
         c.email, c.phone, c.company_registration_number,
         array_remove(array[
           case when v.registration_number is not null and public.normalize_registration_number(c.company_registration_number) = public.normalize_registration_number(v.registration_number) then 'registration_number' end,
           case when v.normalized_name is not null and public.normalize_company_name(c.company_name) = v.normalized_name then 'company_name' end,
           case when v.email is not null and lower(c.email) = v.email then 'email' end,
           case when v.phone is not null and public.normalize_sa_phone(c.phone) = v.phone then 'phone' end
         ], null)
  from public.clients c
  where not coalesce(c.is_archived, false)
    and ((v.registration_number is not null and public.normalize_registration_number(c.company_registration_number) = public.normalize_registration_number(v.registration_number))
      or (v.normalized_name is not null and public.normalize_company_name(c.company_name) = v.normalized_name)
      or (v.email is not null and lower(c.email) = v.email)
      or (v.phone is not null and public.normalize_sa_phone(c.phone) = v.phone))
  limit 10;
end;
$$;
revoke all on function public.find_client_matches_for_prospect(uuid) from public, anon;
grant execute on function public.find_client_matches_for_prospect(uuid) to authenticated;

-- p_mode: 'check'          -> return matches only, change nothing
--         'link_existing'  -> link prospect to p_existing_client_id
--         'create_new'     -> create a client; refused while matches exist
--                             unless p_confirm_despite_matches is true
create or replace function public.convert_prospect_to_client(
  p_prospect_id uuid,
  p_mode text default 'check',
  p_existing_client_id uuid default null,
  p_confirm_despite_matches boolean default false,
  p_client_type text default 'company'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.prospects%rowtype;
  v_matches jsonb;
  v_client_id uuid;
  v_can_clients boolean;
begin
  if not public.can_manage_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  v_can_clients := exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from public.staff_permissions sp where sp.profile_id = auth.uid() and sp.can_manage_clients);
  select * into v from public.prospects where id = p_prospect_id for update;
  if not found then raise exception 'Prospect not found'; end if;
  if v.converted_client_id is not null then
    return jsonb_build_object('status', 'already_converted', 'client_id', v.converted_client_id);
  end if;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into v_matches from public.find_client_matches_for_prospect(p_prospect_id) m;
  if p_mode = 'check' then
    return jsonb_build_object('status', 'checked', 'matches', v_matches);
  end if;
  if not v_can_clients then raise exception 'You need client-management permission to convert prospects to clients' using errcode = '42501'; end if;

  if p_mode = 'link_existing' then
    if p_existing_client_id is null or not exists (select 1 from public.clients where id = p_existing_client_id) then
      raise exception 'Existing client not found';
    end if;
    v_client_id := p_existing_client_id;
  elsif p_mode = 'create_new' then
    if jsonb_array_length(v_matches) > 0 and not p_confirm_despite_matches then
      return jsonb_build_object('status', 'possible_duplicates', 'matches', v_matches);
    end if;
    if p_client_type not in ('individual','company','trust','npo') then raise exception 'Invalid client type'; end if;
    insert into public.clients (
      client_type, company_name, company_registration_number, email, phone, city, province, country, notes, created_by
    ) values (
      p_client_type, v.company_name, v.registration_number, v.email, v.phone, v.city, v.province,
      coalesce(v.country, 'South Africa'),
      concat_ws(E'\n',
        'Converted from Prospect Hub on ' || to_char(now() at time zone 'Africa/Johannesburg', 'YYYY-MM-DD') || '.',
        'Original source: ' || coalesce(v.source_name, 'manual') || coalesce(' (' || v.source_url || ')', ''),
        case when v.lead_service_interest is not null then 'Service interest: ' || v.lead_service_interest end,
        case when v.website is not null then 'Website: ' || v.website end),
      auth.uid()
    ) returning id into v_client_id;
  else
    raise exception 'Invalid mode';
  end if;

  update public.prospects set
    status = 'converted',
    converted_client_id = v_client_id,
    converted_at = now(),
    converted_by = auth.uid(),
    lead_at = coalesce(lead_at, now()),
    lead_by = coalesce(lead_by, auth.uid())
  where id = p_prospect_id;

  -- Stop cold marketing to a converted client (marketing list only).
  if v.email is not null then
    insert into public.prospect_email_suppressions (email, reason, prospect_id, created_by, notes)
    values (v.email, 'converted_client', v.id, auth.uid(), 'Converted to client - excluded from prospect campaigns')
    on conflict (lower(email)) where lifted_at is null do nothing;
  end if;
  update public.prospect_campaign_recipients set status = 'skipped', skip_reason = 'converted_client'
  where prospect_id = p_prospect_id and status in ('pending','queued');

  insert into public.prospect_activities (prospect_id, activity_type, summary, performed_by, metadata)
  values (p_prospect_id, 'conversion',
          case when p_mode = 'link_existing' then 'Linked to existing client' else 'Converted to new client' end,
          auth.uid(), jsonb_build_object('client_id', v_client_id, 'mode', p_mode, 'matches_overridden', p_confirm_despite_matches and jsonb_array_length(v_matches) > 0));
  perform public.log_prospect_audit('prospect.convert_client', p_prospect_id, null, jsonb_build_object('status', v.status),
    jsonb_build_object('client_id', v_client_id, 'mode', p_mode),
    jsonb_build_object('duplicate_override', p_confirm_despite_matches and jsonb_array_length(v_matches) > 0, 'matches', v_matches));
  return jsonb_build_object('status', 'converted', 'client_id', v_client_id, 'mode', p_mode);
end;
$$;
revoke all on function public.convert_prospect_to_client(uuid, text, uuid, boolean, text) from public, anon;
grant execute on function public.convert_prospect_to_client(uuid, text, uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------

-- Returns the reason a prospect must not receive a marketing email now, or
-- null when sending is allowed. Checked when recipients are added AND again
-- by the worker immediately before each send.
create or replace function public.prospect_campaign_block_reason(
  p_prospect_id uuid,
  p_campaign_id uuid,
  p_ignore_recent_contact boolean default false
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v public.prospects%rowtype;
  v_settings public.prospect_campaign_settings%rowtype;
  v_suppressed text;
begin
  select * into v from public.prospects where id = p_prospect_id;
  if not found then return 'prospect_missing'; end if;
  if v.email is null then return 'no_email'; end if;
  if v.email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return 'invalid_email'; end if;
  if v.do_not_contact then return 'do_not_contact'; end if;
  if v.email_opt_out_at is not null then return 'unsubscribed'; end if;
  if v.status = 'converted' or v.converted_client_id is not null then return 'converted_client'; end if;
  if v.status = 'disqualified' then return 'disqualified'; end if;
  v_suppressed := public.is_prospect_email_suppressed(v.email);
  if v_suppressed is not null then return v_suppressed; end if;
  if exists (select 1 from public.clients c where lower(c.email) = v.email and not coalesce(c.is_archived, false)) then
    return 'existing_client_email';
  end if;
  if exists (select 1 from public.prospect_campaign_recipients r
             where r.campaign_id = p_campaign_id and lower(r.email) = v.email and r.prospect_id <> p_prospect_id
               and r.status not in ('skipped')) then
    return 'duplicate_email_in_campaign';
  end if;
  if not p_ignore_recent_contact then
    select * into v_settings from public.prospect_campaign_settings order by created_at limit 1;
    if coalesce(v_settings.min_days_between_contact, 0) > 0 and exists (
      select 1 from public.prospect_campaign_recipients r
      where (r.prospect_id = p_prospect_id or lower(r.email) = v.email)
        and r.campaign_id <> p_campaign_id
        and r.sent_at is not null
        and r.sent_at > now() - make_interval(days => v_settings.min_days_between_contact)
    ) then
      return 'recently_contacted';
    end if;
  end if;
  return null;
end;
$$;
revoke all on function public.prospect_campaign_block_reason(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.prospect_campaign_block_reason(uuid, uuid, boolean) to service_role;

create or replace function public.refresh_prospect_campaign_counts(p_campaign_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.prospect_campaigns c set
    total_recipients = s.total,
    sent_count = s.sent,
    delivered_count = s.delivered,
    opened_count = s.opened,
    replied_count = s.replied,
    bounced_count = s.bounced,
    failed_count = s.failed,
    skipped_count = s.skipped,
    unsubscribed_count = s.unsub
  from (
    select count(*) filter (where status <> 'skipped') total,
           count(*) filter (where sent_at is not null) sent,
           count(*) filter (where delivered_at is not null) delivered,
           count(*) filter (where opened_at is not null) opened,
           count(*) filter (where replied_at is not null) replied,
           count(*) filter (where status = 'bounced') bounced,
           count(*) filter (where status = 'failed') failed,
           count(*) filter (where status = 'skipped') skipped,
           count(*) filter (where unsubscribed_at is not null) unsub
    from public.prospect_campaign_recipients where campaign_id = p_campaign_id
  ) s
  where c.id = p_campaign_id;
$$;
revoke all on function public.refresh_prospect_campaign_counts(uuid) from public, anon, authenticated;
grant execute on function public.refresh_prospect_campaign_counts(uuid) to service_role;

-- Adds recipients to a draft/ready campaign. Ineligible prospects are stored
-- as 'skipped' with the reason so staff can see why. Re-adding an existing
-- recipient is a no-op (unique campaign_id+prospect_id).
create or replace function public.add_prospect_campaign_recipients(
  p_campaign_id uuid,
  p_prospect_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.prospect_campaigns%rowtype;
  v_id uuid;
  v_reason text;
  v_email text;
  v_added integer := 0;
  v_skipped integer := 0;
  v_existing integer := 0;
begin
  if not (public.can_manage_prospect_hub() or public.can_send_prospect_campaigns()) then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into v_campaign from public.prospect_campaigns where id = p_campaign_id for update;
  if not found then raise exception 'Campaign not found'; end if;
  if v_campaign.status not in ('draft','ready') then raise exception 'Recipients can only be changed while the campaign is a draft'; end if;
  if coalesce(array_length(p_prospect_ids, 1), 0) > 2000 then raise exception 'A campaign is limited to 2000 recipients per addition'; end if;

  foreach v_id in array coalesce(p_prospect_ids, '{}'::uuid[]) loop
    if exists (select 1 from public.prospect_campaign_recipients where campaign_id = p_campaign_id and prospect_id = v_id) then
      v_existing := v_existing + 1; continue;
    end if;
    select email into v_email from public.prospects where id = v_id;
    if not found then continue; end if;
    v_reason := public.prospect_campaign_block_reason(v_id, p_campaign_id, false);
    insert into public.prospect_campaign_recipients (campaign_id, prospect_id, email, status, skip_reason)
    values (p_campaign_id, v_id, coalesce(v_email, ''), case when v_reason is null then 'pending' else 'skipped' end, v_reason)
    on conflict (campaign_id, prospect_id) do nothing;
    if v_reason is null then v_added := v_added + 1; else v_skipped := v_skipped + 1; end if;
  end loop;
  perform public.refresh_prospect_campaign_counts(p_campaign_id);
  perform public.log_prospect_audit('campaign.recipients_added', null, p_campaign_id, null,
    jsonb_build_object('added', v_added, 'skipped', v_skipped, 'already_present', v_existing), '{}'::jsonb);
  return jsonb_build_object('added', v_added, 'skipped', v_skipped, 'already_present', v_existing);
end;
$$;
revoke all on function public.add_prospect_campaign_recipients(uuid, uuid[]) from public, anon;
grant execute on function public.add_prospect_campaign_recipients(uuid, uuid[]) to authenticated;

create or replace function public.remove_prospect_campaign_recipient(p_recipient_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_campaign uuid;
begin
  if not (public.can_manage_prospect_hub() or public.can_send_prospect_campaigns()) then raise exception 'Not authorised' using errcode = '42501'; end if;
  delete from public.prospect_campaign_recipients r using public.prospect_campaigns c
  where r.id = p_recipient_id and c.id = r.campaign_id and c.status in ('draft','ready')
  returning r.campaign_id into v_campaign;
  if v_campaign is null then raise exception 'Recipient cannot be removed once the campaign is queued'; end if;
  perform public.refresh_prospect_campaign_counts(v_campaign);
end;
$$;
revoke all on function public.remove_prospect_campaign_recipient(uuid) from public, anon;
grant execute on function public.remove_prospect_campaign_recipient(uuid) to authenticated;

-- Admin override: allow a recipient that was skipped only because of the
-- recently-contacted rule. Hard suppressions (unsubscribe, bounce, complaint,
-- do-not-contact, converted client) can never be overridden here.
create or replace function public.override_prospect_campaign_recipient(p_recipient_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.prospect_campaign_recipients%rowtype;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Only an admin can override' using errcode = '42501'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A reason is required'; end if;
  select * into r from public.prospect_campaign_recipients where id = p_recipient_id for update;
  if not found then raise exception 'Recipient not found'; end if;
  if r.status <> 'skipped' or r.skip_reason <> 'recently_contacted' then raise exception 'Only recently-contacted skips can be overridden'; end if;
  if public.prospect_campaign_block_reason(r.prospect_id, r.campaign_id, true) is not null then raise exception 'Recipient is blocked for another reason'; end if;
  if not exists (select 1 from public.prospect_campaigns where id = r.campaign_id and status in ('draft','ready')) then raise exception 'Campaign is no longer a draft'; end if;
  update public.prospect_campaign_recipients set status = 'pending', skip_reason = null, override_by = auth.uid(), override_reason = p_reason where id = p_recipient_id;
  perform public.refresh_prospect_campaign_counts(r.campaign_id);
  perform public.log_prospect_audit('campaign.recipient_override', r.prospect_id, r.campaign_id, jsonb_build_object('skip_reason', r.skip_reason), jsonb_build_object('reason', p_reason), '{}'::jsonb);
end;
$$;
revoke all on function public.override_prospect_campaign_recipient(uuid, text) from public, anon;
grant execute on function public.override_prospect_campaign_recipient(uuid, text) to authenticated;

-- Approve + queue: requires can_send_prospect_campaigns. Idempotent - a
-- second click on an already-queued campaign is a no-op.
create or replace function public.queue_prospect_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.prospect_campaigns%rowtype;
  n integer;
begin
  if not public.can_send_prospect_campaigns() then raise exception 'You do not have permission to send campaigns' using errcode = '42501'; end if;
  select * into v from public.prospect_campaigns where id = p_campaign_id for update;
  if not found then raise exception 'Campaign not found'; end if;
  if v.status in ('queued','sending','completed') then return jsonb_build_object('status', v.status, 'already', true); end if;
  if v.status not in ('draft','ready') then raise exception 'Campaign cannot be queued from status %', v.status; end if;
  if nullif(trim(v.subject), '') is null or nullif(trim(v.body_text), '') is null then raise exception 'Subject and body are required'; end if;
  update public.prospect_campaign_recipients set status = 'queued', queued_at = now(), next_attempt_at = now()
  where campaign_id = p_campaign_id and status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'The campaign has no eligible recipients'; end if;
  update public.prospect_campaigns set status = 'queued', approved_by = auth.uid(), approved_at = now(), queued_by = auth.uid(), queued_at = now(), last_error = null
  where id = p_campaign_id;
  perform public.refresh_prospect_campaign_counts(p_campaign_id);
  perform public.log_prospect_audit('campaign.approved_and_queued', null, p_campaign_id, jsonb_build_object('status', v.status),
    jsonb_build_object('status', 'queued', 'recipients', n), '{}'::jsonb);
  return jsonb_build_object('status', 'queued', 'recipients', n);
end;
$$;
revoke all on function public.queue_prospect_campaign(uuid) from public, anon;
grant execute on function public.queue_prospect_campaign(uuid) to authenticated;

create or replace function public.set_prospect_campaign_state(p_campaign_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v public.prospect_campaigns%rowtype;
begin
  if not public.can_send_prospect_campaigns() then raise exception 'You do not have permission to control campaigns' using errcode = '42501'; end if;
  select * into v from public.prospect_campaigns where id = p_campaign_id for update;
  if not found then raise exception 'Campaign not found'; end if;
  if p_action = 'pause' then
    if v.status not in ('queued','sending') then raise exception 'Only a queued or sending campaign can be paused'; end if;
    update public.prospect_campaigns set status = 'paused', paused_at = now() where id = p_campaign_id;
  elsif p_action = 'resume' then
    if v.status <> 'paused' then raise exception 'Only a paused campaign can be resumed'; end if;
    update public.prospect_campaigns set status = 'queued', paused_at = null where id = p_campaign_id;
  elsif p_action = 'cancel' then
    if v.status in ('completed','cancelled') then raise exception 'Campaign already finished'; end if;
    update public.prospect_campaign_recipients set status = 'skipped', skip_reason = 'campaign_cancelled'
      where campaign_id = p_campaign_id and status in ('pending','queued');
    update public.prospect_campaigns set status = 'cancelled', cancelled_at = now() where id = p_campaign_id;
    perform public.refresh_prospect_campaign_counts(p_campaign_id);
  else
    raise exception 'Invalid action';
  end if;
  perform public.log_prospect_audit('campaign.' || p_action, null, p_campaign_id, jsonb_build_object('status', v.status), jsonb_build_object('action', p_action), '{}'::jsonb);
  return jsonb_build_object('status', (select status from public.prospect_campaigns where id = p_campaign_id));
end;
$$;
revoke all on function public.set_prospect_campaign_state(uuid, text) from public, anon;
grant execute on function public.set_prospect_campaign_state(uuid, text) to authenticated;

-- Worker claim: atomically locks a batch (SKIP LOCKED so overlapping worker
-- runs never take the same row), re-checks suppression immediately before
-- sending and marks rows 'sending'. Rows stuck in 'sending' (worker died
-- after the provider may have accepted the email) are NOT retried
-- automatically - they are marked failed with 'uncertain_delivery' so a
-- human decides, which prevents duplicate sends.
create or replace function public.claim_prospect_campaign_recipients(p_limit integer)
returns setof public.prospect_campaign_recipients
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.prospect_campaign_recipients%rowtype;
  v_reason text;
  v_sent_today integer;
  v_settings public.prospect_campaign_settings%rowtype;
  v_budget integer;
begin
  select * into v_settings from public.prospect_campaign_settings order by created_at limit 1;
  update public.prospect_campaign_recipients set status = 'failed', failed_at = now(),
    error_message = 'uncertain_delivery: worker stopped after send attempt; not retried automatically to avoid duplicates'
  where status = 'sending' and locked_at < now() - interval '15 minutes';

  select count(*) into v_sent_today from public.prospect_campaign_recipients
  where sent_at >= date_trunc('day', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg';
  v_budget := greatest(0, least(p_limit, coalesce(v_settings.daily_limit, 200) - v_sent_today));
  if v_budget = 0 then return; end if;

  for r in
    select rc.* from public.prospect_campaign_recipients rc
    join public.prospect_campaigns c on c.id = rc.campaign_id
    where rc.status = 'queued'
      and coalesce(rc.next_attempt_at, now()) <= now()
      and c.status in ('queued','sending')
    order by c.queued_at, rc.queued_at, rc.id
    limit v_budget
    for update of rc skip locked
  loop
    v_reason := public.prospect_campaign_block_reason(r.prospect_id, r.campaign_id, r.override_by is not null);
    if v_reason is not null then
      update public.prospect_campaign_recipients set status = 'skipped', skip_reason = v_reason where id = r.id;
      continue;
    end if;
    update public.prospect_campaign_recipients set status = 'sending', locked_at = now(), attempt_count = attempt_count + 1
    where id = r.id returning * into r;
    update public.prospect_campaigns set status = 'sending', started_at = coalesce(started_at, now()) where id = r.campaign_id and status = 'queued';
    return next r;
  end loop;
end;
$$;
revoke all on function public.claim_prospect_campaign_recipients(integer) from public, anon, authenticated;
grant execute on function public.claim_prospect_campaign_recipients(integer) to service_role;

create or replace function public.complete_prospect_campaigns()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.prospect_campaigns c set status = 'completed', completed_at = now()
  where c.status in ('queued','sending')
    and not exists (select 1 from public.prospect_campaign_recipients r where r.campaign_id = c.id and r.status in ('pending','queued','sending'));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.complete_prospect_campaigns() from public, anon, authenticated;
grant execute on function public.complete_prospect_campaigns() to service_role;

-- Marks a reply manually (reply detection is not automatic: there is no
-- inbound mail processing).
create or replace function public.log_prospect_reply(p_prospect_id uuid, p_campaign_id uuid default null, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  insert into public.prospect_activities (prospect_id, activity_type, direction, summary, performed_by, metadata)
  values (p_prospect_id, 'reply', 'inbound', coalesce(nullif(trim(p_note), ''), 'Prospect replied'), auth.uid(), jsonb_build_object('campaign_id', p_campaign_id));
  if p_campaign_id is not null then
    update public.prospect_campaign_recipients set replied_at = coalesce(replied_at, now()), status = case when status in ('sent','delivered','opened') then 'replied' else status end
    where campaign_id = p_campaign_id and prospect_id = p_prospect_id;
    update public.prospect_campaigns c set replied_count = (select count(*) from public.prospect_campaign_recipients r where r.campaign_id = c.id and r.replied_at is not null)
    where c.id = p_campaign_id;
  end if;
  update public.prospects set status = case when status in ('new','contacted','follow_up') then 'interested' else status end,
    last_contacted_at = now() where id = p_prospect_id;
end;
$$;
revoke all on function public.log_prospect_reply(uuid, uuid, text) from public, anon;
grant execute on function public.log_prospect_reply(uuid, uuid, text) to authenticated;

-- Unsubscribe via the token embedded in each marketing email. Only affects
-- the prospect marketing list (transactional/client email is unaffected).
create or replace function public.unsubscribe_prospect_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.prospect_campaign_recipients%rowtype;
begin
  select * into r from public.prospect_campaign_recipients where unsubscribe_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_token'); end if;
  update public.prospect_campaign_recipients set unsubscribed_at = coalesce(unsubscribed_at, now()),
    status = case when status in ('sent','delivered','opened','replied') then 'unsubscribed' else status end,
    last_event_at = now()
  where id = r.id;
  update public.prospects set email_opt_out_at = coalesce(email_opt_out_at, now()), opt_out_reason = coalesce(opt_out_reason, 'Unsubscribed via email link')
  where id = r.prospect_id;
  insert into public.prospect_email_suppressions (email, reason, prospect_id, campaign_id, notes)
  values (lower(r.email), 'unsubscribed', r.prospect_id, r.campaign_id, 'Unsubscribe link')
  on conflict (lower(email)) where lifted_at is null do nothing;
  if not exists (select 1 from public.prospect_activities where prospect_id = r.prospect_id and activity_type = 'suppression' and metadata->>'unsubscribe_recipient' = r.id::text) then
    insert into public.prospect_activities (prospect_id, activity_type, direction, summary, metadata)
    values (r.prospect_id, 'suppression', 'inbound', 'Unsubscribed from marketing email', jsonb_build_object('campaign_id', r.campaign_id, 'unsubscribe_recipient', r.id));
    insert into public.prospect_audit_log (action, prospect_id, campaign_id, new_values)
    values ('suppression.unsubscribe', r.prospect_id, r.campaign_id, jsonb_build_object('email', r.email));
  end if;
  perform public.refresh_prospect_campaign_counts(r.campaign_id);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.unsubscribe_prospect_by_token(uuid) from public, anon, authenticated;
grant execute on function public.unsubscribe_prospect_by_token(uuid) to service_role;

-- Provider webhook events (Mailtrap). Delivery/bounce/complaint are only
-- recorded when the provider reports them.
create or replace function public.record_prospect_email_event(p_message_id text, p_event text, p_occurred_at timestamptz, p_detail text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.prospect_campaign_recipients%rowtype;
begin
  select * into r from public.prospect_campaign_recipients where provider_message_id = p_message_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_message'); end if;
  if p_event = 'delivery' then
    update public.prospect_campaign_recipients set delivered_at = coalesce(delivered_at, p_occurred_at),
      status = case when status = 'sent' then 'delivered' else status end, last_event_at = now() where id = r.id;
  elsif p_event = 'open' then
    update public.prospect_campaign_recipients set opened_at = coalesce(opened_at, p_occurred_at), last_event_at = now() where id = r.id;
  elsif p_event in ('bounce','reject') then
    update public.prospect_campaign_recipients set status = 'bounced', bounced_at = coalesce(bounced_at, p_occurred_at), error_message = left(p_detail, 500), last_event_at = now() where id = r.id;
    insert into public.prospect_email_suppressions (email, reason, prospect_id, campaign_id, notes)
    values (lower(r.email), 'hard_bounce', r.prospect_id, r.campaign_id, left(p_detail, 500))
    on conflict (lower(email)) where lifted_at is null do nothing;
  elsif p_event = 'soft_bounce' then
    update public.prospect_campaign_recipients set error_message = left('soft bounce: ' || coalesce(p_detail, ''), 500), last_event_at = now() where id = r.id;
  elsif p_event = 'spam' then
    insert into public.prospect_email_suppressions (email, reason, prospect_id, campaign_id, notes)
    values (lower(r.email), 'complaint', r.prospect_id, r.campaign_id, 'Spam complaint reported by provider')
    on conflict (lower(email)) where lifted_at is null do nothing;
    update public.prospects set do_not_contact = true, opt_out_reason = 'Spam complaint' where id = r.prospect_id;
  elsif p_event = 'unsubscribe' then
    perform public.unsubscribe_prospect_by_token(r.unsubscribe_token);
  else
    return jsonb_build_object('ok', true, 'ignored', p_event);
  end if;
  perform public.refresh_prospect_campaign_counts(r.campaign_id);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.record_prospect_email_event(text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.record_prospect_email_event(text, text, timestamptz, text) to service_role;

-- ---------------------------------------------------------------------------
-- Dashboard + analytics (aggregates computed server-side)
-- ---------------------------------------------------------------------------

create or replace function public.prospect_hub_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today timestamptz := date_trunc('day', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg';
  v jsonb;
begin
  if not public.can_view_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total', count(*),
    'new_today', count(*) filter (where discovered_at >= v_today),
    'new_week', count(*) filter (where discovered_at >= v_today - interval '6 days'),
    'high_fit', count(*) filter (where score >= 70 and status not in ('converted','disqualified')),
    'missing_contact', count(*) filter (where email is null and phone is null and status not in ('converted','disqualified')),
    'enriched_today', count(*) filter (where enrichment_checked_at >= v_today),
    'needs_review', count(*) filter (where enrichment_status = 'needs_review'),
    'leads', count(*) filter (where status in ('qualified','consultation')),
    'converted', count(*) filter (where status = 'converted'),
    'contacted', count(*) filter (where last_contacted_at is not null or status not in ('new')),
    'do_not_contact', count(*) filter (where do_not_contact)
  ) into v from public.prospects;
  v := v || jsonb_build_object(
    'follow_ups_overdue', (select count(*) from public.prospect_follow_ups where status = 'open' and due_at < now()),
    'follow_ups_due_today', (select count(*) from public.prospect_follow_ups where status = 'open' and due_at >= now() and due_at < v_today + interval '1 day'),
    'campaign_emails_sent', (select count(*) from public.prospect_campaign_recipients where sent_at is not null),
    'campaign_replies', (select count(*) from public.prospect_campaign_recipients where replied_at is not null),
    'duplicates_pending', (select count(*) from public.prospect_duplicate_candidates where status = 'pending')
  );
  return v;
end;
$$;
revoke all on function public.prospect_hub_dashboard() from public, anon;
grant execute on function public.prospect_hub_dashboard() to authenticated;

create or replace function public.prospect_hub_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_can_invoices boolean;
begin
  if not public.can_view_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  v_can_invoices := exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or exists (select 1 from public.staff_permissions where profile_id = auth.uid() and can_view_invoices);
  return jsonb_build_object(
    'funnel', (select jsonb_build_object(
      'discovered', count(*),
      'contacted', count(*) filter (where last_contacted_at is not null or status <> 'new'),
      'replied', count(*) filter (where exists (select 1 from public.prospect_activities a where a.prospect_id = p.id and a.activity_type = 'reply')),
      'qualified', count(*) filter (where lead_at is not null),
      'clients', count(*) filter (where converted_client_id is not null)) from public.prospects p),
    'by_source', (select coalesce(jsonb_agg(x order by x->>'source'), '[]'::jsonb) from (
      select jsonb_build_object('source', coalesce(source_name, 'Manual'), 'prospects', count(*),
        'leads', count(*) filter (where lead_at is not null), 'clients', count(*) filter (where converted_client_id is not null)) x
      from public.prospects group by coalesce(source_name, 'Manual')) s),
    'by_sector', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select jsonb_build_object('sector', coalesce(sector, 'Unclassified'), 'prospects', count(*),
        'leads', count(*) filter (where lead_at is not null), 'clients', count(*) filter (where converted_client_id is not null)) x
      from public.prospects group by coalesce(sector, 'Unclassified') order by count(*) desc limit 15) s),
    'campaigns', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select jsonb_build_object('id', c.id, 'name', c.name, 'status', c.status, 'sent', c.sent_count, 'replies', c.replied_count,
        'bounced', c.bounced_count, 'unsubscribed', c.unsubscribed_count,
        'leads', (select count(distinct r.prospect_id) from public.prospect_campaign_recipients r join public.prospects p on p.id = r.prospect_id
                  where r.campaign_id = c.id and r.sent_at is not null and p.lead_at >= r.sent_at),
        'clients', (select count(distinct r.prospect_id) from public.prospect_campaign_recipients r join public.prospects p on p.id = r.prospect_id
                  where r.campaign_id = c.id and r.sent_at is not null and p.converted_at >= r.sent_at)) x
      from public.prospect_campaigns c where c.status <> 'draft' order by c.created_at desc limit 20) s),
    'staff_activity', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select jsonb_build_object('staff', coalesce(pr.full_name, pr.email, 'Unknown'),
        'calls', count(*) filter (where a.activity_type = 'call'),
        'notes', count(*) filter (where a.activity_type = 'note'),
        'stage_changes', count(*) filter (where a.activity_type = 'status_change'),
        'conversions', count(*) filter (where a.activity_type in ('lead','conversion'))) x
      from public.prospect_activities a join public.profiles pr on pr.id = a.performed_by
      where a.occurred_at >= now() - interval '30 days'
      group by pr.id, pr.full_name, pr.email order by count(*) desc limit 20) s),
    'revenue', case when v_can_invoices then (
      select jsonb_build_object(
        'currency', 'ZAR',
        'invoiced', coalesce(sum(i.total_amount), 0),
        'paid', coalesce(sum(i.amount_paid), 0),
        'clients_with_invoices', count(distinct i.client_id))
      from public.invoices i join public.prospects p on p.converted_client_id = i.client_id
      where i.created_at >= p.converted_at - interval '1 day' and i.status::text <> 'cancelled') else null end
  );
end;
$$;
revoke all on function public.prospect_hub_analytics() from public, anon;
grant execute on function public.prospect_hub_analytics() to authenticated;
