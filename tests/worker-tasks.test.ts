import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSandbox, getLevelById, getSolution, MAP_GENERATION_TIMEOUT, withEditorPlacements } from '../src/engine';
import { createSandboxCheckTask, createSurvivalGenerationTask } from '../src/workers/workerTasks';

class FakeWorker {
  static instances: FakeWorker[] = [];
  static failPost = false;
  static failCreate = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  request: unknown;
  constructor() { if (FakeWorker.failCreate) throw new Error('create failed'); FakeWorker.instances.push(this); }
  postMessage(request: unknown) { this.request = request; if (FakeWorker.failPost) throw new Error('post failed'); }
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
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.timers.tick(MAP_GENERATION_TIMEOUT * 3); assert.equal(task.isRunning(), true);
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

test('survival replaces each seed after 2s and accepts a later success only once', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else Reflect.deleteProperty(globalThis, 'Worker'); });
  const task = createSurvivalGenerationTask(), errors: string[] = [], results: unknown[] = [];
  assert.equal(MAP_GENERATION_TIMEOUT, 2000);
  task.start({ difficulty: 1, seed: 2, id: 'retry', recent: [] }, { onError: reason => errors.push(reason), onResult: result => results.push(result) });
  const worker = FakeWorker.instances.at(-1)!;
  t.mock.timers.tick(1999); assert.equal(task.isRunning(), true); assert.equal(worker.terminated, false);
  t.mock.timers.tick(1); assert.equal(task.isRunning(), true); assert.equal(worker.terminated, true);
  worker.reply({ challenge: {} }); worker.onerror?.();
  assert.deepEqual(errors, []); assert.deepEqual(results, []);
  t.mock.timers.tick(1);
  const next = FakeWorker.instances.at(-1)!;
  assert.notEqual(next, worker); assert.equal(worker.terminated, true);
  assert.equal((next.request as { seed: number }).seed, (2 + 0x9e3779b9) >>> 0);
  for (let i = 0; i < 2; i++) {
    const previous = FakeWorker.instances.at(-1)!;
    t.mock.timers.tick(2000); t.mock.timers.tick(1);
    assert.equal(previous.terminated, true);
    assert.equal((FakeWorker.instances.at(-1)!.request as { seed: number }).seed, ((previous.request as { seed: number }).seed + 0x9e3779b9) >>> 0);
    previous.reply({ status: 'success', challenge: {} });
    assert.deepEqual(errors, []); assert.deepEqual(results, []);
  }
  const final = FakeWorker.instances.at(-1)!, request = final.request as { id: string; seed: number; difficulty: number };
  const level = { ...getLevelById(6)!, size: 8 }, placements = getSolution(6)!;
  const challenge = { ...request, draft: withEditorPlacements({ level, placements }, placements), fingerprint: 'test' };
  final.reply({ status: 'success', challenge }); final.reply({ status: 'success', challenge });
  t.mock.timers.tick(MAP_GENERATION_TIMEOUT * 2);
  assert.equal(task.isRunning(), false); assert.equal(final.terminated, true);
  assert.deepEqual(results, [challenge]); assert.deepEqual(errors, []);
});

test('survival cancellation and background pause stop workers and all queued retries', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else Reflect.deleteProperty(globalThis, 'Worker'); });
  const task = createSurvivalGenerationTask(), results: unknown[] = [], errors: string[] = [];
  const start = () => task.start({ difficulty: 1, seed: 2, id: 'cancel', recent: [] }, { onResult: result => results.push(result), onError: reason => errors.push(reason) });
  task.setPaused(true); const before = FakeWorker.instances.length; start();
  t.mock.timers.tick(MAP_GENERATION_TIMEOUT * 2); assert.equal(FakeWorker.instances.length, before);
  task.setPaused(false); const first = FakeWorker.instances.at(-1)!;
  task.setPaused(true); assert.equal(first.terminated, true);
  first.reply({ status: 'search-failed', error: 'late' });
  t.mock.timers.tick(MAP_GENERATION_TIMEOUT * 2); assert.equal(FakeWorker.instances.at(-1), first);
  task.setPaused(false); const second = FakeWorker.instances.at(-1)!;
  assert.notEqual(second, first);
  second.reply({ status: 'search-failed', error: 'retry queued' }); task.cancel();
  t.mock.timers.tick(MAP_GENERATION_TIMEOUT * 2); task.setPaused(false);
  assert.equal(FakeWorker.instances.at(-1), second); assert.equal(task.isRunning(), false);
  start(); const third = FakeWorker.instances.at(-1)!; task.setPaused(true); task.cancel(); task.setPaused(false);
  assert.equal(third.terminated, true); assert.equal(FakeWorker.instances.at(-1), third);
  start(); task.cancel(); assert.deepEqual(results, []); assert.deepEqual(errors, []);
});

test('successive search failures keep changing seeds within the 45s session budget', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else Reflect.deleteProperty(globalThis, 'Worker'); });
  const task = createSurvivalGenerationTask(), errors: string[] = [];
  const before = FakeWorker.instances.length;
  task.start({ difficulty: 10, seed: 2, id: 'bounded', recent: [] }, { onResult: () => assert.fail('unexpected result'), onError: reason => errors.push(reason) });
  const seeds = new Set<number>();
  for (let i = 0; i < 3; i++) {
    const worker = FakeWorker.instances.at(-1)!;
    seeds.add((worker.request as { seed: number }).seed);
    worker.reply({ status: 'search-failed', error: 'exhausted' });
    t.mock.timers.tick(1);
    assert.equal(worker.terminated, true); assert.equal(task.isRunning(), true);
    assert.deepEqual(errors, []);
  }
  assert.equal(seeds.size, 3); assert.equal(FakeWorker.instances.length - before, 4);
  t.mock.timers.tick(45000);
  assert.equal(task.isRunning(), false);
  assert.deepEqual(errors, ['error']);
  const after = FakeWorker.instances.length;
  t.mock.timers.tick(45000);
  assert.equal(FakeWorker.instances.length, after);
});

test('survival creation, posting, runtime and protocol errors stop without retrying', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else Reflect.deleteProperty(globalThis, 'Worker'); });
  const task = createSurvivalGenerationTask(), errors: string[] = [];
  const start = () => task.start({ difficulty: 1, seed: 2, id: 'error', recent: [] }, { onResult: () => assert.fail('unexpected result'), onError: reason => errors.push(reason) });
  for (const reply of [null, {}, { status: 'success', challenge: {} }, { status: 'search-failed' }, { status: 'error', error: 'unexpected bug' }]) {
    start(); const worker = FakeWorker.instances.at(-1)!;
    worker.reply(reply); worker.onerror?.(); t.mock.timers.tick(MAP_GENERATION_TIMEOUT * 2);
    assert.equal(task.isRunning(), false); assert.equal(FakeWorker.instances.at(-1), worker); assert.equal(worker.terminated, true);
  }
  start(); FakeWorker.instances.at(-1)!.onmessageerror?.(); assert.equal(task.isRunning(), false);
  start(); FakeWorker.instances.at(-1)!.onerror?.(); assert.equal(task.isRunning(), false);
  FakeWorker.failCreate = true; start(); FakeWorker.failCreate = false; assert.equal(task.isRunning(), false);
  FakeWorker.failPost = true; start(); FakeWorker.failPost = false; assert.equal(task.isRunning(), false);
  t.mock.timers.tick(MAP_GENERATION_TIMEOUT * 2); assert.deepEqual(errors, Array(9).fill('error'));
});
