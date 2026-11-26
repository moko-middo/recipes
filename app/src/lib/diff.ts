import { NUTRIENTS, formatMinutes, type Ingredient, type RecipeContent, type StepSection } from './types.ts';
import { formatNutrient } from './markdown.ts';

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
  for (const [key, label, unit] of NUTRIENTS) {
    const x = a.nutrition?.[key];
    const y = b.nutrition?.[key];
    if (x !== y) {
      const f = (v: number | undefined) => (v === undefined ? '（なし）' : formatNutrient(key, v) + unit);
      out.push({ label: `${label}（1人分）`, before: f(x), after: f(y) });
    }
  }
  const t = (v: number | null | undefined) => (v ? formatMinutes(v) : '（なし）');
  if (a.time !== b.time) out.push({ label: '時間（手抜き版）', before: t(a.time), after: t(b.time) });
  if (a.handsOn !== b.handsOn) out.push({ label: '手間（手抜き版）', before: t(a.handsOn), after: t(b.handsOn) });
  diffVersion(out, '', a.ingredients, b.ingredients, a.sections, b.sections);
  if (!a.proper && b.proper) out.push({ label: 'ちゃんと版', before: '（なし）', after: '追加' });
  else if (a.proper && !b.proper) out.push({ label: 'ちゃんと版', before: 'あり', after: '（削除）' });
  else if (a.proper && b.proper) {
    if (a.proper.time !== b.proper.time) out.push({ label: '時間（ちゃんと版）', before: t(a.proper.time), after: t(b.proper.time) });
    if (a.proper.handsOn !== b.proper.handsOn) out.push({ label: '手間（ちゃんと版）', before: t(a.proper.handsOn), after: t(b.proper.handsOn) });
    diffVersion(out, 'ちゃんと版：', a.proper.ingredients, b.proper.ingredients, a.proper.sections, b.proper.sections);
  }
  return out;
}

const stepsText = (sections: StepSection[]) =>
  sections.map((s) => (s.title ? `【${s.title}】\n` : '') + s.steps.map((x, n) => `${n + 1}. ${x}`).join('\n')).join('\n');

function diffVersion(out: Change[], prefix: string, ai: Ingredient[], bi: Ingredient[], as: StepSection[], bs: StepSection[]) {
  const am = new Map(ai.map((i) => [key(i.group, i.name), i.amount]));
  const bm = new Map(bi.map((i) => [key(i.group, i.name), i.amount]));
  const label = (k: string) => {
    const [g, n] = k.split('\u0000');
    return prefix + (g ? `(${g})${n}` : n);
  };
  for (const [k, v] of am) {
    if (!bm.has(k)) out.push({ label: label(k), before: v, after: '（削除）' });
    else if (bm.get(k) !== v) out.push({ label: label(k), before: v, after: bm.get(k)! });
  }
  for (const [k, v] of bm) if (!am.has(k)) out.push({ label: label(k), before: '（なし）', after: v });
  const sa = stepsText(as);
  const sb = stepsText(bs);
  if (sa !== sb) out.push({ label: `${prefix}手順`, before: sa, after: sb });
}
