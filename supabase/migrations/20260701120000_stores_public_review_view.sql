-- ============================================================================
-- Fix cross-tenant PII leak on the public QR review page.
--
-- Before: `public_review_page_select_store` granted anon+authenticated
--         `SELECT ... USING (true)` on the BASE `stores` table, and
--         app/store/[id]/page.tsx did `select('*')`. Any holder of the public
--         anon key could read every store's owner_id / notification_email /
--         google_review_url for arbitrary IDs (cross-tenant PII).
--
-- After:  anon reads a VIEW exposing only the columns the review page needs.
--         The base table has NO anon SELECT policy — owner_select (authenticated
--         owner) and the service-role client (admin/master) are unaffected.
--
-- Safe to re-run. Apply AFTER a backup. Verification queries at the bottom.
-- ============================================================================

-- 1) Remove the blanket anon/authenticated SELECT on the base table.
drop policy if exists "public_review_page_select_store" on public.stores;

-- 2) Anon-safe projection. Excludes owner_id, notification_email, description,
--    created_at, updated_at. security_invoker is left OFF (default) so the view
--    runs with its owner's rights and returns only these columns to callers
--    granted on the view — the base table's RLS still blocks direct anon reads.
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
    is_active,
    logo_url
  from public.stores;

comment on view public.public_store_review is
  'Anon-safe columns of stores for the public /store/[id] QR review page. '
  'Excludes owner_id, notification_email, description and timestamps.';

-- 3) Expose the view to the guest (anon) + logged-in (authenticated) roles.
--    Revoke first so re-runs stay deterministic.
revoke all on public.public_store_review from anon, authenticated;
grant select on public.public_store_review to anon, authenticated;

-- ============================================================================
-- Verification (run in SQL editor after applying)
-- ============================================================================
-- Base table no longer anon-readable (should return 0 rows / permission error
-- when queried through the anon key via PostgREST):
--   select * from public.stores;                     -- as anon → blocked
-- View returns safe columns only:
--   select * from public.public_store_review limit 1;-- as anon → ok, no PII
-- Confirm the blanket policy is gone:
--   select polname from pg_policies
--    where schemaname='public' and tablename='stores';
--   -- expect: super_admin_all, owner_select, owner_insert, owner_update,
--   --         owner_delete  (NOT public_review_page_select_store)
