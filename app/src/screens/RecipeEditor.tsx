import { useMemo, useState } from 'react';
import { useApp } from '../context.tsx';
import { back, go } from '../router.ts';
import { CATEGORIES, NUTRIENTS, contentOf, servingsCount, STALE_NUTRITION, type Category, type NutrientKey, type Nutrition, type RecipeContent } from '../lib/types.ts';
import { deleteRecipe, saveRecipe } from '../lib/store.ts';
import { saveErrorMessage } from '../lib/errors.ts';
import { diffContent } from '../lib/diff.ts';
import { withNutritionStatus } from '../lib/nutrition.ts';
import { TopBar } from '../components/ui.tsx';
import { fromEditVersion, toEditVersion, VersionEditor, type EditVersion } from '../components/VersionEditor.tsx';
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
    nutrition: null,
    nutritionNote: '',
    nutritionStale: false,
    time: null,
    proper: null,
  };
}

function nutritionText(n: Nutrition | null): Record<NutrientKey, string> {
  return Object.fromEntries(NUTRIENTS.map(([k]) => [k, n ? String(n[k]) : ''])) as Record<NutrientKey, string>;
}

function parseNutrition(t: Record<NutrientKey, string>): Nutrition | null {
  if (NUTRIENTS.every(([k]) => t[k].trim() === '')) return null;
  return Object.fromEntries(
    NUTRIENTS.map(([k]) => {
      const v = parseFloat(t[k].normalize('NFKC'));
      return [k, Number.isFinite(v) ? v : 0];
    }),
  ) as Nutrition;
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
  const [easy, setEasy] = useState<EditVersion>(() => toEditVersion(draft.ingredients, draft.sections, draft.time));
  const [proper, setProper] = useState<EditVersion | null>(() =>
    draft.proper ? toEditVersion(draft.proper.ingredients, draft.proper.sections, draft.proper.time) : null,
  );
  const [tab, setTab] = useState<'easy' | 'proper'>('easy');
  const [note, setNote] = useState('');
  const [nutText, setNutText] = useState(() => nutritionText(draft.nutrition));
  const [saving, setSaving] = useState(false);

  const result: RecipeContent = useMemo(() => {
    const e = fromEditVersion(easy);
    return {
      ...draft,
      title: draft.title.trim(),
      ingredients: e.ingredients,
      sections: e.sections,
      time: e.time,
      proper: proper ? fromEditVersion(proper) : null,
      memo: draft.memo.trim(),
      nutrition: parseNutrition(nutText),
      nutritionNote: draft.nutritionNote.trim(),
      source: draft.source.trim(),
    };
  }, [draft, easy, proper, nutText]);
  const final = withNutritionStatus(existing && contentOf(existing), result);
  const changes = existing ? diffContent(contentOf(existing), final) : [];
  const willBeStale = !!existing && final.nutritionStale && !existing.nutritionStale;

  if (id && !existing) return <NotFound />;

  const set = <K extends keyof RecipeContent>(k: K, v: RecipeContent[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!result.title) return toast('料理名を入れてください');
    if (existing && changes.length === 0) return back(`r/${existing.id}`);
    setSaving(true);
    try {
      const message = existing
        ? `「${result.title}」を編集${note.trim() ? `：${note.trim()}` : ''}`
        : `「${result.title}」を追加${note.trim() ? `：${note.trim()}` : ''}`;
      const saved = await saveRecipe(recipes, existing ?? null, final, message);
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
          <div className="with-unit">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={servingsCount(draft.servings)}
              onChange={(e) => set('servings', `${Math.max(1, parseInt(e.target.value, 10) || 1)}人分`)}
            />
            <span>人分</span>
          </div>
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

      <div className="version-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'easy'} className={tab === 'easy' ? 'on' : ''} onClick={() => setTab('easy')}>
          手抜き版
        </button>
        <button role="tab" aria-selected={tab === 'proper'} className={tab === 'proper' ? 'on' : ''} onClick={() => setTab('proper')}>
          ちゃんと版{!proper && '（なし）'}
        </button>
      </div>

      {tab === 'easy' && <VersionEditor value={easy} onChange={setEasy} />}
      {tab === 'proper' &&
        (proper ? (
          <>
            <VersionEditor value={proper} onChange={setProper} />
            <button
              className="btn small danger remove-version"
              onClick={() => {
                if (confirm('ちゃんと版を消しますか？（保存するまでは元に戻せます）')) setProper(null);
              }}
            >
              ちゃんと版を消す
            </button>
          </>
        ) : (
          <div className="empty">
            <p className="muted">ちゃんと版はまだありません。</p>
            <button className="btn primary" onClick={() => setProper({ ...structuredClone(easy), time: '' })}>
              手抜き版をコピーして作る
            </button>
          </div>
        ))}

      <h2>栄養（1人分）</h2>
      <p className="muted small">材料から見積もった目安です。市販品の表示など、正しい値が分かれば書き換えてください。</p>
      <div className="nut-edit">
        {NUTRIENTS.map(([key, label, unit]) => (
          <label key={key} className="field">
            <span>{label}</span>
            <div className="with-unit">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                value={nutText[key]}
                onChange={(e) => setNutText({ ...nutText, [key]: e.target.value })}
              />
              <span>{unit}</span>
            </div>
          </label>
        ))}
      </div>
      <label className="field">
        <span>栄養の注意書き</span>
        <input value={draft.nutritionNote} onChange={(e) => set('nutritionNote', e.target.value)} placeholder="例：ご飯は含みません" />
      </label>

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
                <b>{c.label}</b> {c.label.endsWith('手順') ? '（手順を変更）' : `${c.before || '（空）'} → ${c.after || '（空）'}`}
              </li>
            ))}
          </ul>
          {willBeStale && <p className="stale small">栄養素は計算し直していないので、「{STALE_NUTRITION}」と表示されます。</p>}
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
