# LocalReach 製品化リリースチェックリスト

**対象アプリ:** `02_execution_squad/review_app_nextjs`  
**本番 Supabase:** miraireach プロジェクト（ref `eipovpomvixyhndqchda`）  
**本番 URL 例:** `https://localreach.miraireach.marketing`

---

## 0. リリース前ローカル確認

```powershell
cd 02_execution_squad/review_app_nextjs
npm run build
npx tsx scripts/test-generation-uniqueness.mjs
```

- 生成 500 回 → 衝突 0 であること
- `/master-admin/login` · `/admin/login` · `/store/{uuid}` がビルドに含まれること

---

## 1. Git commit & push

モノレポ `miraireach-platform` の場合:

```powershell
cd C:\Users\AKIO\ai_comany_core
git add 02_execution_squad/review_app_nextjs/
git commit -m "feat(localreach): productization hardening + P1 fixes"
git push origin main
```

別リポ `localreach-app` にミラーしている場合は、push 後にそちらへ同期（または Vercel Root Directory をモノレポの `review_app_nextjs` に設定）。

---

## 2. Supabase マイグレーション（本番）

**必ずバックアップ後に実行。** 詳細は [[SUPABASE-SECURITY-MIGRATION-JA]]。

### 適用順（ファイル名順 = タイムスタンプ順）

| # | ファイル | 内容 |
|---|----------|------|
| 1 | `20260430000000_create_stores_table.sql` | stores 初期 |
| 2 | `20260430000001_stores_i18n_redesign.sql` | i18n + RLS |
| 3 | `20260501000000` … `20260501000006` | is_active, customers, customer_name, owner_whatsapp |
| 4 | `20260502000000_add_forced_keywords.sql` | forced_keywords |
| 5 | **`20260507120000_security_hardening.sql`** | test_table 削除 · RPC · ロゴ非公開化 |
| 6 | `20260510130000_stores_public_select_review_page.sql` | 匿名 store SELECT（QR 用） |
| 7 | `20260510140000_fix_capture_lead_row_security.sql` | RPC row security |
| 8 | `20260511150000_capture_lead_function_row_security_setting.sql` | RPC 設定 |
| 9 | `20260512170000_anon_customers_insert_whatsapp_fallback.sql` | anon INSERT フォールバック |
| 10 | **`20260701120000_stores_public_review_view.sql`** | 越境漏洩修正: 匿名 SELECT を view `public_store_review` に限定（owner_id/notification_email 非公開） |
| 11 | `20260701120001_customers_input_bounds.sql` | customers 入力長 CHECK（NOT VALID・既存行に非破壊） |
| 12 | **`20260701120002_create_feedback_table.sql`** | 低評価フィードバック保存テーブル（`/api/feedback` 経由） |

> 10〜12 は 2026-07-01 の第2パスで追加。詳細は `docs/PRE-RELEASE-REVIEW-2026-07.md`。適用後、`/store/{uuid}` が view 経由で正常表示され、匿名キーで base `stores` が読めないことを確認。

### Dashboard での適用

1. Supabase → **SQL Editor** → 未適用ファイルを **1 本ずつ** 実行（既存オブジェクトがある場合は `IF NOT EXISTS` / `DROP IF EXISTS` 付き行のみ差分確認）。
2. または CLI: `supabase link --project-ref eipovpomvixyhndqchda` → `supabase db push`

### 適用後の確認 SQL

```sql
-- test_table が無いこと
select to_regclass('public.test_table');  -- null

-- RPC があること
select proname from pg_proc where proname = 'capture_store_customer_lead';

-- store-logos が非公開
select public from storage.buckets where id = 'store-logos';  -- false
```

### Auth（Dashboard のみ）

- **Leaked password protection** を有効化（HaveIBeenPwned）

---

## 3. Vercel デプロイ

### 環境変数（Production 必須）

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ゲスト / 店舗 admin |
| `SUPABASE_SERVICE_ROLE_KEY` | ロゴ署名 URL · マスター CSV |
| `NEXT_PUBLIC_APP_URL` | QR リンク（例 `https://localreach.miraireach.marketing`） |
| `MASTER_ADMIN_EMAIL` | マスターログイン |
| `MASTER_ADMIN_PASSWORD` | マスターログイン |
| `MASTER_SESSION_SECRET` | 32 文字以上 |
| `NEXT_PUBLIC_DEMO_STORE_ID` | 任意（`/` デモ用 UUID） |

### デプロイ手順

1. Vercel → プロジェクト → **Settings → Git** — リポ `main` 接続確認  
2. **Root Directory:** モノレポなら `02_execution_squad/review_app_nextjs`  
3. **Deployments → Redeploy**（最新 commit）  
4. マイグレーション適用と **同一時間帯** にデプロイ（ロゴ署名・RPC クライアント整合）

CLI 例:

```powershell
cd 02_execution_squad/review_app_nextjs
npx vercel --prod
```

---

## 4. 本番スモークテスト

| # | 確認 |
|---|------|
| 1 | `/master-admin/login` — マスターログイン |
| 2 | 店舗作成 · CSV エクスポート |
| 3 | GBP レポート — **Sample metrics** 注記が表示されること |
| 4 | `/store/{active-uuid}` — 評価 4+ → 生成 → **Try another wording** |
| 5 | キーワード未設定店舗 — 評価 4+ で Step2 をスキップして生成されること |
| 6 | WhatsApp Save — RPC 成功（Dashboard CRM に反映） |
| 7 | ロゴ表示 — 署名 URL で表示 |
| 8 | Supabase **Database Advisors** — `test_table` ERROR が消えていること |
| 9 | `/store/{uuid}?lang=ja` / `?lang=ar` — UI 全体が翻訳・ar は RTL |
| 10 | 低評価（<4）→ フィードバック送信 → `feedback` テーブルに行が入ること |
| 11 | 匿名キーで base `stores` を直接 SELECT → 拒否 / `public_store_review` は非機微列のみ |
| 12 | PWA — スマホで「ホーム画面に追加」→ standalone 起動・アイコン表示 |

---

## 5. 既知の残タスク（P2）

- ~~低評価フィードバックの DB 保存~~ → 完了（`feedback` + `/api/feedback`, 2026-07-01）
- ~~stores 匿名 SELECT を限定~~ → 完了（view `public_store_review`, 2026-07-01）
- master ログインのレート制限 / ロックアウト（B-7）
- LP のデッドボタン・価格整合（D-4）、コントラスト（D-5）
- QR ローカル生成・楽観保存の 0 行検知（E）
- `business_category` migration + admin UI
