# Supabase 認証メールが届かないとき（リカバリー・マジックリンク）

ローカルリーチのアプリ側（`/admin/forgot-password` の `resetPasswordForEmail` など）は **「送ってください」という API コールだけ** です。**実際のメール送信は Supabase がホスト側で行う** ので、アプリの Vercel 環境変数だけ直しても直らないことがあります。

## よくある誤設定: SMTP の Host にサイト URL を書いている

**Host には自分のサイト（例: `https://localreach.miraireach.marketing/`）を絶対に入れません。**  
ここへ入れるのは **メール事業者の SMTP サーバー名だけ**です（HTTPS や `/` は不要）。

Resend を使う場合の正しい例:

| 項目 | 入れる値 |
|------|-----------|
| **Host** | `smtp.resend.com` のみ（`http://` は付けない） |
| **Port** | `465`（または Resend が案内するポート） |
| **User name** | `resend`（固定・小文字） |
| **Password** | Resend の API Key（`re_...`） |

送信元アドレス `info.ae@miraireach.marketing` と「SMTP の Host」の違い: **送信元メールアドレス**は「誰として送るか」、`Host` は **どの SMTP 経由で送るか**（Resend の機械のアドレス）です。

保存し直したあと Dashboard の **Send magic link / Send password recovery** で再試行し、**Authentication のログまたは監査**で失敗理由が無いか確認してください。

## ありがちな原因（コードでは直せない）

### 1. デフォルトメール送信の制限（いちばん多い）

Supabase は共用 SMTP の乱用対策として、**カスタム SMTP を設定していないプロジェクトでは、組織メンバーのメール以外に Auth メールが送れない／拒否される** ことがあります。  
運用ユーザー（店舗アドレス）がダッシュボードの Org メンバーに含まれていないと、**「送ったように見えるが届かない」「エラーで弾かれる」** が起きます。

**対処:** [カスタム SMTP](https://supabase.com/docs/guides/auth/auth-smtp) を設定する（下記の Resend 設定）。

### 2. 送信レート上限

無料プランやデフォルトプロバイダでは **単位時間あたりの送信上限** に達すると、それ以降届きません。

**対処:** カスタム SMTP（例: Resend）に切り替える。**Authentication → Logs**（または関連する監査ログ）で失敗や制限が出ていないか確認。

### 3. From ドメイン未検証・スパム

Resend を使う場合、**送信ドメインの DNS 検証** が未完だと送信失敗またはスパム扱いになりやすい。

**対処:** Resend ダッシュボードでドメインを検証済みか確認。**迷惑メールフォルダ**も確認。

### 4. ユーザーのメールアドレス誤り

Auth の Users で **実際に登録されているメール** に送っているか確認。

---

## 推奨: Resend を Supabase の SMTP に接続する

**Supabase ダッシュボード**側の SMTP 設定のみで足ります。Resend を使っている場合は **同じ Resend アカウントの API キー** を Supabase SMTP の Password にも流用できます（アプリ用の環境変数は不要です）。

1. **Resend** で API Key を用意し、[ドメインを verify](https://resend.com/docs/dashboard/domains/introduction)。
2. Supabase → **Authentication** → （メールまわり）**SMTP を設定**
3. Resend の [Supabase 向け SMTP](https://resend.com/docs/send-with-supabase-smtp) に従って入力する例：
   - **Host:** `smtp.resend.com`
   - **Port:** `465`（TLS）
   - **Username:** `resend`
   - **Password:** Resend の API key（例: `re_...`）
   - **Sender:** 検証済みドメイン上の任意アドレス（例: `info.ae@miraireach.marketing`）

保存後、`Send password recovery` や アプリからの Forgot password で **ユーザー宛の実メールアドレス** に届くか再テスト。

---

## 確認手順

1. Supabase → **Authentication** → **Audit / Logs**（バージョンによって名称が異なることがあります）で、送信試行やエラーが無いか見る。
2. 画面上に **「SMTP を設定してください」系のバナー** が出ていないかダッシュボード全体を確認。
3. メール側で **プロモーション／迷惑メール** を確認。
4. それでも無理なときは、[Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) で自前送信する構成も検討（上級）。

---

公式: [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
