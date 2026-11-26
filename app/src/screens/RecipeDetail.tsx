import { useRef, useState } from 'react';
import { useApp } from '../context.tsx';
import { go } from '../router.ts';
import { contentOf } from '../lib/types.ts';
import { photoUrl, saveRecipe } from '../lib/store.ts';
import { resizeImage, squareThumb } from '../lib/image.ts';
import { saveErrorMessage } from '../lib/errors.ts';
import { CategoryBadge, IngredientTable, TopBar } from '../components/ui.tsx';

export function RecipeDetail({ id }: { id: string }) {
  const { recipes, canEdit, replace, toast } = useApp();
  const r = recipes.find((x) => x.id === id);
  const [viewing, setViewing] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!r) return <NotFound />;

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy('写真を保存中…');
    try {
      const addPhotos = [];
      for (const f of Array.from(files)) {
        const dataUrl = await resizeImage(f, 1600);
        addPhotos.push({ dataUrl, thumbDataUrl: await squareThumb(dataUrl) });
      }
      const saved = await saveRecipe(recipes, r, contentOf(r), `「${r.title}」に写真を追加`, { addPhotos });
      replace(r.id, saved);
      toast('写真を追加しました');
    } catch (e) {
      console.error(e);
      toast(saveErrorMessage(e));
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const update = async (label: string, fn: () => ReturnType<typeof saveRecipe>) => {
    setBusy(label);
    try {
      replace(r.id, await fn());
      setViewing(null);
    } catch (e) {
      toast(saveErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="page detail">
      <TopBar
        title={r.title}
        backTo=""
        right={
          canEdit && (
            <button className="icon-btn" aria-label="編集" onClick={() => go(`r/${r.id}/edit`)}>
              ✎
            </button>
          )
        }
      />

      {(r.photos.length > 0 || canEdit) && (
        <div className="gallery">
          {r.photos.map((p) => (
            <button key={p} className="gallery-item" onClick={() => setViewing(p)}>
              <img src={photoUrl(p)} alt="" />
            </button>
          ))}
          {canEdit && (
            <button className="gallery-add" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              {busy || '📷\n写真を追加'}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
        </div>
      )}

      <div className="detail-head">
        <CategoryBadge r={r} />
        <span className="servings">{r.servings}</span>
      </div>

      <div className="actions">
        <button className="btn primary big" onClick={() => go(`r/${r.id}/cook`)}>
          🍳 作る（調理モード）
        </button>
      </div>

      <section>
        <h2>材料</h2>
        <IngredientTable items={r.ingredients} />
      </section>

      {r.sections.map((s, k) => (
        <section key={k}>
          <h2>{s.title || '手順'}</h2>
          <ol className="steps">
            {s.steps.map((st, n) => (
              <li key={n}>{st}</li>
            ))}
          </ol>
        </section>
      ))}

      {r.memo && (
        <section>
          <h2>メモ</h2>
          <p className="memo">{r.memo}</p>
        </section>
      )}

      {r.source && (
        <section>
          <h2>参考</h2>
          {r.source.split('\n').map((s, k) =>
            /^https?:\/\//.test(s) ? (
              <a key={k} href={s} target="_blank" rel="noreferrer" className="source">
                {s}
              </a>
            ) : (
              <p key={k} className="source">
                {s}
              </p>
            ),
          )}
        </section>
      )}

      <div className="detail-foot">
        <button className="btn" onClick={() => go(`r/${r.id}/history`)}>
          🕘 変更の履歴
        </button>
      </div>

      {viewing && (
        <div className="lightbox" onClick={() => setViewing(null)}>
          <img src={photoUrl(viewing)} alt="" onClick={(e) => e.stopPropagation()} />
          <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
            {canEdit && r.photos[0] !== viewing && (
              <button
                className="btn"
                disabled={!!busy}
                onClick={() =>
                  update('保存中…', () =>
                    saveRecipe(recipes, r, { ...contentOf(r), photos: [viewing, ...r.photos.filter((p) => p !== viewing)] }, `「${r.title}」の一覧の写真を変更`),
                  )
                }
              >
                一覧の写真にする
              </button>
            )}
            {canEdit && (
              <button
                className="btn danger"
                disabled={!!busy}
                onClick={() => {
                  if (!confirm('この写真を削除しますか？')) return;
                  update('削除中…', () => saveRecipe(recipes, r, contentOf(r), `「${r.title}」の写真を削除`, { removePhotos: [viewing] }));
                }}
              >
                削除
              </button>
            )}
            <button className="btn" onClick={() => setViewing(null)}>
              閉じる
            </button>
          </div>
          {busy && <p className="lightbox-busy">{busy}</p>}
        </div>
      )}
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page">
      <TopBar title="見つかりません" backTo="" />
      <p className="empty">このレシピは見つかりませんでした。</p>
    </div>
  );
}
