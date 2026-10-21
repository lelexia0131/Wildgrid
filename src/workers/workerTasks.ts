import { encodeMap, MAP_GENERATION_TIMEOUT, generationBudget, nextGenerationSeed, inventoryViolations } from '../engine';
import type { SandboxCheck, SandboxDraft } from '../engine';
import type { SurvivalChallenge } from '../game-modes/survival/survivalChallenge';
import type { SurvivalGenerationRequest, SurvivalGenerationResult } from './survivalProtocol';
import type { AdventureHint, HintRequest } from '../engine';
export type { SurvivalGenerationRequest, SurvivalGenerationResult } from './survivalProtocol';

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

export function createAdventureHintTask() {
  return createWorkerTask<HintRequest, AdventureHint>(() => new Worker(new URL('./hint.worker.ts', import.meta.url), { type: 'module' }), 6000);
}

export function createSurvivalGenerationTask() {
  const attempt = createWorkerTask<SurvivalGenerationRequest, unknown>(
    () => new Worker(new URL('./survival.worker.ts', import.meta.url), { type: 'module' }),
  );
  let session: { request: SurvivalGenerationRequest; callbacks: TaskCallbacks<SurvivalChallenge>; elapsed: number; started: number | null } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let paused = false;
  function account() {
    if (session?.started !== null && session?.started !== undefined) { session.elapsed += Date.now() - session.started; session.started = null; }
    clearTimeout(timer); timer = undefined;
  }
  function cancel() { account(); session = null; attempt.cancel(); }
  function retry() {
    if (!session) return;
    account(); attempt.cancel();
    session.request = { ...session.request, seed: nextGenerationSeed(session.request.seed) };
    session.elapsed = 0;
    run();
  }
  function run() {
    const current = session;
    if (!current || paused || attempt.isRunning()) return;
    const fail = (reason: 'error' | 'timeout', message?: string) => {
      if (session !== current) return;
      cancel(); current.callbacks.onError(reason, message);
    };
    // Each search round is bounded; the session continues until success or cancellation.
    // Pausing terminates CPU work and preserves this round's seed and active budget.
    const remaining = Math.min(MAP_GENERATION_TIMEOUT, generationBudget(current.request.difficulty) + 400) - current.elapsed;
    if (remaining <= 0) { retry(); return; }
    try {
      current.started = Date.now();
      timer = setTimeout(retry, remaining);
      const request = { ...current.request, budgetMs: Math.max(1, remaining - 200) };
      attempt.start(request, {
        onError: reason => fail(reason),
        onResult: data => {
          if (session !== current) return;
          account();
          if (!data || typeof data !== 'object' || !('status' in data)) { fail('error'); return; }
          const result = data as SurvivalGenerationResult;
          if (result.status === 'search-failed' && typeof result.error === 'string') { retry(); return; }
          if (result.status !== 'success') { fail('error', typeof result.error === 'string' ? result.error : undefined); return; }
          try {
            const c = result.challenge;
            if (!c || c.id !== request.id || c.seed !== request.seed || c.difficulty !== request.difficulty || typeof c.fingerprint !== 'string' || c.draft.level.size !== 8 || inventoryViolations(c.draft.level,request.difficulty,request.disabled).length > 0) throw new Error('Invalid worker reply');
            if (!request.disabled?.includes('camp_single') && !c.draft.level.pieces.some(p => p.kind === 'camp' && p.shape === 'single')) throw new Error('Missing required single camp');
            encodeMap(c.draft);
          } catch { fail('error'); return; }
          cancel(); current.callbacks.onResult(result.challenge);
        },
      });
    } catch { fail('error'); }
  }
  return {
    start(request: SurvivalGenerationRequest, callbacks: TaskCallbacks<SurvivalChallenge>) {
      if (session) return;
      session = { request, callbacks, elapsed: 0, started: null }; run();
    },
    cancel, isRunning: () => session !== null,
    setPaused(value: boolean) {
      paused = value;
      if (paused) { account(); attempt.cancel(); }
      else run();
    },
  };
}
