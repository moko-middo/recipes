import { useCallback, useEffect, useRef, useState } from 'react';
import { currentLogin, PlanConflict, readPlanFile, writePlanFile } from './github.ts';
import { applyOp, describeOp, EMPTY_PLAN, parsePlan, serializePlan, type PlanOp, type SharedPlan } from './sharedPlan.ts';
import { getToken } from './store.ts';

const CACHE_KEY = 'recipe-plan-shared-cache';
/** 共有前にこの端末だけに保存していた作る予定 */
const OLD_LOCAL_KEY = 'recipe-plan';
const POLL_MS = 20_000;

export type PlanStatus = 'off' | 'loading' | 'ok' | 'saving' | 'error';

function readCache(): SharedPlan {
  try {
    return parsePlan(localStorage.getItem(CACHE_KEY));
  } catch {
    return { ...EMPTY_PLAN };
  }
}

function writeCache(p: SharedPlan) {
  try {
    localStorage.setItem(CACHE_KEY, serializePlan(p));
  } catch {
    /* 保存できなくても動く */
  }
}

function takeOldLocalItems(): { id: string; version: 'easy' | 'proper' }[] {
  try {
    const s = JSON.parse(localStorage.getItem(OLD_LOCAL_KEY) ?? 'null');
    localStorage.removeItem(OLD_LOCAL_KEY);
    return Array.isArray(s?.items) ? s.items : [];
  } catch {
    return [];
  }
}

/**
 * 2人で共有する作る予定。画面はすぐ変わり、保存は後ろで行う。
 * 保存の直前に最新を読み直して操作を重ねるので、相手の変更を消さない。
 */
export function useSharedPlan(canEdit: boolean, titleOf: (id: string) => string, isKnown: ((id: string) => boolean) | null, onError: (msg: string) => void) {
  const [plan, setPlanState] = useState<SharedPlan>(readCache);
  const [login, setLogin] = useState('');
  const [status, setStatus] = useState<PlanStatus>(canEdit ? 'loading' : 'off');
  const queue = useRef<PlanOp[]>([]);
  const busy = useRef(false);
  const loginRef = useRef('');
  const titleRef = useRef(titleOf);
  titleRef.current = titleOf;

  const setPlan = useCallback((p: SharedPlan) => {
    // まだ保存していない操作は画面に残しておく
    const shown = queue.current.reduce((acc, op) => applyOp(acc, op, loginRef.current, Date.now()), p);
    setPlanState(shown);
    writeCache(p);
  }, []);

  const flush = useCallback(async () => {
    const token = getToken();
    if (busy.current || !token || !loginRef.current) return;
    busy.current = true;
    setStatus('saving');
    try {
      while (queue.current.length) {
        const ops = [...queue.current];
        for (let attempt = 0; ; attempt++) {
          const remote = await readPlanFile(token);
          let p = parsePlan(remote?.text);
          const now = Date.now();
          for (const op of ops) p = applyOp(p, op, loginRef.current, now);
          const first = describeOp(ops[0], titleRef.current);
          const message = ops.length > 1 ? `${first}（ほか${ops.length - 1}件）` : first;
          try {
            await writePlanFile(token, serializePlan(p), remote?.sha ?? null, message);
            queue.current.splice(0, ops.length);
            setPlan(p);
            break;
          } catch (e) {
            if (e instanceof PlanConflict && attempt < 4) continue; // 相手が先に保存した → 読み直して重ね直す
            throw e;
          }
        }
      }
      setStatus('ok');
    } catch (e) {
      console.error(e);
      setStatus('error');
      onError('作る予定を保存できませんでした。電波の良いところでもう一度開いてください');
    } finally {
      busy.current = false;
    }
  }, [onError, setPlan]);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token || busy.current || queue.current.length) return;
    try {
      const remote = await readPlanFile(token);
      if (busy.current || queue.current.length) return;
      setPlan(parsePlan(remote?.text));
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, [setPlan]);

  const dispatch = useCallback(
    (op: PlanOp) => {
      queue.current.push(op);
      setPlanState((p) => applyOp(p, op, loginRef.current, Date.now()));
      void flush();
    },
    [flush],
  );

  // 鍵があれば、ユーザー名を調べて読み込み、以前この端末だけにあった予定を引っ越す
  useEffect(() => {
    const token = getToken();
    if (!canEdit || !token) {
      setStatus('off');
      return;
    }
    let alive = true;
    (async () => {
      try {
        const name = await currentLogin(token);
        if (!alive) return;
        loginRef.current = name;
        setLogin(name);
        await refresh();
      } catch {
        if (alive) setStatus('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [canEdit, refresh, dispatch]);

  // 以前この端末だけにあった作る予定を共有に引っ越す（レシピを読み込んでから。無くなったレシピは移さない）
  useEffect(() => {
    if (!canEdit || !login || !isKnown) return;
    for (const i of takeOldLocalItems()) if (isKnown(i.id)) dispatch({ type: 'add', id: i.id, version: i.version });
  }, [canEdit, login, isKnown, dispatch]);

  // 開いている間は20秒ごと、アプリに戻ってきたときにも最新にする
  useEffect(() => {
    if (!canEdit) return;
    const tick = () => document.visibilityState === 'visible' && refresh();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [canEdit, refresh]);

  return { plan, planOp: dispatch, planStatus: status, login, refreshPlan: refresh };
}
