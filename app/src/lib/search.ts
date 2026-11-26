import type { Recipe } from './types.ts';

/** カタカナ→ひらがな、全角英数→半角、小文字化 */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s+/g, '');
}

/** 漢字とかなの言い換え（検索・食材の名寄せに使う） */
const SYNONYMS: string[][] = [
  ['にんじん', '人参'],
  ['たまねぎ', '玉ねぎ', '玉葱'],
  ['しょうゆ', '醤油'],
  ['しょうが', '生姜'],
  ['にんにく', '大蒜'],
  ['ごま', '胡麻'],
  ['たまご', '卵', '玉子'],
  ['ほうれんそう', 'ほうれん草'],
  ['ぶたにく', '豚肉', '豚'],
  ['とりにく', '鶏肉', '鶏'],
  ['ぎゅうにく', '牛肉', '牛'],
  ['ねぎ', '葱', '長ねぎ'],
  ['きゃべつ', 'キャベツ'],
  ['さとう', '砂糖'],
  ['しお', '塩'],
  ['す', '酢'],
  ['みそ', '味噌'],
  ['なす', '茄子'],
  ['じゃがいも', 'じゃが芋', 'ジャガイモ'],
  ['しいたけ', '椎茸'],
  ['こしょう', '胡椒'],
  ['ちんげんさい', 'チンゲン菜', '青梗菜'],
  ['ひきにく', '挽肉', 'ひき肉', '挽き肉'],
];

const synIndex = new Map<string, string[]>();
for (const group of SYNONYMS) {
  const norm = group.map(normalize);
  for (const n of norm) synIndex.set(n, norm);
}

export function expandTerm(term: string): string[] {
  const n = normalize(term);
  return synIndex.get(n) ?? [n];
}

export function haystack(r: Recipe): string {
  return normalize([r.title, r.subCategory, r.memo, ...r.ingredients.map((i) => i.name), ...(r.proper?.ingredients ?? []).map((i) => i.name)].join(' '));
}

/** 空白区切りの全部の言葉を含むレシピを返す（言い換えも考慮） */
export function matches(r: Recipe, q: string): boolean {
  const terms = q.split(/[\s　]+/).filter(Boolean);
  if (terms.length === 0) return true;
  const h = haystack(r);
  return terms.every((t) => expandTerm(t).some((v) => h.includes(v)));
}
