-- Controlled prospect import. The browser parses the CSV/XLSX and sends the
-- mapped rows; this function re-validates every row server-side, detects
-- duplicates against existing prospects AND earlier rows in the same file,
-- and never overwrites an existing prospect. p_commit = false is a dry-run
-- preview returning the same per-row outcome without writing anything.

create or replace function public.import_prospects(p_rows jsonb, p_commit boolean default false, p_filename text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_idx integer := 0;
  v_name text;
  v_norm text;
  v_reg text;
  v_email text;
  v_phone text;
  v_domain text;
  v_match uuid;
  v_reason text;
  v_results jsonb := '[]'::jsonb;
  v_new_id uuid;
  v_created integer := 0;
  v_duplicates integer := 0;
  v_rejected integer := 0;
  seen_norm text[] := '{}';
  seen_reg text[] := '{}';
  seen_email text[] := '{}';
  v_province text;
begin
  if not public.can_manage_prospect_hub() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Rows must be an array'; end if;
  if jsonb_array_length(p_rows) > 2000 then raise exception 'Import is limited to 2000 rows per file'; end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_idx := v_idx + 1;
    v_match := null; v_reason := null;
    v_name := nullif(trim(regexp_replace(coalesce(v_row->>'company_name', ''), '^[=+\-@]+', '')), '');
    v_norm := public.normalize_company_name(v_name);
    v_reg := public.normalize_registration_number(v_row->>'registration_number');
    v_email := nullif(lower(trim(v_row->>'email')), '');
    v_phone := case when nullif(trim(v_row->>'phone'), '') is null then null else public.normalize_sa_phone(v_row->>'phone') end;
    v_domain := public.website_domain(nullif(trim(v_row->>'website'), ''));
    v_province := nullif(trim(v_row->>'province'), '');

    if v_name is null or v_norm is null then
      v_rejected := v_rejected + 1;
      v_results := v_results || jsonb_build_object('index', v_idx, 'status', 'rejected', 'reason', 'Company name is required');
      continue;
    end if;
    if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_rejected := v_rejected + 1;
      v_results := v_results || jsonb_build_object('index', v_idx, 'status', 'rejected', 'reason', 'Invalid email');
      continue;
    end if;
    if v_province is not null and v_province not in ('Gauteng','Western Cape','Eastern Cape','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Free State','Northern Cape') then
      v_rejected := v_rejected + 1;
      v_results := v_results || jsonb_build_object('index', v_idx, 'status', 'rejected', 'reason', 'Unknown province');
      continue;
    end if;

    -- duplicates within the file
    if v_norm = any(seen_norm) or (v_reg is not null and v_reg = any(seen_reg)) or (v_email is not null and v_email = any(seen_email)) then
      v_duplicates := v_duplicates + 1;
      v_results := v_results || jsonb_build_object('index', v_idx, 'status', 'duplicate', 'reason', 'Duplicate of an earlier row in this file');
      continue;
    end if;

    -- duplicates against existing prospects
    select id, case
             when v_reg is not null and public.normalize_registration_number(registration_number) = v_reg then 'Same registration number'
             when normalized_name = v_norm then 'Same company name'
             when v_email is not null and email = v_email then 'Same email'
             when v_domain is not null and website_domain = v_domain then 'Same website'
             else 'Same phone' end
      into v_match, v_reason
    from public.prospects
    where (v_reg is not null and public.normalize_registration_number(registration_number) = v_reg)
       or normalized_name = v_norm
       or (v_email is not null and email = v_email)
       or (v_domain is not null and website_domain = v_domain)
       or (v_phone is not null and phone = v_phone)
    limit 1;

    seen_norm := seen_norm || v_norm;
    if v_reg is not null then seen_reg := seen_reg || v_reg; end if;
    if v_email is not null then seen_email := seen_email || v_email; end if;

    if v_match is not null then
      v_duplicates := v_duplicates + 1;
      v_results := v_results || jsonb_build_object('index', v_idx, 'status', 'duplicate', 'reason', v_reason, 'prospect_id', v_match);
      continue;
    end if;

    if p_commit then
      insert into public.prospects (company_name, registration_number, sector, city, province, email, phone, website,
        contact_name, source_name, source_url, website_source, created_by, metadata)
      values (v_name, nullif(trim(v_row->>'registration_number'), ''), nullif(trim(v_row->>'sector'), ''),
        nullif(trim(v_row->>'city'), ''), v_province, v_email, nullif(trim(v_row->>'phone'), ''),
        nullif(trim(v_row->>'website'), ''), nullif(trim(v_row->>'contact_name'), ''), 'Spreadsheet import',
        nullif(trim(v_row->>'source_url'), ''), case when nullif(trim(v_row->>'website'), '') is not null then 'import' end,
        auth.uid(), jsonb_build_object('import_filename', p_filename))
      returning id into v_new_id;
      insert into public.prospect_activities (prospect_id, activity_type, summary, performed_by, metadata)
      values (v_new_id, 'discovery', 'Imported from spreadsheet' || coalesce(' (' || p_filename || ')', ''), auth.uid(), jsonb_build_object('filename', p_filename));
      v_results := v_results || jsonb_build_object('index', v_idx, 'status', 'created', 'prospect_id', v_new_id);
    else
      v_results := v_results || jsonb_build_object('index', v_idx, 'status', 'ready');
    end if;
    v_created := v_created + 1;
  end loop;

  if p_commit then
    perform public.log_prospect_audit('prospect.import', null, null, null,
      jsonb_build_object('created', v_created, 'duplicates', v_duplicates, 'rejected', v_rejected),
      jsonb_build_object('filename', p_filename, 'rows', jsonb_array_length(p_rows)));
    update public.prospect_sources set last_attempt_at = now(), last_success_at = now(), total_runs = total_runs + 1,
      records_discovered = records_discovered + jsonb_array_length(p_rows), prospects_created = prospects_created + v_created, status = 'healthy'
    where key = 'import';
  end if;

  return jsonb_build_object('committed', p_commit, 'created', v_created, 'duplicates', v_duplicates, 'rejected', v_rejected, 'rows', v_results);
end;
$$;
revoke all on function public.import_prospects(jsonb, boolean, text) from public, anon;
grant execute on function public.import_prospects(jsonb, boolean, text) to authenticated;

update public.prospect_discovery_settings set page_size = 5 where source_name = 'National Treasury eTenders OCDS';
