import { useMemo, useState } from 'react';
import { useApp } from '../context.tsx';
import { go } from '../router.ts';
import { CATEGORIES, type Category } from '../lib/types.ts';
import { matches } from '../lib/search.ts';
import { thumbUrl } from '../lib/store.ts';
import { CategoryBadge, TopBar } from '../components/ui.tsx';

const FILTER_KEY = 'recipe-list-filter';

function loadFilter(): { cat: Category | ''; freeze: boolean } {
  try {
    return JSON.parse(sessionStorage.getItem(FILTER_KEY) ?? '') ?? { cat: '', freeze: false };
  } catch {
    return { cat: '', freeze: false };
  }
}

export function RecipeList() {
  const { recipes, canEdit } = useApp();
  const [q, setQ] = useState(() => sessionStorage.getItem(FILTER_KEY + '-q') ?? '');
  const [filter, setFilterState] = useState(loadFilter);
  const setFilter = (f: typeof filter) => {
    setFilterState(f);
    try {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify(f));
    } catch {
      /* 保存できなくても動く */
    }
  };

  const shown = useMemo(
    () =>
      recipes.filter(
        (r) => (!filter.cat || r.category === filter.cat) && (!filter.freeze || r.freezable === true) && matches(r, q),
      ),
    [recipes, filter, q],
  );

  return (
    <div className="page">
      <TopBar
        title="我が家のレシピ"
        right={
          <button className="icon-btn" aria-label="設定" onClick={() => go('settings')}>
            ⚙
          </button>
        }
      />
      <div className="search">
        <input
          type="search"
          placeholder="料理名や食材で探す（例：ピーマン 豚）"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            try {
              sessionStorage.setItem(FILTER_KEY + '-q', e.target.value);
            } catch {
              /* noop */
            }
          }}
        />
      </div>
      <div className="chips">
        <button className={`chip ${filter.cat === '' ? 'on' : ''}`} onClick={() => setFilter({ ...filter, cat: '' })}>
          すべて
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${filter.cat === c ? 'on' : ''}`} onClick={() => setFilter({ ...filter, cat: c })}>
            {c}
          </button>
        ))}
        <button className={`chip freeze ${filter.freeze ? 'on' : ''}`} onClick={() => setFilter({ ...filter, freeze: !filter.freeze })}>
          ❄ 冷凍OK
        </button>
      </div>

      <div className="count muted">{shown.length}品</div>
      <ul className="recipe-list">
        {shown.map((r) => (
          <li key={r.id}>
            <a href={`#/r/${r.id}`} className="recipe-card">
              <div className="thumb">{r.photos[0] ? <img src={thumbUrl(r.photos[0])} alt="" loading="lazy" /> : <span>{r.title.slice(0, 1)}</span>}</div>
              <div className="card-body">
                <div className="card-title">{r.title}</div>
                <div className="card-meta">
                  <CategoryBadge r={r} />
                  <span className="muted small">{r.servings}</span>
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
      {shown.length === 0 && recipes.length > 0 && <p className="empty muted">見つかりませんでした</p>}

      {canEdit && (
      <div className="fab-row">
        <button className="fab secondary" onClick={() => go('import')}>
          貼り付けて追加
        </button>
        <button className="fab" onClick={() => go('new')}>
          ＋ 新しいレシピ
        </button>
      </div>
      )}
    </div>
  );
}
