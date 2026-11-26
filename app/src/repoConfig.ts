/**
 * レシピを保存しているGitHubリポジトリ。
 * GitHub Actions でビルドするときに、そのリポジトリの名前が自動で入る（コピーした人は自分のリポジトリになる）。
 * 手元で動かすときなどは、GitHub Pages のアドレス（ユーザー名.github.io/リポジトリ名）から読み取る。
 */
function detectRepo() {
  const env = import.meta.env ?? {};
  if (env.VITE_REPO_OWNER && env.VITE_REPO_NAME) {
    return { owner: env.VITE_REPO_OWNER as string, name: env.VITE_REPO_NAME as string, branch: (env.VITE_REPO_BRANCH as string) || 'main' };
  }
  if (typeof location !== 'undefined' && location.hostname.endsWith('.github.io')) {
    const owner = location.hostname.replace(/\.github\.io$/, '');
    const name = location.pathname.split('/').filter(Boolean)[0] ?? `${owner}.github.io`;
    return { owner, name, branch: 'main' };
  }
  return { owner: 'moko-middo', name: 'recipes', branch: 'main' };
}

export const REPO = detectRepo();

/** レシピのMarkdownを置くフォルダ（分類と同じ名前） */
export const RECIPE_FOLDERS = ['主菜', '主食', '副菜', '汁物', 'おやつ'];

/** 写真を置くフォルダ */
export const PHOTO_DIR = '写真';
