import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSave, writeSave } from '../src/game/storage';
import { readSurvival, writeSurvival } from '../src/game/survival';
import { saveLocalMap } from '../src/game/localMaps';
import { getLevelById, getSolution } from '../src/game/levels';

test('unreadable and incompatible saves survive attempted adventure, map and reward writes', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
  try {
    for (const raw of ['{broken', '{"version":2}']) {
      values.set('wildgrid-save-v1', raw);
      assert.equal(writeSave(readSave()), false);
      assert.equal(values.get('wildgrid-save-v1'), raw);
      values.set('wildgrid-survival-v1', raw);
      assert.throws(() => writeSurvival(readSurvival()), /原数据已保留/);
      assert.equal(values.get('wildgrid-survival-v1'), raw);
      values.set('wildgrid-local-maps-v1', raw);
      assert.throws(() => saveLocalMap({ level: getLevelById(1)!, placements: getSolution(1)! }), /原数据已保留/);
      assert.equal(values.get('wildgrid-local-maps-v1'), raw);
    }
    values.clear();
    const save = readSave(); save.completed = [1];
    assert.equal(writeSave(save), true);
    assert.deepEqual(readSave().completed, [1]);
  } finally {
    values.clear(); readSave();
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
