-- Enable UUID extension (already available in Supabase by default)
create extension if not exists "pgcrypto";

-- stores table
create table if not exists public.stores (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  store_name    text not null,
  google_review_url text not null,
  keywords      jsonb not null default '[]'::jsonb,
  brand_color   text not null default '#000000',
  logo_url      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for fast owner lookups
create index if not exists stores_owner_id_idx on public.stores(owner_id);

-- Auto-update updated_at on row changes
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stores_set_updated_at
  before update on public.stores
  for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------
alter table public.stores enable row level security;

-- Super admin helper: checks custom claim set via Supabase Dashboard / Edge Function
create or replace function public.is_super_admin()
returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin',
    false
  );
$$;

-- Super admin: full access
create policy "super_admin_all" on public.stores
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Client owner: can only see and modify their own store
create policy "owner_select" on public.stores
  for select
  using (auth.uid() = owner_id);

create policy "owner_insert" on public.stores
  for insert
  with check (auth.uid() = owner_id);

create policy "owner_update" on public.stores
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "owner_delete" on public.stores
  for delete
  using (auth.uid() = owner_id);

-- -------------------------------------------------------
-- Storage bucket for logos
-- -------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('store-logos', 'store-logos', true)
on conflict (id) do nothing;

-- Owners can upload/update their own logos
create policy "owner_upload_logo" on storage.objects
  for insert
  with check (
    bucket_id = 'store-logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "owner_update_logo" on storage.objects
  for update
  using (
    bucket_id = 'store-logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read access for logos (needed to display in customer-facing app)
create policy "public_read_logo" on storage.objects
  for select
  using (bucket_id = 'store-logos');
