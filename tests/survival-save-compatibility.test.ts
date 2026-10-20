import { test } from 'node:test';
import assert from 'node:assert/strict';
import legacy from './fixtures/survival-before-limit-change.json';
import { decodeMap, inventoryViolations } from '../src/engine';
import { createSurvivalSave, emptySurvivalProgress, replaceSurvivalChallenge, abandonSurvivalChallenge } from '../src/game-modes/survival/survivalChallenge';
import { SURVIVAL_DIFFICULTIES } from '../src/game-modes/survival/survivalDifficulty';
import { parseSurvivalForWrite, serializeSurvivalSave } from '../src/save-system/survivalSaveCodec';
import { readSurvivalForWrite, writeSurvival } from '../src/save-system/survivalStorage';

const draft = decodeMap(legacy.code);
const challenge = { id: 'before-limit-change', difficulty: legacy.difficulty, seed: legacy.seed, draft, fingerprint: 'before-limit-change', startedAt: 100 };
const progress = { ...emptySurvivalProgress(challenge.id), placements: draft.placements.slice(0,2), past: [[], draft.placements.slice(0,1)], future: [draft.placements.slice(0,3)], rotations: { domino: 1 }, selectedId: draft.level.pieces[0].id };
const save = { ...createSurvivalSave(), completed: [{ id: 'earlier-win', difficulty: 1, seed: 1, at: 50 }], challenge, progress };
const stored = serializeSurvivalSave(save);

test('a real challenge from before the limit update preserves its map, progress and ledger', () => {
  assert.ok(draft.level.pieces.length > SURVIVAL_DIFFICULTIES[legacy.difficulty-1].max);
  assert.ok(inventoryViolations(draft.level, legacy.difficulty).length > 0);
  const restored = parseSurvivalForWrite(stored);
  assert.equal(restored.challenge?.id, challenge.id);
  assert.equal(JSON.parse(serializeSurvivalSave(restored)).challenge.code, legacy.code);
  assert.deepEqual(restored.progress, progress);
  assert.deepEqual(restored.completed, save.completed);
});

test('old challenges can save progress, be replaced or be abandoned after a limit update', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let value = stored;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
  } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  const current = readSurvivalForWrite();
  const next = { ...current, progress: { ...current.progress!, placements: draft.placements.slice(0,3) } };
  writeSurvival(next);
  assert.deepEqual(readSurvivalForWrite().progress, next.progress);
  const replacement = { ...challenge, id: 'replacement' };
  writeSurvival(replaceSurvivalChallenge(readSurvivalForWrite(), replacement));
  assert.equal(readSurvivalForWrite().challenge?.id, replacement.id);
  assert.equal(readSurvivalForWrite().records.find(r => r.id === challenge.id)?.code, legacy.code);
  writeSurvival(abandonSurvivalChallenge(readSurvivalForWrite(), replacement.id));
  assert.equal(readSurvivalForWrite().challenge, null);
  assert.deepEqual(readSurvivalForWrite().completed, save.completed);
});

test('invalid versions, damaged maps and invalid progress still block writes and preserve the original data', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let value = stored;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
  } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  const raw = JSON.parse(stored);
  for (const invalid of [
    { ...raw, version: 2 },
    { ...raw, challenge: { ...raw.challenge, code: 'WG1:broken' } },
    { ...raw, progress: { ...raw.progress, placements: [{ id: 'missing', r: 0, c: 0, rotation: 0 }] } },
  ]) {
    value = JSON.stringify(invalid);
    const original = value;
    assert.throws(() => readSurvivalForWrite(), /原数据已保留/);
    assert.throws(() => writeSurvival(createSurvivalSave()), /原数据已保留/);
    assert.equal(value, original);
  }
});
