# Supabase アドバイザー対応（マイグレーション適用手順）

リポジトリの `supabase/migrations/20260507120000_security_hardening.sql` が次をまとめて直します。

- `public.test_table` の削除（RLS 未設定テーブル）
- `public.set_updated_at` / `public.is_super_admin` に `search_path` 固定
- **`customers` の広い匿名 INSERT を廃止**し、`capture_store_customer_lead` RPC（SECURITY DEFINER）に変更
- **`store-logos` を非公開化**し、匿名の一覧読み取りをやめる  
  （アプリは **サービスロールで署名 URL** を `/store/[id]` とダッシュボードで生成）
- **`stores.logo_url` を公開 URL → バケット相対パス**へ正規化（既にパスの行は変更されない）

## 適用順序（推奨）

1. **本番 DB のバックアップ** を取る。  
2. Supabase Dashboard → SQL エディタ、または **`supabase db push`** で上記マイグレーションのみを適用。  
3. **直後に** Vercel へ **同一リビジョンのアプリをデプロイ**（`/store/*` と管理画面ロゴ署名に必要）。  
4. **環境変数** `SUPABASE_SERVICE_ROLE_KEY` が Production に入っていることを確認（未設定だと署名 URL が作れません）。

「マイグレーションだけ先に当て、アプリが古いまま」の時間を長くしすぎると、`store-logos` 非公開化のあいだだけロゴが一時的に表示されなくなることがあります。

## ダッシュボードだけで済ませたい項目

- **Leaked password protection disabled** — Supabase の **Authentication → 設定／セキュリティ**（項目名はバージョンで異なることがあります）で **漏洩パスワード（HaveIBeenPwned）によるチェック**を有効にします。コードや SQL には含められません。

## トラブルシュート

- **ロゴが出ない**: `SUPABASE_SERVICE_ROLE_KEY` がサーバーに読み込まれているか、`logo_url` がマイグレーション後 `'uuid/filename'` 形式になっているかを確認。
- **WhatsApp 保存が失敗する**: アプリが未デプロイで旧クライアントが `customers` に直接 INSERT していると RLS で弾きます。**アプリ側は RPC に切り替え済み**なのでデプロイを揃える。
