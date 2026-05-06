do $$
begin
  if exists (
    select from pg_tables where schemaname = 'public' and tablename = 'stores'
  ) then
    drop policy if exists "super_admin_all" on public.stores;
    drop policy if exists "owner_select"    on public.stores;
    drop policy if exists "owner_insert"    on public.stores;
    drop policy if exists "owner_update"    on public.stores;
    drop policy if exists "owner_delete"    on public.stores;
    drop trigger if exists stores_set_updated_at on public.stores;
    drop table public.stores cascade;
  end if;
end;
$$;

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin',
    false
  );
$$;

create table public.stores (
  id                uuid        primary key default gen_random_uuid(),
  owner_id          uuid        not null references auth.users(id) on delete cascade,
  store_name        jsonb       not null default '{}'::jsonb
                                check (jsonb_typeof(store_name)    = 'object'),
  greeting_text     jsonb       not null default '{}'::jsonb
                                check (jsonb_typeof(greeting_text) = 'object'),
  description       jsonb       not null default '{}'::jsonb
                                check (jsonb_typeof(description)   = 'object'),
  default_language  text        not null default 'en'
                                check (default_language in ('en', 'ja', 'ar')),
  google_review_url text        not null,
  keywords          jsonb       not null default '[]'::jsonb
                                check (jsonb_typeof(keywords) = 'array'),
  brand_color       text        not null default '#000000',
  logo_url          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index stores_owner_id_idx         on public.stores(owner_id);
create index stores_default_language_idx on public.stores(default_language);

create trigger stores_set_updated_at
  before update on public.stores
  for each row execute procedure public.set_updated_at();

alter table public.stores enable row level security;

create policy "super_admin_all" on public.stores
  for all
  using  (public.is_super_admin())
  with check (public.is_super_admin());

create policy "owner_select" on public.stores
  for select using (auth.uid() = owner_id);

create policy "owner_insert" on public.stores
  for insert with check (auth.uid() = owner_id);

create policy "owner_update" on public.stores
  for update
  using      (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "owner_delete" on public.stores
  for delete using (auth.uid() = owner_id);

insert into storage.buckets (id, name, public)
values ('store-logos', 'store-logos', true)
on conflict (id) do nothing;

drop policy if exists "owner_upload_logo" on storage.objects;
drop policy if exists "owner_update_logo" on storage.objects;
drop policy if exists "public_read_logo"  on storage.objects;

create policy "owner_upload_logo" on storage.objects
  for insert with check (
    bucket_id = 'store-logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "owner_update_logo" on storage.objects
  for update using (
    bucket_id = 'store-logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "public_read_logo" on storage.objects
  for select using (bucket_id = 'store-logos');
