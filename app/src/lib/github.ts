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
