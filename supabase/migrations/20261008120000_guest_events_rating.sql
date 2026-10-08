-- ============================================================================
-- guest_events: the stars, for stores with no draft (lib/review-mode.ts)
--
-- Let it dough (2026-10-08) asks for the stars and then sends the guest to
-- Google, with no keyword step and no draft. The rating used to be recorded
-- only alongside a draft, so without this the stars would be thrown away.
--
--   rated         the guest chose stars and tapped Continue (rating 1-5)
--   google_shown  the "write it on Google" screen appeared
--   post_click    (existing) the Google button was tapped
--
-- Additive only. Safe to re-run.
-- ============================================================================

alter table public.guest_events
  add column if not exists rating smallint check (rating between 1 and 5);

alter table public.guest_events
  drop constraint if exists guest_events_event_check;

alter table public.guest_events
  add constraint guest_events_event_check
  check (event in ('draft_shown', 'post_click', 'copy', 'copy_blocked', 'rated', 'google_shown'));
