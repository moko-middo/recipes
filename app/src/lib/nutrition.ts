import { servingsCount, type RecipeContent } from './types.ts';

/** 保存するときの栄養素の扱い：数値を直したら目安の注意を消し、分量だけ変えたら注意を付ける */
export function withNutritionStatus(prev: RecipeContent | undefined, next: RecipeContent): RecipeContent {
  if (!prev || !next.nutrition) return { ...next, nutritionStale: next.nutrition ? next.nutritionStale : false };
  const nutritionEdited = JSON.stringify(prev.nutrition) !== JSON.stringify(next.nutrition);
  if (nutritionEdited) return { ...next, nutritionStale: false };
  const amountsChanged = JSON.stringify(prev.ingredients) !== JSON.stringify(next.ingredients) || servingsCount(prev.servings) !== servingsCount(next.servings);
  return amountsChanged ? { ...next, nutritionStale: true } : next;
}
