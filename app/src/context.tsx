import { createContext, useContext } from 'react';
import type { Recipe } from './lib/types.ts';
import type { PlanState } from './lib/plan.ts';

export interface AppCtx {
  recipes: Recipe[];
  /** 編集用の鍵が登録されていれば true */
  canEdit: boolean;
  reload: () => Promise<void>;
  /** 保存したレシピを一覧に反映する（公開ページの更新を待たずに） */
  replace: (oldId: string | null, r: Recipe | null) => void;
  setCanEdit: (v: boolean) => void;
  toast: (msg: string) => void;
  /** 作る予定 */
  plan: PlanState;
  setPlan: (update: (p: PlanState) => PlanState) => void;
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('no context');
  return c;
}
