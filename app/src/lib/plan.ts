import { useCallback, useState } from 'react';
import type { PlanItem } from './shopping.ts';

const KEY = 'recipe-plan';

export interface PlanState {
  items: PlanItem[];
  /** 買い物リストでチェックした品物の名前 */
  checked: string[];
}

function read(): PlanState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '');
    return { items: Array.isArray(s.items) ? s.items : [], checked: Array.isArray(s.checked) ? s.checked : [] };
  } catch {
    return { items: [], checked: [] };
  }
}

/** 作る予定（この端末に保存） */
export function usePlanState() {
  const [plan, setPlanRaw] = useState<PlanState>(read);
  const setPlan = useCallback((update: (p: PlanState) => PlanState) => {
    setPlanRaw((p) => {
      const next = update(p);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* 保存できなくても画面は動く */
      }
      return next;
    });
  }, []);
  return [plan, setPlan] as const;
}
