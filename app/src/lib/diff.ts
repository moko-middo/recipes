import type { RecipeContent } from './types.ts';

export interface Change {
  label: string;
  before: string;
  after: string;
}

const key = (g: string, n: string) => `${g}\u0000${n}`;

/** 2つの版の違いを人が読める形にする */
export function diffContent(a: RecipeContent, b: RecipeContent): Change[] {
  const out: Change[] = [];
  const simple: [keyof RecipeContent, string][] = [
    ['title', '名前'],
    ['servings', '何人分'],
    ['category', '分類'],
    ['subCategory', '分類の補足'],
    ['memo', 'メモ'],
    ['source', '参考'],
  ];
  for (const [k, label] of simple) if (a[k] !== b[k]) out.push({ label, before: String(a[k] ?? ''), after: String(b[k] ?? '') });
  if (a.freezable !== b.freezable) {
    const f = (v: boolean | null) => (v === null ? '未設定' : v ? 'OK' : 'NG');
    out.push({ label: '冷凍', before: f(a.freezable), after: f(b.freezable) });
  }
  if (a.photos.join() !== b.photos.join()) {
    out.push({ label: '写真', before: `${a.photos.length}枚`, after: `${b.photos.length}枚` });
  }
  const am = new Map(a.ingredients.map((i) => [key(i.group, i.name), i.amount]));
  const bm = new Map(b.ingredients.map((i) => [key(i.group, i.name), i.amount]));
  const label = (k: string) => {
    const [g, n] = k.split('\u0000');
    return g ? `(${g})${n}` : n;
  };
  for (const [k, v] of am) {
    if (!bm.has(k)) out.push({ label: label(k), before: v, after: '（削除）' });
    else if (bm.get(k) !== v) out.push({ label: label(k), before: v, after: bm.get(k)! });
  }
  for (const [k, v] of bm) if (!am.has(k)) out.push({ label: label(k), before: '（なし）', after: v });
  const steps = (r: RecipeContent) => r.sections.map((s) => (s.title ? `【${s.title}】\n` : '') + s.steps.map((x, n) => `${n + 1}. ${x}`).join('\n')).join('\n');
  const sa = steps(a);
  const sb = steps(b);
  if (sa !== sb) out.push({ label: '手順', before: sa, after: sb });
  return out;
}
