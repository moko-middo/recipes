import { describe, expect, it } from 'vitest';
import data from '../../public/recipes.json';
import { parseRecipeFile, parseRecipeMarkdown, toMarkdown } from './markdown.ts';
import { servingsCount, STALE_NUTRITION } from './types.ts';
import { withNutritionStatus } from './nutrition.ts';

const files = (data as { files: { path: string; md: string }[] }).files;
const find = (title: string) => {
  const f = files.find((x) => x.md.includes(`# ${title}\n`))!;
  return parseRecipeFile(f.path, f.md);
};

describe('栄養', () => {
  it('全部のレシピに1人分の栄養素が入っている', () => {
    for (const f of files) {
      const r = parseRecipeFile(f.path, f.md);
      expect(r.nutrition, r.title).not.toBeNull();
      expect(r.nutrition!.kcal, r.title).toBeGreaterThan(0);
      // 炭水化物＝糖質＋食物繊維
      expect(Math.abs(r.nutrition!.carbs - r.nutrition!.sugar - r.nutrition!.fiber), r.title).toBeLessThanOrEqual(0.15);
      expect(r.nutritionStale).toBe(false);
    }
  });

  it('値と注意書きを読める', () => {
    const r = find('キーマカレー');
    expect(r.nutrition).toEqual({ kcal: 324, protein: 15.7, fat: 22, carbs: 19.4, sugar: 16.4, fiber: 3, salt: 2.3 });
    expect(r.nutritionNote).toContain('ご飯は含みません');
    expect(r.source).toBe('');
  });

  it('参考URLは栄養の欄に混ざらない', () => {
    const r = find('から揚げ');
    expect(r.nutritionNote).toBe('');
    expect(r.source).toContain('ajinomoto');
  });

  it('分量だけ変えると目安の注意が付き、書き出しても残る', () => {
    const before = find('きんぴらごぼう');
    const after = structuredClone(before);
    after.ingredients.find((i) => i.name === '砂糖')!.amount = '小1';
    const saved = withNutritionStatus(before, after);
    expect(saved.nutritionStale).toBe(true);
    const md = toMarkdown(saved);
    expect(md).toContain(`※ ${STALE_NUTRITION}`);
    expect(parseRecipeMarkdown(md).nutritionStale).toBe(true);
  });

  it('栄養素を書き換えたら注意は消える', () => {
    const before = { ...find('きんぴらごぼう'), nutritionStale: true };
    const after = structuredClone(before);
    after.nutrition!.kcal = 55;
    expect(withNutritionStatus(before, after).nutritionStale).toBe(false);
  });

  it('手順やメモだけの変更では注意は付かない', () => {
    const before = find('きんぴらごぼう');
    const after = { ...structuredClone(before), memo: 'ごまは多めがおいしい' };
    expect(withNutritionStatus(before, after).nutritionStale).toBe(false);
  });

  it('何人分は数字1つ。幅があれば多いほう', () => {
    expect(servingsCount('2〜3人分')).toBe(3);
    expect(servingsCount('４人分')).toBe(4);
    expect(find('ポッサム（茹で豚の野菜包み）').servings).toBe('3人分');
  });
});
