import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADVENTURE_BADGE_ENGLISH } from '../../src/localization/adventureBadges';
import { createTranslator } from '../../src/localization/LanguageContext';
import { adventureBadgeCounts, adventureHintBoardKey, adventureHintUsage, evaluateAdventureBadge, migrateAdventureBadges } from '../../src/game-modes/adventure/adventureBadges';
import { completeAdventureLevel, levelUnlocked, recordAdventureHint, recordAdventureProgress, restartAdventureLevel } from '../../src/game-modes/adventure/adventureProgress';
import { createAdventureSave, parseAdventureSave } from '../../src/save-system/adventureSaveCodec';
import { readSave, writeSave } from '../../src/save-system/adventureStorage';
import { getLevelById, getSolution } from '../../src/engine/levels';

test('badge evaluation follows first-clear thresholds, including level three and previews', () => {
  for (const [weight, maxLevel, preview, tier] of [
    [0, 0, false, 'gold'], [1, 1, false, 'silver'], [2, 1, false, 'silver'],
    [3, 1, false, 'bronze'], [3, 2, false, 'bronze'], [6, 2, false, 'bronze'],
    [7, 1, false, 'wood'], [6, 3, false, 'wood'], [10, 3, true, 'wood'],
  ] as const) assert.equal(evaluateAdventureBadge({ weight, maxLevel, preview }), tier);
});

test('each actual unlock counts once per board, including after undo and reload', () => {
  const a = getSolution(6)!.slice(0, 2), b = getSolution(6)!.slice(0, 1);
  let save = recordAdventureHint(createAdventureSave(), 6, a, 1);
  assert.deepEqual(adventureHintUsage(save.attempts[6]), { weight: 1, maxLevel: 1, preview: false });
  assert.equal(recordAdventureHint(save, 6, [...a].reverse(), 1), save, 'array order does not create a new board');
  save = recordAdventureHint(save, 6, a, 2);
  assert.equal(adventureHintUsage(save.attempts[6]).weight, 3);
  save = recordAdventureHint(save, 6, a, 3);
  assert.equal(adventureHintUsage(save.attempts[6]).weight, 6);
  save = recordAdventureHint(save, 6, a, 'preview');
  assert.equal(adventureHintUsage(save.attempts[6]).weight, 10);
  assert.equal(recordAdventureHint(save, 6, a, 'preview'), save);
  save = recordAdventureProgress(save, 6, b); // an undo changes placements, not hint history
  assert.equal(adventureHintUsage(save.attempts[6]).weight, 10);
  save = recordAdventureHint(save, 6, b, 1);
  assert.equal(adventureHintUsage(save.attempts[6]).weight, 11);
  save = parseAdventureSave(JSON.stringify(save));
  assert.equal(recordAdventureHint(save, 6, a, 2), save);
  assert.equal(adventureHintUsage(save.attempts[6]).weight, 11);
  assert.deepEqual(save.progress[6], b);
  assert.ok(save.attempts[6].seen[adventureHintBoardKey(getLevelById(6)!, a)]);
});

test('interchangeable IDs and symmetric directions do not turn the same visible layout into paid hints', () => {
  const a = getSolution(6)!.slice(0, 2);
  const swapped = a.map((at, i) => ({ ...at, id: a[1 - i].id, rotation: 2 }));
  const save = recordAdventureHint(createAdventureSave(), 6, a, 1);
  assert.equal(recordAdventureHint(save, 6, swapped, 1), save);
  assert.equal(adventureHintUsage(save.attempts[6]).weight, 1);
});

test('legacy migration grants gold only to completed levels and preserves valid existing grades', () => {
  const old = { version: 1, completed: [1, 3, 15], current: 6, progress: { 6: getSolution(6)!.slice(0, 1) }, settings: { muted: true }, badges: { 1: 'bronze', 2: 'silver', 3: 'invalid', 15: 'wood' } };
  const save = parseAdventureSave(JSON.stringify(old));
  assert.deepEqual(save.badges, { 1: 'bronze', 3: 'gold', 15: 'wood' });
  assert.equal(levelUnlocked(31, save.completed), true);
  assert.equal(save.badges[31], undefined, 'unlocked is not completed');
  assert.deepEqual(save.progress[6], old.progress[6]);
  assert.equal(save.settings.muted, true);
  assert.deepEqual(parseAdventureSave(JSON.stringify(save)), save, 'migration is idempotent');
  assert.deepEqual(migrateAdventureBadges([1, 2], undefined), { 1: 'gold', 2: 'gold' });
  const firstNew = completeAdventureLevel(recordAdventureHint(save, 6, old.progress[6], 1), 6);
  assert.equal(firstNew.badges[6], 'silver', 'new clears follow evaluation, not legacy gold migration');
});

test('first award and completion are atomic, idempotent and permanently locked across restarts', () => {
  let save = createAdventureSave();
  for (const action of [1, 2, 3, 'preview'] as const) save = recordAdventureHint(save, 6, [], action);
  const completed = completeAdventureLevel(save, 6);
  assert.deepEqual(completed.completed, [6]); assert.equal(completed.badges[6], 'wood');
  assert.equal(completed.attempts[6], undefined);
  assert.equal(completeAdventureLevel(completed, 6), completed, 'duplicate callbacks award once');
  assert.equal(recordAdventureHint(completed, 6, [], 1), completed);
  const replayed = completeAdventureLevel(restartAdventureLevel(completed, 6), 6);
  assert.equal(replayed.badges[6], 'wood', 'hint-free replay cannot upgrade the first award');
  const restored = parseAdventureSave(JSON.stringify(replayed));
  assert.equal(restored.badges[6], 'wood');
  assert.deepEqual(adventureBadgeCounts(restored.badges), { gold: 0, silver: 0, bronze: 0, wood: 1 });
  const independent = completeAdventureLevel(createAdventureSave(), 1);
  assert.equal(independent.badges[1], 'gold');
});

test('restarting an unfinished attempt resets usage and board, but leaving or undo never does', () => {
  const placements = getSolution(6)!.slice(0, 1);
  let save = recordAdventureHint(createAdventureSave(), 6, placements, 1);
  save = recordAdventureProgress(save, 6, []);
  assert.equal(adventureHintUsage(save.attempts[6]).weight, 1);
  const restarted = restartAdventureLevel(save, 6);
  assert.deepEqual(restarted.progress[6], []);
  assert.equal(restarted.attempts[6].revision, 1);
  assert.equal(adventureHintUsage(restarted.attempts[6]).weight, 0);
  assert.equal(adventureHintUsage(save.attempts[6]).weight, 1, 'pure transitions preserve the original');
  assert.equal(completeAdventureLevel(restarted, 6).badges[6], 'gold');
});

test('persisted migration, active usage and locked grades survive storage reload without touching other modes', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map([['wildgrid-save-v1', JSON.stringify({ version: 1, completed: [1], progress: {}, current: 6 })], ['wildgrid-survival-v1', 'untouched-survival'], ['wildgrid-local-maps-v1', 'untouched-maps']]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  let save = readSave(); assert.equal(save.badges[1], 'gold');
  save = recordAdventureHint(save, 6, getSolution(6)!.slice(0, 1), 1);
  assert.equal(writeSave(save), true);
  save = readSave(); assert.equal(adventureHintUsage(save.attempts[6]).weight, 1);
  assert.equal(writeSave(completeAdventureLevel(save, 6)), true);
  assert.equal(readSave().badges[6], 'silver');
  assert.equal(values.get('wildgrid-survival-v1'), 'untouched-survival');
  assert.equal(values.get('wildgrid-local-maps-v1'), 'untouched-maps');
});

test('badge names, conditions, confirmations and manual text use existing English localization', () => {
  const { localize } = createTranslator('en');
  for (const key of Object.keys(ADVENTURE_BADGE_ENGLISH)) assert.doesNotMatch(localize(key), /[\u3400-\u9fff]/u);
});
