-- ============================================================================
-- Subscription auto-expiry (contract-end lockout).
--
-- Before: lockout was manual only — master admin toggles stores.is_active.
-- After:  stores.subscription_expires_at (nullable timestamptz) records the
--         contract end. Effective active =
--           is_active AND (subscription_expires_at IS NULL OR > now()).
--         The anon-safe view public_store_review now exposes the EFFECTIVE
--         value as `is_active`, so the public QR review page locks itself the
--         moment the contract lapses with no app redeploy. Server code gates
--         base-table reads via lib/subscription.ts (isStoreCurrentlyActive).
--
-- NULL = no expiry (default) → zero behaviour change for existing stores.
-- Safe to re-run.
-- ============================================================================

alter table public.stores
  add column if not exists subscription_expires_at timestamptz null;

comment on column public.stores.subscription_expires_at is
  'Contract/subscription end (UTC). NULL = no expiry. Effective active = '
  'is_active AND (subscription_expires_at IS NULL OR subscription_expires_at > now()).';

-- Recreate the anon-safe view with the effective active flag. Column list must
-- stay in sync with the live view (includes business_category added after
-- 20260701120000). security_invoker stays OFF (default) intentionally — the
-- view runs with owner rights; base-table RLS still blocks direct anon reads.
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
    business_category
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
-- 1) Column exists, all rows NULL initially:
--    select id, is_active, subscription_expires_at from public.stores;
-- 2) Expiry flips the view flag without touching is_active:
--    update public.stores set subscription_expires_at = now() - interval '1 day'
--     where id = '<qa-store-id>';
--    select is_active from public.public_store_review where id = '<qa-store-id>';
--    -- expect: false  (then reset subscription_expires_at to null)
