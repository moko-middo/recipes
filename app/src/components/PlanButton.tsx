import { useApp } from '../context.tsx';
import type { Recipe } from '../lib/types.ts';
import type { VersionKind } from './VersionToggle.tsx';

/** 作る予定に入っているか、出し入れする関数 */
export function usePlanToggle(r: Recipe) {
  const { plan, planOp, toast } = useApp();
  const inPlan = plan.items.some((i) => i.id === r.id);
  const toggle = (version: VersionKind = 'easy') => {
    planOp(inPlan ? { type: 'remove', id: r.id } : { type: 'add', id: r.id, version: version === 'proper' && r.proper ? 'proper' : 'easy' });
    toast(inPlan ? `「${r.title}」を作る予定から外しました` : `「${r.title}」を作る予定に入れました`);
  };
  return { inPlan, toggle };
}

/** 一覧のカードの右に出す「＋」ボタン */
export function PlanAddButton({ r, version }: { r: Recipe; version: VersionKind }) {
  const { inPlan, toggle } = usePlanToggle(r);
  return (
    <button
      className={`plan-add ${inPlan ? 'on' : ''}`}
      aria-label={inPlan ? `${r.title}を作る予定から外す` : `${r.title}を作る予定に入れる`}
      aria-pressed={inPlan}
      onClick={() => toggle(version)}
    >
      {inPlan ? '✓' : '＋'}
    </button>
  );
}

/** 画面の下に出す「作る予定」への入口 */
export function PlanBar() {
  const { plan, canEdit } = useApp();
  if (!canEdit || plan.items.length === 0) return null;
  return (
    <a className="plan-bar" href="#/plan">
      <span>🛒 作る予定</span>
      <b>{plan.items.length}品</b>
      <span className="plan-bar-go">買い物リストへ ›</span>
    </a>
  );
}
