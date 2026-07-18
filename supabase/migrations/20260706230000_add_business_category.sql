-- business_category was added to production out-of-band (no migration), which
-- makes a fresh rebuild from supabase/migrations/ fail at 20260707000000 (the
-- public_store_review view references the column). Dated BEFORE that migration
-- so a clean provisioning succeeds; idempotent on the live DB.

alter table public.stores add column if not exists business_category text;

comment on column public.stores.business_category is
  'Free-text business category (resolved to a review-template vertical in lib/review-pools.ts resolveVertical).';
