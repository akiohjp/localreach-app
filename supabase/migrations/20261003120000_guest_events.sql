-- ============================================================================
-- Guest taps on the review screen (guest_events)
--
-- store_views records that a guest opened the page and ai_review_drafts that a
-- draft was written. Nothing recorded whether they then went to Google. At Let
-- it dough (2026-10-03) 43 guests received an AI draft and 2 of those drafts
-- are on Google, and there was no way to tell whether the other 41 stopped on
-- the draft screen or reached Google and gave up there.
--
-- One row per tap, written by /api/event from the guest's browser:
--   draft_shown   the draft screen appeared (template and AI drafts alike)
--   post_click    the guest tapped the button that copies and opens Google
--   copy          the guest tapped Copy on its own
--   copy_blocked  the clipboard refused (in-app browsers); the text was selected
--
-- session_id is the same per-tab id /api/view stores, so an open, a draft and a
-- tap from one guest line up. Nothing here identifies a person.
--
-- Safe to re-run.
-- ============================================================================

create table if not exists public.guest_events (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  event text not null check (event in ('draft_shown', 'post_click', 'copy', 'copy_blocked')),
  session_id text,
  locale text,
  ip_hash text,
  device text check (device in ('mobile', 'tablet', 'desktop', 'unknown'))
);

create index if not exists guest_events_store_created_idx
  on public.guest_events (store_id, created_at desc);

alter table public.guest_events enable row level security;

drop policy if exists "owners read own guest events" on public.guest_events;
create policy "owners read own guest events"
  on public.guest_events for select to authenticated
  using (
    exists (
      select 1 from public.stores s
      where s.id = guest_events.store_id and s.owner_id = auth.uid()
    )
  );

comment on table public.guest_events is
  'Guest taps on the review screen (draft shown, Google button, copy), written by /api/event from the browser. Service-role writes only; readable by the store owner.';
