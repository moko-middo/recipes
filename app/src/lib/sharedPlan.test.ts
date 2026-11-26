import { describe, expect, it } from 'vitest';
import { ago, applyOp, EMPTY_PLAN, parsePlan, serializePlan, type PlanOp, type SharedPlan } from './sharedPlan.ts';

const run = (p: SharedPlan, ops: PlanOp[], by: string) => ops.reduce((acc, op, n) => applyOp(acc, op, by, 1000 + n), p);

describe('共有の作る予定', () => {
  it('足す・外す・切り替える・チェックする', () => {
    let p = run(EMPTY_PLAN, [{ type: 'add', id: 'a', version: 'easy' }, { type: 'add', id: 'b', version: 'easy' }], 'wife');
    p = run(p, [{ type: 'version', id: 'a', version: 'proper' }, { type: 'remove', id: 'b' }, { type: 'check', name: '玉ねぎ', on: true }], 'husband');
    expect(p.items).toEqual([{ id: 'a', version: 'proper', by: 'wife', at: 1000 }]);
    expect(p.checked).toEqual([{ name: '玉ねぎ', by: 'husband', at: 1002 }]);
    expect(p.updatedBy).toBe('husband');
  });

  it('同じ操作を2回重ねても結果は同じ（保存のやり直しで重複しない）', () => {
    const op: PlanOp = { type: 'add', id: 'a', version: 'easy' };
    const once = applyOp(EMPTY_PLAN, op, 'wife', 1);
    expect(applyOp(once, op, 'wife', 1)).toEqual(once);
  });

  it('同時に触っても、両方の変更が残る（最新に重ね直す）', () => {
    const base = run(EMPTY_PLAN, [{ type: 'add', id: 'a', version: 'easy' }], 'wife');
    // 妻は b を足し、夫は同じ時に a をちゃんとにした。夫が先に保存 → 妻は夫の保存後の内容に自分の操作を重ね直す
    const afterHusband = run(base, [{ type: 'version', id: 'a', version: 'proper' }], 'husband');
    const afterWife = run(afterHusband, [{ type: 'add', id: 'b', version: 'easy' }], 'wife');
    expect(afterWife.items.map((i) => `${i.id}:${i.version}`)).toEqual(['a:proper', 'b:easy']);
  });

  it('前の形式（呼び名つき）も読める', () => {
    const p = parsePlan('{"items":[],"checked":[],"names":{"otto":"夫"},"updatedBy":"otto","updatedAt":1}');
    expect(p).toEqual({ items: [], checked: [], updatedBy: 'otto', updatedAt: 1 });
  });

  it('保存形式の読み書き。壊れていても空として扱う', () => {
    const p = run(EMPTY_PLAN, [{ type: 'add', id: 'a', version: 'easy' }], 'wife');
    expect(parsePlan(serializePlan(p))).toEqual(p);
    expect(parsePlan('{壊れた')).toEqual(EMPTY_PLAN);
    expect(parsePlan(null)).toEqual(EMPTY_PLAN);
  });

  it('時間の表示', () => {
    const now = 10_000_000;
    expect(ago(now - 30_000, now)).toBe('たった今');
    expect(ago(now - 5 * 60_000, now)).toBe('5分前');
    expect(ago(now - 3 * 3600_000, now)).toBe('3時間前');
  });
});
