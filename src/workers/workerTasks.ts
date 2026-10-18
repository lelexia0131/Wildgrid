import { encodeMap, MAP_GENERATION_TIMEOUT } from '../engine';
import { SURVIVAL_DIFFICULTIES } from '../game-modes/survival/survivalDifficulty';
import type { SandboxCheck, SandboxDraft } from '../engine';
import type { SurvivalChallenge } from '../game-modes/survival/survivalChallenge';

type TaskCallbacks<Result> = { onResult: (result: Result) => void; onError: (reason: 'error' | 'timeout') => void };

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
  let session: { request: SurvivalGenerationRequest; callbacks: TaskCallbacks<SurvivalChallenge>; tried: boolean } | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let paused = false;
  function cancel() {
    session = null; clearTimeout(retry); retry = undefined; attempt.cancel();
  }
  function run() {
    retry = undefined;
    const current = session;
    if (!current || paused || attempt.isRunning()) return;
    const fail = () => { if (session === current) { cancel(); current.callbacks.onError('error'); } };
    const again = () => {
      if (session === current && !paused) retry = setTimeout(run, 0);
    };
    try {
      if (current.tried) {
        const random = crypto.getRandomValues(new Uint32Array(1))[0];
        current.request = { ...current.request, seed: random === current.request.seed ? (random + 1) >>> 0 : random };
      }
      current.tried = true;
      const request = current.request;
      attempt.start(request, {
        onError: reason => { if (session === current) { if (reason === 'timeout') again(); else fail(); } },
        onResult: data => {
          if (session !== current) return;
          if (!data || typeof data !== 'object' || !('status' in data)) { fail(); return; }
          const result = data as SurvivalGenerationResult;
          if (result.status === 'search-failed' && typeof result.error === 'string') { again(); return; }
          if (result.status !== 'success') { fail(); return; }
          // Reject malformed or mismatched replies before they can reach storage.
          try {
            const c = result.challenge, spec = SURVIVAL_DIFFICULTIES[request.difficulty - 1];
            if (!c || c.id !== request.id || c.seed !== request.seed || c.difficulty !== request.difficulty || typeof c.fingerprint !== 'string' || !spec || c.draft.level.size !== 8 || c.draft.level.pieces.length < spec.min || c.draft.level.pieces.length > spec.max) throw new Error('Invalid worker reply');
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
      session = { request, callbacks, tried: false }; run();
    },
    cancel, isRunning: () => session !== null,
    setPaused(value: boolean) {
      paused = value;
      if (paused) { clearTimeout(retry); retry = undefined; attempt.cancel(); }
      else if (session && !attempt.isRunning() && retry === undefined) run();
    },
  };
}

export type SurvivalGenerationRequest = { difficulty: number; seed: number; id: string; recent: string[] };
export type SurvivalGenerationResult = { status: 'success'; challenge: SurvivalChallenge } | { status: 'search-failed' | 'error'; error: string };
