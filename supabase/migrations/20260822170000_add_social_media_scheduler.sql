-- Social Media Scheduler: media library, campaigns, durable scheduled
-- posts, publish attempt history, and Meta account connections.
-- Fully isolated from the whatsapp_* tables/functions - no shared code,
-- no shared credentials, no shared cron job.

create extension if not exists pg_net;

-- Enums -----------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'social_platform') then
    create type public.social_platform as enum ('facebook', 'instagram', 'linkedin');
  end if;

  if not exists (select 1 from pg_type where typname = 'social_asset_status') then
    create type public.social_asset_status as enum ('active', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'social_campaign_status') then
    create type public.social_campaign_status as enum ('draft', 'approved', 'active', 'paused', 'completed', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'social_post_status') then
    create type public.social_post_status as enum ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled', 'skipped');
  end if;

  if not exists (select 1 from pg_type where typname = 'social_publish_attempt_status') then
    create type public.social_publish_attempt_status as enum ('success', 'temporary_failure', 'permanent_failure');
  end if;
end
$$;

-- social_accounts ---------------------------------------------------------
-- Non-secret connection metadata only. Access tokens live in Supabase
-- secrets (META_ACCESS_TOKEN), never in this table, never in an API
-- response, never logged.

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform public.social_platform not null,
  provider_account_id text not null,
  display_name text not null,
  is_active boolean not null default true,
  last_health_check_at timestamptz,
  last_health_check_status text,
  last_health_check_message text,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists social_accounts_platform_provider_id_key
  on public.social_accounts (platform, provider_account_id);

-- social_media_assets -----------------------------------------------------

create table if not exists public.social_media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  default_caption text,
  storage_path text not null,
  mime_type text not null,
  width_px integer not null check (width_px > 0),
  height_px integer not null check (height_px > 0),
  aspect_ratio numeric(6, 3) not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  checksum_sha256 text not null,
  status public.social_asset_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_media_assets_status_idx on public.social_media_assets (status, created_at desc);
create index if not exists social_media_assets_checksum_idx on public.social_media_assets (checksum_sha256);

-- social_platform_variants -------------------------------------------------
-- Derived/cropped per-platform renditions. Empty until a transformation
-- pipeline exists (see Phase 1 report note) - the original asset is what's
-- published today, but the table is ready for that without a schema change.

create table if not exists public.social_platform_variants (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.social_media_assets(id) on delete cascade,
  platform public.social_platform not null,
  storage_path text not null,
  width_px integer not null check (width_px > 0),
  height_px integer not null check (height_px > 0),
  file_size_bytes bigint not null check (file_size_bytes > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists social_platform_variants_asset_platform_key
  on public.social_platform_variants (media_asset_id, platform);

-- social_campaigns ----------------------------------------------------------

create table if not exists public.social_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  description text,
  status public.social_campaign_status not null default 'draft',
  start_at timestamptz not null,
  timezone text not null default 'Africa/Johannesburg',
  interval_days integer not null default 3 check (interval_days > 0),
  target_platforms public.social_platform[] not null default '{}'::public.social_platform[],
  default_caption_template text,
  default_hashtags text[] not null default '{}'::text[],
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  activated_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_campaigns_status_idx on public.social_campaigns (status, created_at desc);

-- social_campaign_items -----------------------------------------------------
-- The ordered poster list for a campaign, before schedule generation.

create table if not exists public.social_campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.social_campaigns(id) on delete cascade,
  media_asset_id uuid not null references public.social_media_assets(id) on delete restrict,
  position integer not null check (position >= 0),
  caption_override text,
  hashtags_override text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists social_campaign_items_campaign_position_key
  on public.social_campaign_items (campaign_id, position);

-- social_campaign_excluded_dates ---------------------------------------------

create table if not exists public.social_campaign_excluded_dates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.social_campaigns(id) on delete cascade,
  excluded_date date not null,
  reason text,
  created_at timestamptz not null default now()
);

create unique index if not exists social_campaign_excluded_dates_campaign_date_key
  on public.social_campaign_excluded_dates (campaign_id, excluded_date);

-- social_scheduled_posts ------------------------------------------------------
-- The durable, per-post publishing record. idempotency_key is the actual
-- duplicate-publish safety net: a deterministic SHA-256 of
-- (campaign, asset, platform, account, scheduled_at) computed by
-- _shared/socialIdempotency.ts, enforced unique here.

create table if not exists public.social_scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.social_campaigns(id) on delete cascade,
  campaign_item_id uuid references public.social_campaign_items(id) on delete set null,
  media_asset_id uuid not null references public.social_media_assets(id) on delete restrict,
  target_platform public.social_platform not null,
  social_account_id uuid not null references public.social_accounts(id) on delete restrict,
  scheduled_at timestamptz not null,
  next_retry_at timestamptz,
  caption text not null,
  hashtags text[] not null default '{}'::text[],
  status public.social_post_status not null default 'scheduled',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  published_at timestamptz,
  provider_post_id text,
  provider_permalink text,
  failure_code text,
  failure_message text,
  idempotency_key text not null,
  claimed_at timestamptz,
  claimed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists social_scheduled_posts_idempotency_key_key
  on public.social_scheduled_posts (idempotency_key);

create index if not exists social_scheduled_posts_due_idx
  on public.social_scheduled_posts (status, scheduled_at)
  where status = 'scheduled';

create index if not exists social_scheduled_posts_campaign_idx
  on public.social_scheduled_posts (campaign_id, scheduled_at);

-- social_publish_attempts ------------------------------------------------------
-- Full attempt history for audit and admin troubleshooting.

create table if not exists public.social_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  scheduled_post_id uuid not null references public.social_scheduled_posts(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status public.social_publish_attempt_status not null,
  provider_response jsonb,
  error_code text,
  error_message text,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists social_publish_attempts_post_idx
  on public.social_publish_attempts (scheduled_post_id, attempt_number);

-- RLS ---------------------------------------------------------------------
-- Admin-only, matching the existing whatsapp_* and staff/users precedent.
-- The publish worker and campaign-activate edge functions use the service
-- role key (bypasses RLS) exactly like whatsapp-agent/whatsapp-qa-feed do.

alter table public.social_accounts enable row level security;
alter table public.social_media_assets enable row level security;
alter table public.social_platform_variants enable row level security;
alter table public.social_campaigns enable row level security;
alter table public.social_campaign_items enable row level security;
alter table public.social_campaign_excluded_dates enable row level security;
alter table public.social_scheduled_posts enable row level security;
alter table public.social_publish_attempts enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'social_accounts', 'social_media_assets', 'social_platform_variants',
    'social_campaigns', 'social_campaign_items', 'social_campaign_excluded_dates',
    'social_scheduled_posts', 'social_publish_attempts'
  ]
  loop
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_admin_all'
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.get_my_role() = ''admin''::public.app_role) with check (public.get_my_role() = ''admin''::public.app_role);',
        t || '_admin_all', t
      );
    end if;
  end loop;
end
$$;

-- Storage bucket ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('social-media-assets', 'social-media-assets', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "social_media_assets_bucket_admin_all" on storage.objects;
create policy "social_media_assets_bucket_admin_all"
on storage.objects
for all
using (bucket_id = 'social-media-assets' and public.get_my_role() = 'admin'::public.app_role)
with check (bucket_id = 'social-media-assets' and public.get_my_role() = 'admin'::public.app_role);
