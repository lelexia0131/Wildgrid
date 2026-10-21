import { generateMap } from '../src/engine/mapGeneration';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSandbox, getLevelById, getSolution, MAP_GENERATION_TIMEOUT, generationBudget, withEditorPlacements } from '../src/engine';
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

test('survival replaces timed-out rounds indefinitely and accepts a result only once', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else Reflect.deleteProperty(globalThis, 'Worker'); });
  const task = createSurvivalGenerationTask(), errors: string[] = [], results: unknown[] = [];
  const start = () => task.start({ difficulty: 1, seed: 2, id: 'bounded', recent: [] }, { onError: reason => errors.push(reason), onResult: result => results.push(result) });
  const before = FakeWorker.instances.length;
  start(); const first = FakeWorker.instances.at(-1)!;
  t.mock.timers.tick(generationBudget(1) + 399); assert.equal(first.terminated, false);
  t.mock.timers.tick(1); assert.equal(first.terminated, true); assert.equal(task.isRunning(), true);
  for (let i = 0; i < 10; i++) t.mock.timers.tick(generationBudget(1) + 400);
  assert.equal(FakeWorker.instances.length, before + 12); assert.deepEqual(errors, []);
  first.reply({status:'success',challenge:{}}); assert.deepEqual(results, []);
  start(); const final = FakeWorker.instances.at(-1)!, request = final.request as { id: string; seed: number; difficulty: number };
  assert.notEqual(request.seed, 2);
  assert.equal(request.id, 'bounded');
  const {level,placements}=generateMap(1,2,'worker-fixture',[]).draft;
  const challenge = { ...request, draft: withEditorPlacements({ level, placements }, placements), fingerprint: 'test' };
  final.reply({ status: 'success', challenge }); final.reply({ status: 'success', challenge });
  assert.deepEqual(results, [challenge]); assert.equal(task.isRunning(), false);
});

test('survival pause preserves the seed and remaining active budget; cancellation ignores stale replies', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else Reflect.deleteProperty(globalThis, 'Worker'); });
  const task = createSurvivalGenerationTask(), results: unknown[] = [], errors: string[] = [];
  const start = () => task.start({ difficulty: 1, seed: 2, id: 'pause', recent: [] }, { onResult: result => results.push(result), onError: reason => errors.push(reason) });
  task.setPaused(true); const before = FakeWorker.instances.length; start();
  t.mock.timers.tick(10000); assert.equal(FakeWorker.instances.length, before);
  task.setPaused(false); const first = FakeWorker.instances.at(-1)!;
  t.mock.timers.tick(500); task.setPaused(true); assert.equal(first.terminated, true);
  t.mock.timers.tick(10000); assert.equal(task.isRunning(), true);
  task.setPaused(false); const second = FakeWorker.instances.at(-1)!;
  assert.equal((second.request as {seed:number}).seed, 2);
  assert.equal((second.request as {budgetMs:number}).budgetMs, (first.request as {budgetMs:number}).budgetMs - 500);
  first.reply({ status: 'error', error: 'stale' }); assert.equal(task.isRunning(), true);
  task.cancel(); second.reply({ status: 'success', challenge: {} });
  task.setPaused(false); t.mock.timers.tick(10000);
  assert.equal(FakeWorker.instances.at(-1), second); assert.deepEqual(results, []); assert.deepEqual(errors, []);
  start(); task.setPaused(true); task.cancel(); task.setPaused(false);
  assert.equal(task.isRunning(), false);
});

test('exhausted searches keep constructing with fresh seeds until cancelled', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else Reflect.deleteProperty(globalThis, 'Worker'); });
  const task = createSurvivalGenerationTask(), errors: string[] = [], before = FakeWorker.instances.length;
  const request = { difficulty: 8, seed: 0xffffffff, id: 'retry', recent: ['previous'], disabled: ['pool_single'], history: [] };
  task.start(request, { onResult: () => assert.fail('unexpected success'), onError: (_reason, message) => errors.push(message!) });
  const seeds = new Set<number>();
  for (let round = 0; round < 25; round++) {
    const worker = FakeWorker.instances.at(-1)!;
    const sent = worker.request as typeof request;
    assert.equal(sent.id, request.id);
    assert.equal(sent.difficulty, request.difficulty);
    assert.deepEqual(sent.disabled, request.disabled);
    assert.deepEqual(sent.recent, request.recent);
    assert.deepEqual(sent.history, request.history);
    assert.ok(sent.seed >= 0 && sent.seed <= 0xffffffff);
    seeds.add(sent.seed);
    worker.reply({ status: 'search-failed', error: '缺少可解释路径' });
    assert.equal(task.isRunning(), true); assert.equal(worker.terminated, true);
    assert.equal(FakeWorker.instances.length, before + round + 2);
    worker.reply({ status: 'error', error: 'stale' });
  }
  assert.equal(seeds.size, 25);
  task.setPaused(true);
  t.mock.timers.tick(MAP_GENERATION_TIMEOUT * 2);
  assert.equal(FakeWorker.instances.length, before + 26);
  task.setPaused(false);
  const last = FakeWorker.instances.at(-1)!;
  task.cancel();
  last.reply({ status: 'search-failed', error: 'late' });
  t.mock.timers.tick(MAP_GENERATION_TIMEOUT * 2);
  assert.equal(task.isRunning(), false);
  assert.equal(FakeWorker.instances.at(-1), last);
  assert.deepEqual(errors, []);
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

test('survival rejects a worker inventory that omits the enabled single camp', t => {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'Worker');
  Object.defineProperty(globalThis,'Worker',{configurable:true,value:FakeWorker});
  t.after(()=>{ if(descriptor) Object.defineProperty(globalThis,'Worker',descriptor); else Reflect.deleteProperty(globalThis,'Worker'); });
  const task=createSurvivalGenerationTask(), errors:string[]=[];
  const request={difficulty:1,seed:2,id:'missing-camp',recent:[]};
  task.start(request,{onResult:()=>assert.fail('unexpected result'),onError:reason=>errors.push(reason)});
  const level={...getLevelById(6)!,size:8};
  const placements=getSolution(6)!;
  const base=withEditorPlacements({level,placements},placements);
  const draft={...base,level:{...base.level,pieces:base.level.pieces.map(p=>p.kind==='camp'&&p.shape==='single'?{...p,kind:'fire' as const}:p)}};
  FakeWorker.instances.at(-1)!.reply({status:'success',challenge:{...request,draft,fingerprint:'missing'}});
  assert.deepEqual(errors,['error']);
  assert.equal(task.isRunning(),false);
});
