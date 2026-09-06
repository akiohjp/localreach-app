# 短縮 QR リンク（qr.miraireach.ae）— 導入手順

**導入日:** 2026-09-06
**形:** `https://qr.miraireach.ae/<6 文字>` → 今までの `/store/<uuid>` と同じページ

## なぜ

ゲスト用 URL は 82 文字で、その大半が店の ID（36 文字）だった。QR は文字数でマス目が増える（82 文字 → 37×37、31 文字 → 25×25）ので、名刺サイズやテーブルの小さなステッカーで読み取りやすさが変わる。読み取った瞬間にブラウザに出るドメインも `.marketing` から `.ae` になる。

**今までの `/store/<uuid>` は永久にそのまま動く。** 印刷済みの QR は刷り直さない。

## 仕組み

- `stores.slug`（6 文字、`23456789abcdefghjkmnpqrstuvwxyz` の 31 字。0/o、1/i/l を含まない）。既存の店は移行で一括採番、新しい店は DB の既定値で自動採番。**一度印刷したら変えない。**
- `middleware.ts` が Host が `NEXT_PUBLIC_QR_HOST` のときだけ `/x7kp2m` を内部で `/r/x7kp2m` に書き換える（転送ではないので URL は短いまま）。`/` はプロダクトサイトへ転送。
- `/store/[id]` と `/r/[slug]` は `app/store/store-review-page.tsx` の同じ部品を描画する。
- リンクの組み立ては `lib/store-links.ts` の `guestReviewUrl()` 一か所。`NEXT_PUBLIC_QR_HOST` が無い、または店に slug が無いときは長い形に戻る（オーナー画面の QR、カウンターカード、マスター管理、WhatsApp 共有すべて）。
- `/api/generate-review` の Origin チェックも QR ホストを許可する。

## 手順（この順で）

1. **DB**: `supabase/migrations/20260906180000_store_slugs.sql` を Supabase の SQL editor で実行（列・採番関数・view）。
2. **Cloudflare（miraireach.ae の DNS）**: CNAME `qr` → `cname.vercel-dns.com`、**Proxy は OFF（DNS only）**。Vercel が証明書を出す。
3. **Vercel**: プロジェクト localreach → Settings → Domains → `qr.miraireach.ae` を追加。数分で Valid になる。
4. **Vercel の環境変数**: `NEXT_PUBLIC_QR_HOST=qr.miraireach.ae`（Production と Preview）。**再デプロイして初めて効く**（NEXT_PUBLIC はビルド時に埋め込まれる）。
5. **確認**: `https://qr.miraireach.ae/<slug>` が店のページを出す。オーナー画面の QR が短いリンクになっている。

順番を守れば途中でも壊れない: 1 だけ済んでいれば長いリンクのまま動く。4 を入れて再デプロイした時点で全店が短いリンクに切り替わる。

## 運用

- slug は `select slug, store_name->>'en' from public.stores;` で一覧できる。マスター管理画面にも表示され、コピーできる。
- 店を消すと slug も消え、その QR は 404 になる。契約終了は `subscription_expires_at`（Service Inactive ページ）で扱い、削除はしない。
