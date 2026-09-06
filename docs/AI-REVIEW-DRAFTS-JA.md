# AI レビュー下書き（Gemini）— 運用メモ

**対象:** `/api/generate-review` と `app/store/[id]/ReviewFlow.tsx`
**導入日:** 2026-09-06

## 何が変わるか

- 店ごとのスイッチ `stores.ai_review_enabled`（既定 OFF）。**マスター管理画面**の「AI Draft」トグルだけで切り替える。オーナー側には出さない（1 回ごとに課金されるため）。
- ON の店では、ゲストがキーワードを選んで「レビューを作成」を押すと、まず Gemini に下書きを頼む。**失敗・遅延・却下のときは今までのテンプレートエンジンが即座に答える**ので、ゲストが空振りすることはない。
- ON の店だけ、キーワード画面に任意の 1 行入力「In your own words」が出る。ここに書かれた言葉が下書きの核になる。
- 「Try another wording」と言語切替も AI を使う（1 回の流れで最大 3 回。それ以降はテンプレート）。

## モデルが知らされること（それ以外は書かせない）

店名、ゲストが ON にしたフレーズ（**店に設定済みのフレーズ以外は捨てる**）、ゲストの 1 行、エンティティ（業種名詞・エリア・都市）。訪問の中身は一切でっち上げない指示にしており、**選んだフレーズはすべて語順どおり**に入っていないと却下される（大小文字は文に合わせてよい。`lib/review-ai-filter.ts`）。

却下条件: 長さレール外／引用符・絵文字・ハッシュタグ・星数／AI 臭い語（hidden gem, nestled, elevate など。ただしフレーズに含まれていれば可）／店名 2 回以上／連絡先。却下は 1 回だけ作り直し、それでも駄目なら 502 でテンプレートに戻る。

## 費用・上限

| 項目 | 値 |
|---|---|
| 1 件あたり | 入力 700 トークン前後 + 出力 120 トークン前後（Flash-Lite で AED 0.001 前後） |
| IP ごと | 10 回/分、60 回/時（店の Wi-Fi は全員同じ IP なので広め） |
| 店ごと | 150 回/時 |
| 全体 | 1 日 `AI_REVIEW_DAILY_CAP`（既定 2,000）。超えたら全店テンプレート |
| 時間 | ルート全体 7.5 秒、1 試行 4.5 秒。クライアントは 9 秒で諦める。実測 `gemini-flash-lite-latest` で 0.6〜0.9 秒（2026-09-06） |

上限はすべて既存の `bump_rate_limit`（`api_rate_limits` テーブル）で数える。

## 前提（本番）

1. **Gemini の鍵は課金有効のプロジェクトのもの**であること。無料枠だと 1 日数十〜数百回で 429 になり、以降は黙ってテンプレートに落ちる。確認: `.env.local` に鍵を置いて `node scripts/test-gemini-tier.mjs`（PAID と出ること）。
2. Vercel の環境変数 `GEMINI_API_KEY`（返信機能と共通）。任意: `GEMINI_REVIEW_MODELS`（カンマ区切りで梯子を上書き）、`AI_REVIEW_DAILY_CAP`。
3. マイグレーション `20260906120000_ai_review_drafts.sql` 適用済み（列・view・`ai_review_drafts` テーブル）。**コードより先に**適用する。QR ページが view から `ai_review_enabled` を読むため。

## 出す前の確認手順

```bash
npm run test:ai-review                                            # フィルタとプロンプトの単体チェック（鍵不要）
npx tsx scripts/test-gemini-review.mjs --n=5 --out=drafts.json    # 実 API で試作（鍵必要）
npx tsx scripts/gate-review-naturalness.mjs --input=drafts.json   # オーナー基準の自然さ判定
```

そのうえで **人が 20 件読む**。gate は「弾かなかった」としか言えない。

## 出した後の見方

```bash
npx tsx scripts/read-ai-drafts.mjs --n=50            # 実際にゲストに渡った下書きと、落ちた理由
npx tsx scripts/read-ai-drafts.mjs --outcome=fallback
npx tsx scripts/read-ai-drafts.mjs --n=30 --out=live.json && npx tsx scripts/gate-review-naturalness.mjs --input=live.json
```

`reason` の内訳（`rate_limited` / `*:timeout` / `keyword_missing:*` / `ai_tell:*`）を見て、梯子やプロンプトを調整する。

## 段階導入

1 店舗だけ ON にして 1 週間、`read-ai-drafts` を毎日読む。問題なければ店を増やす。OFF に戻すのはトグル 1 つで即時。
