-- ============================================================================
-- stores.paid: which stores are paying clients.
--
-- Owner decision 2026-09-08: the Google Places snapshot (review_stats: daily
-- rating + review count, ~USD 0.017 per store per day) runs for PAYING stores
-- only. Demo stores exist to be shown, not measured, and at hundreds of demos
-- the daily calls would be the biggest line on the Google bill.
--
-- The flag is master-admin only (the "Paid" toggle) and is NOT in the anon
-- view: whether a store pays is nobody's business but ours. It also drives
-- the sales list's client / demo split.
--
-- Backfill: the stores under contract on 2026-09-08. Toggle in master admin
-- when that changes. Safe to re-run.
-- ============================================================================

alter table public.stores add column if not exists paid boolean not null default false;

comment on column public.stores.paid is
  'Paying client. Master-admin toggle. Gates the Google Places review_stats capture (daily cron + dashboard freshness); demos are never measured.';

update public.stores
set paid = true
where store_name->>'en' in ('Let It Dough!', 'Cinar Rugs Dubai', 'Cinar Rugs Istanbul', 'Cinar Rugs Cappadocia')
  and paid = false;

-- Verification:
--   select store_name->>'en', paid from public.stores where paid;   -- the four above
