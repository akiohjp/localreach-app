# Vercel に載せるとき（よくあるつまずき）

## 画面に出るエラーについて

**URL が `vercel.com/new/clone` の画面**では、Vercel が **GitHub に「新しいリポジトリ」をまた一つ作ろう**とします。  
すでに **`akiohjp/localreach-app` がある**ので、名前を `localreach-app` のままにすると次のエラーになります。

> The specified name is already used for a different Git repository.

**意味:** 「同じ GitHub アカウントに、`localreach-app` という名前のリポはもうあるよ。二つ目は別名にして」と言われています。

**ここでの正解:** この **Clone 画面は使わない**（二重リポを作る用途向け）。

---

## やること：既存リポを「そのまま」接続する

1. ブラウザで **`https://vercel.com/new`** を開く（**`/clone` は付けない**）。
2. **Import Git Repository** で `localreach-app` を探すか、リポジトリ URL を貼る:  
   `https://github.com/akiohjp/localreach-app`
3. **Framework:** Next.js  
4. **Root Directory（重要）:**
   - **`akiohjp/localreach-app` だけ** を import する場合: リポ直下に `package.json` と `app/` があるので **`./`（または空・未入力）**。
   - もし **モノレポ**（例: `02_execution_squad` 全体が 1 リポジトリ）を import している場合のみ: **`review_app_nextjs`** にする。ここを誤ると別アプリ／空ビルドになり、個別パスだけ 404 になりやすい。
5. 環境変数（Production）を入力して **Deploy**。

これで「**すでにある GitHub の `localreach-app` を Vercel プロジェクトに紐づける**」だけになり、名前の衝突は起きません。

---

## Import の一覧にリポが出ないとき

GitHub → **Settings → Applications → Installed GitHub Apps → Vercel → Configure** で、  
**Repository access** に `localreach-app` を含める（または **All repositories**）。

---

## 既存の Vercel プロジェクトを `localreach-app` に載せ替える（リンクし直し）

1. 上記と同様に GitHub で **Vercel アプリから `localreach-app` が見える**状態にしておく。
2. Vercel → 対象プロジェクト → **Settings → Git**。
3. 既存の別リポが繋がっている場合は **Disconnect**。
4. **Connect Git Repository** → **`akiohjp/localreach-app`** を選択。
5. **Production Branch:** `main`  
   **Root Directory:** `localreach-app` 単体リポなら **`./` または未入力**。モノレポ全体を 1 リポで繋いでいる場合のみ **`review_app_nextjs`**。
6. **Deployments** が成功するまで待ち、環境変数（`NEXT_PUBLIC_*` / Supabase / `MASTER_ADMIN_*` など）は **Settings → Environment Variables** で旧プロジェクトと同様に設定。

---

## `/master-admin/login` が本番だけ 404 のとき（切り分け）

リポジトリの `main` にはパスがある（例: [app/master-admin/login](https://github.com/akiohjp/localreach-app/tree/main/app/master-admin/login)）のに、本番だけ 404 になる場合は **「どのビルド・どのプロジェクトがドメインに付いているか」**の問題です。

1. **Vercel → プロジェクト → Settings → Domains**  
   `localreach.miraireach.marketing` が **このプロジェクトに付いているか**（別プロジェクトに付いていると、古いアプリや別アプリが返る）。

2. **Settings → Git**  
   **Connected Repository** が **`akiohjp/localreach-app`** で、**Production Branch** が **`main`** か。

3. **Settings → General → Root Directory**  
   `localreach-app` のみなら **`./`**。モノレポ全体を import しているなら **`review_app_nextjs`**。誤っているとビルド成果物に `master-admin` が含まれず 404。

4. **Deployments → Production の最新デプロイ**  
   - **Ready（成功）**か。ずっと **Error** だと本番は **過去に成功した古いビルド**のまま止まっていることがあり、その版にルートが無いと 404。  
   - デプロイ詳細の **Source** でコミットが GitHub の `main` と一致しているか（`master-admin` が入ったコミット以降か）。

5. **`next.config.ts` のビルド時 env チェック**  
   環境変数不足で **ビルドが失敗**すると、上記 4 のように古い成功版が残り続ける。Logs を確認し env を揃えて **Redeploy**。

---

## デプロイ後の確認 URL

| 用途 | パス |
|------|------|
| マスター（親）ログイン | `/master-admin/login` |
| 店オーナーログイン | `/admin/login` |
