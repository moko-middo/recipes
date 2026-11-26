import type { Ingredient, StepSection } from '../lib/types.ts';

/** 編集中の版。手順はテキストエリアで「1行1手順」で編集する */
export interface EditVersion {
  ingredients: Ingredient[];
  sections: { title: string; text: string }[];
  time: string;
}

export function toEditVersion(ingredients: Ingredient[], sections: StepSection[], time: number | null): EditVersion {
  return {
    ingredients: ingredients.length ? ingredients.map((i) => ({ ...i })) : [{ group: '', name: '', amount: '' }],
    sections: sections.length ? sections.map((s) => ({ title: s.title, text: s.steps.join('\n') })) : [{ title: '', text: '' }],
    time: time ? String(time) : '',
  };
}

export function fromEditVersion(v: EditVersion): { ingredients: Ingredient[]; sections: StepSection[]; time: number | null } {
  const t = parseInt(v.time.normalize('NFKC'), 10);
  return {
    ingredients: v.ingredients
      .map((i) => ({ group: i.group.trim().replace(/^[（(]|[）)]$/g, ''), name: i.name.trim(), amount: i.amount.trim() }))
      .filter((i) => i.name),
    sections: v.sections
      .map((s) => ({
        title: s.title.trim(),
        steps: s.text
          .split('\n')
          .map((l) => l.replace(/^\s*\d+[.)．）]\s*/, '').trim())
          .filter(Boolean),
      }))
      .filter((s) => s.steps.length || s.title),
    time: Number.isFinite(t) && t > 0 ? t : null,
  };
}

/** 所要時間・材料・手順の編集欄（手抜き版・ちゃんと版で共通） */
export function VersionEditor({ value, onChange }: { value: EditVersion; onChange: (v: EditVersion) => void }) {
  const setIng = (n: number, patch: Partial<Ingredient>) =>
    onChange({ ...value, ingredients: value.ingredients.map((i, k) => (k === n ? { ...i, ...patch } : i)) });
  const moveIng = (n: number, dir: -1 | 1) => {
    const list = [...value.ingredients];
    const m = n + dir;
    if (m < 0 || m >= list.length) return;
    [list[n], list[m]] = [list[m], list[n]];
    onChange({ ...value, ingredients: list });
  };
  const setSection = (k: number, patch: Partial<EditVersion['sections'][number]>) =>
    onChange({ ...value, sections: value.sections.map((x, j) => (j === k ? { ...x, ...patch } : x)) });

  return (
    <>
      <label className="field time-field">
        <span>所要時間</span>
        <div className="with-unit">
          <input type="number" inputMode="numeric" min={1} value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} placeholder="例：30" />
          <span>分</span>
        </div>
      </label>

      <h2>材料</h2>
      <p className="muted small">まとまり欄に A や B、「たれ」などを入れると (A) のようにまとめて表示されます。</p>
      <div className="ing-edit">
        <div className="ing-row ing-head" aria-hidden="true">
          <span>まとまり</span>
          <span>材料</span>
          <span>分量</span>
          <span />
        </div>
        {value.ingredients.map((i, n) => (
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
              <button aria-label="削除" onClick={() => onChange({ ...value, ingredients: value.ingredients.filter((_, k) => k !== n) })}>
                ×
              </button>
            </div>
          </div>
        ))}
        <button className="btn" onClick={() => onChange({ ...value, ingredients: [...value.ingredients, { group: '', name: '', amount: '' }] })}>
          ＋ 材料を追加
        </button>
      </div>

      <h2>手順</h2>
      <p className="muted small">1行に1つの手順を書きます。「仕込み」「帰宅後」のように分けたいときは手順のまとまりを追加します。</p>
      {value.sections.map((s, k) => (
        <div key={k} className="section-edit">
          <input value={s.title} placeholder="まとまりの名前（ふつうの手順なら空のまま）" onChange={(e) => setSection(k, { title: e.target.value })} />
          <textarea
            rows={Math.max(4, s.text.split('\n').length + 1)}
            value={s.text}
            placeholder={'ごぼうはささがきにする\n人参は細切りにする'}
            onChange={(e) => setSection(k, { text: e.target.value })}
          />
          {value.sections.length > 1 && (
            <button className="btn small" onClick={() => onChange({ ...value, sections: value.sections.filter((_, j) => j !== k) })}>
              このまとまりを削除
            </button>
          )}
        </div>
      ))}
      <button className="btn" onClick={() => onChange({ ...value, sections: [...value.sections, { title: '', text: '' }] })}>
        ＋ 手順のまとまりを追加
      </button>
    </>
  );
}
