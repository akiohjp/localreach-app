-- ============================================================================
-- AI-written guest review drafts (Gemini), per-store opt-in.
--
-- The guest flow keeps the zero-API template engine as its floor. When a
-- store's ai_review_enabled is ON, /api/generate-review asks Gemini for the
-- draft first and falls back to the template engine on any failure, so the
-- guest never waits on a broken upstream. The switch is master-admin only:
-- every call is billed to the platform's Gemini key.
--
-- 1) stores.ai_review_enabled  — the switch (default OFF; nothing changes for
--                                 existing stores until it is flipped)
-- 2) public_store_review        — the anon-safe view gains the switch so the
--                                 QR page knows whether to call the route at all
--                                 (CREATE OR REPLACE: the column is appended, so
--                                 the live view is never dropped)
-- 3) ai_review_drafts           — what the model wrote (or why it was rejected),
--                                 so a human can read the drafts guests actually
--                                 received. Service-role writes only; owners may
--                                 read their own store's rows.
--
-- Safe to re-run.
-- ============================================================================

alter table public.stores
  add column if not exists ai_review_enabled boolean not null default false;

comment on column public.stores.ai_review_enabled is
  'Master-admin switch: guests of this store get a Gemini-written review draft (template engine stays the fallback). Billed per call; default off.';

-- Column list must match the live view exactly, plus the new column at the END
-- (CREATE OR REPLACE VIEW only allows appending).
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
    (is_active and (subscription_expires_at is null or subscription_expires_at > now())) as is_active,
    logo_url,
    business_category,
    entity_area,
    entity_city,
    entity_category_label,
    contact_channel,
    contact_dial_code,
    keyword_types,
    ai_review_enabled
  from public.stores;

comment on view public.public_store_review is
  'Anon-safe columns of stores for the public /store/[id] QR review page. '
  'Excludes owner_id, description and timestamps. is_active is the EFFECTIVE '
  'value: manual kill switch AND subscription not expired.';

revoke all on public.public_store_review from anon, authenticated;
grant select on public.public_store_review to anon, authenticated;

create table if not exists public.ai_review_drafts (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  -- 'ai' = the guest received this draft; 'fallback' = every attempt was
  -- rejected or failed and the guest got the template engine instead.
  outcome text not null check (outcome in ('ai', 'fallback')),
  model text,
  locale text not null,
  rating smallint not null,
  keywords jsonb not null default '[]'::jsonb,
  guest_note text,
  -- The shipped draft (outcome 'ai') or the last rejected candidate (fallback).
  draft text,
  -- Why the route fell back: rate_limited, timeout, keyword_missing:<kw>, ...
  reason text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists ai_review_drafts_store_created_idx
  on public.ai_review_drafts (store_id, created_at desc);

alter table public.ai_review_drafts enable row level security;

drop policy if exists "owners read own ai review drafts" on public.ai_review_drafts;
create policy "owners read own ai review drafts"
  on public.ai_review_drafts for select to authenticated
  using (
    exists (
      select 1 from public.stores s
      where s.id = ai_review_drafts.store_id and s.owner_id = auth.uid()
    )
  );

comment on table public.ai_review_drafts is
  'Every AI draft attempt from /api/generate-review: what the guest received or why the route fell back to the template engine. Service-role writes only.';

-- ============================================================================
-- Verification (SQL editor, after applying)
-- ============================================================================
-- 1) select ai_review_enabled from public.public_store_review limit 1;   -- false
-- 2) select count(*) from public.ai_review_drafts;                         -- 0
-- 3) select policyname from pg_policies where tablename = 'ai_review_drafts';
