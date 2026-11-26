import { GitHubError } from './github.ts';

/** 保存に失敗したときに出す言葉 */
export function saveErrorMessage(e: unknown): string {
  if (e instanceof GitHubError) {
    if (e.status === 401) return '編集用の鍵が使えなくなっています。設定で登録し直してください';
    if (e.status === 403 || e.status === 404) return 'この鍵ではレシピを書き換えられません。設定で鍵の権限を確認してください';
    return `保存できませんでした（${e.status} ${e.message}）`;
  }
  if (e instanceof TypeError) return '保存できませんでした。電波の良いところでもう一度お試しください';
  return `保存できませんでした（${String(e)}）`;
}
