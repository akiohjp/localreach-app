-- ============================================================================
-- LocalReach — 本番 DB「デプロイ後」ロックダウン (2026-07-01)
--
-- ⚠️ これは新しい（view 参照版）アプリを Vercel にデプロイした「後」に実行します。
--    デプロイ前に実行すると、旧アプリ（stores を select('*') する）が壊れます。
--
-- 事前適用（APPLY 済み）: customer_name / view(invoker) / feedback / bounds /
--   authenticated 越境読み取り遮断 / customers insert ポリシーの絞り込み。
--   （security advisor: ERROR 0 件。）
--
-- 本スクリプトで残りの 2 件を締めます:
--   A) anon の stores 直接読み取りを列単位に制限（owner_id 等の列漏洩を遮断）
--   B) 匿名 RPC の実行権限剥奪（新アプリは /api/customer-leads=service role のみ使用）
-- ============================================================================

-- A) anon は base stores を列単位でのみ読める（invoker view は動作、select('*') は拒否）。
--    新アプリは public_store_review ビュー経由なので影響なし。
revoke select on public.stores from anon;
grant select (
  id, store_name, greeting_text, keywords, forced_keywords,
  google_review_url, brand_color, default_language, is_active, logo_url
) on public.stores to anon;

-- B) 新アプリは RPC を使わない（service-role の API 経由）。匿名/ログイン実行権を剥奪。
revoke execute on function
  public.capture_store_customer_lead(uuid, text, boolean, text[], text)
  from anon, authenticated;

-- ============================================================================
-- 検証（anon キーで、ブラウザ相当）
--   /rest/v1/stores?select=*            → permission denied（base は読めない）
--   /rest/v1/stores?select=owner_id     → denied
--   /rest/v1/public_store_review?select=* → 10 列のみ返る（新アプリの経路）
-- security advisor 再実行 → definer-function WARN 2件が消えること
--
-- Dashboard（SQL 不可）:
--   Authentication → Leaked password protection を有効化（advisor の残り 1 WARN）
-- ============================================================================
