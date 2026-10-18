import { MAP_GENERATION_TIMEOUT } from '../engine';
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
  return createWorkerTask<{ difficulty: number; seed: number; id: string; recent: string[] }, { challenge?: SurvivalChallenge; error?: string }>(
    () => new Worker(new URL('./survival.worker.ts', import.meta.url), { type: 'module' }), MAP_GENERATION_TIMEOUT,
  );
}
