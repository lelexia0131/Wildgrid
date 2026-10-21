import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adventureContinueId, adventureStartSnapshot } from '../../src/game-modes/adventure/adventureProgress';
import { abandonSurvivalChallenge, createSurvivalSave, emptySurvivalProgress, settleSurvival, survivalContinuation } from '../../src/game-modes/survival/survivalChallenge';
import type { SurvivalChallenge } from '../../src/game-modes/survival/survivalChallenge';
import { createAdventureSave, parseAdventureSave } from '../../src/save-system/adventureSaveCodec';
import { parseSurvivalSave, serializeSurvivalSave } from '../../src/save-system/survivalSaveCodec';
import { getLevelById, getSolution, levels, withEditorPlacements } from '../../src/engine';

const placements = getSolution(6)!;
const draft = withEditorPlacements({ level: { ...getLevelById(6)!, size: 8 }, placements }, placements);
const challenge: SurvivalChallenge = { id: 'continue-test', difficulty: 1, seed: 6, startedAt: 100, draft, fingerprint: 'continue-test' };

test('first players and diary-only players continue an unlocked unfinished board', () => {
  const save = createAdventureSave();
  assert.equal(adventureContinueId(save), levels[0].id);
  save.completed = [1, 2]; save.current = 2;
  assert.equal(adventureContinueId(save), 3, 'a completed current level advances');
  save.current = levels[levels.length - 1].id;
  assert.equal(adventureContinueId(save), 3, 'a locked current level is skipped');
  assert.equal(survivalContinuation(createSurvivalSave()), null);
});

test('diary progress takes priority and survives a restart, including a replayed current level', () => {
  const save = createAdventureSave();
  save.completed = [1, 2, 3, 4, 5]; save.current = 2;
  save.progress[6] = placements.slice(0, 1);
  const restored = parseAdventureSave(JSON.stringify(save));
  assert.equal(adventureContinueId(restored), 6);
  assert.deepEqual(adventureStartSnapshot(restored, adventureContinueId(restored)).placements, placements.slice(0, 1));
  restored.completed = levels.map(level => level.id);
  restored.current = levels[levels.length - 1].id;
  assert.equal(adventureContinueId(restored), restored.current, 'all-clear retains the existing current-level replay behavior');
  assert.deepEqual(adventureStartSnapshot(restored, restored.current).placements, []);
});

test('browsing survival creates no history; active challenge restores exact persisted progress', () => {
  assert.equal(survivalContinuation(parseSurvivalSave(null)), null);
  assert.equal(survivalContinuation(parseSurvivalSave(serializeSurvivalSave(createSurvivalSave()))), null);
  const save = { ...createSurvivalSave(), challenge, progress: { ...emptySurvivalProgress(challenge.id), placements: placements.slice(0, 1), past: [[]], future: [placements.slice(0, 2)], rotations: { domino: 1 }, selectedId: null } };
  const restored = parseSurvivalSave(serializeSurvivalSave(save));
  assert.deepEqual(survivalContinuation(restored), restored.challenge);
  assert.deepEqual(restored.progress, save.progress);
});

test('completed, abandoned and legacy survival histories fall back to the diary without starting a challenge', () => {
  const save = { ...createSurvivalSave(), challenge, progress: emptySurvivalProgress(challenge.id) };
  const settled = settleSurvival(save, challenge, placements, 200).save;
  assert.equal(settled.challenge, null);
  const stored = serializeSurvivalSave(settled);
  const restored = parseSurvivalSave(stored);
  assert.equal(survivalContinuation(restored), null);
  assert.equal(serializeSurvivalSave(restored), stored, 'routing must not change the reward ledger');
  const legacy = parseSurvivalSave(JSON.stringify({ version: 1, completed: [{ id: 'old', difficulty: 4, seed: 9, at: 200 }], recent: [] }));
  assert.equal(survivalContinuation(legacy), null);
  assert.equal(survivalContinuation(parseSurvivalSave(serializeSurvivalSave(abandonSurvivalChallenge(save, challenge.id)))), null);
  assert.equal(survivalContinuation({ ...createSurvivalSave(), recent: ['old-abandoned-map'] }), null);
  const stale = { ...restored, challenge, progress: { ...emptySurvivalProgress(challenge.id), placements } };
  assert.equal(survivalContinuation(stale), null, 'a stale settled board must not be resumed');
});

test('only an active survival challenge takes priority over the diary', () => {
  const save = { ...createSurvivalSave(), records: [
    { id: 'new', difficulty: 3, seed: 1, startedAt: 300, placements: [] },
    { id: 'old', difficulty: 2, seed: 2, finishedAt: 200, placements: [] },
  ] };
  assert.equal(survivalContinuation(save), null);
  assert.deepEqual(survivalContinuation({ ...save, challenge, progress: emptySurvivalProgress(challenge.id) }), challenge);
});
