import { useEffect, useState } from 'react';
import { useApp } from '../context.tsx';
import { checkToken } from '../lib/github.ts';
import { getToken, setToken } from '../lib/store.ts';
import { REPO } from '../repoConfig.ts';
import { TopBar } from '../components/ui.tsx';

export function Settings() {
  const { canEdit, setCanEdit, reload, toast } = useApp();
  const [input, setInput] = useState('');
  const [login, setLogin] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (t) checkToken(t).then((r) => setLogin(r.login)).catch(() => setLogin(''));
  }, []);

  const register = async () => {
    const t = input.trim();
    if (!t) return;
    setChecking(true);
    try {
      const r = await checkToken(t);
      if (!r.canPush) return toast('この鍵ではレシピを書き換えられません。権限を確認してください');
      setToken(t);
      setLogin(r.login);
      setCanEdit(true);
      setInput('');
      toast('登録しました。編集できるようになりました');
    } catch {
      toast('鍵を確認できませんでした。貼り付け間違いがないか見てください');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="page settings">
      <TopBar title="設定" backTo="" />

      <section>
        <h2>編集用の鍵</h2>
        {canEdit ? (
          <>
            <p>この端末は編集できます{login && `（GitHub：${login}）`}。</p>
            <button
              className="btn small danger"
              onClick={() => {
                if (!confirm('この端末から鍵を消しますか？見るだけになります')) return;
                setToken(null);
                setCanEdit(false);
                setLogin('');
              }}
            >
              この端末から鍵を消す
            </button>
          </>
        ) : (
          <>
            <p className="muted small">
              見るだけなら鍵は不要です。編集・写真の追加をするには、GitHubで作った鍵（fine-grained personal access token）を貼り付けます。作り方は app/README.md にあります。
            </p>
            <div className="inline-form">
              <input type="password" placeholder="github_pat_…" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" />
              <button className="btn primary" onClick={register} disabled={checking}>
                {checking ? '確認中…' : '登録'}
              </button>
            </div>
          </>
        )}
      </section>

      <section>
        <h2>最新の内容を読み込む</h2>
        <p className="muted small">ほかの端末で保存した内容は、1〜2分でここに反映されます。</p>
        <button
          className="btn"
          onClick={async () => {
            await reload();
            toast('読み込みました');
          }}
        >
          読み込み直す
        </button>
      </section>

      <section>
        <h2>レシピの置き場所</h2>
        <p className="muted small">
          レシピはGitHubのリポジトリにMarkdownファイルとして保存されています。
          <br />
          <a href={`https://github.com/${REPO.owner}/${REPO.name}`} target="_blank" rel="noreferrer">
            github.com/{REPO.owner}/{REPO.name}
          </a>
        </p>
      </section>
    </div>
  );
}
