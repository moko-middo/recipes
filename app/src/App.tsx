import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ctx, type AppCtx } from './context.tsx';
import { useRoute } from './router.ts';
import type { Recipe } from './lib/types.ts';
import { getToken, loadRecipes } from './lib/store.ts';
import { RecipeList } from './screens/RecipeList.tsx';
import { RecipeDetail } from './screens/RecipeDetail.tsx';
import { RecipeEditor } from './screens/RecipeEditor.tsx';
import { HistoryScreen } from './screens/History.tsx';
import { CookMode } from './screens/CookMode.tsx';
import { ImportScreen } from './screens/Import.tsx';
import { Settings } from './screens/Settings.tsx';

const byTitle = (a: Recipe, b: Recipe) => a.title.localeCompare(b.title, 'ja');

export function App() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState('');
  const [canEdit, setCanEdit] = useState(() => !!getToken());
  const [toastMsg, setToastMsg] = useState('');
  const timer = useRef<number>(0);
  const route = useRoute();

  const reload = useCallback(async () => {
    try {
      setRecipes((await loadRecipes()).sort(byTitle));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(''), 3000);
  }, []);

  const replace = useCallback((oldId: string | null, r: Recipe | null) => {
    setRecipes((list) => {
      const rest = (list ?? []).filter((x) => x.id !== oldId && x.id !== r?.id);
      return (r ? [...rest, r] : rest).sort(byTitle);
    });
  }, []);

  const ctx = useMemo<AppCtx | null>(
    () => (recipes ? { recipes, canEdit, reload, replace, setCanEdit, toast } : null),
    [recipes, canEdit, reload, replace, toast],
  );

  if (error) return <div className="center">読み込めませんでした。電波の良いところで開き直してください。<br />{error}</div>;
  if (!ctx) return <div className="center muted">読み込み中…</div>;

  const [a, id, sub] = route;
  let screen;
  if (a === 'r' && id && sub === 'edit') screen = <RecipeEditor id={id} />;
  else if (a === 'r' && id && sub === 'history') screen = <HistoryScreen id={id} />;
  else if (a === 'r' && id && sub === 'cook') screen = <CookMode id={id} />;
  else if (a === 'r' && id) screen = <RecipeDetail id={id} />;
  else if (a === 'new') screen = <RecipeEditor />;
  else if (a === 'import') screen = <ImportScreen />;
  else if (a === 'settings') screen = <Settings />;
  else screen = <RecipeList />;

  return (
    <Ctx.Provider value={ctx}>
      {screen}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </Ctx.Provider>
  );
}
