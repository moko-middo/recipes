import { PHOTO_DIR } from '../repoConfig.ts';
import { commitFiles, fileAt, fileCommits, rawUrl, type FileChange } from './github.ts';
import { parseRecipeFile, pathFor, toMarkdown } from './markdown.ts';
import { contentOf, type Recipe, type RecipeContent, type Revision } from './types.ts';

const TOKEN_KEY = 'github-token';
const OVERLAY_KEY = 'recipe-overlay';

/*
 * レシピの読み込み：公開ページの recipes.json（push のたびに作り直される）を読む。
 * 保存直後は作り直しに1〜2分かかるので、その間は自分で保存した内容をこの端末に覚えておいて上書き表示する。
 */

interface Overlay {
  [path: string]: { md: string | null; savedAt: number };
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* 保存できなくても動く */
  }
}

export function getToken(): string | null {
  return safeGet(TOKEN_KEY);
}

export function setToken(t: string | null) {
  safeSet(TOKEN_KEY, t);
}

function readOverlay(): Overlay {
  try {
    return JSON.parse(safeGet(OVERLAY_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeOverlay(o: Overlay) {
  safeSet(OVERLAY_KEY, JSON.stringify(o));
}

/** パスから安定したIDを作る */
export function idOf(path: string): string {
  let h = 5381;
  for (const c of path) h = ((h << 5) + h + c.codePointAt(0)!) >>> 0;
  return 'r' + h.toString(36);
}

function toRecipe(path: string, md: string): Recipe {
  return { ...parseRecipeFile(path, md), id: idOf(path), path };
}

export async function loadRecipes(): Promise<Recipe[]> {
  const res = await fetch('recipes.json', { cache: 'no-cache' });
  const data: { builtAt: number; files: { path: string; md: string }[] } = await res.json();
  const files = new Map(data.files.map((f) => [f.path, f.md]));

  const overlay = readOverlay();
  let changed = false;
  for (const [path, o] of Object.entries(overlay)) {
    // 公開ページがもう新しい内容になっていれば覚えておく必要はない（時計のずれを見て10分は残す）
    if (o.savedAt < data.builtAt - 10 * 60 * 1000) {
      delete overlay[path];
      changed = true;
      continue;
    }
    if (o.md === null) files.delete(path);
    else files.set(path, o.md);
  }
  if (changed) writeOverlay(overlay);

  return [...files].map(([path, md]) => toRecipe(path, md));
}

/** 撮ったばかりでまだ公開ページに無い写真をこの端末で表示するためのキャッシュ */
const photoCache = new Map<string, string>();

export function photoUrl(path: string): string {
  return photoCache.get(path) ?? rawUrl(path);
}

export function thumbPath(photo: string): string {
  return photo.replace(/\.jpg$/i, '.thumb.jpg');
}

export function thumbUrl(photo: string): string {
  return photoCache.get(thumbPath(photo)) ?? rawUrl(thumbPath(photo));
}

export interface NewPhoto {
  dataUrl: string;
  thumbDataUrl: string;
}

function photoName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${PHOTO_DIR}/${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${Math.random().toString(36).slice(2, 6)}.jpg`;
}

/**
 * レシピを保存する（GitHubに1つのコミットとして）。
 * prev が無ければ新規。addPhotos の写真は content.photos の最後に足される。
 */
export async function saveRecipe(
  all: Recipe[],
  prev: Recipe | null,
  content: RecipeContent,
  message: string,
  opts: { addPhotos?: NewPhoto[]; removePhotos?: string[] } = {},
): Promise<Recipe> {
  const token = getToken();
  if (!token) throw new Error('編集用の鍵が登録されていません');

  const changes: FileChange[] = [];
  const next = contentOf(content);

  for (const p of opts.addPhotos ?? []) {
    const path = photoName();
    changes.push({ path, base64: p.dataUrl.split(',')[1] });
    changes.push({ path: thumbPath(path), base64: p.thumbDataUrl.split(',')[1] });
    photoCache.set(path, p.dataUrl);
    photoCache.set(thumbPath(path), p.thumbDataUrl);
    next.photos.push(path);
  }
  for (const p of opts.removePhotos ?? []) {
    changes.push({ path: p, remove: true }, { path: thumbPath(p), remove: true });
    next.photos = next.photos.filter((x) => x !== p);
  }

  // 保存先のパス。名前や分類が変わったら引っ越す。同じ名前の別レシピがあれば番号を付ける
  let path = prev && pathFor(prev) === pathFor(next) ? prev.path : pathFor(next);
  for (let n = 2; all.some((r) => r.path === path && r.id !== prev?.id); n++) {
    path = pathFor(next).replace(/\.md$/, `（${n}）.md`);
  }
  const md = toMarkdown(next);
  changes.push({ path, text: md });
  if (prev && prev.path !== path) changes.push({ path: prev.path, remove: true });

  await commitFiles(token, message, changes);

  const overlay = readOverlay();
  const now = Date.now();
  overlay[path] = { md, savedAt: now };
  if (prev && prev.path !== path) overlay[prev.path] = { md: null, savedAt: now };
  writeOverlay(overlay);

  return toRecipe(path, md);
}

export async function deleteRecipe(r: Recipe): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('編集用の鍵が登録されていません');
  const changes: FileChange[] = [{ path: r.path, remove: true }];
  for (const p of r.photos) changes.push({ path: p, remove: true }, { path: thumbPath(p), remove: true });
  await commitFiles(token, `「${r.title}」を削除`, changes);
  const overlay = readOverlay();
  overlay[r.path] = { md: null, savedAt: Date.now() };
  writeOverlay(overlay);
}

/** そのレシピの版の一覧（新しい順）。中身はコミット時点のファイル */
export async function listRevisions(r: Recipe): Promise<Revision[]> {
  const commits = await fileCommits(getToken(), r.path);
  return Promise.all(
    commits.map(async (c) => {
      const md = await fileAt(c.sha, r.path);
      return {
        sha: c.sha,
        date: c.commit.author.date,
        author: c.author?.login ?? c.commit.author.name,
        message: c.commit.message.split('\n')[0],
        content: md === null ? null : parseRecipeFile(r.path, md),
      };
    }),
  );
}
