import { useEffect, useState } from 'react';
import { useApp } from '../context.tsx';
import type { Revision } from '../lib/types.ts';
import { diffContent } from '../lib/diff.ts';
import { listRevisions, saveRecipe } from '../lib/store.ts';
import { saveErrorMessage } from '../lib/errors.ts';
import { formatDate, TopBar } from '../components/ui.tsx';
import { NotFound } from './RecipeDetail.tsx';

/** GitHubのコミット履歴を、レシピの「変更の履歴」として見せる */
export function HistoryScreen({ id }: { id: string }) {
  const { recipes, canEdit, replace, toast } = useApp();
  const r = recipes.find((x) => x.id === id);
  const [revs, setRevs] = useState<Revision[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!r) return;
    listRevisions(r)
      .then(setRevs)
      .catch((e) => setError(String(e)));
  }, [r?.path]);

  if (!r) return <NotFound />;

  return (
    <div className="page">
      <TopBar title={`${r.title}の履歴`} backTo={`r/${r.id}`} />
      {error && <p className="empty">履歴を読み込めませんでした。少し時間をおいて開き直してください。</p>}
      {!error && revs === null && <p className="muted empty">読み込み中…</p>}
      {revs?.length === 0 && <p className="muted empty">まだ履歴はありません（保存してから1分ほどで表示されます）。</p>}
      <ol className="history">
        {revs?.map((rev, n) => {
          const older = revs[n + 1]?.content;
          const changes = older && rev.content ? diffContent(older, rev.content) : [];
          return (
            <li key={rev.sha} className="history-item">
              <div className="history-head">
                <b>{formatDate(new Date(rev.date).getTime())}</b>
                <span className="muted small">{rev.author}</span>
              </div>
              <p className="history-note">{rev.message}</p>
              {changes.length > 0 && (
                <ul className="changes">
                  {changes.map((c, k) =>
                    c.label === '手順' ? (
                      <li key={k}>
                        <b>手順</b>
                        <details>
                          <summary>変更前の手順を見る</summary>
                          <pre>{c.before}</pre>
                        </details>
                      </li>
                    ) : (
                      <li key={k}>
                        <b>{c.label}</b> <s>{c.before || '（空）'}</s> → {c.after || '（空）'}
                      </li>
                    ),
                  )}
                </ul>
              )}
              {!older && n === revs.length - 1 && <p className="muted small">最初の版</p>}
              {canEdit && n > 0 && rev.content && (
                <button
                  className="btn small"
                  onClick={async () => {
                    if (!confirm('この版の内容に戻しますか？（今の内容も履歴に残ります）')) return;
                    try {
                      const saved = await saveRecipe(
                        recipes,
                        r,
                        { ...rev.content!, photos: r.photos },
                        `「${r.title}」を${formatDate(new Date(rev.date).getTime())}の版に戻した`,
                      );
                      replace(r.id, saved);
                      toast('戻しました');
                      history.back();
                    } catch (e) {
                      toast(saveErrorMessage(e));
                    }
                  }}
                >
                  この版に戻す
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {revs && revs.length > 0 && <p className="muted small">いちばん上が今の内容です。</p>}
    </div>
  );
}
