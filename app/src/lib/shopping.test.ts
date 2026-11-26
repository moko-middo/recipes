import { describe, expect, it } from 'vitest';
import data from '../../public/recipes.json';
import { parseRecipeFile } from './markdown.ts';
import { idOf } from './store.ts';
import { buildShopping, findProduct, parseAmount, prettyFraction, suggestFor, type PlanItem } from './shopping.ts';
import type { Recipe } from './types.ts';

const recipes: Recipe[] = (data as { files: { path: string; md: string }[] }).files.map((f) => ({
  ...parseRecipeFile(f.path, f.md),
  id: idOf(f.path),
  path: f.path,
}));
const pick = (title: string, version: PlanItem['version'] = 'easy'): PlanItem => ({ id: recipes.find((r) => r.title === title)!.id, version });

describe('分量を読む', () => {
  it.each([
    ['1/2本', { qty: 0.5, unit: '本' }],
    ['1と1/3', { qty: 4 / 3, unit: '' }],
    ['3〜4枚', { qty: 4, unit: '枚' }],
    ['1枚（250g）', { qty: 250, unit: 'g' }],
    ['1本 (400g)', { qty: 400, unit: 'g' }],
    ['大1', { qty: 1, unit: '大' }],
    ['大1個', { qty: 1, unit: '個' }],
    ['小さじ1/2', { qty: 0.5, unit: '小' }],
    ['1/2カップ', { qty: 100, unit: 'ml' }],
    ['1袋（100g）', { qty: 100, unit: 'g' }],
  ])('%s', (raw, expected) => {
    const a = parseAmount(raw)!;
    expect(a.unit).toBe(expected.unit);
    expect(a.qty).toBeCloseTo(expected.qty);
  });

  it('読めないものは null', () => {
    expect(parseAmount('適量')).toBeNull();
    expect(parseAmount('お好みで')).toBeNull();
  });

  it('分数の表示', () => {
    expect(prettyFraction(0.5)).toBe('1/2');
    expect(prettyFraction(1.5)).toBe('1と1/2');
    expect(prettyFraction(0.99)).toBe('1');
    expect(prettyFraction(0.6)).toBeNull();
  });
});

describe('品物の見分け', () => {
  it.each([
    ['人参', 'にんじん'],
    ['にんじん', 'にんじん'],
    ['玉葱 or 長ねぎ', '玉ねぎ'],
    ['ねぎ(青い部分)', '長ねぎ'],
    ['小葱', '小ねぎ'],
    ['ホールトマト缶', 'トマト缶'],
    ['トマト(くし切り)', 'トマト'],
    ['豚バラ肉（塊）', '豚バラ（塊）'],
    ['豚バラ薄切り', '豚バラ薄切り'],
    ['小松菜（またはチンゲン菜）', '小松菜'],
    ['サラダ', 'カットサラダ'],
  ])('%s → %s', (name, product) => {
    expect(findProduct(name)?.name).toBe(product);
  });

  it.each(['サラダ油', 'バニラエッセンス', 'しょうゆ', '油揚げ以外の油'])('%s は野菜ではない', (name) => {
    expect(findProduct(name)?.section ?? '').not.toBe('野菜・きのこ');
  });
});

describe('買い物リストと余り', () => {
  const plan = [pick('キーマカレー'), pick('ジューシーハンバーグ', 'proper'), pick('三色ナムル'), pick('ピーマンの肉巻き')];
  const rows = buildShopping(recipes, plan);
  const row = (n: string) => rows.find((r) => r.name === n)!;

  it('同じ食材はまとめる（表記ゆれも）', () => {
    // キーマ1個＋ハンバーグ1/2個
    expect(row('玉ねぎ').use).toBe('1と1/2個');
    expect(row('玉ねぎ').buy).toBe('2個');
    expect(row('合いびき肉').buy).toBe('500g');
  });

  it('売っている単位で買うと余る量を出す', () => {
    expect(row('ピーマン').buy).toBe('1袋（5個入り）');
    expect(row('ピーマン').leftoverText).toBe('1個');
    expect(row('なす').leftoverText).toBe('2本');
    expect(row('にんじん').leftoverText).toBe('3/4本');
    expect(row('パプリカ').leftover).toBe(0);
  });

  it('卵は切り上げて買う', () => {
    expect(row('卵').buy).toBe('1個');
  });

  it('調味料は「家にあるか確認」', () => {
    expect(row('ケチャップ').section).toBe('家にあるか確認');
    expect(row('サラダ油').section).toBe('家にあるか確認');
  });

  it('余りを使えるレシピを提案（予定に入っているものは除く）', () => {
    const s = suggestFor(row('にんじん'), recipes, plan);
    expect(s[0].recipe.title).toBe('きんぴらごぼう');
    expect(s[0].usesAll).toBe(true);
    expect(s.some((x) => plan.some((p) => p.id === x.recipe.id))).toBe(false);
  });

  it('提案を足すと余りが減る', () => {
    const plan2 = [...plan, pick('きんぴらごぼう')];
    const carrot = buildShopping(recipes, plan2).find((r) => r.name === 'にんじん')!;
    expect(carrot.leftover).toBe(0);
  });

  it('ちゃんと版を選ぶと、ちゃんと版の材料で計算する', () => {
    const easy = buildShopping(recipes, [pick('ジューシーハンバーグ')]);
    const proper = buildShopping(recipes, [pick('ジューシーハンバーグ', 'proper')]);
    expect(easy.some((r) => r.name === '豚ひき肉')).toBe(true);
    expect(proper.some((r) => r.name === '合いびき肉')).toBe(true);
  });
});
