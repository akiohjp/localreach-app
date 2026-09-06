-- 2026-09-06: who writes this store's reviews.
--
-- The review engine now speaks in a visitor's voice for stores whose guests are
-- in town once (no "my go-to rug store", no "adding it to the rotation") and
-- decides that from the free-text business_category (lib/review-pools.ts
-- resolveAudience). Cinar Dubai sells the same rugs as Cinar Istanbul, but to
-- residents and interior buyers, and the category alone cannot tell the two
-- apart. This column is the owner's word; null keeps the heuristic.
alter table public.stores
  add column if not exists guest_audience text
  check (guest_audience is null or guest_audience in ('local', 'visitor'));

comment on column public.stores.guest_audience is
  'Who writes the reviews: local (can come back) | visitor (in town once). Null = category heuristic (lib/review-pools resolveAudience).';

-- The anon-safe projection that feeds the guest page. CREATE OR REPLACE VIEW
-- may only append columns, so the new one goes last; everything else is the
-- live definition as of 2026-09-06 (pg_get_viewdef), unchanged.
create or replace view public.public_store_review as
select
  id,
  store_name,
  greeting_text,
  keywords,
  forced_keywords,
  google_review_url,
  brand_color,
  default_language,
  is_active and (subscription_expires_at is null or subscription_expires_at > now()) as is_active,
  logo_url,
  business_category,
  entity_area,
  entity_city,
  entity_category_label,
  contact_channel,
  contact_dial_code,
  keyword_types,
  ai_review_enabled,
  guest_audience
from public.stores;
