import { CATEGORIES, NUTRIENTS, STALE_NUTRITION, formatMinutes, parseMinutes, type Category, type Ingredient, type Nutrition, type RecipeContent, type StepSection } from './types.ts';

const CATEGORY_ALIASES: Record<string, Category> = {
  主菜: '主菜',
  主食: '主食',
  副菜: '副菜',
  汁物: '汁物',
  スープ: '汁物',
  みそ汁: '汁物',
  おやつ: 'おやつ',
  甘味: 'おやつ',
  デザート: 'おやつ',
};

/** 「主菜（肉）」→ { category: 主菜, sub: 肉 } */
export function parseCategory(raw: string): { category: Category; subCategory: string } {
  const m = raw.trim().match(/^([^（(]+)(?:[（(]([^）)]*)[）)])?/);
  const head = (m?.[1] ?? raw).trim();
  const sub = (m?.[2] ?? '').trim();
  const category = CATEGORY_ALIASES[head] ?? (CATEGORIES as readonly string[]).find((c) => head.includes(c)) ?? '主菜';
  return { category: category as Category, subCategory: sub };
}

const GROUP_RE = /^[（(]([^）)]{1,12})[）)]\s*(.+)$/;

export function splitGroup(cell: string): { group: string; name: string } {
  const m = cell.trim().match(GROUP_RE);
  if (m) return { group: m[1].trim(), name: m[2].trim() };
  return { group: '', name: cell.trim() };
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function parseFreezable(v: string): boolean | null {
  if (/OK|可|○|はい/i.test(v)) return true;
  if (/NG|不可|×|いいえ/i.test(v)) return false;
  return null;
}

export interface ParseOptions {
  /** フォルダ名などから分かる冷凍可否 */
  freezable?: boolean | null;
  category?: Category;
}

/**
 * これまでのレシピMarkdownの形式を読み取る。
 * 貼り付けられたテキストにも使うので、多少崩れていても読めるようにしている。
 */
export function parseRecipeMarkdown(md: string, opts: ParseOptions = {}): RecipeContent {
  const text = md.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const lines = text.split('\n');

  const front: Record<string, string> = {};
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (lines[i]?.trim() === '---') {
    let j = i + 1;
    const tmp: Record<string, string> = {};
    while (j < lines.length && lines[j].trim() !== '---') {
      const m = lines[j].match(/^\s*([^:：]+)[:：]\s*(.*)$/);
      if (m) tmp[m[1].trim()] = m[2].trim();
      j++;
    }
    if (j < lines.length) {
      Object.assign(front, tmp);
      i = j + 1;
    }
  }

  let title = '';
  let servings = '';
  const easy = { ingredients: [] as Ingredient[], sections: [] as StepSection[] };
  const proper = { ingredients: [] as Ingredient[], sections: [] as StepSection[] };
  let target = easy;
  let hasProper = false;
  const ingredients = easy.ingredients;
  const sections = easy.sections;
  const memoLines: string[] = [];
  const sources: string[] = [];

  let nutritionHead: string[] = [];
  let nutrition: Nutrition | null = null;
  const nutritionNotes: string[] = [];
  let nutritionStale = false;

  type Mode = 'none' | 'ingredients' | 'steps' | 'memo' | 'nutrition';
  let mode: Mode = 'none';
  let parentTitle = '';
  let current: StepSection | null = null;

  let tableColumns: Ingredient[][] = [];
  const flushTable = () => {
    for (const col of tableColumns) if (col) target.ingredients.push(...col);
    tableColumns = [];
  };

  const startSection = (t: string) => {
    current = { title: t, steps: [] };
    target.sections.push(current);
  };

  for (; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line.startsWith('|')) flushTable();
    if (line === '' || /^-{3,}$/.test(line)) continue;

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      if (!title) title = h1[1].trim();
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      let h = h2[1].trim();
      // 「## ちゃんと版：材料」「## ちゃんと版：手順」はちゃんと版のほう
      const pm = h.match(/^ちゃんと版\s*[：:]?\s*(.*)$/);
      if (pm) {
        target = proper;
        hasProper = true;
        h = pm[1].trim() || '手順';
      } else {
        target = easy;
      }
      current = null;
      const sv = h.match(/[（(]([^）)]*人分[^）)]*)[）)]/);
      if (sv && !servings) servings = sv[1].trim();
      if (/^材料/.test(h)) {
        mode = 'ingredients';
      } else if (/^栄養/.test(h)) {
        mode = 'nutrition';
      } else if (/^(メモ|ポイント|コツ|備考)/.test(h)) {
        mode = 'memo';
      } else {
        mode = 'steps';
        parentTitle = /^(手順|作り方)$/.test(h) ? '' : h;
        startSection(parentTitle);
      }
      continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      mode = 'steps';
      const t = h3[1].trim();
      // 親見出しの直後で手順がまだ無い空のセクションは置き換える
      const cur = current as StepSection | null;
      if (cur && cur.steps.length === 0 && cur.title === parentTitle) target.sections.pop();
      startSection(parentTitle ? `${parentTitle}（${t}）` : t);
      continue;
    }

    const bold = line.match(/^\*\*(.+人分.*)\*\*$/);
    if (bold) {
      servings = bold[1].trim();
      continue;
    }

    if (/^!\[[^\]]*\]\([^)]*\)$/.test(line)) continue; // 写真の表示用の行（写真は先頭の「写真:」で管理）

    if (line.startsWith('>')) {
      const s = line.replace(/^>\s*/, '').replace(/^(参考|出典)\s*[:：]\s*/, '').trim();
      // 「https://www.  kurashiru.  com/...」のように紛れ込んだ空白を詰める
      if (s) sources.push(s.replace(/https?:\/\/.*$/, (u) => u.replace(/\s+/g, '')));
      continue;
    }

    if (mode === 'nutrition') {
      if (line.startsWith('|')) {
        const c = cells(line);
        if (c.every((x) => /^:?-+:?$/.test(x) || x === '')) continue;
        if (nutritionHead.length === 0) {
          nutritionHead = c;
        } else {
          const n = {} as Nutrition;
          for (const [key, label] of NUTRIENTS) {
            const k = nutritionHead.findIndex((h) => h.includes(label));
            const v = k >= 0 ? parseFloat((c[k] ?? '').normalize('NFKC')) : NaN;
            n[key] = Number.isFinite(v) ? v : 0;
          }
          nutrition = n;
        }
      } else {
        const t = line.replace(/^※\s*/, '');
        if (t.includes(STALE_NUTRITION)) nutritionStale = true;
        else nutritionNotes.push(t);
      }
      continue;
    }

    if (line.startsWith('|')) {
      const c = cells(line);
      if (c.every((x) => /^:?-+:?$/.test(x) || x === '')) continue;
      if (c[0] === '材料' || c[0] === '食材') continue;
      // 表は「左の列を上から→右の列を上から」の順で読む
      for (let k = 0; k + 1 < c.length; k += 2) {
        if (!c[k]) continue;
        const { group, name } = splitGroup(c[k]);
        (tableColumns[k / 2] ??= []).push({ group, name, amount: c[k + 1] ?? '' });
      }
      continue;
    }

    if (mode === 'ingredients') {
      // 「・豚肉 200g」形式にも対応
      const m = line.replace(/^[-*・●]\s*/, '').match(/^(.+?)[\s　…:：]+([^\s　]+)$/);
      if (m) {
        const { group, name } = splitGroup(m[1]);
        target.ingredients.push({ group, name, amount: m[2] });
      } else {
        const { group, name } = splitGroup(line.replace(/^[-*・●]\s*/, ''));
        target.ingredients.push({ group, name, amount: '' });
      }
      continue;
    }

    if (mode === 'memo') {
      memoLines.push(line.replace(/^[-*・]\s*/, ''));
      continue;
    }

    if (mode === 'steps' || mode === 'none') {
      if (!current) startSection('');
      const step = line.replace(/^(\d+[.)．）]|[-*・])\s*/, '').trim();
      if (step) (current as unknown as StepSection).steps.push(step);
    }
  }

  flushTable();
  const cat = front['分類'] ? parseCategory(front['分類']) : { category: opts.category ?? '主菜', subCategory: '' };
  if (!servings) servings = front['何人分'] ?? '';
  const frozenFront = front['冷凍'] !== undefined ? parseFreezable(front['冷凍']) : undefined;
  const photos = (front['写真'] ?? '')
    .split(/[,、]/)
    .map((x) => x.trim())
    .filter(Boolean);

  return {
    title: title || front['タイトル'] || '名前のないレシピ',
    category: cat.category,
    subCategory: cat.subCategory,
    freezable: frozenFront !== undefined ? frozenFront : (opts.freezable ?? null),
    servings,
    ingredients,
    sections: sections.filter((s) => s.steps.length > 0 || s.title),
    memo: memoLines.join('\n'),
    source: sources.join('\n'),
    photos,
    nutrition,
    nutritionNote: nutritionNotes.join('\n'),
    nutritionStale: nutrition ? nutritionStale : false,
    time: parseMinutes(front['時間']),
    proper: hasProper
      ? {
          ingredients: proper.ingredients,
          sections: proper.sections.filter((s) => s.steps.length > 0 || s.title),
          time: parseMinutes(front['ちゃんと版の時間']),
        }
      : null,
  };
}

function writeVersion(out: string[], prefix: string, ingredients: Ingredient[], sections: StepSection[]) {
  if (prefix) out.push('');
  out.push(`## ${prefix}材料`, '', '| 材料 | 分量 | 材料 | 分量 |', '|------|------|------|------|');
  const half = Math.ceil(ingredients.length / 2);
  for (let k = 0; k < half; k++) {
    const a = ingredients[k];
    const b = ingredients[k + half];
    out.push(`| ${groupLabel(a.group)}${a.name} | ${a.amount} | ${b ? groupLabel(b.group) + b.name : ''} | ${b ? b.amount : ''} |`);
  }
  for (const s of sections) {
    out.push('', `## ${prefix}${s.title || '手順'}`, '');
    s.steps.forEach((st, n) => out.push(`${n + 1}. ${st}`));
  }
}

function groupLabel(g: string): string {
  return g ? `(${g})` : '';
}

/** アプリのレシピをいつものMarkdown形式に戻す（書き出し・本づくり用） */
export function toMarkdown(r: RecipeContent): string {
  const out: string[] = [];
  out.push('---');
  out.push(`分類: ${r.category}${r.subCategory ? `（${r.subCategory}）` : ''}`);
  out.push(`何人分: ${r.servings}`);
  if (r.freezable !== null) out.push(`冷凍: ${r.freezable ? 'OK' : 'NG'}`);
  if (r.photos.length) out.push(`写真: ${r.photos.join(', ')}`);
  if (r.time) out.push(`時間: ${formatMinutes(r.time)}`);
  if (r.proper?.time) out.push(`ちゃんと版の時間: ${formatMinutes(r.proper.time)}`);
  out.push('---', '', `# ${r.title}`, '');
  if (r.servings) out.push(`**${r.servings}**`, '');
  writeVersion(out, '', r.ingredients, r.sections);
  if (r.proper) writeVersion(out, 'ちゃんと版：', r.proper.ingredients, r.proper.sections);
  if (r.nutrition) {
    const n = r.nutrition;
    out.push('', '## 栄養（1人分）', '');
    out.push('| ' + NUTRIENTS.map(([, label]) => label).join(' | ') + ' |');
    out.push('|' + NUTRIENTS.map(() => '---').join('|') + '|');
    out.push('| ' + NUTRIENTS.map(([key, , unit]) => `${formatNutrient(key, n[key])}${unit}`).join(' | ') + ' |');
    if (r.nutritionStale) out.push('', `※ ${STALE_NUTRITION}`);
    if (r.nutritionNote) out.push('', ...r.nutritionNote.split('\n'));
  }
  if (r.memo) out.push('', '## メモ', '', ...r.memo.split('\n'));
  if (r.source) out.push('', ...r.source.split('\n').map((s) => `> 参考: ${s}`));
  if (r.photos.length) out.push('', ...r.photos.map((p) => `![](/${encodeURI(p)})`));
  return out.join('\n') + '\n';
}

const UNSAFE = /[\\/:*?"<>|#%]/g;

/** 分類・冷凍の可否・名前から、保存先のファイルパスを決める */
export function pathFor(r: RecipeContent): string {
  const name = r.title.replace(UNSAFE, '・').trim() || '名前のないレシピ';
  const freezeDir = r.category === '副菜' && r.freezable !== null ? (r.freezable ? '冷凍OK/' : '冷凍NG/') : '';
  return `${r.category}/${freezeDir}${name}.md`;
}

/** リポジトリのファイルを読む。副菜の冷凍OK/NGはフォルダからも分かる */
export function parseRecipeFile(path: string, md: string): RecipeContent {
  const freezable = path.includes('/冷凍OK/') ? true : path.includes('/冷凍NG/') ? false : null;
  return parseRecipeMarkdown(md, { freezable });
}

/** カロリーは整数、塩分などは小数1桁で表示する */
export function formatNutrient(key: string, v: number): string {
  return key === 'kcal' ? String(Math.round(v)) : v.toFixed(1);
}
