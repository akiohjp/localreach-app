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
3. **Framework:** Next.js、**Root Directory:** `./`
4. 環境変数（Production）を入力して **Deploy**。

これで「**すでにある GitHub の `localreach-app` を Vercel プロジェクトに紐づける**」だけになり、名前の衝突は起きません。

---

## Import の一覧にリポが出ないとき

GitHub → **Settings → Applications → Installed GitHub Apps → Vercel → Configure** で、  
**Repository access** に `localreach-app` を含める（または **All repositories**）。
