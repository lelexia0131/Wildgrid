import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteLocalMap, readLocalMaps, renameLocalMap, saveLocalMap } from '../src/game/localMaps';
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
  assert.deepEqual(readLocalMaps().map(saved => saved.name), ['本地地图1', '本地地图2']);
  assert.equal(saveLocalMap(map).id, 5);
  assert.deepEqual(readLocalMaps().map(saved => saved.id), [1, 4, 5]);
  values.set(key, '{broken');
  assert.deepEqual(readLocalMaps(), []);
  values.set(key, JSON.stringify({ version: 2, maps: raw.maps }));
  assert.deepEqual(readLocalMaps(), []);
});

test('deleting a middle map persists consecutive names while preserving stable ids and progress', () => {
  const values = storage(), map = draft();
  const first = saveLocalMap(map, [{ id: 'a', r: 2, c: 4, rotation: 0 }]);
  const middle = saveLocalMap(map);
  const last = saveLocalMap(map, [{ id: 'b', r: 4, c: 2, rotation: 1 }]);
  assert.equal(deleteLocalMap(middle.id), true);
  const remaining = readLocalMaps();
  assert.deepEqual(remaining.map(saved => saved.id), [first.id, last.id]);
  assert.deepEqual(remaining.map(saved => saved.name), ['本地地图1', '本地地图2']);
  assert.deepEqual(remaining[0].progress, first.progress);
  assert.deepEqual(remaining[1].progress, last.progress);
  const persisted = JSON.parse([...values.values()][0]);
  assert.deepEqual(persisted.maps.map((saved: { id: number }) => saved.id), [1, 3]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (requested: string) => values.get(requested) ?? null,
    setItem: (requested: string, value: string) => values.set(requested, value),
  } });
  assert.deepEqual(readLocalMaps(), remaining, 'reloading storage retains the deletion and remaining progress');
  const updated = saveLocalMap(map, [{ id: 'a', r: 3, c: 4, rotation: 0 }], last.id);
  assert.equal(updated.name, '本地地图2');
  assert.equal(updated.id, last.id);
  assert.deepEqual(readLocalMaps()[0], first);
  const next = saveLocalMap(map);
  assert.equal(next.id, 4);
  assert.equal(next.name, '本地地图3');
  assert.deepEqual(readLocalMaps().map(saved => saved.name), ['本地地图1', '本地地图2', '本地地图3']);
});

test('deleting missing maps leaves storage untouched and deleting all maps leaves an empty list', () => {
  const values = storage(), map = saveLocalMap(draft());
  const before = [...values.entries()];
  assert.equal(deleteLocalMap(99), false);
  assert.deepEqual([...values.entries()], before);
  assert.equal(deleteLocalMap(map.id), true);
  assert.deepEqual(readLocalMaps(), []);
  assert.equal(deleteLocalMap(map.id), false);
  assert.equal(saveLocalMap(draft()).name, '本地地图1');
});

test('custom map names are trimmed, persist across saves, and survive other map deletions', () => {
  const values = storage(), map = draft();
  const first = saveLocalMap(map), second = saveLocalMap(map, [{ id: 'a', r: 2, c: 4, rotation: 0 }]);
  renameLocalMap(second.id, '  林间营地  ');
  const named = readLocalMaps()[1];
  assert.equal(named.name, '林间营地');
  assert.equal(named.customName, '林间营地');
  assert.deepEqual(named.progress, second.progress);
  const raw = JSON.parse([...values.values()][0]);
  assert.equal(raw.maps.find((saved: { id: number }) => saved.id === second.id).customName, '林间营地');
  assert.equal(raw.maps.find((saved: { id: number }) => saved.id === second.id).name, undefined);
  const updated = saveLocalMap(map, [], second.id);
  assert.equal(updated.name, '林间营地');
  assert.equal(updated.customName, '林间营地');
  assert.equal(deleteLocalMap(first.id), true);
  assert.equal(readLocalMaps()[0].name, '林间营地');
  renameLocalMap(second.id, '  \n\t  ');
  const restored = readLocalMaps()[0];
  assert.equal(restored.name, '本地地图1');
  assert.equal(restored.customName, undefined);
  assert.equal(JSON.parse([...values.values()][0]).maps[0].customName, undefined);
  const before = [...values.entries()];
  assert.throws(() => renameLocalMap(99, '不存在的地图'), /存档不存在/);
  assert.deepEqual([...values.entries()], before);
});

test('map deletion and renaming surface storage failures without changing the saved maps', () => {
  const values = storage(), saved = saveLocalMap(draft());
  const before = [...values.entries()];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: () => { throw new Error('QuotaExceededError'); },
  } });
  assert.throws(() => deleteLocalMap(saved.id), /本地地图.*失败/);
  assert.throws(() => renameLocalMap(saved.id, '新名称'), /本地地图.*失败/);
  assert.deepEqual([...values.entries()], before);
  assert.deepEqual(readLocalMaps(), [saved]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => assert.fail('must not overwrite maps after a failed read'),
  } });
  assert.throws(() => deleteLocalMap(saved.id), /无法读取本地地图/);
  assert.throws(() => renameLocalMap(saved.id, '新名称'), /无法读取本地地图/);
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
