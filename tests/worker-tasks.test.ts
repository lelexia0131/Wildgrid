import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSandbox, MAP_GENERATION_TIMEOUT } from '../src/engine';
import { createSandboxCheckTask, createSurvivalGenerationTask } from '../src/workers/workerTasks';

class FakeWorker {
  static instances: FakeWorker[] = [];
  static failPost = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  constructor() { FakeWorker.instances.push(this); }
  postMessage() { if (FakeWorker.failPost) throw new Error('post failed'); }
  terminate() { this.terminated = true; }
  reply(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
}

test('worker tasks cancel, ignore stale/duplicate replies, release errors and clean up failed posts', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else Reflect.deleteProperty(globalThis, 'Worker'); });
  const task = createSandboxCheckTask(), results: unknown[] = [], errors: string[] = [];
  const callbacks = { onResult: (result: unknown) => results.push(result), onError: (reason: string) => errors.push(reason) };
  task.start(createSandbox(6), callbacks);
  const first = FakeWorker.instances.at(-1)!;
  task.cancel(); assert.equal(first.terminated, true);
  task.start(createSandbox(8), callbacks);
  const second = FakeWorker.instances.at(-1)!;
  task.start(createSandbox(6), callbacks); assert.equal(FakeWorker.instances.at(-1), second);
  first.reply({ status: 'unique' }); assert.deepEqual(results, []);
  second.reply({ status: 'none' }); second.reply({ status: 'unique' });
  assert.deepEqual(results, [{ status: 'none' }]); assert.equal(task.isRunning(), false); assert.equal(second.terminated, true);
  task.start(createSandbox(6), callbacks); FakeWorker.instances.at(-1)!.onerror?.();
  assert.deepEqual(errors, ['error']); assert.equal(task.isRunning(), false);
  FakeWorker.failPost = true;
  try { assert.throws(() => task.start(createSandbox(6), callbacks), /post failed/); }
  finally { FakeWorker.failPost = false; }
  assert.equal(task.isRunning(), false); assert.equal(FakeWorker.instances.at(-1)!.terminated, true);
});

test('survival worker keeps the existing deadline and cannot publish after timeout', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else Reflect.deleteProperty(globalThis, 'Worker'); });
  const task = createSurvivalGenerationTask(), errors: string[] = [], results: unknown[] = [];
  task.start({ difficulty: 10, seed: 2, id: 'timeout', recent: [] }, { onError: reason => errors.push(reason), onResult: result => results.push(result) });
  const worker = FakeWorker.instances.at(-1)!;
  t.mock.timers.tick(MAP_GENERATION_TIMEOUT - 1); assert.equal(task.isRunning(), true);
  t.mock.timers.tick(1); assert.equal(task.isRunning(), false); assert.equal(worker.terminated, true);
  worker.reply({ challenge: {} }); worker.onerror?.();
  assert.deepEqual(errors, ['timeout']); assert.deepEqual(results, []);
});
