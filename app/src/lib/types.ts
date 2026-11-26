export const CATEGORIES = ['主菜', '主食', '副菜', '汁物', 'おやつ'] as const;
export type Category = (typeof CATEGORIES)[number];

/** 栄養素（1人分）。カロミルの「Myメニュー」と同じ項目 */
export const NUTRIENTS = [
  ['kcal', 'カロリー', 'kcal'],
  ['protein', 'たんぱく質', 'g'],
  ['fat', '脂質', 'g'],
  ['carbs', '炭水化物', 'g'],
  ['sugar', '糖質', 'g'],
  ['fiber', '食物繊維', 'g'],
  ['salt', '塩分', 'g'],
] as const;
export type NutrientKey = (typeof NUTRIENTS)[number][0];
export type Nutrition = Record<NutrientKey, number>;

/** 分量を変えたあと、栄養素を計算し直していないときに出す言葉 */
export const STALE_NUTRITION = '分量が変わったので栄養素は目安です';

export interface Ingredient {
  /** (A)(B)や「サムジャン」などのまとまり。なければ空文字 */
  group: string;
  name: string;
  amount: string;
}

export interface StepSection {
  /** 「仕込み」「帰宅後」など。普通の手順は空文字 */
  title: string;
  steps: string[];
}

/** レシピの中身（履歴に残す部分） */
export interface RecipeContent {
  title: string;
  category: Category;
  /** 「肉」「魚」など分類の補足 */
  subCategory: string;
  /** 冷凍OKならtrue、NGならfalse、未設定はnull */
  freezable: boolean | null;
  servings: string;
  ingredients: Ingredient[];
  sections: StepSection[];
  memo: string;
  source: string;
  /** リポジトリ内の写真のパス（1枚目が一覧に出る） */
  photos: string[];
  /** 1人分の栄養素（未計算なら null） */
  nutrition: Nutrition | null;
  /** 「ご飯は含みません」などの注意書き */
  nutritionNote: string;
  /** 分量を変えたあと栄養素を計算し直していなければ true */
  nutritionStale: boolean;
}

export interface Recipe extends RecipeContent {
  id: string;
  /** リポジトリ内のMarkdownファイルのパス（例：副菜/冷凍OK/きんぴらごぼう.md） */
  path: string;
}

/** GitHubのコミット1つ分＝そのときのレシピの版 */
export interface Revision {
  sha: string;
  date: string;
  author: string;
  /** コミットメッセージ（変更メモ） */
  message: string;
  content: RecipeContent | null;
}

export function contentOf(r: RecipeContent): RecipeContent {
  return {
    title: r.title,
    category: r.category,
    subCategory: r.subCategory,
    freezable: r.freezable,
    servings: r.servings,
    ingredients: r.ingredients.map((i) => ({ ...i })),
    sections: r.sections.map((s) => ({ title: s.title, steps: [...s.steps] })),
    memo: r.memo,
    source: r.source,
    photos: [...r.photos],
    nutrition: r.nutrition ? { ...r.nutrition } : null,
    nutritionNote: r.nutritionNote,
    nutritionStale: r.nutritionStale,
  };
}

/** 「2人分」→ 2。「2〜3人分」のように幅があれば多いほう */
export function servingsCount(s: string): number {
  const nums = (s.normalize('NFKC').match(/\d+/g) ?? []).map(Number).filter((n) => n > 0);
  return nums.length ? Math.max(...nums) : 1;
}
