-- Platform-variant pipeline: social_platform_variants gains the columns
-- the transform pipeline needs (aspect_ratio/mime_type/transformation
-- metadata - the table existed but was placeholder-only until now, see
-- 20260822170000). social_scheduled_posts gains platform_variant_id so a
-- scheduled post can point at a generated variant instead of the original
-- when one was needed to pass validation.

alter table public.social_platform_variants
  add column if not exists aspect_ratio numeric(6, 3),
  add column if not exists mime_type text,
  add column if not exists transformation_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'social_platform_variants' and column_name = 'aspect_ratio' and is_nullable = 'NO'
  ) then
    -- Table is variant-generation-only and was empty until this pipeline
    -- shipped, so backfilling isn't needed before enforcing NOT NULL.
    update public.social_platform_variants set aspect_ratio = width_px::numeric / height_px::numeric where aspect_ratio is null;
    update public.social_platform_variants set mime_type = 'image/jpeg' where mime_type is null;
    alter table public.social_platform_variants alter column aspect_ratio set not null;
    alter table public.social_platform_variants alter column mime_type set not null;
  end if;
end
$$;

alter table public.social_scheduled_posts
  add column if not exists platform_variant_id uuid references public.social_platform_variants(id) on delete set null;

create index if not exists social_scheduled_posts_platform_variant_idx
  on public.social_scheduled_posts (platform_variant_id)
  where platform_variant_id is not null;
