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

/** ちゃんと版（材料と手順を丸ごと持つ） */
export interface ProperVersion {
  ingredients: Ingredient[];
  sections: StepSection[];
  /** 所要時間（分） */
  time: number | null;
  /** そのうち手を動かす時間（分） */
  handsOn: number | null;
}

/** レシピの中身（履歴に残す部分）。材料と手順は「手抜き版」 */
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
  /** 手抜き版の所要時間（分） */
  time: number | null;
  /** 手抜き版で手を動かす時間（分） */
  handsOn: number | null;
  /** ちゃんと版（無ければ null） */
  proper: ProperVersion | null;
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
    time: r.time,
    handsOn: r.handsOn,
    proper: r.proper
      ? {
          ingredients: r.proper.ingredients.map((i) => ({ ...i })),
          sections: r.proper.sections.map((x) => ({ title: x.title, steps: [...x.steps] })),
          time: r.proper.time,
          handsOn: r.proper.handsOn,
        }
      : null,
  };
}

/** 「2人分」→ 2。「2〜3人分」のように幅があれば多いほう */
export function servingsCount(s: string): number {
  const nums = (s.normalize('NFKC').match(/\d+/g) ?? []).map(Number).filter((n) => n > 0);
  return nums.length ? Math.max(...nums) : 1;
}

/** 「40分」「1時間30分」→ 分。読めなければ null */
export function parseMinutes(s: string | undefined): number | null {
  if (!s) return null;
  const t = s.normalize('NFKC');
  const h = t.match(/(\d+(?:\.\d+)?)\s*時間/);
  const m = t.match(/(\d+)\s*分/);
  if (!h && !m) {
    const n = parseInt(t, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return Math.round((h ? parseFloat(h[1]) * 60 : 0) + (m ? parseInt(m[1], 10) : 0)) || null;
}

/** 分 → 「40分」「1時間30分」 */
export function formatMinutes(n: number): string {
  if (n < 60) return `${n}分`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}時間${m}分` : `${h}時間`;
}

/** 全体と手間の差がこれ以下なら「手間」は出さない（ずっと手を動かしている） */
export const HANDS_ON_MIN_GAP = 5;

/** 「手間 5分」を出すときだけ手間の分数を返す */
export function visibleHandsOn(time: number | null, handsOn: number | null): number | null {
  if (!time || !handsOn) return null;
  return time - handsOn > HANDS_ON_MIN_GAP ? handsOn : null;
}
