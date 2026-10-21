import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeSurvival, readSurvival, writeSurvival } from '../../src/save-system/survivalStorage';
import { archiveSurvivalRecord, emptySurvivalProgress, survivalTotals } from '../../src/game-modes/survival/survivalChallenge';
import { getLevelById, getSolution } from '../../src/engine';
import { withEditorPlacements } from '../../src/engine';
import type { SurvivalChallenge } from '../../src/game-modes/survival/survivalChallenge';

test('completed and abandoned history retains exact map snapshots without duplicate rewards', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  try {
    const level = { ...getLevelById(6)!, size: 8 }, placements = getSolution(6)!;
    const draft = withEditorPlacements({ level, placements }, placements);
    const challenge: SurvivalChallenge = { id: 'history-clear', difficulty: 1, seed: 123, startedAt: Date.now() - 60000, draft, fingerprint: 'history-clear' };
    writeSurvival({ ...readSurvival(), challenge, progress: emptySurvivalProgress(challenge.id) });
    assert.deepEqual(readSurvival().records, []);
    const first = completeSurvival(challenge, placements);
    const record = readSurvival().records[0];
    assert.equal(record.startedAt, challenge.startedAt);
    assert.equal(record.finishedAt, first.save.completed[0].at);
    assert.ok(record.code); assert.deepEqual(record.placements, placements);
    assert.equal(completeSurvival(challenge, placements).reward.earned, 0);
    assert.deepEqual(readSurvival().records, [record]);
    const abandoned = { ...challenge, id: 'history-abandoned', startedAt: Date.now() };
    const save = readSurvival(), totals = survivalTotals(save);
    writeSurvival(archiveSurvivalRecord(save, abandoned, placements.slice(0, 1)));
    assert.deepEqual(survivalTotals(readSurvival()), totals);
    assert.equal(readSurvival().records[1].finishedAt, undefined);
    assert.deepEqual(readSurvival().records[1].placements, placements.slice(0, 1));
    assert.deepEqual(readSurvival().records[0], record);
  } finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});
