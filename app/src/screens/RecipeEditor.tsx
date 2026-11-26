import { useMemo, useState } from 'react';
import { useApp } from '../context.tsx';
import { back, go } from '../router.ts';
import { CATEGORIES, contentOf, type Category, type Ingredient, type RecipeContent } from '../lib/types.ts';
import { deleteRecipe, saveRecipe } from '../lib/store.ts';
import { saveErrorMessage } from '../lib/errors.ts';
import { diffContent } from '../lib/diff.ts';
import { TopBar } from '../components/ui.tsx';
import { NotFound } from './RecipeDetail.tsx';

const DRAFT_KEY = 'recipe-import-draft';

export function blankRecipe(): RecipeContent {
  return {
    title: '',
    category: '主菜',
    subCategory: '',
    freezable: null,
    servings: '2人分',
    ingredients: [{ group: '', name: '', amount: '' }],
    sections: [{ title: '', steps: [] }],
    memo: '',
    source: '',
    photos: [],
  };
}

/** 貼り付け取り込みからエディタへ下書きを渡す */
export function setImportDraft(c: RecipeContent) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(c));
}

function takeImportDraft(): RecipeContent | null {
  try {
    const s = sessionStorage.getItem(DRAFT_KEY);
    if (!s) return null;
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function RecipeEditor({ id }: { id?: string }) {
  const { recipes, replace, toast } = useApp();
  const existing = id ? recipes.find((r) => r.id === id) : undefined;
  const fromImport = !id && location.hash.includes('draft');
  const [draft, setDraft] = useState<RecipeContent>(() =>
    existing ? contentOf(existing) : (fromImport && takeImportDraft()) || blankRecipe(),
  );
  // 手順はテキストエリアで「1行1手順」で編集する
  const [stepTexts, setStepTexts] = useState(() => draft.sections.map((s) => s.steps.join('\n')));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const result: RecipeContent = useMemo(
    () => ({
      ...draft,
      title: draft.title.trim(),
      ingredients: draft.ingredients
        .map((i) => ({ group: i.group.trim().replace(/^[（(]|[）)]$/g, ''), name: i.name.trim(), amount: i.amount.trim() }))
        .filter((i) => i.name),
      sections: draft.sections
        .map((s, k) => ({
          title: s.title.trim(),
          steps: (stepTexts[k] ?? '')
            .split('\n')
            .map((l) => l.replace(/^\s*\d+[.)．）]\s*/, '').trim())
            .filter(Boolean),
        }))
        .filter((s) => s.steps.length || s.title),
      memo: draft.memo.trim(),
      source: draft.source.trim(),
    }),
    [draft, stepTexts],
  );
  const changes = existing ? diffContent(contentOf(existing), result) : [];

  if (id && !existing) return <NotFound />;

  const set = <K extends keyof RecipeContent>(k: K, v: RecipeContent[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setIng = (n: number, patch: Partial<Ingredient>) =>
    set(
      'ingredients',
      draft.ingredients.map((i, k) => (k === n ? { ...i, ...patch } : i)),
    );
  const moveIng = (n: number, dir: -1 | 1) => {
    const list = [...draft.ingredients];
    const m = n + dir;
    if (m < 0 || m >= list.length) return;
    [list[n], list[m]] = [list[m], list[n]];
    set('ingredients', list);
  };

  const save = async () => {
    if (!result.title) return toast('料理名を入れてください');
    if (existing && changes.length === 0) return back(`r/${existing.id}`);
    setSaving(true);
    try {
      const message = existing
        ? `「${result.title}」を編集${note.trim() ? `：${note.trim()}` : ''}`
        : `「${result.title}」を追加${note.trim() ? `：${note.trim()}` : ''}`;
      const saved = await saveRecipe(recipes, existing ?? null, result, message);
      replace(existing?.id ?? null, saved);
      toast(existing ? '保存しました（前の内容は履歴に残っています）' : '追加しました');
      if (existing && existing.id === saved.id) back(`r/${saved.id}`);
      else location.replace(`#/r/${saved.id}`);
    } catch (e) {
      console.error(e);
      toast(saveErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page editor">
      <TopBar title={existing ? '編集' : '新しいレシピ'} backTo={existing ? `r/${existing.id}` : ''} />

      <label className="field">
        <span>料理名</span>
        <input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="例：きんぴらごぼう" />
      </label>

      <div className="field-row">
        <label className="field">
          <span>分類</span>
          <select value={draft.category} onChange={(e) => set('category', e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>補足</span>
          <input value={draft.subCategory} onChange={(e) => set('subCategory', e.target.value)} placeholder="肉・魚など" />
        </label>
        <label className="field">
          <span>何人分</span>
          <input value={draft.servings} onChange={(e) => set('servings', e.target.value)} />
        </label>
      </div>

      <div className="field">
        <span>冷凍</span>
        <div className="seg">
          {([
            [true, 'OK'],
            [false, 'NG'],
            [null, '未設定'],
          ] as const).map(([v, label]) => (
            <button key={label} className={draft.freezable === v ? 'on' : ''} onClick={() => set('freezable', v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <h2>材料</h2>
      <p className="muted small">まとまり欄に A や B、「たれ」などを入れると (A) のようにまとめて表示されます。</p>
      <div className="ing-edit">
        <div className="ing-row ing-head" aria-hidden="true">
          <span>まとまり</span>
          <span>材料</span>
          <span>分量</span>
          <span />
        </div>
        {draft.ingredients.map((i, n) => (
          <div key={n} className="ing-row">
            <input className="g" value={i.group} aria-label="まとまり" onChange={(e) => setIng(n, { group: e.target.value })} />
            <input className="n" value={i.name} aria-label="材料" onChange={(e) => setIng(n, { name: e.target.value })} />
            <input className="a" value={i.amount} aria-label="分量" onChange={(e) => setIng(n, { amount: e.target.value })} />
            <div className="row-btns">
              <button aria-label="上へ" onClick={() => moveIng(n, -1)}>
                ↑
              </button>
              <button aria-label="下へ" onClick={() => moveIng(n, 1)}>
                ↓
              </button>
              <button aria-label="削除" onClick={() => set('ingredients', draft.ingredients.filter((_, k) => k !== n))}>
                ×
              </button>
            </div>
          </div>
        ))}
        <button className="btn" onClick={() => set('ingredients', [...draft.ingredients, { group: '', name: '', amount: '' }])}>
          ＋ 材料を追加
        </button>
      </div>

      <h2>手順</h2>
      <p className="muted small">1行に1つの手順を書きます。「仕込み」「帰宅後」のように分けたいときは手順のまとまりを追加します。</p>
      {draft.sections.map((s, k) => (
        <div key={k} className="section-edit">
          <input
            value={s.title}
            placeholder="まとまりの名前（ふつうの手順なら空のまま）"
            onChange={(e) => set('sections', draft.sections.map((x, j) => (j === k ? { ...x, title: e.target.value } : x)))}
          />
          <textarea
            rows={Math.max(4, (stepTexts[k] ?? '').split('\n').length + 1)}
            value={stepTexts[k] ?? ''}
            placeholder={'ごぼうはささがきにする\n人参は細切りにする'}
            onChange={(e) => setStepTexts(stepTexts.map((t, j) => (j === k ? e.target.value : t)))}
          />
          {draft.sections.length > 1 && (
            <button
              className="btn small"
              onClick={() => {
                set('sections', draft.sections.filter((_, j) => j !== k));
                setStepTexts(stepTexts.filter((_, j) => j !== k));
              }}
            >
              このまとまりを削除
            </button>
          )}
        </div>
      ))}
      <button
        className="btn"
        onClick={() => {
          set('sections', [...draft.sections, { title: '', steps: [] }]);
          setStepTexts([...stepTexts, '']);
        }}
      >
        ＋ 手順のまとまりを追加
      </button>

      <label className="field">
        <span>メモ・コツ</span>
        <textarea rows={3} value={draft.memo} onChange={(e) => set('memo', e.target.value)} placeholder="子どもは薄味が好き、など" />
      </label>
      <label className="field">
        <span>参考（URL・番組名・雑誌名など）</span>
        <textarea rows={2} value={draft.source} onChange={(e) => set('source', e.target.value)} />
      </label>

      {!existing && (
        <label className="field">
          <span>ひとことメモ（任意・履歴に残ります）</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：きょうの料理で見た" />
        </label>
      )}
      {existing && changes.length > 0 && (
        <div className="change-box">
          <h3>変更点</h3>
          <ul className="changes">
            {changes.map((c, n) => (
              <li key={n}>
                <b>{c.label}</b> {c.label === '手順' ? '（手順を変更）' : `${c.before || '（空）'} → ${c.after || '（空）'}`}
              </li>
            ))}
          </ul>
          <label className="field">
            <span>変更メモ（任意）</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：砂糖を減らしたらちょうどよかった" />
          </label>
        </div>
      )}

      <div className="save-bar">
        {existing && (
          <button
            className="btn danger"
            onClick={async () => {
              if (!confirm(`「${existing.title}」を削除しますか？写真や履歴も消えます。`)) return;
              try {
                await deleteRecipe(existing);
              } catch (e) {
                return toast(saveErrorMessage(e));
              }
              replace(existing.id, null);
              toast('削除しました');
              go('');
            }}
          >
            削除
          </button>
        )}
        <button className="btn primary big" onClick={save} disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  );
}
