-- Adds the two staff-permission flags that gate the Client Import/Export
-- feature (bulk/single export, bulk import). Independent toggles, no
-- cascading relationship to can_manage_clients or any other permission.
--
-- Reconstructed to match the live production schema after the original
-- local source for this migration was lost (never committed). The columns
-- below already exist on the linked project; this file is idempotent so it
-- is safe to keep in history without needing to be re-applied.

alter table public.staff_permissions
  add column if not exists can_export_clients boolean not null default false,
  add column if not exists can_import_clients boolean not null default false;
