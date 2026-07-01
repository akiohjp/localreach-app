-- ============================================================================
-- Private low-rating feedback capture.
--
-- Before: StepFeedback (<4★ path) showed "thank you" but never persisted the
--         text anywhere — silent data loss for the store owner.
-- After:  feedback is written server-side via the service role (/api/feedback),
--         so there is NO anon INSERT path; owners read their own via RLS.
--
-- Idempotent. Apply AFTER a backup.
-- ============================================================================

create table if not exists public.feedback (
  id         uuid        primary key default gen_random_uuid(),
  store_id   uuid        not null references public.stores(id) on delete cascade,
  rating     smallint    not null check (rating between 1 and 5),
  message    text        not null check (char_length(btrim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_store_id_idx  on public.feedback(store_id);
create index if not exists feedback_created_at_idx on public.feedback(created_at desc);

alter table public.feedback enable row level security;

-- Writes go through the service-role API route (bypasses RLS); no anon policy.
drop policy if exists "super_admin_all" on public.feedback;
create policy "super_admin_all" on public.feedback
  for all
  using      (public.is_super_admin())
  with check (public.is_super_admin());

-- Store owner can read their own store's feedback.
drop policy if exists "owner_select" on public.feedback;
create policy "owner_select" on public.feedback
  for select using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

comment on table public.feedback is
  'Private (<4 star) guest feedback. Written by the service role via /api/feedback; readable by the store owner.';
