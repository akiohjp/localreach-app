-- Ensure customers RLS policies are correct.
-- Using drop-if-exists + recreate so this is safe to apply on any DB state.

alter table public.customers enable row level security;

-- Super admin: full access
drop policy if exists "super_admin_all" on public.customers;
create policy "super_admin_all" on public.customers
  for all
  using  (public.is_super_admin())
  with check (public.is_super_admin());

-- Store owner: read their own store's customers
drop policy if exists "owner_select" on public.customers;
create policy "owner_select" on public.customers
  for select using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
    )
  );

-- Public visitors: insert only for active stores
drop policy if exists "public_insert" on public.customers;
create policy "public_insert" on public.customers
  for insert with check (
    exists (
      select 1 from public.stores
      where id = store_id and is_active = true
    )
  );
