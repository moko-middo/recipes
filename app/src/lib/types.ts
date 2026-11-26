export const CATEGORIES = ['主菜', '主食', '副菜', '汁物', 'おやつ'] as const;
export type Category = (typeof CATEGORIES)[number];

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
  };
}
