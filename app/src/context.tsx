import { createContext, useContext } from 'react';
import type { Recipe } from './lib/types.ts';
import type { PlanOp, SharedPlan } from './lib/sharedPlan.ts';
import type { PlanStatus } from './lib/plan.ts';

export interface AppCtx {
  recipes: Recipe[];
  /** 編集用の鍵が登録されていれば true */
  canEdit: boolean;
  reload: () => Promise<void>;
  /** 保存したレシピを一覧に反映する（公開ページの更新を待たずに） */
  replace: (oldId: string | null, r: Recipe | null) => void;
  setCanEdit: (v: boolean) => void;
  toast: (msg: string) => void;
  /** 2人で共有する作る予定 */
  plan: SharedPlan;
  planOp: (op: PlanOp) => void;
  planStatus: PlanStatus;
  refreshPlan: () => Promise<void>;
  /** 鍵の持ち主（GitHubのユーザー名） */
  login: string;
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('no context');
  return c;
}
