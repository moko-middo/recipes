import { useEffect, useState } from 'react';
import { useApp } from '../context.tsx';
import { back } from '../router.ts';
import { NotFound } from './RecipeDetail.tsx';

/** 作るとき用の大きな表示。画面が消えないようにする。Nest Hub にキャストして見る想定 */
export function CookMode({ id }: { id: string }) {
  const { recipes } = useApp();
  const r = recipes.find((x) => x.id === id);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<typeof lock> } }).wakeLock.request('screen');
      } catch {
        /* 対応していない端末では何もしない */
      }
    };
    request();
    const onVis = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release();
    };
  }, []);

  if (!r) return <NotFound />;

  const toggle = (key: string) =>
    setDone((d) => {
      const n = new Set(d);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <div className="cook">
      <header className="cook-head">
        <button className="btn" onClick={() => back(`r/${r.id}`)}>
          ‹ 戻る
        </button>
        <h1>{r.title}</h1>
        <span className="cook-servings">{r.servings}</span>
      </header>
      <div className="cook-body">
        <aside className="cook-ings">
          <h2>材料</h2>
          <ul className="cook-checklist">
            {r.ingredients.map((i, n) => (
              <li key={n} className={checked.has(n) ? 'checked' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={checked.has(n)}
                    onChange={() =>
                      setChecked((c) => {
                        const x = new Set(c);
                        if (x.has(n)) x.delete(n);
                        else x.add(n);
                        return x;
                      })
                    }
                  />
                  {i.group && <span className="muted">({i.group})</span>}
                  {i.name} <b>{i.amount}</b>
                </label>
              </li>
            ))}
          </ul>
        </aside>
        <main className="cook-steps">
          {r.sections.map((s, k) => (
            <section key={k}>
              {s.title && <h2>{s.title}</h2>}
              <ol>
                {s.steps.map((st, n) => {
                  const key = `${k}-${n}`;
                  return (
                    <li key={key} className={done.has(key) ? 'done' : ''} onClick={() => toggle(key)}>
                      <span className="num">{n + 1}</span>
                      <span>{st}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          <p className="muted small">終わった手順はタップすると薄くなります。</p>
        </main>
      </div>
    </div>
  );
}
