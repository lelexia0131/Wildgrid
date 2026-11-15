import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSandbox, createSandbox, createSession, decodeMap, dispatch, encodeMap, evaluate, getLevelById, getSolution, withEditorPlacements } from '../../src/engine';
import type { GameCommand, SandboxDraft } from '../../src/engine';
import { parseLocalMapsSave, serializeLocalMaps } from '../../src/save-system/localMapSaveCodec';
import { createSurvivalSave } from '../../src/game-modes/survival/survivalChallenge';

function balloonMap(): SandboxDraft {
  const draft = createSandbox(8, 'sky');
  return withEditorPlacements({ ...draft, level: { ...draft.level,
    terrain: [{ kind: 'water', r: 0, c: 1 }],
    sky: { ...draft.level.sky!, anchors: [{ r: 1, c: 0 }], clouds: [{ r: 7, c: 7 }] },
    pieces: [{ id: 'camp', kind: 'camp', shape: 'single' }, { id: 'balloon', kind: 'balloon', shape: 'single' }],
  } }, [{ id: 'camp', r: 1, c: 1, rotation: 0 }, { id: 'balloon', r: 1, c: 1, rotation: 0 }]);
}

test('sky sandbox is restricted to 8×8 and calculates independent layer clues', () => {
  for (const size of [6, 8] as const) assert.equal(createSandbox(size).level.sky, undefined);
  assert.throws(() => createSandbox(6, 'sky'), /8×8/);
  assert.deepEqual(createSandbox(8, 'sky').level.sky, { rows: Array(8).fill(0), cols: Array(8).fill(0), anchors: [], clouds: [] });
  const draft = balloonMap();
  assert.deepEqual(draft.level.rows, [0, 1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(draft.level.sky!.rows, draft.level.rows);
  assert.deepEqual(draft.level.sky!.cols, draft.level.cols);
  assert.equal(evaluate(draft.level, draft.placements).won, true);
  assert.equal(checkSandbox(draft).status, 'unique');
  const groundOnly = withEditorPlacements(draft, draft.placements.slice(0, 1));
  assert.deepEqual(groundOnly.level.sky!.rows, Array(8).fill(0));
  assert.deepEqual(groundOnly.level.rows, draft.level.rows);
  assert.deepEqual(groundOnly.level.sky!.anchors, draft.level.sky!.anchors);
});

test('sky blueprints round-trip all new facilities and persist both layers of local progress', () => {
  const chapter = getLevelById(60)!;
  const draft = withEditorPlacements({ level: { ...createSandbox(8, 'sky').level, terrain: chapter.terrain, pieces: chapter.pieces, sky: chapter.sky }, placements: [] }, getSolution(60)!);
  assert.deepEqual(decodeMap(encodeMap(draft)), draft);
  assert.equal(evaluate(draft.level, draft.placements).won, true);
  const balloon = balloonMap();
  const maps = [{ id: 1, name: '本地地图1', draft: balloon, progress: balloon.placements }];
  assert.deepEqual(parseLocalMapsSave(serializeLocalMaps(maps), createSurvivalSave()), maps);
});

test('sky editor terrain and facilities respect their own layer and restore through history', () => {
  let session = createSession({ mode: 'sandbox-editor', present: createSandbox(8, 'sky') });
  const apply = (command: GameCommand) => {
    const outcome = dispatch(session, command);
    assert.equal(outcome.error, null);
    session = outcome.session;
  };
  apply({ type: 'terrain', kind: 'anchor', cell: { r: 1, c: 0 } });
  apply({ type: 'terrain', kind: 'water', cell: { r: 0, c: 1 } });
  apply({ type: 'place', piece: { id: 'camp', kind: 'camp', shape: 'single' }, cell: { r: 1, c: 1 }, rotation: 0 });
  apply({ type: 'terrain', kind: 'cloud', cell: { r: 1, c: 1 } });
  assert.equal(dispatch(session, { type: 'place', piece: { id: 'balloon', kind: 'balloon', shape: 'single' }, cell: { r: 1, c: 1 }, rotation: 0 }).error?.code, 'blocked');
  apply({ type: 'terrain', layer: 'sky', cell: { r: 1, c: 1 } });
  apply({ type: 'place', piece: { id: 'balloon', kind: 'balloon', shape: 'single' }, cell: { r: 1, c: 1 }, rotation: 0 });
  assert.equal(dispatch(session, { type: 'terrain', kind: 'cloud', cell: { r: 1, c: 1 } }).error?.code, 'blocked');
  const placed = session.present;
  apply({ type: 'undo' });
  assert.equal(session.present.level.pieces.length, 1);
  apply({ type: 'redo' });
  assert.deepEqual(session.present, placed);
  apply({ type: 'remove', id: 'camp' });
  apply({ type: 'terrain', kind: 'mountain', cell: { r: 1, c: 1 } });
  apply({ type: 'terrain', kind: 'water', cell: { r: 1, c: 0 } });
  assert.deepEqual(session.present.level.sky!.anchors, []);
  apply({ type: 'terrain', kind: 'anchor', cell: { r: 1, c: 0 } });
  assert.equal(session.present.level.terrain.some(cell => cell.r === 1 && cell.c === 0), false);
  const grass = createSession({ mode: 'sandbox-editor', present: createSandbox(8) });
  assert.ok(dispatch(grass, { type: 'terrain', kind: 'anchor', cell: { r: 1, c: 0 } }).error);
  assert.ok(dispatch(grass, { type: 'place', piece: { id: 'balloon', kind: 'balloon', shape: 'single' }, cell: { r: 1, c: 1 }, rotation: 0 }).error);
});

test('sky map import rejects malformed layers, fixed cells and incompatible facilities', () => {
  const payload = JSON.parse(Buffer.from(encodeMap(balloonMap()).slice(4), 'base64url').toString('utf8'));
  const pack = (value: unknown) => `WG1:${Buffer.from(JSON.stringify(value)).toString('base64url')}`;
  for (const sky of [null, {}, { ...payload.sky, rows: [0] }, { ...payload.sky, cols: Array(8).fill(9) },
    { ...payload.sky, anchors: [{ r: 8, c: 0 }] }, { ...payload.sky, anchors: [{ r: 0, c: 1 }] },
    { ...payload.sky, clouds: [{ r: 7, c: 7 }, { r: 7, c: 7 }] }, { ...payload.sky, clouds: [{ r: 1, c: 1 }] },
    { ...payload.sky, html: '<script/>' }]) assert.throws(() => decodeMap(pack({ ...payload, sky })));
  const { sky, ...ground } = payload;
  assert.throws(() => decodeMap(pack(ground)));
  assert.throws(() => decodeMap(pack({ ...payload, s: 6 })));
  const badRules = balloonMap();
  assert.equal(checkSandbox({ ...badRules, level: { ...badRules.level, sky: { ...badRules.level.sky!, anchors: [] } } }).status, 'invalid');
});
