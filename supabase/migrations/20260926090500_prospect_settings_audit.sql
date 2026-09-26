-- Audit trail for Prospect Hub configuration changes (sending switch and
-- limits, discovery/enrichment settings, source enable/disable, template
-- edits). Only changed columns are recorded.

create or replace function public.audit_prospect_config_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := to_jsonb(old) - 'updated_at' - 'last_run_at' - 'last_success_at' - 'last_error' - 'last_attempt_at'
                 - 'window_cursor' - 'next_page' - 'consecutive_failures' - 'total_runs' - 'total_failures'
                 - 'records_discovered' - 'prospects_created' - 'status';
  v_new jsonb := to_jsonb(new) - 'updated_at' - 'last_run_at' - 'last_success_at' - 'last_error' - 'last_attempt_at'
                 - 'window_cursor' - 'next_page' - 'consecutive_failures' - 'total_runs' - 'total_failures'
                 - 'records_discovered' - 'prospects_created' - 'status';
  v_changed_old jsonb := '{}'::jsonb;
  v_changed_new jsonb := '{}'::jsonb;
  k text;
begin
  for k in select jsonb_object_keys(v_new) loop
    if v_new->k is distinct from v_old->k then
      v_changed_old := v_changed_old || jsonb_build_object(k, v_old->k);
      v_changed_new := v_changed_new || jsonb_build_object(k, v_new->k);
    end if;
  end loop;
  if v_changed_new <> '{}'::jsonb then
    insert into public.prospect_audit_log (actor_id, action, old_values, new_values, metadata)
    values (auth.uid(), 'config.' || tg_table_name, v_changed_old, v_changed_new, jsonb_build_object('row_id', new.id));
  end if;
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['prospect_campaign_settings','prospect_discovery_settings','prospect_enrichment_settings','prospect_sources','prospect_email_templates'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after update on public.%I for each row execute function public.audit_prospect_config_change()', t || '_audit', t);
  end loop;
end $$;
