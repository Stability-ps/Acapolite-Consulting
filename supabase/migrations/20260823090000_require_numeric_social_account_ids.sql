-- Root cause of the "permission missing" report: the Connect Account form
-- had no validation, so profile URLs (facebook.com/instagram.com) were
-- entered where Meta's numeric Graph API IDs belong. The connection health
-- check has since been fixed to detect this, auto-discover the correct
-- numeric ID from META_ACCESS_TOKEN via /me/accounts, and self-correct the
-- row (see social-connection-health). This migration adds the constraint
-- that should have existed from the start.
--
-- Added NOT VALID: the two known-bad rows haven't necessarily been
-- corrected yet at migration time (that happens the next time an admin
-- runs "Check token health", which now self-heals them). NOT VALID means
-- Postgres enforces the check on every NEW insert/update starting now
-- (so this mistake can never happen again) without failing on data that
-- hasn't been corrected yet. Run `alter table ... validate constraint ...`
-- once every row has been confirmed numeric.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'social_accounts_provider_account_id_numeric'
      and conrelid = 'public.social_accounts'::regclass
  ) then
    alter table public.social_accounts
      add constraint social_accounts_provider_account_id_numeric
      check (provider_account_id ~ '^[0-9]+$') not valid;
  end if;
end
$$;
