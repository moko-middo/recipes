import type { ReactNode } from 'react';
import { back } from '../router.ts';
import type { Recipe } from '../lib/types.ts';

export function TopBar({ title, backTo, right }: { title: ReactNode; backTo?: string; right?: ReactNode }) {
  return (
    <header className="topbar">
      {backTo !== undefined ? (
        <button className="icon-btn" aria-label="戻る" onClick={() => back(backTo)}>
          ‹
        </button>
      ) : (
        <span className="topbar-spacer" />
      )}
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

export function CategoryBadge({ r }: { r: Pick<Recipe, 'category' | 'subCategory' | 'freezable'> }) {
  return (
    <span className="badges">
      <span className={`badge cat-${r.category}`}>
        {r.category}
        {r.subCategory ? `・${r.subCategory}` : ''}
      </span>
      {r.freezable === true && <span className="badge freeze">冷凍OK</span>}
      {r.freezable === false && r.category === '副菜' && <span className="badge nofreeze">冷凍NG</span>}
    </span>
  );
}

export function formatDate(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 材料を(A)(B)などのまとまりごとに並べる */
export function IngredientTable({ items, large }: { items: Recipe['ingredients']; large?: boolean }) {
  const groups: { group: string; items: Recipe['ingredients'] }[] = [];
  for (const i of items) {
    const g = groups.find((x) => x.group === i.group);
    if (g) g.items.push(i);
    else groups.push({ group: i.group, items: [i] });
  }
  groups.sort((a, b) => (a.group === '' ? -1 : b.group === '' ? 1 : 0));
  return (
    <div className={`ingredients ${large ? 'large' : ''}`}>
      {groups.map((g) => (
        <div key={g.group} className="ing-group">
          {g.group && <div className="ing-group-label">{/^[A-Za-zＡ-Ｚ]$/.test(g.group) ? `(${g.group})` : g.group}</div>}
          <ul>
            {g.items.map((i, n) => (
              <li key={n}>
                <span className="ing-name">{i.name}</span>
                <span className="ing-amount">{i.amount}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
