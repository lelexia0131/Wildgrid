import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basicLessons, finishLesson, freshTutorial, matchesAction, readTutorial, resolveTutorial, tutorialStorageKey, writeTutorial } from '../src/game/tutorial';
import { getLevelById, levels } from '../src/game/levels';
import { dictionaries } from '../src/i18n';
import type { FacilityKind } from '../src/game/types';
import { createTranslator } from '../src/i18n/context';
import { facilities } from '../src/game/facilityRegistry';

test('tutorial migration uses play records and leaves all three existing saves intact', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) } });
  try {
    assert.equal(readTutorial().basicComplete, false);
    storage.set('wildgrid-save-v1', JSON.stringify({ version: 1, completed: [], progress: { 1: [] } }));
    assert.equal(readTutorial().basicComplete, false);
    storage.set('wildgrid-save-v1', JSON.stringify({ version: 1, completed: [15], progress: {} }));
    storage.set('wildgrid-local-maps-v1', '{"version":1,"maps":[]}');
    storage.set('wildgrid-survival-v1', '{"version":1,"completed":[]}');
    const original = new Map(storage);
    const state = readTutorial();
    assert.equal(state.basicComplete, true);
    assert.ok(state.facilitiesSeen.includes('camp'));
    assert.equal(state.facilitiesSeen.includes('foodTruck'), false);
    assert.equal(writeTutorial({ ...state, enabled: false, language: 'en' }), true);
    assert.equal(readTutorial().enabled, false);
    assert.equal(readTutorial().language, 'en');
    for (const [key, value] of original) assert.equal(storage.get(key), value);
    storage.set(tutorialStorageKey, '{"version":1,"basicSeen":["invalid"],"facilitiesSeen":["pool","invalid"],"language":"bad"}');
    assert.deepEqual(readTutorial().facilitiesSeen, ['pool']);
    assert.equal(readTutorial().language, 'zh');
    storage.set(tutorialStorageKey, '{broken');
    assert.equal(readTutorial().basicComplete, true);
  } finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});
test('first play is progressive and action conditions match only the intended operation', () => {
  const level = getLevelById(1)!;
  const context = { mode: 'adventure' as const, level, placements: [], selected: null, won: false };
  let state = freshTutorial();
  const orientation = resolveTutorial(state, context)!;
  assert.equal(orientation.id, 'orientation');
  state = finishLesson(state, orientation);
  const camp = resolveTutorial(state, context)!;
  assert.equal(camp.facility, 'camp');
  state = finishLesson(state, camp, true);
  assert.deepEqual(state.skipped, ['facility:camp']);
  assert.equal(resolveTutorial(state, context)?.id, 'placing');
  assert.equal(matchesAction({ type: 'pickup', pieceId: 'camp-1' }, { type: 'pickup', pieceId: 'camp-2' }), false);
  assert.equal(matchesAction({ type: 'place', kind: 'camp' }, { type: 'place', kind: 'camp' }), true);
  assert.equal(matchesAction({ type: 'rotate' }, { type: 'select' }), false);
});
test('all eight facilities, including Day 31 additions, queue once in every play mode', () => {
  const introduced = new Set<FacilityKind>();
  for (const mode of ['adventure', 'survival', 'sandbox-play'] as const) {
    let state = freshTutorial(true);
    for (const level of levels) {
      const context = { mode, level, placements: [], selected: null, won: false };
      let lesson;
      while ((lesson = resolveTutorial(state, context))) {
        assert.ok(lesson.facility);
        introduced.add(lesson.facility!);
        state = finishLesson(state, lesson);
      }
      assert.equal(resolveTutorial(state, context), null);
    }
    assert.equal(state.facilitiesSeen.length, 8);
    assert.equal(resolveTutorial({ ...state, facilitiesSeen: [], enabled: false }, { mode, level: levels[0], placements: [], selected: null, won: false }), null);
  }
  assert.deepEqual([...introduced].sort(), Object.keys(dictionaries.zh.facilities).sort());
  assert.equal(resolveTutorial(freshTutorial(), { mode: 'sandbox-editor', level: levels[0], placements: [], selected: null, won: false }), null);
});
test('basic completion waits for every lesson; both languages cover every tutorial', () => {
  let state = freshTutorial();
  for (const basic of basicLessons) state = finishLesson(state, { id: basic, basic, steps: [] });
  assert.equal(state.basicComplete, true);
  for (const language of ['zh', 'en'] as const) {
    for (const entry of [...Object.values(dictionaries[language].basics), ...Object.values(dictionaries[language].facilities)]) assert.ok(entry.title && entry.text);
    assert.deepEqual(Object.keys(dictionaries[language].basics), Object.keys(dictionaries.zh.basics));
  }
});
test('English covers every facility rule and level hint; early guidance introduces only present concepts', () => {
  const { localize } = createTranslator('en');
  for (const level of levels) assert.equal(/\p{Script=Han}/u.test(localize(level.tip)), false, level.tip);
  for (const facility of facilities) {
    for (const text of [facility.name, ...facility.tips, facility.require, facility.forbid, facility.why, ...facility.extra?.map(e => e.why) || []]) assert.equal(/\p{Script=Han}/u.test(localize(text)), false, text);
    assert.ok(dictionaries.zh.facilities[facility.kind].text.includes(facility.name));
  }
  assert.equal(/森林|山地/.test(dictionaries.zh.basics.board.text), false);
  assert.equal(/餐车|电塔/.test(dictionaries.zh.facilities.camp.text), false);
  assert.equal(/电塔/.test(dictionaries.zh.facilities.fire.text), false);
  assert.equal(/Ctrl|Cmd/.test(dictionaries.zh.basics.undo.text), false);
  assert.equal(/\p{Script=Han}/u.test(localize('营地：所在行或列的占格数超出提示；营地至少有一格需要上下左右挨着水')), false);
});
