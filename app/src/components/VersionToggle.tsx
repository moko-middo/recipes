import { useState } from 'react';
import { formatMinutes, type Recipe } from '../lib/types.ts';

export type VersionKind = 'easy' | 'proper';

const KEY = 'recipe-version';

function read(): VersionKind {
  try {
    return localStorage.getItem(KEY) === 'proper' ? 'proper' : 'easy';
  } catch {
    return 'easy';
  }
}

/** 手抜き／ちゃんとのどちらを見るか。端末に覚えておき、調理モードでも同じ版を出す */
export function useVersion(): [VersionKind, (v: VersionKind) => void] {
  const [v, setV] = useState(read);
  const set = (next: VersionKind) => {
    setV(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* 覚えられなくても切り替えはできる */
    }
  };
  return [v, set];
}

/** 表示する材料・手順・時間（ちゃんと版が無ければ手抜き版） */
export function versionOf(r: Recipe, v: VersionKind) {
  if (v === 'proper' && r.proper) return { kind: 'proper' as const, ...r.proper };
  return { kind: 'easy' as const, ingredients: r.ingredients, sections: r.sections, time: r.time };
}

const t = (n: number | null) => (n ? formatMinutes(n) : '');

export function VersionToggle({ r, value, onChange, compact }: { r: Recipe; value: VersionKind; onChange: (v: VersionKind) => void; compact?: boolean }) {
  if (!r.proper) {
    return r.time ? <span className="time-chip">⏱ {t(r.time)}</span> : null;
  }
  const shown = versionOf(r, value).kind;
  return (
    <div className={`version-toggle ${compact ? 'compact' : ''}`} role="tablist" aria-label="作り方">
      <button role="tab" aria-selected={shown === 'easy'} className={shown === 'easy' ? 'on' : ''} onClick={() => onChange('easy')}>
        <span className="vt-label">手抜き</span>
        {r.time && <span className="vt-time">{t(r.time)}</span>}
      </button>
      <button role="tab" aria-selected={shown === 'proper'} className={shown === 'proper' ? 'on' : ''} onClick={() => onChange('proper')}>
        <span className="vt-label">ちゃんと</span>
        {r.proper.time && <span className="vt-time">{t(r.proper.time)}</span>}
      </button>
    </div>
  );
}
