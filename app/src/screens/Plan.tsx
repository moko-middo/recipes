import { useMemo } from 'react';
import { useApp } from '../context.tsx';
import { buildShopping, SECTIONS, suggestFor, type PlanItem, type ShoppingRow } from '../lib/shopping.ts';
import { formatMinutes, type Recipe } from '../lib/types.ts';
import { CategoryBadge, TopBar } from '../components/ui.tsx';
import { ago, type SharedItem } from '../lib/sharedPlan.ts';

/** 作る予定：選んだ料理、余りそうな食材と使い切りの提案、買い物リスト */
export function PlanScreen() {
  const { recipes, plan, planOp, planStatus, login, canEdit, toast } = useApp();

  // 消えたレシピ（名前を変えた・削除した）は外して扱う
  const items = useMemo(
    () => plan.items.map((i) => ({ item: i, recipe: recipes.find((r) => r.id === i.id) })).filter((x): x is { item: SharedItem; recipe: Recipe } => !!x.recipe),
    [plan.items, recipes],
  );
  const live = items.map((x) => x.item);
  const rows = buildShopping(recipes, live);
  const leftovers = rows.filter((r) => r.leftover);
  const pantry = rows.filter((r) => r.section === '家にあるか確認');

  const setVersion = (id: string, version: PlanItem['version']) => planOp({ type: 'version', id, version });
  const remove = (id: string) => planOp({ type: 'remove', id });
  const add = (r: Recipe, version: PlanItem['version']) => {
    planOp({ type: 'add', id: r.id, version });
    toast(`「${r.title}」を足しました`);
  };
  const checkOf = (name: string) => plan.checked.find((c) => c.name === name);
  const toggleCheck = (name: string) => planOp({ type: 'check', name, on: !checkOf(name) });
  // 相手はGitHubのユーザー名で出す
  const who = (l: string) => (l === login ? 'わたし' : l);

  if (!canEdit) {
    return (
      <div className="page plan">
        <TopBar title="作る予定" backTo="" />
        <div className="empty">
          <p>作る予定は、編集用の鍵を登録した端末で使えます。</p>
          <a className="btn primary" href="#/settings">
            設定へ
          </a>
        </div>
      </div>
    );
  }

  const syncLine = (
    <p className={`sync-line ${planStatus}`}>
      {planStatus === 'saving' && '保存中…'}
      {planStatus === 'error' && '保存できていません（電波を確認してください）'}
      {(planStatus === 'ok' || planStatus === 'loading') && plan.updatedAt > 0 && `最終更新：${who(plan.updatedBy)}・${ago(plan.updatedAt)}`}
    </p>
  );

  const totalTime = items.reduce((s, { item, recipe }) => s + ((item.version === 'proper' && recipe.proper ? recipe.proper.handsOn : recipe.handsOn) ?? 0), 0);

  if (items.length === 0) {
    return (
      <div className="page plan">
        <TopBar title="作る予定" backTo="" />
        {syncLine}
        <div className="empty">
          <p>まだ何も選んでいません。</p>
          <p className="muted small">一覧の「＋」で、作りたい料理を選んでください。</p>
          <a className="btn primary" href="#/">
            レシピを選ぶ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="page plan">
      <TopBar title="作る予定" backTo="" />
      {syncLine}

      <section>
        <h2>作るもの（{items.length}品）</h2>
        <ul className="plan-items">
          {items.map(({ item, recipe: r }) => {
            const proper = item.version === 'proper' && !!r.proper;
            const t = proper ? r.proper!.time : r.time;
            const h = proper ? r.proper!.handsOn : r.handsOn;
            return (
              <li key={r.id} className="plan-item">
                <div className="plan-item-main">
                  <a href={`#/r/${r.id}`} className="plan-item-title">
                    {r.title}
                  </a>
                  <div className="plan-item-meta">
                    <CategoryBadge r={r} />
                    {item.by && <span className="added-by">{who(item.by)}が追加</span>}
                    {t && (
                      <span className="muted small">
                        {formatMinutes(t)}
                        {h && h < t ? `（手間${formatMinutes(h)}）` : ''}
                      </span>
                    )}
                  </div>
                </div>
                {r.proper && (
                  <div className="mini-seg" role="group" aria-label="作り方">
                    <button className={!proper ? 'on' : ''} onClick={() => setVersion(r.id, 'easy')}>
                      手抜き
                    </button>
                    <button className={proper ? 'on' : ''} onClick={() => setVersion(r.id, 'proper')}>
                      ちゃんと
                    </button>
                  </div>
                )}
                <button className="icon-btn small" aria-label={`${r.title}を外す`} onClick={() => remove(r.id)}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
        {totalTime > 0 && <p className="muted small plan-total">手を動かす時間の合計：約{formatMinutes(totalTime)}</p>}
      </section>

      <section>
        <h2>余りそうな食材</h2>
        {leftovers.length === 0 ? (
          <p className="no-leftover">余りそうな食材はありません。使い切れます！</p>
        ) : (
          <ul className="leftovers">
            {leftovers.map((row) => (
              <LeftoverCard key={row.name} row={row} recipes={recipes} plan={live} onAdd={add} />
            ))}
          </ul>
        )}
      </section>

      <section className="shopping">
        <h2>買い物リスト</h2>
        {SECTIONS.filter((s) => s !== '家にあるか確認').map((section) => {
          const list = rows.filter((r) => r.section === section);
          if (list.length === 0) return null;
          return (
            <div key={section} className="shop-group">
              <h3>{section}</h3>
              <ul>
                {list.map((row) => {
                  const check = checkOf(row.name);
                  const done = !!check;
                  return (
                    <li key={row.name} className={done ? 'done' : ''}>
                      <label>
                        <input type="checkbox" checked={done} onChange={() => toggleCheck(row.name)} />
                        <span className="shop-name">{row.name}</span>
                        <span className="shop-buy">{row.buy}</span>
                      </label>
                      {row.leftover ? <span className="shop-note">使うのは{row.use}・{row.leftoverText}余る</span> : null}
                      {check && check.by !== login && <span className="shop-by">{who(check.by)}が買った</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {pantry.length > 0 && (
          <div className="shop-group pantry">
            <h3>家にあるか確認</h3>
            <p>{pantry.map((r) => r.name).join('、')}</p>
          </div>
        )}
      </section>

      <div className="plan-foot">
        {plan.checked.length > 0 && (
          <button className="btn small" onClick={() => planOp({ type: 'clearChecks' })}>
            チェックを外す
          </button>
        )}
        <button
          className="btn small danger"
          onClick={() => {
            if (confirm('作る予定を全部消しますか？（相手のスマホからも消えます）')) planOp({ type: 'clearAll' });
          }}
        >
          作る予定を全部消す
        </button>
      </div>
    </div>
  );
}

function LeftoverCard({
  row,
  recipes,
  plan,
  onAdd,
}: {
  row: ShoppingRow;
  recipes: Recipe[];
  plan: PlanItem[];
  onAdd: (r: Recipe, v: PlanItem['version']) => void;
}) {
  const suggestions = suggestFor(row, recipes, plan);
  return (
    <li className="leftover">
      <div className="leftover-head">
        <b>{row.name}</b> が <b className="leftover-amount">{row.leftoverText}</b> 余ります
        <span className="muted small">（使うのは{row.use}）</span>
      </div>
      {suggestions.length > 0 ? (
        <div className="suggestions">
          <span className="muted small">これも作ると使えます：</span>
          {suggestions.map((s) => (
            <button key={s.recipe.id} className="suggest" onClick={() => onAdd(s.recipe, s.version)}>
              <span className="suggest-plus">＋</span>
              <span className="suggest-title">
                {s.recipe.title}
                {s.version === 'proper' && <small>（ちゃんと版）</small>}
              </span>
              <span className="suggest-use">
                {s.useText}使う{s.usesAll && <b>・使い切り</b>}
                {s.recipe.freezable && s.recipe.category === '副菜' && <span className="badge freeze">冷凍OK</span>}
              </span>
              {s.newLeftovers.length > 0 && <span className="suggest-warn">代わりに{s.newLeftovers.join('、')}が余ります</span>}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted small">足しても全体の余りが減るレシピはありませんでした。ほかの料理に使うか、冷凍しておきましょう。</p>
      )}
    </li>
  );
}
