import { describe, expect, it } from 'vitest';
import { parseRecipeMarkdown, toMarkdown } from './markdown.ts';
import { diffContent } from './diff.ts';
import { formatMinutes, parseMinutes, visibleHandsOn } from './types.ts';

const md = `---
分類: 副菜
何人分: 4人分
時間: 60分
手間: 5分
ちゃんと版の時間: 30分
ちゃんと版の手間: 28分
---

# きんぴらごぼう

## 材料

| 材料 | 分量 | 材料 | 分量 |
|------|------|------|------|
| きんぴら用カット野菜 | 1袋 | しょうゆ | 大1 |

## 手順

1. 内鍋に全部入れる
2. 炒める5分

## ちゃんと版：材料

| 材料 | 分量 | 材料 | 分量 |
|------|------|------|------|
| ごぼう | 100g | しょうゆ | 大1 |
| 人参 | 100g |  |  |

## ちゃんと版：下ごしらえ

1. ごぼうをささがきにする

## ちゃんと版：手順

1. フライパンで炒める

## 栄養（1人分）

| カロリー | たんぱく質 | 脂質 | 炭水化物 | 糖質 | 食物繊維 | 塩分 |
|---|---|---|---|---|---|---|
| 60kcal | 1.1g | 1.7g | 10.2g | 8.0g | 2.2g | 0.7g |
`;

describe('手抜き版とちゃんと版', () => {
  it('両方の材料・手順・時間を読める', () => {
    const r = parseRecipeMarkdown(md);
    expect(r.time).toBe(60);
    expect(r.handsOn).toBe(5);
    expect(r.proper!.handsOn).toBe(28);
    expect(r.ingredients.map((i) => i.name)).toEqual(['きんぴら用カット野菜', 'しょうゆ']);
    expect(r.sections).toEqual([{ title: '', steps: ['内鍋に全部入れる', '炒める5分'] }]);
    expect(r.proper!.time).toBe(30);
    expect(r.proper!.ingredients.map((i) => i.name)).toEqual(['ごぼう', '人参', 'しょうゆ']);
    expect(r.proper!.sections).toEqual([
      { title: '下ごしらえ', steps: ['ごぼうをささがきにする'] },
      { title: '', steps: ['フライパンで炒める'] },
    ]);
    expect(r.nutrition!.kcal).toBe(60);
  });

  it('書き出して読み直しても同じ', () => {
    const r = parseRecipeMarkdown(md);
    expect(parseRecipeMarkdown(toMarkdown(r))).toEqual(r);
  });

  it('ちゃんと版が無いレシピは null', () => {
    expect(parseRecipeMarkdown('# a\n## 材料\n- 卵 1個\n## 手順\n1. 焼く').proper).toBeNull();
  });

  it('ちゃんと版の変更も履歴に出る', () => {
    const a = parseRecipeMarkdown(md);
    const b = structuredClone(a);
    b.proper!.ingredients[0].amount = '120g';
    b.proper!.time = 40;
    expect(diffContent(a, b)).toEqual([
      { label: '時間（ちゃんと版）', before: '30分', after: '40分' },
      { label: 'ちゃんと版：ごぼう', before: '100g', after: '120g' },
    ]);
  });

  it('全体と手間の差が5分以内なら手間は出さない', () => {
    expect(visibleHandsOn(60, 5)).toBe(5);
    expect(visibleHandsOn(30, 25)).toBeNull();
    expect(visibleHandsOn(30, 24)).toBe(24);
    expect(visibleHandsOn(null, 5)).toBeNull();
  });

  it('時間の読み書き', () => {
    expect(parseMinutes('1時間30分')).toBe(90);
    expect(parseMinutes('４０分')).toBe(40);
    expect(parseMinutes('')).toBeNull();
    expect(formatMinutes(90)).toBe('1時間30分');
    expect(formatMinutes(60)).toBe('1時間');
  });
});
