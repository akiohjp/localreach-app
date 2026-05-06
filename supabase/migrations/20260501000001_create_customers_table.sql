create table public.customers (
  id         uuid        primary key default gen_random_uuid(),
  store_id   uuid        not null references public.stores(id) on delete cascade,
  whatsapp   text        not null,
  created_at timestamptz not null default now()
);

create index customers_store_id_idx  on public.customers(store_id);
create index customers_created_at_idx on public.customers(created_at desc);

alter table public.customers enable row level security;

-- Super admin can do everything
create policy "super_admin_all" on public.customers
  for all
  using  (public.is_super_admin())
  with check (public.is_super_admin());

-- Store owner can view their own store's customers
create policy "owner_select" on public.customers
  for select using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
    )
  );

-- Unauthenticated visitors can submit their WhatsApp number
-- (only allowed for active stores)
create policy "public_insert" on public.customers
  for insert with check (
    exists (
      select 1 from public.stores
      where id = store_id and is_active = true
    )
  );
