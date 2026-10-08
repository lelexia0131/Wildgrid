import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { generateSurvival } from '../src/game/survivalGenerator';
import { completeSurvival, emptySurvivalProgress, rankFor, readSurvival, survivalDifficulties, survivalTotals, writeSurvival } from '../src/game/survival';
import type { SurvivalChallenge } from '../src/game/survival';
import { evaluate } from '../src/game/rules';
import { solveLevel } from '../src/game/solver';
import { encodeMap } from '../src/game/sandbox';
import { readLocalMaps, saveLocalMap, unlockSurvivalMaps } from '../src/game/localMaps';

const maps: SurvivalChallenge[] = [];
const values = new Map<string, string>();
function storage(fail = false) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (fail) throw new Error('QuotaExceededError'); values.set(key, value); },
  } });
}

test('ten seeded tiers generate legal unique 8×8 puzzles, including twenty facilities', () => {
  for (let difficulty = 1; difficulty <= 10; difficulty++) {
    const started = Date.now(), spec = survivalDifficulties[difficulty - 1];
    const map = generateSurvival(difficulty, difficulty === 10 ? 2 : 20261008 + difficulty, `test-${difficulty}`);
    assert.equal(map.draft.level.size, 8);
    assert.ok(map.draft.level.pieces.length >= spec.min && map.draft.level.pieces.length <= spec.max);
    assert.equal(evaluate(map.draft.level, map.draft.placements).won, true);
    const solved = solveLevel(map.draft.level, 2, { deadline: Date.now() + 1500, maxNodes: 50000 });
    assert.equal(solved.aborted, false); assert.equal(solved.count, 1);
    maps.push(map);
    console.log(`${difficulty}难: ${map.draft.level.pieces.length} 设施, ${map.draft.level.terrain.length} 地形, ${solved.candidates} 候选, ${solved.nodes} 搜索节点, ${Date.now() - started}ms`);
  }
  assert.equal(maps[9].draft.level.pieces.length, 20);
  assert.equal(generateSurvival(1, maps[0].seed, 'other-id').fingerprint, maps[0].fingerprint);
  assert.notEqual(generateSurvival(1, maps[0].seed, 'different', [maps[0].fingerprint]).fingerprint, maps[0].fingerprint);
  mkdirSync('.desktop-smoke/survival', { recursive: true });
  writeFileSync('.desktop-smoke/survival/fixtures.json', JSON.stringify(maps.map(map => ({ ...map, code: encodeMap(map.draft) }))));
});

test('progress, undo, selection and rotations survive reload; settlement is atomic and rewards once', () => {
  values.clear(); storage();
  const challenge = maps[3], progress = { ...emptySurvivalProgress(challenge.id), placements: challenge.draft.placements.slice(0, 2), past: [[], challenge.draft.placements.slice(0, 1)], future: [challenge.draft.placements.slice(0, 3)], rotations: { domino: 1 }, selectedId: challenge.draft.level.pieces[2].id };
  const save = { ...readSurvival(), challenge, progress };
  writeSurvival(save);
  assert.deepEqual(readSurvival().progress, progress);
  const raw = JSON.parse(values.get('wildgrid-survival-v1')!);
  assert.ok(raw.challenge.code); assert.equal(raw.challenge.placements, undefined);
  storage(true);
  assert.throws(() => completeSurvival(challenge, challenge.draft.placements), /保存失败/);
  assert.equal(survivalTotals(readSurvival()).xp, 0); assert.ok(readSurvival().challenge);
  storage();
  const first = completeSurvival(challenge, challenge.draft.placements);
  assert.equal(first.reward.earned, 10); assert.equal(first.reward.beforeRank, 0); assert.equal(first.reward.rank, 1);
  assert.equal(readSurvival().challenge, null); assert.equal(readSurvival().progress, null);
  assert.equal(completeSurvival(challenge, challenge.draft.placements).reward.earned, 0);
  assert.deepEqual(survivalTotals(readSurvival()), { counts: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0], total: 1, xp: 10 });
  assert.deepEqual([0, 9, 10, 99, 100, 499, 500, 999, 1000, 5000].map(rankFor), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(values.has('wildgrid-save-v1'), false);
});

test('collections keep the original answer, block locked edits and unlock every copy by challenge ID', () => {
  values.clear(); storage();
  const challenge = maps[0], info = { challengeId: challenge.id, difficulty: 1, seed: challenge.seed, completed: false, blueprintUnlocked: false };
  const first = saveLocalMap(challenge.draft, [], undefined, info), second = saveLocalMap(challenge.draft, [], undefined, info);
  assert.deepEqual(first.draft.placements, challenge.draft.placements); assert.deepEqual(first.progress, []);
  const changed = structuredClone(challenge.draft); changed.level.terrain.push({ r: 7, c: 7, kind: 'mountain' });
  assert.throws(() => saveLocalMap(changed, [], first.id), /通关后才能编辑/);
  writeSurvival({ ...readSurvival(), challenge, progress: emptySurvivalProgress(challenge.id) });
  completeSurvival(challenge, challenge.draft.placements);
  unlockSurvivalMaps(challenge.id);
  assert.equal(readLocalMaps().filter(map => map.survival?.blueprintUnlocked).length, 2);
  assert.equal(readLocalMaps().find(map => map.id === second.id)?.survival?.completed, true);
  assert.equal(completeSurvival(challenge, challenge.draft.placements).reward.earned, 0);
  const edited = saveLocalMap(changed, [], first.id);
  assert.equal(edited.survival, undefined);
  assert.equal(saveLocalMap(challenge.draft).survival, undefined);
});
