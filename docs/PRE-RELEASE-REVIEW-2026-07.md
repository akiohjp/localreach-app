# LocalReach — 製品化前 全体レビュー & PWA化 (2026-07-01)

対象: `02_execution_squad/review_app_nextjs`
作業: PWA化（awa化） + 全デバイス対応 + 徹底レビュー。ビルドは green (`npm run build` exit 0)。

このドキュメントは 4 観点（顧客フロー / 管理・認証 / バックエンド・データ / LP・SEO）の並列レビュー結果を統合したもの。

---

## ✅ 追記: 第2パス実装完了 (2026-07-01)

初回パス（A）に続き、**B（セキュリティ）・C-1（フィードバック保存）・C-2（UI多言語化）・D（LP/SEO）を実装済み**。`npm run build` / `tsc --noEmit` / `eslint` すべて green。

**コードは適用済み。ただし DB 変更は下記 3 マイグレーションの適用が必要（本番 Supabase はバックアップ後に手動適用）:**

| ファイル | 内容 |
|----------|------|
| `20260701120000_stores_public_review_view.sql` | **B-1** 越境漏洩修正: `stores` の匿名 SELECT を廃止し、非機微列のみの view `public_store_review` を作成 |
| `20260701120001_customers_input_bounds.sql` | **B-4** 匿名 INSERT の長さ制約（NOT VALID・既存行に非破壊） |
| `20260701120002_create_feedback_table.sql` | **C-1** `feedback` テーブル（低評価フィードバック保存先。service-role の `/api/feedback` 経由で書込） |

**実装済み項目:** B-1（view + `store/[id]` を view 参照へ）/ B-2（middleware で `/admin`・`/master-admin` を default-deny ガード）/ B-3（`/admin` 一覧を `owner_id` で明示絞込）/ B-5（CSV インジェクション対策）/ B-6（ロゴ署名失敗時は本番で null）/ C-1（`/api/feedback` + StepFeedback 保存）/ C-2（en/ja/ar 辞書 `lib/ui-strings.ts` で全 Step を多言語化）/ D-1（LP に route layout で metadata）/ D-2（layout に OG/Twitter + `public/og.png` 生成）/ D-3（sitemap に LP 2 ページ・canonical 追加）。

**プレビュー中に発見したバグ (第3パス, 2026-07-01):**
- **保存が RPC 400 で失敗**: `/store` フローの WhatsApp 保存で `capture_store_customer_lead` が `42703: column "customer_name" of relation "customers" does not exist` を返す。本番 Supabase(`eipovpomvixyhndqchda`)で RPC は `customer_name` を参照するのに列が未追加 = **マイグレーション `20260501000004_add_customer_name.sql` が未適用/不整合**。→ 全マイグレーション（1〜12）を順に適用すれば解消（アプリ側はフォールバックで 201 保存に回復するが脆い）。
- **リロードで rating に戻り生成レビューが消える**: 保存失敗に伴うページ再読込で状態喪失。→ **`lib/use-flow-persistence.ts` を追加**し、`ReviewFlow` と デモ `/` で flow 状態を sessionStorage に保持（30分TTL・店舗キー別）。リロードしても result へ復元することをプレビューで検証済み。コードによる reset 経路は無し（保存ハンドラはナビゲーションしない）。
- **保存経路の一本化（B-4 解消 + 400 撲滅）**: クライアントの匿名 RPC/insert を廃止し、`StepResult` の保存を検証済みサーバ経路 `/api/customer-leads`（service-role）に一本化。同 route の demo ゲートを撤去し全店舗対応。サーバ側で E.164・store active・長さ上限を検証し、`customer_name` 欠落時も legacy insert にフォールバックするため**マイグレーション未適用でも 201 で成功**（ブラウザに 400 が出ない）。プレビューで `POST /api/customer-leads → 200`・コンソールエラー無しを確認。
- **DB 適用の簡易化**: `docs/APPLY-DB-2026-07.sql` を追加（Supabase SQL Editor に 1 回貼るだけで customer_name 修正 + view + bounds + feedback を冪等適用）。

**残・要手動対応:**
- 上記 3 マイグレーションを本番 Supabase に適用（`docs/LOCALREACH-RELEASE-CHECKLIST-JA.md` 参照）。
- 実店舗リンクで `?lang=ja` / `?lang=ar` の表示 QA（多言語 UI・RTL の実機確認）。ar 訳は要ネイティブ確認。
- 未対応で残す項目: B-7（master ログインのレート制限）, D-4（LP のデッドボタン/価格整合）, D-5（コントラスト/emoji aria）, E（QR ローカル生成・楽観保存の 0 行検知 等）。

---

## A. 今回のパスで修正済み

### A-1. PWA化（新規実装 — これまで完全未実装だった）
- `app/manifest.ts` — name / short_name / icons(192・512・maskable) / `display:standalone` / theme_color `#f59e0b` / start_url。`/manifest.webmanifest` で配信、`<link rel="manifest">` 自動挿入を確認。
- アプリアイコン一式を生成: `public/icons/icon-{192,512}.png`・`icon-maskable-{192,512}.png`・`apple-touch-icon.png`、`app/icon.svg`（ブランド: アンバー地に白ピン＋星）。`sharp` で SVG からラスタライズ。
- `app/layout.tsx` — `viewport` export（`viewport-fit=cover` + theme-color light/dark、ピンチズームは維持=a11y）、`appleWebApp`（ホーム画面追加・タイトル・ステータスバー）、`icons`、`formatDetection`。
- `public/sw.js` + `components/ServiceWorkerRegister.tsx` — 本番のみ登録。静的アセットは cache-first、ページ遷移は network-first＋失敗時 `/offline`、API/auth/Supabase は非介入（マルチテナントの stale 混在を防止）。
- `app/offline/page.tsx` — ブランド付きオフラインフォールバック（precache）。
- 検証: `/manifest.webmanifest`・`/sw.js`(application/javascript)・各アイコン・`/offline` すべて 200、`<head>` に theme-color / manifest / apple-touch-icon / mobile-web-app-capable / viewport-fit=cover を確認。

### A-2. 顧客レビューフローの磨き込み（`components/Step*.tsx`, `app/store/[id]`）
- **iOS 自動ズーム防止**: 入力欄・textarea を `text-sm`(14px)→`text-base`(16px)（`StepResult`, `StepFeedback`）。
- **クリップボード安全化**: `StepResult` の copy/post を try/catch 化。`Post on Google` は copy を fire-and-forget にして `window.open` をユーザージェスチャ内に維持（ポップアップブロック回避）。
- **RTL 修正**: 電話入力行に `dir="ltr"`（国番号＋番号の並び）、星文字列に `dir="ltr"`（`★★★☆☆` の反転防止）＋ aria-label。
- **生 DB エラーの顧客露出を除去**: `StepResult` の失敗表示から Postgres 生エラー＋「Supabase migrations…」文言を撤去 → 一般文言 `role="alert"`。詳細は `console.error` のみ（未使用化した state/helper も整理）。
- **a11y**: textarea/inputs に aria-label、キーワード pill に `aria-pressed` + focus-visible リング、生成中に `role="status" aria-live`、装飾要素に `aria-hidden`。

### A-3. 表示バグ / 品質（LP・全体）
- **未定義 Tailwind クラスの視覚バグ修正**: `gold-*`（`bg-gold-100`, `shadow-gold-*`）と `animate-fade-in` が Tailwind v4 で未定義＝無効化していた。`app/globals.css` に `@theme` で gold スケール（#D4AF37 基準）と `fade-in` keyframe を定義。CSS 出力に反映を確認。
- **フォント配線**: `--font-sans/--font-mono` を `next/font` の Geist 変数に接続（従来 body は未ロードの "Inter" 参照で system fallback していた）。
- **`prefers-reduced-motion`** 対応、`overscroll-behavior-y:none`、`min-h-[100dvh]` + safe-area（`app/store/[id]/page.tsx`）。
- LP フッターの `© 2024` → `{new Date().getFullYear()}`（`app/local-reach-lp/page.tsx`）。

---

## B. 未対応 — セキュリティ / データ（**リリース前に要判断**。本番 Supabase 変更を伴う）

> これらは複数レビューアが独立に指摘。本番 RLS/マイグレーション変更は影響が大きいため未実施。バックアップ後の適用を推奨。

- **B-1 [P0] stores の匿名 SELECT が全カラム・全行公開**
  `supabase/migrations/20260510130000_stores_public_select_review_page.sql` の `USING (true)` (anon,authenticated) + `app/store/[id]/page.tsx` の `select('*')` により、匿名キー保持者が任意 ID で全店舗の `owner_id` / `notification_email` / `google_review_url` 等を読み取り可能（越境 PII 漏洩）。
  対応案: QR 表示に必要な非機微カラムのみの **view** 経由に限定 + `is_active=true` 限定。`select('*')` を必要列に絞る。（既存チェックリスト P2「匿名 SELECT を is_active=true に限定」の上位版）
- **B-2 [P0] middleware に認証ガードが無い**
  `middleware.ts` は cookie リフレッシュのみでリダイレクト無し。保護はページ毎の `getUser()` 頼み＝新規 admin ルートが既定で公開になる。`/admin`・`/master-admin` prefix の default-deny を追加推奨。
- **B-3 [P0] /admin 一覧が全店舗を列挙**
  `app/admin/page.tsx` が `owner_id` フィルタ無しで `stores` を取得（RLS 依存）。RLS 是正と独立に `.eq('owner_id', user.id)` を明示すべき。
- **B-4 [P1] 顧客 lead の匿名 INSERT がサーバ検証を迂回**
  実運用の書き込みは client の anon insert / RPC（`length>=8` のみ）で、厳格検証を持つ `app/api/customer-leads/route.ts` は **demo store 限定**（`storeId !== demoStoreId → 404`）で実質デッド。全書き込みを API 経由に一本化 or RPC/CHECK で E.164・長さ制約を強制。
- **B-5 [P1] master-admin CSV に CSV インジェクション**
  `app/master-admin/actions.ts` の CSV 生成で `= + - @` 始まりの氏名等を未エスケープ。Excel でマクロ実行の恐れ。各セルを quote/`'` prefix。
- **B-6 [P1] ロゴ署名 URL 失敗時に public URL へフォールバック**
  `lib/resolve-store-logo-url.ts` — バケット非公開化後は壊れた/漏洩し得る URL を返す。本番では `null` 返却＋サーバログに。
- **B-7 [P1] master ログインにレート制限/ロックアウト無し・plaintext env 比較・失効不可**
  `lib/master-session.ts`, `lib/master-admin-env.ts`。試行制限追加、password 変更でセッション失効する設計を推奨。
- 参考(良好): service-role キーはサーバ専用で client バンドルに未露出、`customers` に anon SELECT ポリシー無し（PII 読み戻し不可）。

---

## C. 未対応 — プロダクト機能ギャップ（**要作業判断**）

- **C-1 [P0] 低評価(<4)フィードバックが DB 未保存 = サイレント消失**
  `components/StepFeedback.tsx` → `onSubmit()` はテキストをどこにも送らず「送信済み」表示。保存先テーブル + 書き込み（API 経由推奨）が必要。（チェックリスト P2 と一致）
- **C-2 [P0/大] 言語スイッチャーがあるのに UI 文言が全て英語ハードコード**
  `Step*` の全ボタン/ラベル/星の語（"Excellent" 等）が英語固定。ar/ja では店名・挨拶と RTL だけ切替わり、UI は英語のまま。ロケール辞書（サーバ解決済み locale をクライアントに渡す）で i18n 化する機能追加が必要。

---

## D. 未対応 — マーケLP / SEO

- **D-1 [P0] LP に metadata が無い**: `app/local-reach-lp/page.tsx` が `"use client"` で `metadata` を export 不可。Server ラッパへ分離して title/description/OG を付与。
- **D-2 [P0] OG/Twitter カード未設定**（layout・両 LP）。`opengraph-image` + `openGraph`/`twitter` を追加（WhatsApp 共有が主動線のため重要）。
- **D-3 [P1]** `lang="en"` だが LP は日本語主体 → per-route lang。canonical 無し。`app/sitemap.ts` が LP 2 ページを欠落。JSON-LD（Organization/Product）無し。
- **D-4 [P1]** LP の「Book a Demo」等が href/handler 無しのデッドボタン、フッター `href="#"`。価格/実績表記が LP 間で不整合。
- **D-5 [P2]** gold 背景に白文字のコントラスト不足（WCAG AA 未達箇所）。装飾 emoji に `aria-hidden`。

---

## E. 未対応 — その他 P2
- QR を外部 `api.qrserver.com` 生成（`StoreDashboard.tsx`）→ ローカル生成推奨（可用性/プライバシー）。
- optimistic 保存が 0 行更新(RLS)でも「Saved」表示（`StoreDashboard.tsx`, `LogoUploader.tsx`）→ `.select()` で反映確認。
- 生成前の固定 1200ms 遅延（`ReviewFlow.tsx`）、ステップ間フォーカス移動、戻るボタン欠如。
- `next.config.ts` の env fail-fast が `VERCEL_ENV` 限定 → 非 Vercel 本番ビルドで素通り。
- `middleware`→`proxy` リネーム（Next 16 で deprecation 警告）。
- 非idempotent マイグレーション（再適用でエラー）: `create table`/`create index` に `if not exists`。

---

### 推奨リリース順
1. **B（セキュリティ）** をバックアップ後に適用 — 特に B-1〜B-3 は越境/公開リスク。
2. **C-1（フィードバック保存）** — データ消失は顧客体験に直結。
3. D-1/D-2（OG/metadata）— 共有動線の見栄え。
4. C-2（i18n）は規模が大きいので別スプリント可。

各項目、着手する範囲を指示ください。B・C は本番 DB / 機能追加を伴うため、実装前に方針確認します。
