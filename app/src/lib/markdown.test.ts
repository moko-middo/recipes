import { describe, expect, it } from 'vitest';
import { parseRecipeFile, parseRecipeMarkdown, pathFor, toMarkdown } from './markdown.ts';
import { matches } from './search.ts';
import { diffContent } from './diff.ts';

const md = `---
分類: 主菜（肉）
何人分: 2人分
---

# から揚げ

**2人分**

## 材料

| 材料 | 分量 | 材料 | 分量 |
|------|------|------|------|
| 鶏もも肉 | 250g | (A)しょうが | 2cm |
| (A) 鶏がらスープ | 小1 | (A)しょうゆ | 小1 |

## 手順

1. 鶏モモ肉を8等分する
2. (A)に漬け込み、20分以上置く

> 参考: https://www.  example.  com/a
`;

describe('parseRecipeMarkdown', () => {
  it('いつもの形式を読める', () => {
    const r = parseRecipeMarkdown(md);
    expect(r.title).toBe('から揚げ');
    expect(r.category).toBe('主菜');
    expect(r.subCategory).toBe('肉');
    expect(r.servings).toBe('2人分');
    expect(r.ingredients.map((i) => i.name)).toEqual(['鶏もも肉', '鶏がらスープ', 'しょうが', 'しょうゆ']);
    expect(r.ingredients[1].group).toBe('A');
    expect(r.sections[0].steps).toHaveLength(2);
    expect(r.source).toBe('https://www.example.com/a');
  });

  it('書き出して読み直しても同じ', () => {
    const r = parseRecipeMarkdown(md, { freezable: true });
    const again = parseRecipeMarkdown(toMarkdown(r));
    expect(again).toEqual(r);
  });

  it('写真付きでも書き出して読み直せる', () => {
    const r = { ...parseRecipeMarkdown(md), photos: ['写真/a.jpg', '写真/b.jpg'] };
    const out = toMarkdown(r);
    expect(out).toContain('写真: 写真/a.jpg, 写真/b.jpg');
    expect(out).toContain('![](/%E5%86%99%E7%9C%9F/a.jpg)');
    expect(parseRecipeMarkdown(out)).toEqual(r);
  });

  it('保存先のパスを決める', () => {
    const r = parseRecipeMarkdown(md);
    expect(pathFor(r)).toBe('主菜/から揚げ.md');
    expect(pathFor({ ...r, category: '副菜', freezable: true, title: 'a/b' })).toBe('副菜/冷凍OK/a・b.md');
    expect(parseRecipeFile('副菜/冷凍NG/x.md', '# x').freezable).toBe(false);
  });

  it('箇条書きの材料も読める', () => {
    const r = parseRecipeMarkdown(`# 卵焼き\n## 材料（2人分）\n- 卵 3個\n- 砂糖 大1\n## 作り方\n1. 混ぜる\n2. 焼く`);
    expect(r.servings).toBe('2人分');
    expect(r.ingredients).toEqual([
      { group: '', name: '卵', amount: '3個' },
      { group: '', name: '砂糖', amount: '大1' },
    ]);
    expect(r.sections[0].steps).toEqual(['混ぜる', '焼く']);
  });
});

describe('search', () => {
  it('漢字とかなの言い換えで探せる', () => {
    const r = { ...parseRecipeMarkdown(md), id: 'x', path: '主菜/から揚げ.md' };
    expect(matches(r, '醤油')).toBe(true);
    expect(matches(r, 'トリモモ')).toBe(false);
    expect(matches(r, '鶏もも')).toBe(true);
  });
});

describe('diffContent', () => {
  it('分量の変更を拾う', () => {
    const a = parseRecipeMarkdown(md);
    const b = structuredClone(a);
    b.ingredients[3].amount = '大1';
    expect(diffContent(a, b)).toEqual([{ label: '(A)しょうゆ', before: '小1', after: '大1' }]);
  });
});
