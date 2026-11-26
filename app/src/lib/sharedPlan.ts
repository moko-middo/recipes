import type { PlanItem } from './shopping.ts';

/*
 * 2人で共有する「作る予定」。
 * GitHub の plan ブランチの plan.json に置き、変更は「足す」「外す」などの操作を
 * 最新の内容に1つずつ重ねて保存する（同時に触っても、どちらの変更も消えない）。
 */

export interface SharedItem extends PlanItem {
  /** 足した人（GitHubのユーザー名） */
  by: string;
  at: number;
}

export interface SharedCheck {
  name: string;
  by: string;
  at: number;
}

export interface SharedPlan {
  items: SharedItem[];
  checked: SharedCheck[];
  updatedBy: string;
  updatedAt: number;
}

export type PlanOp =
  | { type: 'add'; id: string; version: PlanItem['version'] }
  | { type: 'remove'; id: string }
  | { type: 'version'; id: string; version: PlanItem['version'] }
  | { type: 'check'; name: string; on: boolean }
  | { type: 'clearChecks' }
  | { type: 'clearAll' };

export const EMPTY_PLAN: SharedPlan = { items: [], checked: [], updatedBy: '', updatedAt: 0 };

export function parsePlan(text: string | null | undefined): SharedPlan {
  if (!text) return { ...EMPTY_PLAN };
  try {
    const p = JSON.parse(text);
    return {
      items: Array.isArray(p.items) ? p.items.filter((i: SharedItem) => i && typeof i.id === 'string') : [],
      checked: Array.isArray(p.checked) ? p.checked.filter((c: SharedCheck) => c && typeof c.name === 'string') : [],
      updatedBy: typeof p.updatedBy === 'string' ? p.updatedBy : '',
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : 0,
    };
  } catch {
    return { ...EMPTY_PLAN };
  }
}

export function serializePlan(p: SharedPlan): string {
  return JSON.stringify(p, null, 1) + '\n';
}

/** 操作を1つ重ねる。同じ操作を2回重ねても結果が変わらないようにしてある */
export function applyOp(p: SharedPlan, op: PlanOp, by: string, at: number): SharedPlan {
  const next: SharedPlan = { ...p, items: [...p.items], checked: [...p.checked], updatedBy: by, updatedAt: at };
  switch (op.type) {
    case 'add':
      if (!next.items.some((i) => i.id === op.id)) next.items.push({ id: op.id, version: op.version, by, at });
      break;
    case 'remove':
      next.items = next.items.filter((i) => i.id !== op.id);
      break;
    case 'version':
      next.items = next.items.map((i) => (i.id === op.id ? { ...i, version: op.version } : i));
      break;
    case 'check':
      next.checked = next.checked.filter((c) => c.name !== op.name);
      if (op.on) next.checked.push({ name: op.name, by, at });
      break;
    case 'clearChecks':
      next.checked = [];
      break;
    case 'clearAll':
      next.items = [];
      next.checked = [];
      break;
  }
  return next;
}

/** 履歴（plan ブランチのコミット）に残す一言 */
export function describeOp(op: PlanOp, title: (id: string) => string): string {
  switch (op.type) {
    case 'add':
      return `作る予定に「${title(op.id)}」を追加`;
    case 'remove':
      return `作る予定から「${title(op.id)}」を外す`;
    case 'version':
      return `「${title(op.id)}」を${op.version === 'proper' ? 'ちゃんと' : '手抜き'}にする`;
    case 'check':
      return op.on ? `${op.name}を買った` : `${op.name}のチェックを外す`;
    case 'clearChecks':
      return '買い物リストのチェックを外す';
    case 'clearAll':
      return '作る予定を全部消す';
  }
}

/** 「3分前」「きのう」など */
export function ago(at: number, now = Date.now()): string {
  const m = Math.floor((now - at) / 60000);
  if (m < 1) return 'たった今';
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'きのう' : `${d}日前`;
}
