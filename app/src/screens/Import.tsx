import { useState } from 'react';
import { useApp } from '../context.tsx';
import { go } from '../router.ts';
import { parseRecipeMarkdown } from '../lib/markdown.ts';
import { TopBar } from '../components/ui.tsx';
import { setImportDraft } from './RecipeEditor.tsx';

/** Claudeアプリに送る依頼文。写真や音声の内容をいつもの形式にしてもらう */
export const CLAUDE_PROMPT = `添付した写真（または、このあと話す内容）のレシピを、次の形式のMarkdownにまとめてください。
説明や前置きは不要で、Markdownだけを返してください。

ルール：
- 分類は 主菜・主食・副菜・汁物・おやつ のどれか。主菜は（肉）（魚）なども付ける
- 冷凍は、冷凍保存できる副菜なら OK、できないなら NG、分からなければ行ごと省く
- 調味料をまとめて合わせるものは (A) (B) のように材料名の前に付ける
- 分量は 大1・小1/2・100g のように短く書く
- 手順は番号付きで、1行に1つ
- コツや注意点があれば「## メモ」に書く
- 作り方は「手抜き版」と「ちゃんと版」の2つを書く。元のレシピ（雑誌・テレビ）はちゃんと版として「## ちゃんと版：材料」「## ちゃんと版：手順」に書く。手抜き版は、カット野菜・冷凍野菜・チューブ・ホットクックなどを使って下ごしらえを省く作り方を考えて「## 材料」「## 手順」に書く
- 所要時間（食べられるまで。漬け込みなど置いておく時間は除く）を、手抜き版は「時間:」、ちゃんと版は「ちゃんと版の時間:」に書く
- 何人分は「2人分」のように1つの数字で書く（「2〜3人分」のような幅は多いほうの数にする）
- 材料と分量から、1人分の栄養素の目安を日本食品標準成分表をもとに計算し「## 栄養（1人分）」に書く。ご飯など材料に無いものは含めず、含めていないものは表の下に書く
- 出典（番組名・雑誌名・URL）が分かれば最後に「> 参考: 〜」と書く

形式：
---
分類: 副菜
何人分: 2人分
冷凍: OK
時間: 10分
ちゃんと版の時間: 25分
---

# 料理名

## 材料

| 材料 | 分量 | 材料 | 分量 |
|------|------|------|------|
| きんぴら用カット野菜 | 1袋 | (A)しょうゆ | 大1 |
| | | (A)みりん | 大1 |

## 手順

1. ホットクックの内鍋に全部入れる
2. 手動→炒める→5分

## ちゃんと版：材料

| 材料 | 分量 | 材料 | 分量 |
|------|------|------|------|
| ごぼう | 100g | (A)しょうゆ | 大1 |
| 人参 | 100g | (A)みりん | 大1 |

## ちゃんと版：手順

1. ごぼうはささがきにして水にさらす
2. 人参は細切りにする
3. フライパンで炒め、(A)で味をつける

## 栄養（1人分）

| カロリー | たんぱく質 | 脂質 | 炭水化物 | 糖質 | 食物繊維 | 塩分 |
|---|---|---|---|---|---|---|
| 60kcal | 1.1g | 1.7g | 10.2g | 8.0g | 2.2g | 0.7g |

## メモ

ごまは最後に入れる

> 参考: 〇〇テレビ「〇〇」`;

export function ImportScreen() {
  const { toast } = useApp();
  const [text, setText] = useState('');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CLAUDE_PROMPT);
      toast('依頼文をコピーしました');
    } catch {
      toast('コピーできませんでした。下の依頼文を長押しでコピーしてください');
    }
  };

  const paste = async () => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      toast('入力欄を長押しして貼り付けてください');
    }
  };

  const next = () => {
    if (!text.trim()) return toast('レシピを貼り付けてください');
    // ```markdown ... ``` で囲まれていても読めるようにする
    const body = text.replace(/^[\s\S]*?```(?:markdown|md)?\n([\s\S]*?)```[\s\S]*$/, '$1');
    setImportDraft(parseRecipeMarkdown(body));
    go('new/draft');
  };

  return (
    <div className="page import">
      <TopBar title="貼り付けて追加" backTo="" />
      <ol className="howto">
        <li>
          <b>依頼文をコピー</b>
          <button className="btn" onClick={copy}>
            📋 依頼文をコピー
          </button>
        </li>
        <li>
          <b>Claudeアプリに貼り付けて送る</b>
          <br />
          雑誌やテレビのレシピなら写真を添付。思いつきのレシピなら、マイクで話した内容を続けて送ります。
        </li>
        <li>
          <b>返ってきた文章をコピーして、下に貼り付け</b>
        </li>
      </ol>

      <div className="paste-box">
        <textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder="ここに貼り付け（いつもの形式のMarkdown、または普通の文章でもOK）" />
        <div className="paste-actions">
          <button className="btn" onClick={paste}>
            貼り付け
          </button>
          <button className="btn primary" onClick={next}>
            読み取って確認へ →
          </button>
        </div>
      </div>
      <p className="muted small">次の画面で中身を確認・修正してから保存できます。</p>

      <details className="prompt-preview">
        <summary>依頼文の中身を見る</summary>
        <pre>{CLAUDE_PROMPT}</pre>
      </details>
    </div>
  );
}
