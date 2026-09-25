-- Tighten EXECUTE grants flagged by the Supabase security advisor.
-- Trigger functions are never meant to be called through the API, and the
-- suppression lookup must not be usable to probe whether an address is on
-- the marketing suppression list. Triggers keep firing (EXECUTE is not
-- checked at trigger fire time) and SECURITY DEFINER callers run as owner.
revoke execute on function public.audit_prospect_config_change() from public, anon, authenticated;
revoke execute on function public.prospects_after_update_audit() from public, anon, authenticated;
revoke execute on function public.refresh_prospect_procurement_stats() from public, anon, authenticated;
revoke execute on function public.sync_prospect_next_follow_up() from public, anon, authenticated;
revoke execute on function public.prospects_before_write() from public, anon, authenticated;
revoke execute on function public.is_prospect_email_suppressed(text) from public, anon, authenticated;
grant execute on function public.is_prospect_email_suppressed(text) to service_role;
