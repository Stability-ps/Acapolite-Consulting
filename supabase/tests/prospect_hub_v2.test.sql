-- Prospect Hub v2 database tests.
--
-- Runs entirely inside one transaction that is ROLLED BACK at the end, so it
-- can be executed safely against any environment (including production)
-- after the v2 migrations are applied:
--   supabase db query --linked -f supabase/tests/prospect_hub_v2.test.sql
-- Every check writes a row to a temp table; the final SELECT lists results.

begin;

create temp table t_results (seq serial, name text, passed boolean, detail text) on commit drop;
grant all on t_results to authenticated, anon;
grant usage, select on sequence t_results_seq_seq to authenticated, anon;

create function pg_temp.check(p_name text, p_ok boolean, p_detail text default null) returns void
language sql as $$ insert into t_results(name, passed, detail) values (p_name, coalesce(p_ok, false), p_detail) $$;

create function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- Fixture ids (existing production profiles; nothing is persisted).
create temp table t_ids (k text primary key, v uuid) on commit drop;
grant select on t_ids to authenticated, anon;
insert into t_ids values
  ('admin', (select id from public.profiles where role = 'admin' and is_active order by created_at limit 1)),
  ('client', (select id from public.profiles where role = 'client' and is_active order by created_at limit 1)),
  ('staff_ok', (select p.id from public.profiles p join public.staff_permissions sp on sp.profile_id = p.id where p.role = 'consultant' and p.is_active order by p.created_at limit 1)),
  ('staff_no', (select p.id from public.profiles p join public.staff_permissions sp on sp.profile_id = p.id where p.role = 'consultant' and p.is_active order by p.created_at offset 1 limit 1));
-- Grant one consultant view+manage (not send, not clients) for this transaction only.
update public.staff_permissions set can_view_prospect_hub = true, can_manage_prospect_hub = true, can_send_prospect_campaigns = false, can_manage_clients = false
  where profile_id = (select v from t_ids where k = 'staff_ok');
update public.staff_permissions set can_view_prospect_hub = false, can_manage_prospect_hub = false, can_send_prospect_campaigns = false
  where profile_id = (select v from t_ids where k = 'staff_no');
update public.prospect_campaign_settings set min_days_between_contact = 30;

-- ---------------------------------------------------------------- discovery
create temp table t_p (k text primary key, v uuid) on commit drop;
grant all on t_p to authenticated, anon;

do $$
declare r1 jsonb; r2 jsonb; r3 jsonb; r4 jsonb; r5 jsonb; r6 jsonb; r7 jsonb; v_count int; v public.prospects%rowtype;
begin
  r1 := public.upsert_discovered_prospect('etenders_ocds',
    '{"company_name":"QA Zulu Mahika Technologies (Pty) Ltd","source_supplier_id":"qa-sup-1","sector":"IT","province":"Gauteng","supplier_size":"EME"}',
    '{"source_record_id":"qa-ocid-1:qa-sup-1","ocid":"qa-ocid-1","tender_title":"Laptops","buyer_name":"Dept A","award_value":"1000","award_date":"2026-08-01T00:00:00Z"}');
  r2 := public.upsert_discovered_prospect('etenders_ocds',
    '{"company_name":"QA ZULU MAHIKA TECHNOLOGIES PTY LTD","source_supplier_id":"qa-sup-1","sector":"IT","province":"Gauteng"}',
    '{"source_record_id":"qa-ocid-2:qa-sup-1","ocid":"qa-ocid-2","tender_title":"Servers","buyer_name":"Dept B","award_value":"2500","award_date":"2026-09-01T00:00:00Z"}');
  -- exact duplicate record replayed (e.g. retried run)
  r3 := public.upsert_discovered_prospect('etenders_ocds',
    '{"company_name":"QA Zulu Mahika Technologies","source_supplier_id":"qa-sup-1"}',
    '{"source_record_id":"qa-ocid-2:qa-sup-1","ocid":"qa-ocid-2"}');
  insert into t_p values ('mahika', (r1->>'prospect_id')::uuid);
  perform pg_temp.check('discovery: first record creates prospect', r1->>'status' = 'created', r1::text);
  perform pg_temp.check('discovery: second tender for same supplier attaches to same prospect', r2->>'prospect_id' = r1->>'prospect_id' and r2->>'status' = 'updated', r2::text);
  perform pg_temp.check('discovery: replayed record is idempotent', (r3->>'new_record')::boolean = false and r3->>'prospect_id' = r1->>'prospect_id', r3::text);
  select count(*) into v_count from public.prospect_source_records where prospect_id = (r1->>'prospect_id')::uuid;
  perform pg_temp.check('discovery: two evidence records, not three', v_count = 2, v_count::text);
  select * into v from public.prospects where id = (r1->>'prospect_id')::uuid;
  perform pg_temp.check('scoring: procurement stats maintained', v.procurement_record_count = 2 and v.total_award_value = 3500, v.procurement_record_count || '/' || v.total_award_value);
  perform pg_temp.check('scoring: explainable reasons stored', jsonb_array_length(v.score_reasons) >= 5 and v.score = (select sum((x->>'points')::int) from jsonb_array_elements(v.score_reasons) x), v.score || ' ' || v.score_reasons::text);
  perform pg_temp.check('scoring: never labelled as SARS non-compliance', v.score_reasons::text !~* 'non.?complian', v.score_reasons::text);

  -- same name, no supplier id -> merges by normalised name
  r4 := public.upsert_discovered_prospect('etenders_ocds', '{"company_name":"QA Zulu Mahika Technologies CC"}', '{"source_record_id":"qa-ocid-3:x"}');
  perform pg_temp.check('dedup: normalised name variant merges', r4->>'prospect_id' = r1->>'prospect_id' and r4->>'match_reason' = 'normalized_name', r4::text);

  -- registration number conflict -> separate company
  update public.prospects set registration_number = '2020/111111/07' where id = (r1->>'prospect_id')::uuid;
  r5 := public.upsert_discovered_prospect('etenders_ocds', '{"company_name":"QA Zulu Mahika Technologies","registration_number":"2019/999999/07"}', '{"source_record_id":"qa-ocid-4:y"}');
  perform pg_temp.check('dedup: same name with different registration number is NOT merged', r5->>'prospect_id' <> r1->>'prospect_id' and r5->>'status' = 'created', r5::text);

  -- similar (not identical) name -> flagged for review, not merged
  r6 := public.upsert_discovered_prospect('etenders_ocds', '{"company_name":"QA Zulu Mahika Technologies Gauteng"}', '{"source_record_id":"qa-ocid-5:z"}');
  perform pg_temp.check('dedup: similar name creates separate prospect', r6->>'status' = 'created', r6::text);
  perform pg_temp.check('dedup: similar name flagged for human review',
    exists (select 1 from public.prospect_duplicate_candidates where prospect_id = (r6->>'prospect_id')::uuid and status = 'pending'), null);

  -- malformed record
  r7 := public.upsert_discovered_prospect('etenders_ocds', '{"company_name":"   "}', '{"source_record_id":"qa-bad"}');
  perform pg_temp.check('discovery: malformed record skipped', r7->>'status' = 'skipped', r7::text);
end $$;

-- extra fixtures (as postgres)
insert into public.prospects (company_name, email, phone, sector, province, source_name) values
  ('QA Zulu Email Co', 'qa-zulu-email@example-qa.co.za', '011 555 0001', 'Construction', 'Gauteng', 'manual');
insert into t_p select 'email_co', id from public.prospects where company_name = 'QA Zulu Email Co';
insert into public.prospects (company_name, sector, source_name) values ('QA Zulu No Email', 'Security', 'manual');
insert into t_p select 'no_email', id from public.prospects where company_name = 'QA Zulu No Email';
insert into public.prospects (company_name, email, do_not_contact, source_name) values ('QA Zulu DNC', 'qa-zulu-dnc@example-qa.co.za', true, 'manual');
insert into t_p select 'dnc', id from public.prospects where company_name = 'QA Zulu DNC';
insert into public.prospects (company_name, email, source_name) values ('QA Zulu Second', 'qa-zulu-second@example-qa.co.za', 'manual');
insert into t_p select 'second', id from public.prospects where company_name = 'QA Zulu Second';

select pg_temp.check('normalisation: phone stored as +27', (select phone from public.prospects where id = (select v from t_p where k = 'email_co')) = '+27115550001', null);

-- ---------------------------------------------------------------- anon
set local role anon;
do $$ begin
  perform 1 from public.prospects limit 1;
  perform pg_temp.check('security: anon cannot read prospects', false, 'select succeeded');
exception when insufficient_privilege then perform pg_temp.check('security: anon cannot read prospects', true, null);
end $$;
do $$ begin
  perform public.prospect_hub_dashboard();
  perform pg_temp.check('security: anon cannot call dashboard RPC', false, null);
exception when insufficient_privilege then perform pg_temp.check('security: anon cannot call dashboard RPC', true, null);
end $$;
reset role;

-- ---------------------------------------------------------------- client
select pg_temp.as_user((select v from t_ids where k = 'client'));
set local role authenticated;
select pg_temp.check('security: client sees zero prospects', (select count(*) from public.prospects) = 0, null);
select pg_temp.check('security: client sees zero campaigns/templates/audit',
  (select count(*) from public.prospect_email_templates) + (select count(*) from public.prospect_audit_log) + (select count(*) from public.prospect_source_records) = 0, null);
do $$ begin
  insert into public.prospects (company_name) values ('QA client insert');
  perform pg_temp.check('security: client cannot insert prospect', false, null);
exception when insufficient_privilege or check_violation then perform pg_temp.check('security: client cannot insert prospect', true, null);
end $$;
do $$ begin
  perform public.prospect_hub_dashboard();
  perform pg_temp.check('security: client cannot call dashboard', false, null);
exception when insufficient_privilege then perform pg_temp.check('security: client cannot call dashboard', true, null);
end $$;
do $$ begin
  perform public.convert_prospect_to_client((select v from t_p where k = 'email_co'), 'create_new');
  perform pg_temp.check('security: client cannot convert', false, null);
exception when insufficient_privilege then perform pg_temp.check('security: client cannot convert', true, null);
end $$;
reset role;

-- ---------------------------------------------------------------- unauthorised staff
select pg_temp.as_user((select v from t_ids where k = 'staff_no'));
set local role authenticated;
select pg_temp.check('security: unauthorised consultant sees zero prospects', (select count(*) from public.prospects) = 0, null);
do $$ begin
  perform public.log_prospect_call((select v from t_p where k = 'email_co'), 'no_answer');
  perform pg_temp.check('security: unauthorised consultant cannot log calls', false, null);
exception when insufficient_privilege then perform pg_temp.check('security: unauthorised consultant cannot log calls', true, null);
end $$;
reset role;

-- ---------------------------------------------------------------- authorised staff (view+manage, no send, no clients)
select pg_temp.as_user((select v from t_ids where k = 'staff_ok'));
set local role authenticated;
select pg_temp.check('permissions: authorised consultant sees prospects', (select count(*) from public.prospects where company_name like 'QA Zulu%') >= 5, null);
do $$ declare v_follow int; v_status text; begin
  perform public.log_prospect_call((select v from t_p where k = 'email_co'), 'call_back', 'Asked us to call Monday', now(), 'Call back Monday', now() + interval '3 days');
  select count(*) into v_follow from public.prospect_follow_ups where prospect_id = (select v from t_p where k = 'email_co') and status = 'open';
  select status into v_status from public.prospects where id = (select v from t_p where k = 'email_co');
  perform pg_temp.check('calls: call logged with follow-up created', v_follow = 1, v_follow::text);
  perform pg_temp.check('calls: stage advanced from new', v_status in ('contacted','follow_up'), v_status);
  perform pg_temp.check('follow-ups: next_follow_up_at synced',
    (select next_follow_up_at from public.prospects where id = (select v from t_p where k = 'email_co')) is not null, null);
end $$;
do $$ begin
  insert into public.prospect_notes (prospect_id, body, created_by) values ((select v from t_p where k = 'email_co'), 'Already has accountant', (select v from t_ids where k = 'staff_ok'));
  perform pg_temp.check('notes: authorised staff can add note', true, null);
end $$;
do $$ begin
  update public.prospect_notes set body = 'edited' where prospect_id = (select v from t_p where k = 'email_co');
  perform pg_temp.check('notes: history cannot be edited', false, null);
exception when insufficient_privilege then perform pg_temp.check('notes: history cannot be edited', true, null);
end $$;
do $$ begin
  insert into public.prospect_notes (prospect_id, body, created_by) values ((select v from t_p where k = 'email_co'), 'spoof', (select v from t_ids where k = 'admin'));
  perform pg_temp.check('notes: cannot attribute a note to someone else', false, null);
exception when insufficient_privilege or check_violation then perform pg_temp.check('notes: cannot attribute a note to someone else', true, null);
end $$;
do $$ declare r jsonb; r2 jsonb; begin
  r := public.mark_prospect_as_lead((select v from t_p where k = 'email_co'), 'TCS assistance', 'Needs TCS for tender');
  r2 := public.mark_prospect_as_lead((select v from t_p where k = 'email_co'), 'TCS assistance');
  perform pg_temp.check('lead: prospect converted to lead', r->>'status' = 'lead', r::text);
  perform pg_temp.check('lead: second conversion is a no-op (no duplicate lead)', r2->>'status' = 'already_lead', r2::text);
end $$;
do $$ begin
  perform public.convert_prospect_to_client((select v from t_p where k = 'email_co'), 'create_new');
  perform pg_temp.check('conversion: staff without client permission cannot create client', false, null);
exception when insufficient_privilege then perform pg_temp.check('conversion: staff without client permission cannot create client', true, null);
end $$;
-- campaign draft by staff without send permission
do $$ declare v_c uuid; r jsonb; begin
  insert into public.prospect_campaigns (name, subject, body_text, status, created_by)
  values ('QA Zulu Campaign', 'Hello {{company_name}}', 'Body', 'draft', (select v from t_ids where k = 'staff_ok')) returning id into v_c;
  r := public.add_prospect_campaign_recipients(v_c, array[(select v from t_p where k = 'email_co'), (select v from t_p where k = 'no_email'), (select v from t_p where k = 'dnc'), (select v from t_p where k = 'second')]);
  perform pg_temp.check('campaigns: staff can build draft + recipients', (r->>'added')::int = 2 and (r->>'skipped')::int = 2, r::text);
  r := public.add_prospect_campaign_recipients(v_c, array[(select v from t_p where k = 'email_co')]);
  perform pg_temp.check('campaigns: duplicate recipient add is a no-op', (r->>'already_present')::int = 1 and (r->>'added')::int = 0, r::text);
  perform pg_temp.check('campaigns: skip reasons recorded',
    (select string_agg(skip_reason, ',' order by skip_reason) from public.prospect_campaign_recipients where campaign_id = v_c and status = 'skipped') = 'do_not_contact,no_email', null);
  insert into t_p values ('campaign1', v_c);
  begin
    perform public.queue_prospect_campaign(v_c);
    perform pg_temp.check('campaigns: staff without send permission cannot queue', false, null);
  exception when insufficient_privilege then perform pg_temp.check('campaigns: staff without send permission cannot queue', true, null);
  end;
  begin
    insert into public.prospect_campaign_recipients (campaign_id, prospect_id, email) values (v_c, (select v from t_p where k = 'dnc'), 'x@y.z');
    perform pg_temp.check('campaigns: recipients cannot be inserted directly (bypassing suppression)', false, null);
  exception when insufficient_privilege then perform pg_temp.check('campaigns: recipients cannot be inserted directly (bypassing suppression)', true, null);
  end;
  begin
    update public.prospect_campaigns set status = 'queued' where id = v_c;
    perform pg_temp.check('campaigns: status cannot be forced to queued via REST', not found, null);
  exception when insufficient_privilege or check_violation then perform pg_temp.check('campaigns: status cannot be forced to queued via REST', true, null);
  end;
end $$;
reset role;

-- ---------------------------------------------------------------- admin
select pg_temp.as_user((select v from t_ids where k = 'admin'));
set local role authenticated;
do $$ declare r jsonb; r2 jsonb; v_c uuid := (select v from t_p where k = 'campaign1'); n int; begin
  r := public.queue_prospect_campaign(v_c);
  r2 := public.queue_prospect_campaign(v_c);
  perform pg_temp.check('campaigns: admin approves + queues', r->>'status' = 'queued' and (r->>'recipients')::int = 2, r::text);
  perform pg_temp.check('campaigns: double-click queue is idempotent', (r2->>'already')::boolean, r2::text);
  select count(*) into n from public.prospect_audit_log where campaign_id = v_c and action = 'campaign.approved_and_queued';
  perform pg_temp.check('audit: campaign approval logged once', n = 1, n::text);
  r := public.set_prospect_campaign_state(v_c, 'pause');
  perform pg_temp.check('campaigns: pause', r->>'status' = 'paused', r::text);
  r := public.set_prospect_campaign_state(v_c, 'resume');
  perform pg_temp.check('campaigns: resume', r->>'status' = 'queued', r::text);
end $$;
reset role;

-- worker (service context)
do $$ declare n int; n2 int; v_c uuid := (select v from t_p where k = 'campaign1'); begin
  select count(*) into n from public.claim_prospect_campaign_recipients(10);
  select count(*) into n2 from public.claim_prospect_campaign_recipients(10);
  perform pg_temp.check('worker: claims eligible recipients once', n = 2, n::text);
  perform pg_temp.check('worker: second overlapping claim gets nothing (no double send)', n2 = 0, n2::text);
  update public.prospect_campaign_recipients set status = 'sent', sent_at = now(), provider_message_id = 'qa-msg-' || id::text where campaign_id = v_c and status = 'sending';
  perform public.complete_prospect_campaigns();
  perform pg_temp.check('worker: campaign completes when queue drained', (select status from public.prospect_campaigns where id = v_c) = 'completed', null);
  perform public.record_prospect_email_event('qa-msg-' || (select id::text from public.prospect_campaign_recipients where campaign_id = v_c and prospect_id = (select v from t_p where k = 'second')), 'bounce', now(), '550 no such user');
  perform pg_temp.check('events: hard bounce suppresses the address', public.is_prospect_email_suppressed('qa-zulu-second@example-qa.co.za') = 'hard_bounce', null);
  perform public.unsubscribe_prospect_by_token((select unsubscribe_token from public.prospect_campaign_recipients where campaign_id = v_c and prospect_id = (select v from t_p where k = 'email_co')));
  perform pg_temp.check('unsubscribe: token unsubscribes + suppresses', public.is_prospect_email_suppressed('qa-zulu-email@example-qa.co.za') = 'unsubscribed', null);
  perform pg_temp.check('unsubscribe: prospect opt-out recorded', (select email_opt_out_at from public.prospects where id = (select v from t_p where k = 'email_co')) is not null, null);
end $$;

-- recently-contacted + admin override
insert into public.prospects (company_name, email, source_name) values ('QA Zulu Recent', 'qa-zulu-recent@example-qa.co.za', 'manual');
insert into t_p select 'recent', id from public.prospects where company_name = 'QA Zulu Recent';
insert into public.prospect_campaigns (name, subject, body_text, status) values ('QA Zulu Old', 's', 'b', 'completed');
insert into public.prospect_campaign_recipients (campaign_id, prospect_id, email, status, sent_at)
select c.id, (select v from t_p where k = 'recent'), 'qa-zulu-recent@example-qa.co.za', 'sent', now() - interval '2 days' from public.prospect_campaigns c where c.name = 'QA Zulu Old';

select pg_temp.as_user((select v from t_ids where k = 'admin'));
set local role authenticated;
do $$ declare v_c uuid; r jsonb; v_rec uuid; begin
  insert into public.prospect_campaigns (name, subject, body_text, status) values ('QA Zulu Campaign 2', 's', 'b', 'draft') returning id into v_c;
  r := public.add_prospect_campaign_recipients(v_c, array[(select v from t_p where k = 'recent'), (select v from t_p where k = 'email_co')]);
  perform pg_temp.check('suppression: recently contacted prospect skipped', exists (select 1 from public.prospect_campaign_recipients where campaign_id = v_c and skip_reason = 'recently_contacted'), r::text);
  perform pg_temp.check('suppression: unsubscribed prospect skipped server-side', exists (select 1 from public.prospect_campaign_recipients where campaign_id = v_c and skip_reason in ('unsubscribed')), null);
  select id into v_rec from public.prospect_campaign_recipients where campaign_id = v_c and skip_reason = 'recently_contacted';
  perform public.override_prospect_campaign_recipient(v_rec, 'Client asked for info pack');
  perform pg_temp.check('override: admin can override recently-contacted with audit',
    (select status from public.prospect_campaign_recipients where id = v_rec) = 'pending'
    and exists (select 1 from public.prospect_audit_log where action = 'campaign.recipient_override' and campaign_id = v_c), null);
  begin
    perform public.override_prospect_campaign_recipient((select id from public.prospect_campaign_recipients where campaign_id = v_c and skip_reason = 'unsubscribed'), 'try');
    perform pg_temp.check('override: unsubscribe can never be overridden', false, null);
  exception when others then perform pg_temp.check('override: unsubscribe can never be overridden', true, sqlerrm);
  end;
end $$;

-- conversion with duplicate-client detection
reset role;
insert into public.clients (client_type, company_name, email) values ('company', 'QA Zulu No Email (Pty) Ltd', 'qa-zulu-existing-client@example-qa.co.za');
select pg_temp.as_user((select v from t_ids where k = 'admin'));
set local role authenticated;
do $$ declare r jsonb; r2 jsonb; r3 jsonb; v_client uuid; begin
  r := public.convert_prospect_to_client((select v from t_p where k = 'no_email'), 'check');
  perform pg_temp.check('conversion: existing client detected by company name', jsonb_array_length(r->'matches') = 1, r::text);
  r2 := public.convert_prospect_to_client((select v from t_p where k = 'no_email'), 'create_new');
  perform pg_temp.check('conversion: create_new refused while duplicates exist', r2->>'status' = 'possible_duplicates', r2::text);
  v_client := (r->'matches'->0->>'client_id')::uuid;
  r3 := public.convert_prospect_to_client((select v from t_p where k = 'no_email'), 'link_existing', v_client);
  perform pg_temp.check('conversion: linked to existing client', r3->>'status' = 'converted' and (r3->>'client_id')::uuid = v_client, r3::text);
  r3 := public.convert_prospect_to_client((select v from t_p where k = 'no_email'), 'link_existing', v_client);
  perform pg_temp.check('conversion: repeat conversion is a no-op', r3->>'status' = 'already_converted', r3::text);
  r := public.convert_prospect_to_client((select v from t_p where k = 'mahika'), 'create_new');
  perform pg_temp.check('conversion: new client created in existing clients table',
    r->>'status' = 'converted' and exists (select 1 from public.clients where id = (r->>'client_id')::uuid and company_name like 'QA Zulu Mahika%'), r::text);
  perform pg_temp.check('conversion: source attribution retained on prospect',
    (select converted_client_id from public.prospects where id = (select v from t_p where k = 'mahika')) = (r->>'client_id')::uuid
    and (select notes from public.clients where id = (r->>'client_id')::uuid) like '%National Treasury eTenders OCDS%', null);
  perform pg_temp.check('conversion: timeline + audit written',
    exists (select 1 from public.prospect_activities where prospect_id = (select v from t_p where k = 'mahika') and activity_type = 'conversion')
    and exists (select 1 from public.prospect_audit_log where prospect_id = (select v from t_p where k = 'mahika') and action = 'prospect.convert_client'), null);
  r := public.prospect_hub_dashboard();
  perform pg_temp.check('dashboard: admin gets aggregate stats', (r->>'total')::int >= 7, r::text);
  r := public.prospect_hub_analytics();
  perform pg_temp.check('analytics: funnel returned', (r->'funnel'->>'clients')::int >= 2, (r->'funnel')::text);
end $$;
do $$ begin
  delete from public.prospects where id = (select v from t_p where k = 'dnc');
  perform pg_temp.check('security: admin may delete a prospect', true, null);
end $$;
reset role;

select seq, case when passed then 'PASS' else 'FAIL' end as result, name, detail from t_results order by seq;
rollback;
