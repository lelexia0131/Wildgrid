import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placementHints } from '../src/game/placementHints';
import { evaluate } from '../src/game/rules';
import { readSave, writeSave } from '../src/game/storage';
import { getLevelById, solutions } from '../src/game/levels';
import type { Level, Piece, Placement } from '../src/game/types';

const piece = (id: string, kind: Piece['kind'], shape: Piece['shape'] = 'single'): Piece => ({ id, kind, shape });
const at = (id: string, r: number, c: number): Placement => ({ id, r, c, rotation: 0 });
const level = (pieces: Piece[], terrain: Level['terrain'] = [{ r: 2, c: 0, kind: 'water' }]): Level =>
  ({ id: 0, name: '', chapter: '', tip: '', size: 6, rows: Array(6).fill(6), cols: Array(6).fill(6), terrain, pieces });
const hints = (l: Level, placements: Placement[], selected: Piece, rotation = 0) => placementHints(l, placements, selected, rotation, evaluate(l, placements).issues);

test('hints distinguish valid, pending camp support, terrain rules and complete rotated footprints', () => {
  const camp = piece('c', 'camp', 'domino'), fire = piece('f', 'fire');
  const l = level([camp, fire]);
  assert.equal(hints(l, [], camp)['2,1'], 'VALID');
  assert.equal(hints(l, [], camp)['0,1'], 'INVALID');
  assert.equal(hints(l, [], fire)['2,3'], 'INCOMPLETE');
  assert.equal(hints(l, [], camp)['2,5'], 'INVALID');
  assert.equal(hints(l, [], camp, 1)['2,5'], 'INVALID');
  const rotated = level([camp], [{ r: 2, c: 4, kind: 'water' }]);
  assert.equal(hints(rotated, [], camp)['2,5'], 'INVALID');
  assert.equal(hints(rotated, [], camp, 1)['2,5'], 'VALID');
  assert.equal(hints(l, [], camp)['2,0'], undefined);
  assert.equal(hints(l, [at('c', 2, 1)], fire)['2,1'], undefined);
  assert.equal(hints(l, [at('c', 2, 1)], fire)['2,3'], 'VALID');
  assert.equal(hints(l, [at('c', 2, 1)], fire)['0,5'], 'INVALID');
  assert.equal(hints({ ...l, rows: [6, 6, 0, 6, 6, 6] }, [], camp)['2,1'], 'INVALID');
  assert.equal(hints({ ...l, cols: [6, 0, 6, 6, 6, 6] }, [], camp)['2,1'], 'INVALID');
  assert.equal(hints({ ...l, terrain: [...l.terrain, { r: 1, c: 4, kind: 'forest' }] }, [], fire)['2,3'], 'INVALID');
});

test('a valid new facility is red when it invalidates an existing truck connection', () => {
  const camp = piece('c', 'camp'), truck = piece('t', 'foodTruck'), picnic = piece('p', 'picnic');
  const l = level([camp, truck, picnic]), placements = [at('c', 2, 1), at('t', 2, 3)];
  assert.equal(evaluate(l, placements).issues.t.status, 'VALID');
  const after = evaluate(l, [...placements, at('p', 2, 2)]);
  assert.equal(after.issues.p.status, 'VALID');
  assert.equal(after.issues.t.status, 'INVALID');
  assert.equal(hints(l, placements, picnic)['2,2'], 'INVALID');
  assert.equal(hints(l, [], truck)['2,3'], 'INCOMPLETE');
  const alreadyInvalid = { ...l, cols: [6, 6, 6, 0, 6, 6] };
  assert.equal(evaluate(alreadyInvalid, placements).issues.t.status, 'INVALID');
  assert.equal(evaluate(alreadyInvalid, [...placements, at('p', 2, 2)]).issues.p.status, 'VALID');
  assert.equal(hints(alreadyInvalid, placements, picnic)['2,2'], 'INVALID');
});

test('unrelated existing errors do not turn every candidate red; new reasons still do', () => {
  const camp = piece('c', 'camp'), tower = piece('t', 'tower');
  const l = level([camp, tower]);
  assert.equal(hints(l, [at('t', 0, 5)], camp)['2,1'], 'VALID');
  const fire = piece('f', 'fire'), picnic = piece('p', 'picnic');
  const forest = level([camp, fire, picnic], [{ r: 2, c: 0, kind: 'water' }, { r: 0, c: 2, kind: 'forest' }]);
  const placements = [at('c', 2, 1), at('f', 1, 2)];
  assert.equal(evaluate(forest, placements).issues.f.status, 'INVALID');
  assert.equal(hints(forest, placements, picnic)['2,2'], 'INVALID');
});

test('rule display defaults on in old saves and its disabled state preserves adventure progress', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let stored: string | null = null;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } } });
  try {
    assert.equal(readSave().settings.ruleDisplay, true);
    const progress = solutions[31].slice(0, 1);
    stored = JSON.stringify({ version: 1, completed: [1, 15], current: 31, progress: { 31: progress }, settings: { muted: true, facilityNames: true } });
    const save = readSave();
    assert.equal(save.settings.ruleDisplay, true);
    save.settings.ruleDisplay = false;
    assert.equal(writeSave(save), true);
    const restored = readSave();
    assert.equal(restored.settings.ruleDisplay, false);
    assert.equal(restored.settings.facilityNames, true);
    assert.deepEqual(restored.completed, [1, 15]);
    assert.equal(restored.current, 31);
    assert.deepEqual(restored.progress[31], progress);
    assert.equal(evaluate(getLevelById(31)!, progress).won, false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
