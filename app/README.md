# app（開発者向け）

使い方と始め方は、リポジトリ直下の [README.md](../README.md) を見てください。

## 動かす

```sh
cd app
npm install
npm run dev      # 開発用サーバー（http://localhost:5173）
npm test         # テスト
npm run build    # レシピのMarkdownを public/recipes.json にまとめてビルド（dist/）
```

`npm run dev` / `npm run build` のたびに、リポジトリ直下の `主菜/` などのMarkdownから `public/recipes.json` が作られます。

## 構成

| 場所 | 中身 |
|---|---|
| `src/lib/markdown.ts` | レシピのMarkdownの読み書き |
| `src/lib/store.ts` | レシピの読み込みと、GitHubへの保存（コミット） |
| `src/lib/github.ts` | GitHub API |
| `src/lib/shopping.ts` | 買い物リストと余りの計算、使い切りの提案。売り方の表（`PRODUCTS`） |
| `src/lib/sharedPlan.ts` `src/lib/plan.ts` | 共有の作る予定（`plan` ブランチの `plan.json`）と同期 |
| `src/repoConfig.ts` | 保存先のリポジトリ（ビルド時に GitHub Actions から自動で入る） |
| `src/screens/` | 画面 |
| `scripts/build-seed.mjs` | レシピのMarkdownを `recipes.json` にまとめる |

## 保存先のリポジトリ

GitHub Actions でビルドするときに、`VITE_REPO_OWNER` `VITE_REPO_NAME` `VITE_REPO_BRANCH` にそのリポジトリの情報が入ります（`.github/workflows/pages.yml`）。
手元でビルドするときは、これらの環境変数を指定するか、`*.github.io/（リポジトリ名）/` で開いたときのアドレスから読み取ります。
