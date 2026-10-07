import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLocalMaps, saveLocalMap } from '../src/game/localMaps';
import { createSandbox, encodeMap, withEditorPlacements } from '../src/game/sandbox';
import type { Placement } from '../src/game/types';

function draft() {
  const map = createSandbox(6);
  map.level.terrain = [{ kind: 'water', r: 0, c: 1 }, { kind: 'water', r: 0, c: 2 }];
  map.level.pieces = [{ id: 'a', kind: 'camp', shape: 'single' }, { id: 'b', kind: 'camp', shape: 'domino' }];
  return withEditorPlacements(map, [{ id: 'a', r: 1, c: 1, rotation: 0 }, { id: 'b', r: 1, c: 2, rotation: 0 }]);
}

function storage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
  return values;
}

test('local maps get numbered names, persist blueprint and partial progress, and update the selected slot', () => {
  const values = storage(), map = draft();
  const first = saveLocalMap(map);
  const progress = [{ id: 'a', r: 2, c: 4, rotation: 0 }];
  const second = saveLocalMap(map, progress);
  assert.equal(first.name, '本地地图1');
  assert.equal(second.name, '本地地图2');
  assert.deepEqual(readLocalMaps(), [first, second]);
  assert.deepEqual(second.draft, map);
  assert.equal(values.has('wildgrid-save-v1'), false);
  const changed = saveLocalMap(map, map.placements, first.id);
  assert.deepEqual(readLocalMaps(), [changed, second]);
  assert.equal(saveLocalMap(map).id, 3);
  assert.throws(() => saveLocalMap(map, [], 10), /存档不存在/);
  progress[0].r = 5;
  assert.equal(readLocalMaps()[1].progress[0].r, 2);
});

test('corrupt entries are ignored while saving keeps valid maps and uses the newest list', () => {
  const values = storage(), map = draft();
  saveLocalMap(map);
  const [key, encoded] = [...values.entries()][0];
  const raw = JSON.parse(encoded);
  raw.maps.push({ id: 4, code: encodeMap(map), progress: [] });
  raw.maps.push({ id: 2, code: 'WG1:invalid', progress: [] });
  raw.maps.push({ id: 3, code: encodeMap(map), progress: [{ id: 'unknown', r: 1, c: 1, rotation: 0 }] });
  raw.maps.push({ id: 4, code: encodeMap(map), progress: [] });
  raw.maps.push({ id: -1, code: encodeMap(map), progress: [] });
  values.set(key, JSON.stringify(raw));
  assert.deepEqual(readLocalMaps().map(saved => saved.id), [1, 4]);
  assert.equal(saveLocalMap(map).id, 5);
  assert.deepEqual(readLocalMaps().map(saved => saved.id), [1, 4, 5]);
  values.set(key, '{broken');
  assert.deepEqual(readLocalMaps(), []);
  values.set(key, JSON.stringify({ version: 2, maps: raw.maps }));
  assert.deepEqual(readLocalMaps(), []);
});

test('local map progress rejects unknown, duplicate, malformed, overlapping, terrain and out-of-bounds placements', () => {
  const values = storage(), map = draft();
  saveLocalMap(map);
  const before = [...values.entries()];
  const invalid: unknown[] = [
    null,
    [{ id: 'unknown', r: 1, c: 1, rotation: 0 }],
    [map.placements[0], map.placements[0]],
    [{ id: 'a', r: 1.5, c: 1, rotation: 0 }],
    [{ id: 'a', r: 1, c: 1, rotation: 4 }],
    [{ id: 'a', r: 1, c: 1, rotation: '0' }],
    [{ id: 'a', r: -1, c: 1, rotation: 0 }],
    [{ id: 'a', r: 0, c: 1, rotation: 0 }],
    [{ id: 'b', r: 1, c: 5, rotation: 0 }],
    [{ id: 'a', r: 1, c: 2, rotation: 0 }, map.placements[1]],
  ];
  const [key, encoded] = before[0];
  for (const progress of invalid) {
    assert.throws(() => saveLocalMap(map, progress as Placement[]), /地图游玩进度/);
    assert.deepEqual([...values.entries()], before);
    const raw = JSON.parse(encoded);
    raw.maps.push({ id: 2, code: encodeMap(map), progress });
    values.set(key, JSON.stringify(raw));
    assert.deepEqual(readLocalMaps().map(saved => saved.id), [1]);
    values.set(key, encoded);
  }
});

test('storage failures surface a Chinese error and do not report a successful save', () => {
  storage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
  } });
  assert.throws(() => saveLocalMap(draft()), /本地地图保存失败.*存储空间/);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => assert.fail('must not overwrite maps after a failed read'),
  } });
  assert.deepEqual(readLocalMaps(), []);
  assert.throws(() => saveLocalMap(draft()), /无法读取本地地图/);
});
