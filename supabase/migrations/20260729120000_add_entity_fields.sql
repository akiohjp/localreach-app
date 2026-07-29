-- ============================================================================
-- Entity layer for AI visibility (AIO / GEO / Local SEO).
--
-- Why: the generated review text is the ONLY text surface LocalReach controls,
-- and until now it could not state WHAT the business is or WHERE it is — the
-- {kw} slots are dish/object slots, so putting "Motor City" in keywords
-- produced "Definitely try Motor City" (observed on live store E2E 2026-07-29).
-- AI answer engines (AI Overviews / AI Mode / ChatGPT) and Google's local
-- ranking both match reviews against "<category> in <area>" language, so every
-- review should carry the entity once, in natural guest wording.
--
-- New columns (all optional — stores without them behave exactly as before):
--   entity_area           branch neighbourhood, e.g. 'Motor City'
--   entity_city           city, e.g. 'Dubai'
--   entity_category_label per-locale NATURAL NOUN for the business, e.g.
--                         {"en":"udon restaurant","ja":"うどん店","ar":"مطعم ياباني"}
--                         (NOT the vertical selector `business_category`, which
--                         stays the pool/flavour switch.)
--
-- The engine guarantees at most ONE entity sentence per review, skips parts
-- already present (e.g. a forced keyword that contains the area), and never
-- routes entity terms through the {kw} object slots.
--
-- Safe to re-run.
-- ============================================================================

alter table public.stores
  add column if not exists entity_area text null,
  add column if not exists entity_city text null,
  add column if not exists entity_category_label jsonb not null default '{}'::jsonb;

comment on column public.stores.entity_area is
  'Branch neighbourhood/area woven once into generated reviews (e.g. "Motor City"). NULL = not woven.';
comment on column public.stores.entity_city is
  'City occasionally appended after the area (e.g. "Dubai"). NULL = not woven.';
comment on column public.stores.entity_category_label is
  'Per-locale natural business noun for review text, e.g. {"en":"udon restaurant","ja":"うどん店","ar":"مطعم ياباني"}. Empty = not woven.';

-- Recreate the anon-safe view with the entity columns. Column list must stay in
-- sync with the live view (business_category + effective is_active included).
-- security_invoker stays OFF (default) intentionally — the view runs with owner
-- rights; base-table RLS still blocks direct anon reads.
drop view if exists public.public_store_review;

create view public.public_store_review as
  select
    id,
    store_name,
    greeting_text,
    keywords,
    forced_keywords,
    google_review_url,
    brand_color,
    default_language,
    (is_active and (subscription_expires_at is null or subscription_expires_at > now())) as is_active,
    logo_url,
    business_category,
    entity_area,
    entity_city,
    entity_category_label
  from public.stores;

comment on view public.public_store_review is
  'Anon-safe columns of stores for the public /store/[id] QR review page. '
  'Excludes owner_id, description and timestamps. is_active is the EFFECTIVE '
  'value: manual kill switch AND subscription not expired.';

revoke all on public.public_store_review from anon, authenticated;
grant select on public.public_store_review to anon, authenticated;

-- ============================================================================
-- Verification (SQL editor, after applying)
-- ============================================================================
-- 1) Columns exist and default correctly:
--    select entity_area, entity_city, entity_category_label from public.stores limit 3;
-- 2) View exposes them to anon:
--    select entity_area, entity_category_label from public.public_store_review limit 1;
-- 3) Policies on base table unchanged:
--    select polname from pg_policies where schemaname='public' and tablename='stores';
