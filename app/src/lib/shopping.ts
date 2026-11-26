import { normalize } from './search.ts';
import type { Ingredient, Recipe } from './types.ts';

/*
 * 作る予定 → 買い物リストと「余りそうな食材」を計算する。
 * 冷蔵庫の中身は登録しないので、「お店で売っている単位」で買ったときにどれだけ余るかを出す。
 */

export type Section = '野菜・きのこ' | '肉・魚' | '卵・乳製品' | 'その他' | '家にあるか確認';
export const SECTIONS: Section[] = ['野菜・きのこ', '肉・魚', '卵・乳製品', 'その他', '家にあるか確認'];

interface Product {
  name: string;
  /** 材料名に含まれていたらこの品物とみなす（上から順に調べる）。「=」で始まるものは名前が完全に一致したときだけ */
  match: string[];
  section: Section;
  /** 数える単位（本・個など） */
  unit: string;
  /** 1単位あたりのグラム */
  grams: number;
  /** 1回に買う量（単位いくつ分）。余りの計算に使う。無ければ余りは計算しない */
  pack?: number;
  /** 買う単位の呼び名（「袋」など）。pack が1でないとき */
  packName?: string;
  /** ほかの単位で書かれたときのグラム（ほうれん草の「株」など） */
  alt?: Record<string, number>;
}

// よくある売り方。お店に合わせて変えてよい
export const PRODUCTS: Product[] = [
  // 先に調べたいもの（名前に別の品物の名前を含むもの）
  { name: 'トマト缶', match: ['トマト缶', 'ホールトマト', 'カットトマト'], section: 'その他', unit: 'g', grams: 1 },
  { name: '小ねぎ', match: ['小ねぎ', '小葱', '万能ねぎ'], section: '野菜・きのこ', unit: '束', grams: 100, pack: 1 },
  { name: '玉ねぎ', match: ['玉ねぎ', '玉葱', 'たまねぎ'], section: '野菜・きのこ', unit: '個', grams: 200, pack: 1, alt: { 大: 10, 小: 3 } },
  { name: '塩昆布', match: ['塩昆布'], section: 'その他', unit: 'g', grams: 1 },
  { name: 'キムチ', match: ['キムチ'], section: 'その他', unit: 'g', grams: 1 },
  // 野菜・きのこ
  { name: 'にんじん', match: ['にんじん', '人参'], section: '野菜・きのこ', unit: '本', grams: 150, pack: 1 },
  { name: 'じゃがいも', match: ['じゃがいも', 'じゃが芋'], section: '野菜・きのこ', unit: '個', grams: 150, pack: 1 },
  { name: 'キャベツ', match: ['キャベツ'], section: '野菜・きのこ', unit: '個', grams: 1200, pack: 0.25, packName: '1/4カット', alt: { 枚: 50 } },
  { name: 'もやし', match: ['もやし'], section: '野菜・きのこ', unit: '袋', grams: 200, pack: 1 },
  { name: 'ピーマン', match: ['ピーマン'], section: '野菜・きのこ', unit: '個', grams: 35, pack: 5, packName: '袋' },
  { name: 'なす', match: ['なす', '茄子'], section: '野菜・きのこ', unit: '本', grams: 80, pack: 3, packName: '袋' },
  { name: 'トマト', match: ['トマト'], section: '野菜・きのこ', unit: '個', grams: 150, pack: 1 },
  { name: 'パプリカ', match: ['パプリカ'], section: '野菜・きのこ', unit: '個', grams: 150, pack: 1 },
  { name: 'アボカド', match: ['アボカド'], section: '野菜・きのこ', unit: '個', grams: 140, pack: 1 },
  { name: 'ほうれん草', match: ['ほうれん草', 'ほうれんそう'], section: '野菜・きのこ', unit: '束', grams: 200, pack: 1, alt: { 株: 200 / 6 } },
  { name: '小松菜', match: ['小松菜'], section: '野菜・きのこ', unit: '束', grams: 200, pack: 1, alt: { 株: 40 } },
  { name: 'チンゲン菜', match: ['チンゲン菜', '青梗菜'], section: '野菜・きのこ', unit: '株', grams: 100, pack: 2, packName: '袋' },
  { name: 'にら', match: ['=にら', '=ニラ'], section: '野菜・きのこ', unit: '束', grams: 100, pack: 1 },
  { name: '長ねぎ', match: ['長ねぎ', '長葱', 'ねぎ'], section: '野菜・きのこ', unit: '本', grams: 100, pack: 1, alt: { 大: 10, 小: 3 } },
  { name: 'セロリ', match: ['セロリ'], section: '野菜・きのこ', unit: '本', grams: 100, pack: 1 },
  { name: 'ブロッコリー', match: ['ブロッコリー'], section: '野菜・きのこ', unit: '株', grams: 250, pack: 1 },
  { name: 'いんげん', match: ['いんげん'], section: '野菜・きのこ', unit: '袋', grams: 100, pack: 1 },
  { name: 'ごぼう', match: ['ごぼう'], section: '野菜・きのこ', unit: '本', grams: 150, pack: 1 },
  { name: 'しいたけ', match: ['しいたけ', '椎茸'], section: '野菜・きのこ', unit: '個', grams: 15, pack: 6, packName: 'パック' },
  { name: 'マッシュルーム', match: ['マッシュルーム'], section: '野菜・きのこ', unit: 'パック', grams: 100, pack: 1 },
  { name: 'オクラ', match: ['オクラ'], section: '野菜・きのこ', unit: '袋', grams: 100, pack: 1 },
  { name: 'アスパラガス', match: ['アスパラ'], section: '野菜・きのこ', unit: '本', grams: 20, pack: 5, packName: '束' },
  { name: 'きゅうり', match: ['きゅうり'], section: '野菜・きのこ', unit: '本', grams: 100, pack: 1 },
  { name: '青じそ', match: ['青じそ', '大葉'], section: '野菜・きのこ', unit: '枚', grams: 1, pack: 10, packName: '束' },
  { name: 'サンチュ', match: ['サンチュ'], section: '野菜・きのこ', unit: '袋', grams: 80, pack: 1 },
  { name: 'みょうが', match: ['みょうが'], section: '野菜・きのこ', unit: '個', grams: 15, pack: 3, packName: 'パック' },
  { name: 'パセリ', match: ['パセリ'], section: '野菜・きのこ', unit: '束', grams: 30, pack: 1 },
  { name: 'カットサラダ', match: ['=サラダ', 'カットサラダ'], section: '野菜・きのこ', unit: 'パック', grams: 100, pack: 1 },
  // 肉・魚
  { name: '鶏もも肉', match: ['鶏もも', '鶏モモ'], section: '肉・魚', unit: 'g', grams: 1, alt: { 枚: 250 } },
  { name: '鶏むね肉', match: ['鶏むね'], section: '肉・魚', unit: 'g', grams: 1, alt: { 枚: 250 } },
  { name: '豚バラ（塊）', match: ['豚バラ肉（塊）', '豚バラ肉(塊)', '豚バラ塊'], section: '肉・魚', unit: 'g', grams: 1 },
  { name: '豚バラ薄切り', match: ['豚バラ'], section: '肉・魚', unit: 'g', grams: 1 },
  { name: '豚しゃぶしゃぶ用', match: ['しゃぶしゃぶ用豚肉'], section: '肉・魚', unit: 'g', grams: 1 },
  { name: '豚ひき肉', match: ['豚ひき', '豚挽'], section: '肉・魚', unit: 'g', grams: 1 },
  { name: '合いびき肉', match: ['合いびき', '合びき', '合挽'], section: '肉・魚', unit: 'g', grams: 1 },
  { name: 'スペアリブ', match: ['スペアリブ'], section: '肉・魚', unit: 'g', grams: 1 },
  { name: '豚肉（カレー用）', match: ['豚肉'], section: '肉・魚', unit: 'g', grams: 1 },
  { name: '牛肉（カレー用）', match: ['牛肉（カレー用）', '牛肉(カレー用)'], section: '肉・魚', unit: 'g', grams: 1 },
  { name: '牛薄切り肉', match: ['牛薄切り', '牛肉薄切り', '牛肉'], section: '肉・魚', unit: 'g', grams: 1 },
  { name: 'えび', match: ['えび', 'エビ', '海老'], section: '肉・魚', unit: '尾', grams: 20 },
  { name: '焼き豚', match: ['焼き豚', 'チャーシュー'], section: '肉・魚', unit: 'g', grams: 1 },
  { name: '明太子', match: ['明太子'], section: '肉・魚', unit: '腹', grams: 80 },
  { name: 'ちりめんじゃこ', match: ['じゃこ'], section: '肉・魚', unit: 'g', grams: 1 },
  { name: 'ツナ缶（水煮）', match: ['ツナ'], section: 'その他', unit: '袋', grams: 70 },
  { name: 'ちくわ', match: ['ちくわ'], section: 'その他', unit: '本', grams: 30 },
  // 卵・乳製品
  { name: '卵', match: ['卵', 'たまご'], section: '卵・乳製品', unit: '個', grams: 50 },
  { name: '牛乳', match: ['牛乳'], section: '卵・乳製品', unit: 'ml', grams: 1, alt: { 大: 15, 小: 5 } },
  { name: 'ピザ用チーズ', match: ['ピザ用チーズ'], section: '卵・乳製品', unit: 'g', grams: 1 },
  { name: 'スライスチーズ', match: ['スライスチーズ'], section: '卵・乳製品', unit: '枚', grams: 18 },
  { name: '粉チーズ', match: ['粉チーズ'], section: '卵・乳製品', unit: 'g', grams: 1, alt: { 大: 6, 小: 2 } },
  { name: 'バター', match: ['バター'], section: '卵・乳製品', unit: 'g', grams: 1, alt: { 大: 12, 小: 4 } },
  // その他
  { name: 'うどん', match: ['うどん'], section: 'その他', unit: '玉', grams: 200 },
  { name: 'スパゲティ', match: ['スパゲティ', 'パスタ（乾'], section: 'その他', unit: 'g', grams: 1, alt: { 人分: 100 } },
  { name: '食パン', match: ['食パン'], section: 'その他', unit: '枚', grams: 60 },
  { name: '油揚げ', match: ['油揚げ'], section: 'その他', unit: '枚', grams: 30 },
  { name: 'ひじき（乾燥）', match: ['ひじき'], section: 'その他', unit: 'g', grams: 1 },
  { name: '梅干し', match: ['梅干し'], section: 'その他', unit: '個', grams: 10 },
  { name: 'カレールウ', match: ['カレールー', 'カレールウ'], section: 'その他', unit: '皿分', grams: 20 },
  { name: 'ハヤシライスルウ', match: ['ハヤシライス'], section: 'その他', unit: '皿分', grams: 20 },
  { name: 'ナムルの素', match: ['シーズニング', 'ナムルの素'], section: 'その他', unit: '袋', grams: 10 },
  { name: 'キムチ鍋の素', match: ['キムチ鍋の素'], section: 'その他', unit: 'g', grams: 1 },
];

// 調味料・香味野菜など、たいてい家にあるもの
const PANTRY = [
  'しょうゆ', '醤油', '醬油', 'みりん', '酒', '砂糖', '塩', 'こしょう', '胡椒', 'コショウ', '酢', '油', 'オリーブオイル',
  '片栗粉', '小麦粉', 'パン粉', 'コンソメ', '鶏がら', '鶏ガラ', 'だし', 'ほんだし', 'みそ', 'ケチャップ', 'マヨネーズ', 'ソース',
  'ごま', '胡麻', 'はちみつ', 'チューブ', 'ポン酢', 'めんつゆ', 'ローリエ', 'ターメリック', 'クミン', 'コリアンダー',
  'チリパウダー', 'カレー粉', '一味', '唐辛子', 'ナツメグ', 'レモン', 'クレイジーソルト', 'ワイン', '梅酒', 'バニラ',
  'メープル', '粉糖', 'マーマレード', '昆布', 'かつお節', '鰹節', 'コチュジャン', 'にんにく', 'ニンニク', 'しょうが',
  '生姜', 'ごはん', 'ご飯', 'カット野菜',
];
const IGNORE = /^(水|お湯|湯|蒸し汁|ゆで汁|パスタのゆで汁|ひたひた)$/;

/** 材料名をそろえる（「（すりおろし）」などの補足を取る） */
export function cleanName(raw: string): string {
  return raw
    .split(/\s+or\s+|または/)[0]
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[・、].*$/, '')
    .trim();
}

export function findProduct(rawName: string): Product | null {
  const full = normalize(rawName.split(/\s+or\s+/)[0]);
  const exact = normalize(cleanName(rawName));
  for (const p of PRODUCTS) {
    if (p.match.some((m) => (m.startsWith('=') ? exact === normalize(m.slice(1)) : full.includes(normalize(m))))) return p;
  }
  return null;
}

// 表記ゆれをそろえる（「醤油」と「しょうゆ」を1つにまとめる）
const PANTRY_SPELLING: [RegExp, string][] = [
  [/^(醤油|醬油)$/, 'しょうゆ'],
  [/^(生姜|生姜チューブ|しょうがの皮)$/, 'しょうが'],
  [/^(ニンニク|ニンニクチューブ|おろしにんにく)$/, 'にんにく'],
  [/^(胡椒|コショウ|塩、胡椒|塩、こしょう)$/, '塩こしょう'],
  [/^(鶏ガラの素|鶏がらスープ|鶏ガラスープ|鶏ガラスープの素)$/, '鶏がらスープの素'],
  [/^(ごはん|ご飯)$/, 'ごはん'],
];

function pantryName(name: string): string {
  for (const [re, to] of PANTRY_SPELLING) if (re.test(name)) return to;
  return name;
}

function isPantry(name: string): boolean {
  const n = normalize(name);
  return PANTRY.some((p) => n.includes(normalize(p)));
}

export interface Amount {
  qty: number;
  unit: string;
}

/** 「1/2本」「1と1/3」「3〜4枚」「1枚（250g）」「大1」などを読む。読めなければ null */
export function parseAmount(raw: string): Amount | null {
  let s = raw.normalize('NFKC').split(/\s+or\s+/)[0].replace(/^各/, '').trim();
  // かっこ内にグラムがあればそちらを使う（例：1枚（250g）、1本 (400g)）
  const g = s.match(/[（(]\s*(\d+(?:\.\d+)?)\s*g\s*[）)]/);
  if (g) return { qty: parseFloat(g[1]), unit: 'g' };
  s = s.replace(/[（(][^）)]*[）)]/g, '').trim();
  // 「大1個」のような大きさの「大」は取る
  s = s.replace(/^[大小]\s*(?=[\d./と]+\s*[^\d./と\s〜~])/, '');
  const spoon = s.match(/^(大|小)(?:さじ)?\s*([\d./と〜~\s]+)$/);
  if (spoon) {
    const n = parseNumber(spoon[2]);
    return n === null ? null : { qty: n, unit: spoon[1] };
  }
  const m = s.match(/^([\d./と〜~\s]+?)\s*(kg|g|ml|cc|mL|カップ|本分|本|個|袋|束|株|枚|パック|玉|尾|缶|片|かけ|腹|皿分|人分|房|cm)?$/);
  if (!m) return null;
  const n = parseNumber(m[1]);
  if (n === null) return null;
  let unit = m[2] ?? '';
  if (unit === 'kg') return { qty: n * 1000, unit: 'g' };
  if (unit === 'cc' || unit === 'mL') unit = 'ml';
  if (unit === 'カップ') return { qty: n * 200, unit: 'ml' };
  if (unit === '本分') unit = '本';
  return { qty: n, unit };
}

function parseNumber(s: string): number | null {
  // 「3〜4」は多いほう
  const parts = s.split(/[〜~]/);
  const last = parts[parts.length - 1].trim();
  const m = last.match(/^(\d+(?:\.\d+)?)?(?:\s*と?\s*(\d+)\/(\d+))?$/);
  if (!m || (!m[1] && !m[2])) return null;
  const whole = m[1] ? parseFloat(m[1]) : 0;
  const frac = m[2] ? parseInt(m[2], 10) / parseInt(m[3], 10) : 0;
  // 「1/2」のように整数部が無いとき
  if (!m[2] && m[1] && last.includes('/')) return null;
  return whole + frac;
}

/** 品物の単位に直す（グラムや「株」も換算する）。できなければ null */
export function toProductUnits(p: Product, a: Amount): number | null {
  if (a.unit === p.unit || (a.unit === '' && p.unit !== 'g')) return a.qty;
  if (a.unit === 'g') return a.qty / p.grams;
  if (p.unit === 'g' && p.alt?.[a.unit]) return a.qty * p.alt[a.unit];
  if (p.alt?.[a.unit]) return (a.qty * p.alt[a.unit]) / p.grams;
  return null;
}

export interface PlanItem {
  id: string;
  version: 'easy' | 'proper';
}

export function ingredientsFor(r: Recipe, v: PlanItem['version']): Ingredient[] {
  return v === 'proper' && r.proper ? r.proper.ingredients : r.ingredients;
}

export interface ShoppingRow {
  name: string;
  section: Section;
  /** 買う量の表示（例：「1袋（5個入り）」「480g」） */
  buy: string;
  /** 使う量の表示（例：「1と1/2本」） */
  use: string;
  /** どのレシピで使うか */
  recipes: string[];
  /** 余る量（品物の単位）。余りを計算しない品物は null */
  leftover: number | null;
  leftoverText: string;
  product: Product | null;
}

interface Acc {
  name: string;
  section: Section;
  product: Product | null;
  units: number;
  /** 換算できなかった分量（そのまま並べる） */
  raw: string[];
  recipes: Set<string>;
}

/** 0.5 → 「1/2」、1.5 → 「1と1/2」。きれいな分数でなければ null */
export function prettyFraction(n: number): string | null {
  const whole = Math.floor(n + 1e-9);
  const f = n - whole;
  if (f < 0.04) return whole ? String(whole) : null;
  if (f > 0.96) return String(whole + 1);
  const fracs: [number, string][] = [[1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4']];
  for (const [v, t] of fracs) if (Math.abs(f - v) < 0.04) return whole ? `${whole}と${t}` : t;
  return null;
}

export function formatUnits(p: Product, units: number): string {
  if (p.unit === 'g' || p.unit === 'ml') return `${Math.round(units)}${p.unit}`;
  const f = prettyFraction(units);
  if (f) return `${f}${p.unit}`;
  // きれいな分数にならないときは、だいたいの量で（1以上は半分刻み、1未満はグラム）
  if (units >= 1) return `約${prettyFraction(Math.round(units * 2) / 2)}${p.unit}`;
  return `約${Math.max(10, Math.round((units * p.grams) / 10) * 10)}g`;
}

function formatBuy(p: Product, packs: number): string {
  if (!p.pack) return '';
  if (p.pack === 1) return `${packs}${p.unit}`;
  if (p.pack < 1) return formatUnits(p, packs * p.pack);
  return `${packs}${p.packName ?? 'パック'}（${p.pack}${p.unit}入り）`;
}

/** 余りとみなす最小量（グラム）。これより少なければ気にしない */
const LEFTOVER_MIN_GRAMS = 30;

export function leftoverText(p: Product, units: number): string {
  const f = prettyFraction(units);
  if (f && (p.pack ?? 1) <= 1) return `${f}${p.unit}`;
  if (Number.isInteger(Math.round(units * 100) / 100) && p.unit !== 'g') return `${Math.round(units)}${p.unit}`;
  return `約${Math.round(units * p.grams / 10) * 10}g`;
}

/** 作る予定から買い物リストを作る */
export function buildShopping(recipes: Recipe[], plan: PlanItem[]): ShoppingRow[] {
  const accs = new Map<string, Acc>();
  for (const item of plan) {
    const r = recipes.find((x) => x.id === item.id);
    if (!r) continue;
    for (const ing of ingredientsFor(r, item.version)) {
      const name = ing.name.trim();
      if (!name) continue;
      const clean = cleanName(name);
      if (IGNORE.test(clean)) continue;
      const product = findProduct(name);
      let section: Section;
      let key: string;
      if (product) {
        section = product.section;
        key = product.name;
      } else if (isPantry(name)) {
        section = '家にあるか確認';
        key = pantryName(clean);
      } else {
        section = 'その他';
        key = clean;
      }
      const acc = accs.get(key) ?? { name: key, section, product, units: 0, raw: [], recipes: new Set() };
      acc.recipes.add(r.title);
      const amount = parseAmount(ing.amount);
      const units = product && amount ? toProductUnits(product, amount) : null;
      if (units !== null) acc.units += units;
      else if (ing.amount && section !== '家にあるか確認') acc.raw.push(ing.amount);
      accs.set(key, acc);
    }
  }

  const rows: ShoppingRow[] = [];
  for (const a of accs.values()) {
    const p = a.product;
    const usedText = [p && a.units > 0 ? formatUnits(p, a.units) : '', ...a.raw].filter(Boolean).join('＋');
    let buy = usedText;
    let leftover: number | null = null;
    // 卵のように数えるものは切り上げて買う
    if (p && !p.pack && p.unit !== 'g' && p.unit !== 'ml' && a.units > 0 && a.raw.length === 0) buy = `${Math.ceil(a.units - 1e-6)}${p.unit}`;
    // 余りが計算できるのは、売り方が分かっていて全部換算できた野菜だけ
    if (p?.pack && a.units > 0 && a.raw.length === 0) {
      const packs = Math.max(1, Math.ceil(a.units / p.pack - 1e-6));
      buy = formatBuy(p, packs);
      const left = packs * p.pack - a.units;
      leftover = left * p.grams >= LEFTOVER_MIN_GRAMS ? left : 0;
    }
    rows.push({
      name: a.name,
      section: a.section,
      buy,
      use: usedText,
      recipes: [...a.recipes],
      leftover,
      leftoverText: leftover && p ? leftoverText(p, leftover) : '',
      product: p,
    });
  }
  const order = (s: Section) => SECTIONS.indexOf(s);
  return rows.sort((x, y) => order(x.section) - order(y.section) || x.name.localeCompare(y.name, 'ja'));
}

export interface Suggestion {
  recipe: Recipe;
  version: PlanItem['version'];
  /** 使う量の表示 */
  useText: string;
  /** 余りをほぼ使い切れるなら true */
  usesAll: boolean;
  /** 足すと新しく余る食材（例：「玉ねぎ 1/2個」）。無ければ空 */
  newLeftovers: string[];
}

/** 余る量の合計（グラム）。提案を足して本当に減るかを比べるのに使う */
function leftoverGrams(rows: ShoppingRow[]): number {
  return rows.reduce((s, r) => s + (r.leftover && r.product ? r.leftover * r.product.grams : 0), 0);
}

/**
 * 余りそうな食材を使えるレシピ（作る予定に無いもの）。
 * 足すと別の食材が余って「余りが余りを呼ぶ」ことがないよう、
 * 足したあとに全体の余りが減るものだけを出す。新しい余りを生まないもの、冷凍OKの副菜を優先。
 */
export function suggestFor(row: ShoppingRow, recipes: Recipe[], plan: PlanItem[], max = 3): Suggestion[] {
  const p = row.product;
  if (!p || !row.leftover) return [];
  const before = buildShopping(recipes, plan);
  const beforeGrams = leftoverGrams(before);
  const beforeLeft = new Map(before.filter((r) => r.leftover).map((r) => [r.name, r.leftover!]));
  const out: (Suggestion & { score: number })[] = [];
  for (const r of recipes) {
    if (plan.some((x) => x.id === r.id)) continue;
    let best: (Suggestion & { score: number }) | null = null;
    for (const version of ['easy', 'proper'] as const) {
      if (version === 'proper' && !r.proper) continue;
      let used = 0;
      for (const ing of ingredientsFor(r, version)) {
        if (findProduct(ing.name) !== p) continue;
        const a = parseAmount(ing.amount);
        const u = a ? toProductUnits(p, a) : null;
        if (u) used += u;
      }
      if (!used) continue;
      const after = buildShopping(recipes, [...plan, { id: r.id, version }]);
      const reduced = beforeGrams - leftoverGrams(after);
      if (reduced <= 0) continue; // 全体の余りが減らないなら出さない
      const newLeftovers = after
        .filter((x) => x.leftover && x.product && x.leftover > (beforeLeft.get(x.name) ?? 0) + 1e-6)
        .map((x) => `${x.name} ${x.leftoverText}`);
      const thisAfter = after.find((x) => x.name === row.name);
      let score = reduced / 100 - newLeftovers.length * 2;
      if (r.category === '副菜' && r.freezable) score += 0.5;
      if (!best || score > best.score) {
        best = { recipe: r, version, useText: formatUnits(p, used), usesAll: !thisAfter?.leftover, newLeftovers, score };
      }
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max).map(({ score: _s, ...s }) => s);
}
