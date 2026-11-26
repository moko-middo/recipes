import { REPO } from '../repoConfig.ts';

const API = 'https://api.github.com';
const repoUrl = `${API}/repos/${REPO.owner}/${REPO.name}`;

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const encPath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

async function gh<T>(token: string | null, method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url.startsWith('http') ? url : repoUrl + url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    // 作る予定は2人で同時に見るので、古い内容をブラウザにためない
    cache: 'no-store',
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).message ?? msg;
    } catch {
      /* noop */
    }
    throw new GitHubError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

/** 鍵が使えるか、このリポジトリに書き込めるかを確かめる */
export async function checkToken(token: string): Promise<{ login: string; canPush: boolean }> {
  const user = await gh<{ login: string }>(token, 'GET', `${API}/user`);
  const repo = await gh<{ permissions?: { push?: boolean } }>(token, 'GET', '');
  return { login: user.login, canPush: !!repo.permissions?.push };
}

export interface FileChange {
  path: string;
  /** 文字列（Markdown） */
  text?: string;
  /** base64（写真） */
  base64?: string;
  /** trueならファイルを消す */
  remove?: boolean;
}

let authorCache: { token: string; author: { name: string; email: string } } | null = null;

/** コミットに記録する名前とメール。本当のメールアドレスが公開されないよう、GitHubの匿名アドレスを使う */
async function commitAuthor(token: string) {
  if (authorCache?.token !== token) {
    const u = await gh<{ login: string; id: number }>(token, 'GET', `${API}/user`);
    authorCache = { token, author: { name: u.login, email: `${u.id}+${u.login}@users.noreply.github.com` } };
  }
  return authorCache.author;
}

/** 複数のファイルの変更を1つのコミットにまとめて保存する */
export async function commitFiles(token: string, message: string, changes: FileChange[]): Promise<string> {
  const author = await commitAuthor(token);
  for (let attempt = 0; ; attempt++) {
    try {
      const ref = await gh<{ object: { sha: string } }>(token, 'GET', `/git/ref/heads/${REPO.branch}`);
      const parent = ref.object.sha;
      const base = await gh<{ tree: { sha: string } }>(token, 'GET', `/git/commits/${parent}`);
      const entries = [];
      for (const c of changes) {
        if (c.remove) {
          entries.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
          continue;
        }
        const blob = await gh<{ sha: string }>(token, 'POST', '/git/blobs', c.base64 !== undefined ? { content: c.base64, encoding: 'base64' } : { content: c.text ?? '', encoding: 'utf-8' });
        entries.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
      }
      const tree = await gh<{ sha: string }>(token, 'POST', '/git/trees', { base_tree: base.tree.sha, tree: entries });
      const commit = await gh<{ sha: string }>(token, 'POST', '/git/commits', { message, tree: tree.sha, parents: [parent], author, committer: author });
      await gh(token, 'PATCH', `/git/refs/heads/${REPO.branch}`, { sha: commit.sha });
      return commit.sha;
    } catch (e) {
      // 同時に別の端末から保存された場合はやり直す
      if (e instanceof GitHubError && e.status === 422 && attempt < 2) continue;
      throw e;
    }
  }
}

/** 鍵の持ち主（GitHubのユーザー名） */
export async function currentLogin(token: string): Promise<string> {
  return (await commitAuthor(token)).name;
}

/* ---------- 作る予定（plan ブランチの plan.json） ---------- */

export const PLAN_BRANCH = 'plan';
const PLAN_FILE = 'plan.json';

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** 作る予定を読む。まだ無ければ null */
export async function readPlanFile(token: string): Promise<{ text: string; sha: string } | null> {
  try {
    const f = await gh<{ content: string; sha: string }>(token, 'GET', `/contents/${PLAN_FILE}?ref=${PLAN_BRANCH}`);
    return { text: fromBase64(f.content), sha: f.sha };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

/** 読んだあとに相手が保存していたら投げる（読み直してやり直す） */
export class PlanConflict extends Error {}

/**
 * 作る予定を保存する。sha は読んだときのもの（新規なら null）。新しい sha を返す。
 * plan ブランチが無ければ、plan.json だけが入ったブランチを作る（レシピの履歴とは分ける）。
 */
export async function writePlanFile(token: string, text: string, sha: string | null, message: string): Promise<string> {
  const author = await commitAuthor(token);
  try {
    const res = await gh<{ content: { sha: string } }>(token, 'PUT', `/contents/${PLAN_FILE}`, {
      message,
      content: toBase64(text),
      branch: PLAN_BRANCH,
      ...(sha ? { sha } : {}),
      author,
      committer: author,
    });
    return res.content.sha;
  } catch (e) {
    if (!(e instanceof GitHubError)) throw e;
    if (e.status === 409 || (e.status === 422 && /sha/i.test(e.message))) throw new PlanConflict();
    // ブランチがまだ無い
    if ((e.status === 404 || e.status === 422) && !sha) {
      const blob = await gh<{ sha: string }>(token, 'POST', '/git/blobs', { content: text, encoding: 'utf-8' });
      const tree = await gh<{ sha: string }>(token, 'POST', '/git/trees', { tree: [{ path: PLAN_FILE, mode: '100644', type: 'blob', sha: blob.sha }] });
      const commit = await gh<{ sha: string }>(token, 'POST', '/git/commits', { message, tree: tree.sha, parents: [], author, committer: author });
      try {
        await gh(token, 'POST', '/git/refs', { ref: `refs/heads/${PLAN_BRANCH}`, sha: commit.sha });
      } catch (e2) {
        // 相手が先にブランチを作っていた
        if (e2 instanceof GitHubError && e2.status === 422) throw new PlanConflict();
        throw e2;
      }
      return blob.sha;
    }
    throw e;
  }
}

export interface CommitInfo {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
  author: { login: string } | null;
}

/** そのファイルのコミット履歴（新しい順） */
export function fileCommits(token: string | null, path: string): Promise<CommitInfo[]> {
  return gh(token, 'GET', `/commits?sha=${REPO.branch}&per_page=30&path=${encodeURIComponent(path)}`);
}

/** あるコミット時点のファイルの中身 */
export async function fileAt(sha: string, path: string): Promise<string | null> {
  const res = await fetch(`https://raw.githubusercontent.com/${REPO.owner}/${REPO.name}/${sha}/${encPath(path)}`);
  return res.ok ? res.text() : null;
}

/** 写真などリポジトリのファイルを表示するためのURL */
export function rawUrl(path: string): string {
  return `https://raw.githubusercontent.com/${REPO.owner}/${REPO.name}/${REPO.branch}/${encPath(path)}`;
}
