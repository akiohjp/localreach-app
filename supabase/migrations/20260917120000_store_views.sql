-- ============================================================================
-- Guest page opens (store_views)
--
-- Until now the only trace a guest left was ai_review_drafts: the row written
-- when they pressed "write my review". Someone who scanned the QR, read the
-- page and closed it was invisible, so a demo that was opened and ignored and
-- a demo that was never opened at all looked exactly the same.
--
-- This table records the open itself. Written by /api/view from the guest's
-- own browser (never from the server render), because WhatsApp, iMessage and
-- Slack fetch a link's page to build their preview card: logging server-side
-- would count every forward of the link as a visit.
--
-- What is kept is deliberately coarse. ip_prefix is the /24 (IPv4) or /48
-- (IPv6) of the caller, enough to tell "our own line" from "somebody else's",
-- and ip_hash is a salted digest, enough to tell two devices apart without
-- storing anyone's address. Service-role writes only; owners read their own.
--
-- Safe to re-run.
-- ============================================================================

create table if not exists public.store_views (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  opened_at timestamptz not null default now(),
  -- Which address was used: 'r' = the short QR link, 'store' = the old
  -- /store/<uuid> link printed on cards issued before 2026-09-06.
  entry text not null default 'r' check (entry in ('r', 'store')),
  locale text,
  -- Random per-browser-session id, so repeat renders inside one visit collapse
  -- into one row and two visits stay two rows.
  session_id text,
  -- /24 of an IPv4 caller ("91.73.7.0"), /48 of an IPv6 one. Never the address.
  ip_prefix text,
  -- sha256(address + salt), first 16 hex. Distinguishes devices, identifies none.
  ip_hash text,
  device text check (device in ('mobile', 'tablet', 'desktop', 'unknown')),
  ua text,
  -- Host only ("l.instagram.com"), never the full referring URL.
  referrer_host text
);

create index if not exists store_views_store_opened_idx
  on public.store_views (store_id, opened_at desc);

alter table public.store_views enable row level security;

drop policy if exists "owners read own store views" on public.store_views;
create policy "owners read own store views"
  on public.store_views for select to authenticated
  using (
    exists (
      select 1 from public.stores s
      where s.id = store_views.store_id and s.owner_id = auth.uid()
    )
  );

comment on table public.store_views is
  'One row per guest page open, written by /api/view from the browser. Service-role writes only; readable by the store owner. Retention: 400 days via purge_store_views().';

create or replace function public.purge_store_views()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.store_views where opened_at < now() - interval '400 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_store_views() from public, anon, authenticated;

-- ============================================================================
-- Verification (SQL editor, after applying)
-- ============================================================================
-- 1) select count(*) from public.store_views;                            -- 0
-- 2) select policyname from pg_policies where tablename = 'store_views';
-- 3) select public.purge_store_views();                                  -- 0
