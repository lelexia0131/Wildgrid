import type { MapFeatures } from '../engine/mapNovelty';
import { encodeMap, MAP_GENERATION_TIMEOUT } from '../engine';
import { SURVIVAL_DIFFICULTIES } from '../game-modes/survival/survivalDifficulty';
import type { SandboxCheck, SandboxDraft } from '../engine';
import type { SurvivalChallenge } from '../game-modes/survival/survivalChallenge';

type TaskCallbacks<Result> = { onResult: (result: Result) => void; onError: (reason: 'error' | 'timeout', message?: string) => void };

// One worker per task owner. A terminated worker can never publish into a later run.
function createWorkerTask<Request, Result>(createWorker: () => Worker, timeoutMs?: number) {
  let worker: Worker | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function cancel() {
    const previous = worker;
    worker = null;
    clearTimeout(timer); timer = undefined;
    previous?.terminate();
  }
  function start(request: Request, callbacks: TaskCallbacks<Result>) {
    if (worker) return;
    const current = createWorker();
    worker = current;
    const fail = (reason: 'error' | 'timeout') => {
      if (worker !== current) return;
      cancel(); callbacks.onError(reason);
    };
    current.onmessage = (event: MessageEvent<Result>) => {
      if (worker !== current) return;
      cancel(); callbacks.onResult(event.data);
    };
    current.onerror = () => fail('error');
    current.onmessageerror = () => fail('error');
    if (timeoutMs !== undefined) timer = setTimeout(() => fail('timeout'), timeoutMs);
    try { current.postMessage(request); }
    catch (cause) { cancel(); throw cause; }
  }
  return { start, cancel, isRunning: () => worker !== null };
}

export function createSandboxCheckTask() {
  return createWorkerTask<SandboxDraft, SandboxCheck>(() => new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' }));
}

export function createSurvivalGenerationTask() {
  const attempt = createWorkerTask<SurvivalGenerationRequest, unknown>(
    () => new Worker(new URL('./survival.worker.ts', import.meta.url), { type: 'module' }), MAP_GENERATION_TIMEOUT,
  );
  let session: { request: SurvivalGenerationRequest; callbacks: TaskCallbacks<SurvivalChallenge>; attempts: number; elapsed: number; started: number | null; retrying: boolean } | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  let paused = false;
  function account() {
    if (session?.started !== null && session?.started !== undefined) { session.elapsed += Date.now() - session.started; session.started = null; }
    clearTimeout(budgetTimer); budgetTimer = undefined;
  }
  function cancel() {
    account(); session = null; clearTimeout(retry); retry = undefined; attempt.cancel();
  }
  function run() {
    retry = undefined;
    const current = session;
    if (!current || paused || attempt.isRunning()) return;
    const fail = (message?: string) => { if (session === current) { cancel(); current.callbacks.onError('error', message); } };
    if (current.elapsed >= 45000) { fail('地图生成超时，请重试或调整禁用设施。'); return; }
    if (current.retrying) {
      if (current.attempts) current.request = { ...current.request, seed: (current.request.seed + 0x9e3779b9) >>> 0 };
      current.attempts++; current.retrying = false;
    }
    const again = (message?: string) => {
      account();
      if (session !== current) return;
      if (current.elapsed >= 45000) { fail(message || '地图生成超时，请重试或调整禁用设施。'); return; }
      current.retrying = true;
      if (!paused) retry = setTimeout(run, 0);
    };
    try {
      current.started = Date.now();
      budgetTimer = setTimeout(() => fail('地图生成超时，请重试或调整禁用设施。'), 45000 - current.elapsed);
      const request = current.request;
      attempt.start(request, {
        onError: reason => { if (session === current) { if (reason === 'timeout') again(); else fail(); } },
        onResult: data => {
          if (session !== current) return;
          account();
          if (!data || typeof data !== 'object' || !('status' in data)) { fail(); return; }
          const result = data as SurvivalGenerationResult;
          if (result.status === 'search-failed' && typeof result.error === 'string') { again(result.error); return; }
          if (result.status !== 'success') { fail(result.error); return; }
          try {
            const c = result.challenge, spec = SURVIVAL_DIFFICULTIES[request.difficulty - 1];
            if (!c || c.id !== request.id || c.seed !== request.seed || c.difficulty !== request.difficulty || typeof c.fingerprint !== 'string' || !spec || c.draft.level.size !== 8 || c.draft.level.pieces.length < spec.min || c.draft.level.pieces.length > spec.max || c.draft.level.pieces.some(p => request.disabled?.includes(`${p.kind}_${p.shape}`))) throw new Error('Invalid worker reply');
            encodeMap(c.draft);
          } catch { fail(); return; }
          cancel(); current.callbacks.onResult(result.challenge);
        },
      });
    } catch { fail(); }
  }
  return {
    start(request: SurvivalGenerationRequest, callbacks: TaskCallbacks<SurvivalChallenge>) {
      if (session) return;
      session = { request, callbacks, attempts: 0, elapsed: 0, started: null, retrying: true }; run();
    },
    cancel, isRunning: () => session !== null,
    setPaused(value: boolean) {
      paused = value;
      if (paused) { account(); clearTimeout(retry); retry = undefined; attempt.cancel(); }
      else if (session && !attempt.isRunning() && retry === undefined) run();
    },
  };
}

export type SurvivalGenerationRequest = { difficulty: number; seed: number; id: string; recent: string[]; disabled?: string[]; history?: MapFeatures[] };
export type SurvivalGenerationResult = { status: 'success'; challenge: SurvivalChallenge } | { status: 'search-failed' | 'error'; error: string };
