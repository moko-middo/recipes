# レシピアプリ

## できること（第1段階）

- 一覧・検索（料理名・食材。「人参」で「にんじん」も見つかる）・分類と冷凍OKで絞り込み
- レシピの詳細表示、写真の追加（一覧の写真も選べる）
- その場で編集。前の分量は「変更の履歴」に残り、変更メモも付けられる。前の内容に戻すこともできる
- 手抜き版／ちゃんと版：レシピ画面の上で切り替え。それぞれの所要時間（食べられるまで。漬け込み時間は除く）と、機械に任せられるレシピでは「手間（手を動かす時間）」も表示。選んだ版は覚えておき、調理モードでも同じ版が出る
- 栄養（1人分）：カロリー・たんぱく質・脂質・炭水化物・糖質・食物繊維・塩分。材料から見積もった目安で、編集画面で書き換えられる。分量だけ変えて保存すると「分量が変わったので栄養素は目安です」と表示される
- 作る予定（2人で共有）：一覧の「＋」で作りたいものを選ぶと、余りそうな食材（例：玉ねぎ1/2個）と、それを使い切れるレシピ、売り場ごとの買い物リストが出る
- 調理モード：大きい文字、画面が消えない、材料のチェック、終わった手順を薄く表示。Androidの「画面をキャスト」でNest Hubに映すと横長の画面に合わせて表示される
- 貼り付けて追加：Claudeアプリ用の依頼文をコピー → 写真や音声と一緒にClaudeに送る → 返ってきた文章を貼り付けて取り込む

## しくみ

- レシピは**このリポジトリのMarkdownファイルが正本**です（`主菜/` `副菜/冷凍OK/` など）
- アプリで保存すると、GitHubに「コミット」として保存されます。変更メモがコミットのメッセージになり、「変更の履歴」はそのファイルのコミット履歴です
- 写真は `写真/` フォルダに保存され、レシピのMarkdownの先頭（`写真:`）に書き込まれます
- `main` が更新されるたびに、GitHub Actions がスマホ版（GitHub Pages）を作り直します（1〜2分）。自分で保存した内容は、その間もすぐ画面に出ます

## スマホで使えるようにする手順（GitHubだけ・無料）

### 1. GitHub Pages をオンにする
このリポジトリの「Settings」→「Pages」→「Build and deployment」の Source を **GitHub Actions** にする。
そのあと「Actions」タブ →「スマホ版を更新」→「Run workflow」を押すと、1〜2分で次のアドレスで開けます：
**https://moko-middo.github.io/recipes/**

AndroidのChromeで開き、メニューの「ホーム画面に追加」でアプリのように使えます。

### 2. 編集用の鍵を作る（編集・写真の追加をする端末だけ）
見るだけなら鍵は要りません。

1. https://github.com/settings/personal-access-tokens/new を開く
2. Token name：`レシピアプリ`、Expiration：長め（切れたら作り直してアプリに登録し直します）
3. Repository access：**Only select repositories** → `recipes` だけを選ぶ
4. Permissions →「Repository permissions」→ **Contents** を **Read and write** にする
5. 「Generate token」→ 表示された `github_pat_…` をコピー
6. アプリの「設定 → 編集用の鍵」に貼り付けて「登録」

鍵は、このレシピのリポジトリを書き換えることだけができる合言葉です。人に見せないでください。
スマホをなくしたときは、同じページ（Settings → Developer settings → Personal access tokens）で鍵を削除すれば使えなくなります。

### 3. 夫も使えるようにする（作る予定を2人で共有）

作る予定と買い物リストは2人で共有されます。どちらのスマホから足したり外したりチェックしたりしても、同じリストになります（開いている間は20秒ごとに最新になります）。

**あなたがすること**
1. このリポジトリの「Settings」→「Collaborators」→「Add people」で、夫のGitHubのユーザー名を入れて招待する

**夫がすること**
1. GitHubのアカウントを作る（無料）。メールアドレスは非公開の設定（Settings → Emails の「Keep my email addresses private」）にしておく
2. 届いた招待メール（または https://github.com/moko-middo/recipes/invitations ）で招待を受ける
3. 鍵を作る：https://github.com/settings/tokens/new （classic token）を開き、Note に `レシピアプリ`、Expiration は長め、**`public_repo` だけにチェック**して「Generate token」
   - 招待された人は、自分が持ち主ではないリポジトリなので「fine-grained token」では絞り込めません。そのため classic token の `public_repo`（公開リポジトリへの書き込み）を使います
4. スマホで https://moko-middo.github.io/recipes/ を開き、「設定 → 編集用の鍵」に貼り付けて登録

作る予定では、相手の操作はGitHubのユーザー名で「〇〇が追加」「〇〇が買った」と出ます（自分の操作は「わたし」）。

**安全について**：書き換えられるのは、持ち主（あなた）と招待した人（夫）だけです。知らない人が自分の鍵を登録しても、アプリは断り、GitHubも書き込みを拒否します。

## 開発

```sh
cd app
npm install
npm run dev      # 開発用サーバー
npm test         # テスト
npm run build    # レシピのMarkdownを recipes.json にまとめてビルド
```

## メールアドレスについて

アプリからの保存は、GitHubの匿名アドレス（`…@users.noreply.github.com`）で記録されます。
パソコンからコミットするときは、GitHubの Settings → Emails の「Block command line pushes that expose my email」をオンにしておくと、本当のアドレスが記録されたコミットはpushできなくなります。
