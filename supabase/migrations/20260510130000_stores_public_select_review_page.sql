-- Guest QR flow (/store/[id]) uses SSR + anon Supabase client (no logged-in cookie).
-- Without this policy only owner_select matched for authenticated owners — anonymous got zero rows → 404.

drop policy if exists "public_review_page_select_store" on public.stores;

create policy "public_review_page_select_store"
  on public.stores
  for select
  to anon, authenticated
  using (true);
