import { expect, it } from 'vitest';
import data from '../../public/recipes.json';
import { parseRecipeFile, toMarkdown, pathFor } from './markdown.ts';
it('既存43品は書き出し→読み直しで変わらず、保存先も今と同じ', () => {
  for (const f of (data as { files: { path: string; md: string }[] }).files) {
    const r = parseRecipeFile(f.path, f.md);
    expect(parseRecipeFile(f.path, toMarkdown(r))).toEqual(r);
    expect(pathFor(r)).toBe(f.path);
  }
});
