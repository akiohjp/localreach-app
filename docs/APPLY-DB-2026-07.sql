-- ============================================================================
-- LocalReach — 本番 DB 適用スクリプト (2026-07-01)
--
-- Supabase Dashboard → SQL Editor にこのファイル全体を貼って 1 回実行するだけで、
-- 下記すべてが「冪等（何度実行しても安全）」に適用されます。**必ずバックアップ後に実行。**
--
--   0) customers.customer_name 欠落の修正   ← 保存が 42703 で 400 になる原因
--   1) stores 越境漏洩の修正（view 化）      ← 移行 20260701120000
--   2) customers 入力長 CHECK               ← 移行 20260701120001
--   3) feedback テーブル                     ← 移行 20260701120002
--
-- 個別ファイルで `supabase db push` する場合は supabase/migrations/ を参照。
-- ============================================================================

-- ── 0) 保存 400 の直接原因: customer_name / opt_in / selected_keywords 列を保証 ──
alter table public.customers add column if not exists customer_name     text;
alter table public.customers add column if not exists opt_in            boolean not null default true;
alter table public.customers add column if not exists selected_keywords text[];

-- ── 1) stores 匿名 SELECT を廃止し、非機微列のみの view に限定 ──
drop policy if exists "public_review_page_select_store" on public.stores;

drop view if exists public.public_store_review;
create view public.public_store_review as
  select id, store_name, greeting_text, keywords, forced_keywords,
         google_review_url, brand_color, default_language, is_active, logo_url
  from public.stores;
comment on view public.public_store_review is
  'Anon-safe columns of stores for the public /store/[id] QR review page.';
revoke all on public.public_store_review from anon, authenticated;
grant select on public.public_store_review to anon, authenticated;

-- ── 2) customers 入力長の CHECK（NOT VALID = 既存行に非破壊）──
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_whatsapp_len_chk') then
    alter table public.customers add constraint customers_whatsapp_len_chk
      check (char_length(btrim(whatsapp_number)) between 8 and 24) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customers_name_len_chk') then
    alter table public.customers add constraint customers_name_len_chk
      check (customer_name is null or char_length(customer_name) <= 200) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customers_keywords_bounds_chk') then
    alter table public.customers add constraint customers_keywords_bounds_chk
      check (
        selected_keywords is null
        or (coalesce(array_length(selected_keywords, 1), 0) <= 50
            and char_length(array_to_string(selected_keywords, ',')) <= 4000)
      ) not valid;
  end if;
end $$;

-- ── 3) feedback テーブル（低評価フィードバック保存先）──
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

drop policy if exists "super_admin_all" on public.feedback;
create policy "super_admin_all" on public.feedback
  for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "owner_select" on public.feedback;
create policy "owner_select" on public.feedback
  for select using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

-- ============================================================================
-- 検証（適用後に実行して確認）
-- ============================================================================
-- customer_name が存在すること:
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='customers' and column_name='customer_name';
-- RPC が通ること（1 行返る = 成功）:
--   select public.capture_store_customer_lead(
--     (select id from public.stores where is_active limit 1),
--     '+971500000000', true, array['test']::text[], 'QA');
-- view が非機微列のみ:  select * from public.public_store_review limit 1;
-- base stores が匿名で読めない（anon キーでの PostgREST 経由）:  select * from public.stores;  -- blocked
-- feedback が作成済み:  select count(*) from public.feedback;
