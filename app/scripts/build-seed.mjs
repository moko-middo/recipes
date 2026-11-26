// リポジトリのレシピMarkdownをまとめて public/recipes.json にする（アプリはこれを読み込む）
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const FOLDERS = ['主菜', '主食', '副菜', '汁物', 'おやつ'];

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });
}

const files = [];
for (const folder of FOLDERS) {
  let list = [];
  try {
    list = walk(join(root, folder));
  } catch {
    continue;
  }
  for (const file of list.sort()) {
    files.push({ path: relative(root, file).split(sep).join('/'), md: readFileSync(file, 'utf8') });
  }
}
writeFileSync(join(here, '..', 'public', 'recipes.json'), JSON.stringify({ builtAt: Date.now(), files }));
console.log(`recipes.json: ${files.length}品`);
